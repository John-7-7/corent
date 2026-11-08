<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import MemberAvatar from '@/components/MemberAvatar.vue'
import { onAuthChange } from '@/services/authService'
import { availableGroups, setActiveGroup } from '@/services/activeGroup'
import { getListings } from '@/services/listings'
import {
  loadNotificationState,
  mergeNotificationStates,
  saveNotificationState,
  subscribeToGroupActivity,
  subscribeToProfileUpdates,
} from '@/services/notificationService'

/**
 * The message icon in the top bar: a red count of what teammates have done in
 * any of your groups, a pop-up as it happens, and a list to catch up on.
 *
 *   enquiry submitted · comment posted · listing shortlisted · group
 *   preferences updated · a teammate changed their own preferences ·
 *   member joined · member left
 *
 * Your own actions never notify you. What you have read, and the member lists
 * used to spot joins and leaves, are saved to your private Firestore document
 * (User_Preferences/{uid}/Private/Notifications) so they follow you between
 * devices, with a copy in this browser for a fast start.
 */
const router = useRouter()
const uid = ref('')
const stopAuth = onAuthChange((user) => (uid.value = user?.uid ?? ''))

const RECENT_DAYS = 14
const MAX_ITEMS = 40

/* ---------- per-user storage ---------- */
// Kept in this browser for a fast start, and in Firestore so it follows the
// user to other devices (notificationService: loadNotificationState).
const storageKey = (name) => `corent-notify-${name}:${uid.value}`
function readStore(name, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey(name)) ?? 'null')
    return value ?? fallback
  } catch {
    return fallback
  }
}
function writeStore(name, value) {
  try {
    localStorage.setItem(storageKey(name), JSON.stringify(value))
  } catch {
    // Private mode or storage full: the Firestore copy still has it.
  }
}

const seen = ref(new Set())
// Activity from before you first opened the app counts as read, so the first
// visit is not a wall of old notifications.
const since = ref(Date.now())
const memberSnapshot = ref({}) // groupId -> { uid: name }, as last seen
const memberEvents = ref([]) // joins and leaves, which have no stored record
// When each teammate's profile was first seen; only later saves are news.
const profileBaseline = ref({})
// False until the saved state has loaded. Joins, leaves and profile baselines
// wait for it, so a stale copy in this browser cannot invent events.
const ready = ref(false)

function currentState(savedAt = Date.now()) {
  return {
    seen: [...seen.value].slice(-500),
    since: since.value,
    members: memberSnapshot.value,
    membersLog: memberEvents.value,
    profiles: profileBaseline.value,
    savedAt,
  }
}

let saveTimer = null
let pendingSave = null
function flushSave() {
  clearTimeout(saveTimer)
  saveTimer = null
  pendingSave?.()
  pendingSave = null
}
// Saves locally straight away and to Firestore shortly after, batching bursts.
function persist() {
  if (!ready.value || !uid.value) return
  const id = uid.value
  const state = currentState()
  writeStore('seen', state.seen)
  writeStore('since', state.since)
  writeStore('members', state.members)
  writeStore('members-log', state.membersLog)
  writeStore('profiles', state.profiles)
  writeStore('saved-at', state.savedAt)
  clearTimeout(saveTimer)
  pendingSave = () =>
    saveNotificationState(id, state).catch((error) =>
      console.error('Could not save notification state:', error),
    )
  saveTimer = setTimeout(flushSave, 1500)
}

watch(
  uid,
  async (id) => {
    flushSave()
    ready.value = false
    if (!id) return
    const local = {
      seen: readStore('seen', []),
      since: readStore('since', null),
      members: readStore('members', {}),
      membersLog: readStore('members-log', []),
      profiles: readStore('profiles', {}),
      savedAt: readStore('saved-at', 0),
    }
    // Carry over enquiries already read with the earlier enquiry-only icon.
    try {
      JSON.parse(localStorage.getItem(`corent-seen-enquiries:${id}`) || '[]').forEach((key) => {
        const [groupId, enquiryId] = key.split('/')
        local.seen.push(`${groupId}/enquiry/${enquiryId}`)
      })
    } catch {
      /* nothing to carry over */
    }
    let state = local
    try {
      state = mergeNotificationStates(local, await loadNotificationState(id))
    } catch (error) {
      // Offline or refused: carry on with this browser's copy.
      console.error('Could not load notification state:', error)
    }
    if (uid.value !== id) return // signed out or switched while loading
    seen.value = new Set(state.seen)
    since.value = state.since ?? Date.now()
    memberSnapshot.value = state.members
    memberEvents.value = state.membersLog
    profileBaseline.value = state.profiles
    ready.value = true
    persist()
  },
  { immediate: true },
)
const onPageHide = () => flushSave()
window.addEventListener('pagehide', onPageHide)

/* ---------- joins and leaves ---------- */
watch(
  [availableGroups, uid, ready],
  ([groups, me, isReady]) => {
    if (!me || !isReady) return
    const snapshot = memberSnapshot.value
    // Groups not loaded yet keep their last known members, so a page load
    // never forgets who was there.
    const next = { ...snapshot }
    const fresh = []
    for (const group of groups) {
      const current = Object.fromEntries(
        (group.members ?? []).map((member) => [member.id, member.name || 'A member']),
      )
      for (const id of group.memberIds ?? []) current[id] ??= 'A member'
      const before = snapshot[group.id]
      // A group seen for the first time is the baseline, not a burst of joins.
      if (before) {
        const at = Date.now()
        for (const [id, name] of Object.entries(current)) {
          if (!(id in before) && id !== me) fresh.push({ key: `${group.id}/join/${id}/${at}`, type: 'join', groupId: group.id, actorId: id, actorName: name, at })
        }
        for (const [id, name] of Object.entries(before)) {
          if (!(id in current) && id !== me) fresh.push({ key: `${group.id}/leave/${id}/${at}`, type: 'leave', groupId: group.id, actorId: id, actorName: name, at })
        }
      }
      next[group.id] = current
    }
    const changed = JSON.stringify(next) !== JSON.stringify(snapshot)
    memberSnapshot.value = next
    if (fresh.length) {
      memberEvents.value = [...fresh, ...memberEvents.value].slice(0, 50)
      fresh.forEach(announce)
    }
    if (changed || fresh.length) persist()
  },
  { immediate: true },
)

/* ---------- live group activity ---------- */
const activity = ref({}) // groupId -> events
const groupStops = new Map()
const primed = new Set()

watch(
  () => availableGroups.value.map((group) => group.id).join('|'),
  () => {
    const ids = new Set(availableGroups.value.map((group) => group.id))
    for (const [groupId, stop] of groupStops) {
      if (ids.has(groupId)) continue
      stop()
      groupStops.delete(groupId)
      primed.delete(groupId)
      const rest = { ...activity.value }
      delete rest[groupId]
      activity.value = rest
    }
    for (const groupId of ids) {
      if (groupStops.has(groupId)) continue
      groupStops.set(
        groupId,
        subscribeToGroupActivity(
          groupId,
          (events) => {
            const known = new Set((activity.value[groupId] ?? []).map((event) => event.key))
            activity.value = { ...activity.value, [groupId]: events }
            // Pop up only what arrives while the page is open.
            if (primed.has(groupId)) events.filter((event) => !known.has(event.key)).forEach(announceEvent)
            else setTimeout(() => primed.add(groupId), 1500)
          },
          (error) => console.error('Error loading group activity:', error),
        ),
      )
    }
  },
  { immediate: true },
)

/* ---------- teammates' own preferences ---------- */
const profileEvents = ref({}) // uid -> event
const profileStops = new Map()
const profilePrimed = new Set()

const teammates = computed(() => {
  const ids = new Set()
  availableGroups.value.forEach((group) => (group.memberIds ?? []).forEach((id) => ids.add(id)))
  ids.delete(uid.value)
  return ids
})
// Nobody is watched until the saved baselines have loaded.
const watchedTeammates = computed(() => (ready.value ? teammates.value : new Set()))
watch(
  () => [...watchedTeammates.value].sort().join('|'),
  () => {
    for (const [id, stop] of profileStops) {
      if (watchedTeammates.value.has(id)) continue
      stop()
      profileStops.delete(id)
      profilePrimed.delete(id)
      const rest = { ...profileEvents.value }
      delete rest[id]
      profileEvents.value = rest
    }
    for (const id of watchedTeammates.value) {
      if (profileStops.has(id)) continue
      profileStops.set(
        id,
        subscribeToProfileUpdates(
          id,
          (event) => {
            const previous = profileEvents.value[id]
            // The first time someone is your teammate, their existing profile
            // is the starting point, not news. Later saves are.
            if (event && !(id in profileBaseline.value)) {
              profileBaseline.value = { ...profileBaseline.value, [id]: event.at }
              persist()
            }
            profileEvents.value = { ...profileEvents.value, [id]: event }
            if (profilePrimed.has(id) && event && event.key !== previous?.key) announceEvent(event)
            profilePrimed.add(id)
          },
          () => {},
        ),
      )
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  stopAuth?.()
  flushSave()
  window.removeEventListener('pagehide', onPageHide)
  groupStops.forEach((stop) => stop())
  profileStops.forEach((stop) => stop())
})

/* ---------- presentation ---------- */
const listingTitles = ref(new Map())
getListings()
  .then((all) => (listingTitles.value = new Map(all.map((l) => [l.ListingID, l.Title]))))
  .catch(() => {})

const groupOf = (groupId) => availableGroups.value.find((group) => group.id === groupId)
const nameOf = (event) => {
  if (event.actorName) return event.actorName
  const groups = event.groupId ? [groupOf(event.groupId)] : availableGroups.value
  for (const group of groups) {
    const member = group?.members?.find((entry) => entry.id === event.actorId)
    if (member?.name) return member.name
  }
  return 'A teammate'
}
const photoOf = (actorId) => {
  for (const group of availableGroups.value) {
    const member = group.members?.find((entry) => entry.id === actorId)
    if (member) return member.photo || ''
  }
  return ''
}
// A teammate's own profile belongs to no single group: name the first shared one.
const groupFor = (event) =>
  event.groupId ? groupOf(event.groupId) : availableGroups.value.find((group) => group.memberIds?.includes(event.actorId))

const TYPES = {
  enquiry: { icon: 'message', tone: 'red', tab: 'shortlist' },
  comment: { icon: 'message', tone: 'blue', tab: 'shortlist' },
  shortlist: { icon: 'bookmark', tone: 'blue', tab: 'shortlist' },
  prefs: { icon: 'users', tone: 'amber', tab: 'summary' },
  profile: { icon: 'user', tone: 'amber', tab: 'summary' },
  join: { icon: 'plus', tone: 'green', tab: 'group' },
  leave: { icon: 'minus', tone: 'grey', tab: 'group' },
}

function describe(event) {
  const group = groupFor(event)
  const listing = event.listingTitle || listingTitles.value.get(event.listingId) || 'a listing'
  const groupName = group?.name || 'your group'
  switch (event.type) {
    case 'enquiry': return { action: 'submitted an enquiry for', object: listing }
    case 'comment': return { action: 'commented on', object: listing, quote: event.snippet }
    case 'shortlist': return { action: 'shortlisted', object: listing }
    case 'prefs': return { action: 'updated the agreed preferences of', object: groupName }
    case 'profile': return { action: 'changed their rental preferences', object: '' }
    case 'join': return { action: 'joined', object: groupName }
    case 'leave': return { action: 'left', object: groupName }
    default: return { action: 'did something in', object: groupName }
  }
}

const cutoff = () => Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000
const notifications = computed(() =>
  [
    ...Object.values(activity.value).flat(),
    ...Object.values(profileEvents.value).filter(
      (event) => event && event.at > (profileBaseline.value[event.actorId] ?? Infinity),
    ),
    ...memberEvents.value.filter((event) => availableGroups.value.some((group) => group.id === event.groupId)),
  ]
    .filter((event) => event.actorId && event.actorId !== uid.value && event.at >= cutoff())
    .sort((a, b) => b.at - a.at)
    .slice(0, MAX_ITEMS)
    .map((event) => ({
      ...event,
      who: nameOf(event),
      photo: photoOf(event.actorId),
      groupName: groupFor(event)?.name || '',
      ...describe(event),
      ...TYPES[event.type],
    })),
)

const isUnread = (n) => !seen.value.has(n.key) && n.at >= since.value
const unread = computed(() => notifications.value.filter(isUnread))

/* ---------- pop-ups ---------- */
const toasts = ref([])
let toastId = 0
function announceEvent(event) {
  if (!event.actorId || event.actorId === uid.value) return
  announce(event)
}
function announce(event) {
  // Rendered from the formatted list so names and titles match the panel.
  setTimeout(() => {
    const item = notifications.value.find((n) => n.key === event.key)
    if (!item) return
    const id = ++toastId
    toasts.value = [...toasts.value, { id, item }].slice(-3)
    setTimeout(() => (toasts.value = toasts.value.filter((t) => t.id !== id)), 6000)
  })
}

/* ---------- panel ---------- */
const open = ref(false)
const root = ref(null)

function markAllSeen() {
  notifications.value.forEach((n) => seen.value.add(n.key))
  seen.value = new Set(seen.value)
  persist()
}
function toggle() {
  open.value = !open.value
  // The highlights stay while the list is open; the count clears on close.
  if (!open.value) markAllSeen()
}
function close() {
  if (!open.value) return
  open.value = false
  markAllSeen()
}

function openNotification(n) {
  const group = groupFor(n)
  if (group) setActiveGroup(group.id)
  close()
  toasts.value = toasts.value.filter((t) => t.item.key !== n.key)
  seen.value.add(n.key)
  persist()
  if (n.tab === 'group' && group) router.push(`/groups/${group.id}`)
  else router.push(n.tab === 'summary' ? '/group-summary' : '/shortlist')
}

function onDocumentClick(event) {
  if (open.value && root.value && !root.value.contains(event.target)) close()
}
function onKeydown(event) {
  if (event.key === 'Escape') close()
}
onMounted(() => {
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onKeydown)
})

const relative = new Intl.RelativeTimeFormat('en-SG', { numeric: 'auto' })
function timeAgo(ms) {
  const minutes = Math.round((ms - Date.now()) / 60000)
  if (Math.abs(minutes) < 1) return 'just now'
  if (Math.abs(minutes) < 60) return relative.format(minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return relative.format(hours, 'hour')
  return relative.format(Math.round(hours / 24), 'day')
}
</script>

<template>
  <div ref="root" class="en">
    <button
      type="button"
      class="en-trigger"
      :aria-expanded="open"
      aria-haspopup="dialog"
      :aria-label="unread.length ? `Notifications, ${unread.length} new` : 'Notifications'"
      @click="toggle"
    >
      <AppIcon name="message" :size="20" />
      <span v-if="unread.length" class="en-count" aria-hidden="true">{{ unread.length > 9 ? '9+' : unread.length }}</span>
    </button>

    <div v-if="open" class="en-panel" role="dialog" aria-label="Notifications">
      <p class="en-head">
        Notifications
        <button v-if="unread.length" type="button" class="link" @click="markAllSeen">Mark all as read</button>
      </p>
      <p v-if="!notifications.length" class="en-empty">
        Nothing yet. When a teammate joins, leaves, shortlists, comments, changes preferences or submits an
        enquiry, it shows up here.
      </p>
      <ul v-else>
        <li v-for="n in notifications" :key="n.key">
          <button type="button" class="en-item" :class="{ 'en-item--new': isUnread(n) }" @click="openNotification(n)">
            <span class="en-avatar" aria-hidden="true">
              <MemberAvatar :uid="n.actorId" :photo="n.photo" />
              <span class="en-type" :class="`en-type--${n.tone}`"><AppIcon :name="n.icon" :size="9" /></span>
            </span>
            <span class="en-body">
              <span>
                <strong>{{ n.who }}</strong> {{ n.action }}
                <strong v-if="n.object">{{ n.object }}</strong>
              </span>
              <q v-if="n.quote">{{ n.quote }}</q>
              <small>
                <template v-if="n.groupName && n.groupName !== n.object">{{ n.groupName }} · </template>{{ timeAgo(n.at) }}
              </small>
            </span>
            <span v-if="isUnread(n)" class="en-dot" aria-label="New"></span>
          </button>
        </li>
      </ul>
    </div>

    <Teleport to="body">
      <div class="en-toasts" aria-live="polite">
        <div v-for="t in toasts" :key="t.id" class="en-toast" :class="`en-toast--${t.item.tone}`" role="status">
          <span class="en-avatar" aria-hidden="true">
            <MemberAvatar :uid="t.item.actorId" :photo="t.item.photo" />
            <span class="en-type" :class="`en-type--${t.item.tone}`"><AppIcon :name="t.item.icon" :size="9" /></span>
          </span>
          <span class="en-body">
            <span>
              <strong>{{ t.item.who }}</strong> {{ t.item.action }}
              <strong v-if="t.item.object">{{ t.item.object }}</strong>
            </span>
            <small>{{ t.item.groupName }}</small>
          </span>
          <button type="button" class="link" @click="openNotification(t.item)">View</button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.en {
  position: relative;
}
.en-trigger {
  position: relative;
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  border: 1px solid var(--line);
  border-radius: 50%;
  background: rgb(255 255 255 / 80%);
  box-shadow: 0 2px 10px rgb(42 45 62 / 8%);
  color: var(--text);
  cursor: pointer;
  backdrop-filter: var(--glass-blur);
}
.en-trigger:hover {
  border-color: var(--red);
  color: var(--red-dark);
}
.en-count {
  position: absolute;
  top: -3px;
  right: -3px;
  display: grid;
  place-items: center;
  min-width: 20px;
  height: 20px;
  padding: 0 5px;
  border: 2px solid #fff;
  border-radius: 999px;
  background: #e5484d;
  color: #fff;
  font-size: 11px;
  font-weight: 800;
  animation: en-pop 0.25s ease;
}
@keyframes en-pop {
  from {
    transform: scale(0.4);
  }
}
.en-panel {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 20;
  width: 380px;
  max-height: 460px;
  overflow-y: auto;
  padding: 10px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 16px 40px rgb(42 45 62 / 18%);
}
.en-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 2px 6px 8px;
  color: var(--muted);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.en-head .link {
  font-size: 11px;
  letter-spacing: 0;
  text-transform: none;
}
.en-empty {
  margin: 8px 6px 10px;
  color: var(--muted);
  font-size: 12.5px;
  line-height: 1.5;
}
.en-panel ul {
  display: grid;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.en-item {
  display: flex;
  gap: 10px;
  align-items: center;
  width: 100%;
  padding: 9px 8px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--text);
  font-size: 12.5px;
  text-align: left;
  cursor: pointer;
}
.en-item:hover {
  background: var(--soft);
}
.en-item--new {
  background: rgb(229 72 77 / 6%);
}
.en-avatar {
  position: relative;
  flex: none;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: linear-gradient(145deg, #e6e9fd, #fbe9f1);
}
.en-type {
  position: absolute;
  right: -3px;
  bottom: -3px;
  display: grid;
  place-items: center;
  width: 16px;
  height: 16px;
  border: 1.5px solid #fff;
  border-radius: 50%;
  color: #fff;
}
.en-type--red {
  background: #e5484d;
}
.en-type--blue {
  background: var(--red);
}
.en-type--amber {
  background: #d99a1e;
}
.en-type--green {
  background: var(--ok);
}
.en-type--grey {
  background: #8a8fa3;
}
.en-body {
  display: grid;
  flex: 1;
  gap: 2px;
  min-width: 0;
  line-height: 1.4;
}
.en-body q {
  overflow: hidden;
  color: var(--muted);
  font-style: italic;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.en-body small {
  color: var(--muted);
  font-size: 11px;
}
.en-dot {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #e5484d;
}
.en-toasts {
  position: fixed;
  top: 76px;
  right: 20px;
  z-index: 60;
  display: grid;
  gap: 8px;
  width: min(360px, calc(100vw - 32px));
}
.en-toast {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 12px;
  border: 1px solid var(--line);
  border-left: 4px solid #e5484d;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 12px 30px rgb(42 45 62 / 18%);
  color: var(--text);
  font-size: 12.5px;
  animation: en-slide 0.25s ease;
}
.en-toast--blue {
  border-left-color: var(--red);
}
.en-toast--amber {
  border-left-color: #d99a1e;
}
.en-toast--green {
  border-left-color: var(--ok);
}
.en-toast--grey {
  border-left-color: #8a8fa3;
}
@keyframes en-slide {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
}
</style>
