<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import MemberAvatar from '@/components/MemberAvatar.vue'
import { onAuthChange } from '@/services/authService'
import { availableGroups, setActiveGroup } from '@/services/activeGroup'
import { subscribeToGroupEnquiries } from '@/services/enquiryService'

/**
 * Message icon with a red count of enquiries your teammates have submitted,
 * across every group you are in. Live: it listens to the same enquiries the
 * Shortlist page writes, so a teammate's enquiry shows up within a second, and
 * a short pop-up announces it while you are online.
 *
 * What you have already seen is remembered in this browser (localStorage), so
 * no new Firestore fields are needed.
 */
const router = useRouter()
const uid = ref('')
const stopAuth = onAuthChange((user) => (uid.value = user?.uid ?? ''))

const byGroup = ref({}) // groupId -> enquiries
const listeners = new Map() // groupId -> unsubscribe
const primed = new Set() // groups whose first snapshot has arrived

/* ---------- seen state ---------- */
const seenKey = computed(() => `corent-seen-enquiries:${uid.value}`)
const seen = ref(new Set())
function loadSeen() {
  try {
    seen.value = new Set(JSON.parse(localStorage.getItem(seenKey.value) || '[]'))
  } catch {
    seen.value = new Set()
  }
}
function saveSeen() {
  try {
    localStorage.setItem(seenKey.value, JSON.stringify([...seen.value]))
  } catch {
    // Private mode or storage full: the count just resets next visit.
  }
}
watch(uid, loadSeen, { immediate: true })

/* ---------- live enquiries ---------- */
const toasts = ref([])
let toastId = 0
function toast(item) {
  const id = ++toastId
  toasts.value = [...toasts.value, { id, item }]
  setTimeout(() => (toasts.value = toasts.value.filter((t) => t.id !== id)), 6000)
}

watch(
  () => availableGroups.value.map((group) => group.id).join('|'),
  () => {
    const ids = new Set(availableGroups.value.map((group) => group.id))
    for (const [groupId, stop] of listeners) {
      if (!ids.has(groupId)) {
        stop()
        listeners.delete(groupId)
        primed.delete(groupId)
        const next = { ...byGroup.value }
        delete next[groupId]
        byGroup.value = next
      }
    }
    for (const groupId of ids) {
      if (listeners.has(groupId)) continue
      listeners.set(
        groupId,
        subscribeToGroupEnquiries(
          groupId,
          (items) => {
            const before = new Set((byGroup.value[groupId] ?? []).map((e) => e.id))
            byGroup.value = { ...byGroup.value, [groupId]: items }
            // Announce enquiries that arrive while the page is open, not the
            // ones already there when it loaded.
            if (primed.has(groupId)) {
              notifications.value
                .filter((n) => n.groupId === groupId && !before.has(n.enquiryId))
                .forEach(toast)
            }
            primed.add(groupId)
          },
          (error) => console.error('Error loading enquiry notifications:', error),
        ),
      )
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  stopAuth?.()
  listeners.forEach((stop) => stop())
  listeners.clear()
})

const memberName = (group, userId) =>
  group?.members?.find((member) => member.id === userId)?.name || 'A group member'

// Teammates' enquiries only: your own submission needs no notification.
const notifications = computed(() =>
  Object.entries(byGroup.value)
    .flatMap(([groupId, items]) => {
      const group = availableGroups.value.find((entry) => entry.id === groupId)
      return items
        .filter((item) => item.userId && item.userId !== uid.value)
        .map((item) => ({
          key: `${groupId}/${item.id}`,
          groupId,
          enquiryId: item.id,
          userId: item.userId,
          who: memberName(group, item.userId),
          photo: group?.members?.find((member) => member.id === item.userId)?.photo || '',
          listingTitle: item.listingTitle || 'a listing',
          groupName: group?.name || 'your group',
          at: item.submittedAt?.toMillis?.() ?? Date.now(),
        }))
    })
    .sort((a, b) => b.at - a.at),
)

const unread = computed(() => notifications.value.filter((n) => !seen.value.has(n.key)))

/* ---------- panel ---------- */
const open = ref(false)
const root = ref(null)

function markAllSeen() {
  notifications.value.forEach((n) => seen.value.add(n.key))
  seen.value = new Set(seen.value)
  saveSeen()
}

function toggle() {
  open.value = !open.value
  // Opening the list is reading it; the badge clears once it closes so the
  // "new" highlights are still visible while it is open.
  if (!open.value) markAllSeen()
}

function close() {
  if (!open.value) return
  open.value = false
  markAllSeen()
}

function openNotification(n) {
  setActiveGroup(n.groupId)
  close()
  toasts.value = toasts.value.filter((t) => t.item.key !== n.key)
  seen.value.add(n.key)
  saveSeen()
  router.push('/shortlist')
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
        No enquiries yet. When a teammate submits one, it appears here.
      </p>
      <ul v-else>
        <li v-for="n in notifications.slice(0, 20)" :key="n.key">
          <button type="button" class="en-item" :class="{ 'en-item--new': !seen.has(n.key) }" @click="openNotification(n)">
            <span class="en-avatar" aria-hidden="true"><MemberAvatar :uid="n.userId" :photo="n.photo" /></span>
            <span class="en-body">
              <span><strong>{{ n.who }}</strong> submitted an enquiry for <strong>{{ n.listingTitle }}</strong></span>
              <small>{{ n.groupName }} · {{ timeAgo(n.at) }}</small>
            </span>
            <span v-if="!seen.has(n.key)" class="en-dot" aria-label="New"></span>
          </button>
        </li>
      </ul>
    </div>

    <Teleport to="body">
      <div class="en-toasts" aria-live="polite">
        <div v-for="t in toasts" :key="t.id" class="en-toast" role="status">
          <span class="en-avatar" aria-hidden="true"><MemberAvatar :uid="t.item.userId" :photo="t.item.photo" /></span>
          <span class="en-body">
            <span><strong>{{ t.item.who }}</strong> submitted an enquiry for <strong>{{ t.item.listingTitle }}</strong></span>
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
  width: 360px;
  max-height: 420px;
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
  flex: none;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: linear-gradient(145deg, #e6e9fd, #fbe9f1);
}
.en-body {
  display: grid;
  flex: 1;
  gap: 2px;
  min-width: 0;
  line-height: 1.4;
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
@keyframes en-slide {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
}
</style>
