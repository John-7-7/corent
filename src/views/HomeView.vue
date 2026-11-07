<script setup>
import { computed, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import AppIcon from '@/components/AppIcon.vue'
import GroupCard from '@/components/groups/GroupCard.vue'
import { onAuthChange } from '@/services/authService'
import { getListings } from '@/services/listings'
import { useGroupScoring } from '@/services/useGroupScoring'
import {createGroup as createGroupInFirestore, getUserGroups, joinGroupByInviteCode,} from '@/services/groupService.js'
import { activeGroupId, refreshGroups, setActiveGroup } from '@/services/activeGroup'

const router = useRouter()

const currentUser = ref(null)
const groups = ref([])
const selectedGroup = ref(null)
const activeDialog = ref('')
const groupName = ref('')
const inviteCode = ref('')
const groupError = ref('')
const dashboardError = ref('')
const groupActionLoading = ref(false)

const firstName = computed(
  () =>
    currentUser.value?.displayName?.trim().split(/\s+/)[0] ||
    'there',
)

// Top picks were two hardcoded percentages (94% and 87%) against invented
// listings. Everything else in the app refuses to show a score it cannot
// compute, so these are real listings scored the same way Browse scores them.
// With no group or no agreed preferences there is no basis for a match, so the
// section falls back to the cheapest listings and shows no percentage at all.
const allListings = ref([])
getListings()
  .then((data) => (allListings.value = data))
  .catch(() => (allListings.value = []))

const { scoredById, canScore } = useGroupScoring(allListings)

// Photo URLs that failed to load, so the gradient shows instead of a broken
// image icon. Vue tracks Set mutations, so add() re-renders.
const brokenImages = ref(new Set())

const picks = computed(() => {
  const available = allListings.value.filter((l) => l.IsAvailable)
  const ranked = canScore.value
    ? available
        .map((l) => ({ listing: l, score: scoredById.value.get(l.ListingID)?.score ?? null }))
        .filter((e) => e.score !== null)
        .sort((a, b) => b.score - a.score)
    : [...available].sort((a, b) => a.MonthlyRent - b.MonthlyRent).map((l) => ({ listing: l, score: null }))

  return ranked.slice(0, 3).map(({ listing, score }, index) => ({
    id: listing.ListingID,
    title: listing.Title,
    price: `$${listing.MonthlyRent.toLocaleString('en-SG')}`,
    area: listing.Neighbourhood ?? listing.Region ?? '',
    match: score,
    image: listing.ImageURL ?? null,
    tone: ['', 'alt', 'cool'][index],
  }))
})

const picksHeading = computed(() =>
  canScore.value ? 'Top picks for your group' : 'Lowest rent right now',
)

function getErrorMessage(error, fallbackMessage) {
  return error instanceof Error
    ? error.message
    : fallbackMessage
}

async function loadGroups(user = currentUser.value) {
  dashboardError.value = ''

  if (!user?.uid) {
    groups.value = []
    return
  }

  try {
    groups.value = await getUserGroups(user.uid)
  } catch (error) {
    groups.value = []
    dashboardError.value = getErrorMessage(
      error,
      'Unable to load your groups.',
    )
  }
}

function openDialog(dialog) {
  activeDialog.value = dialog
  groupError.value = ''
  groupName.value = ''
  inviteCode.value = ''
}

function closeDialog() {
  activeDialog.value = ''
  groupError.value = ''
}

async function createGroup() {
  groupError.value = ''

  if (!currentUser.value) {
    groupError.value = 'You must be signed in to create a group.'
    return
  }

  groupActionLoading.value = true

  try {
    const created = await createGroupInFirestore(
      groupName.value,
      currentUser.value,
    )

    await loadGroups()
    await refreshGroups(currentUser.value)
    setActiveGroup(created)
    closeDialog()
  } catch (error) {
    groupError.value = getErrorMessage(
      error,
      'Unable to create the group.',
    )
  } finally {
    groupActionLoading.value = false
  }
}

async function joinGroup() {
  groupError.value = ''

  if (!currentUser.value) {
    groupError.value = 'You must be signed in to join a group.'
    return
  }

  groupActionLoading.value = true

  try {
    await joinGroupByInviteCode(
      inviteCode.value,
      currentUser.value,
    )

    await loadGroups()
    await refreshGroups(currentUser.value)
    closeDialog()
  } catch (error) {
    groupError.value = getErrorMessage(
      error,
      'Unable to join the group.',
    )
  } finally {
    groupActionLoading.value = false
  }
}

function openGroupPreview(groupId) {
  selectedGroup.value =
    groups.value.find((group) => group.id === groupId) || null

  if (selectedGroup.value) {
    activeDialog.value = 'preview'
  }
}

function viewGroupDetails() {
  if (!selectedGroup.value) return

  const groupId = selectedGroup.value.id

  // Opening a group is also how you switch to it. Browse and Shortlist score
  // against one group at a time, and until this call existed the only way the
  // active group was ever set was by creating one — so a user in several
  // groups was stuck scoring against whichever Firestore happened to return
  // first, with no way to change it and nothing on screen saying which.
  setActiveGroup(selectedGroup.value)

  closeDialog()

  router.push({
    name: 'group-details',
    params: { groupId },
  })
}

const unsubscribeAuth = onAuthChange(async (user) => {
  currentUser.value = user
  await loadGroups(user)
})

onUnmounted(unsubscribeAuth)
</script>

<template>
  <div>
    <header class="page-head">
      <h1>Dashboard</h1>
      <p>Welcome back, {{ firstName }}.</p>
    </header>

    <div class="content">
      <div class="stack">
        <p v-if="dashboardError" class="field-error" role="alert">{{ dashboardError }}</p>

        <div class="actions">
          <button class="action action-primary" type="button" @click="openDialog('create')">
            <AppIcon name="plus" :size="16" />
            <strong>Create Group</strong>
            <span>Start a new hunt</span>
          </button>
          <button class="action" type="button" @click="openDialog('join')">
            <span class="red"><AppIcon name="users" :size="16" /></span>
            <strong>Join a Group</strong>
            <span>Use an invite code</span>
          </button>
          <router-link class="action" to="/listings">
            <span class="red"><AppIcon name="search" :size="16" /></span>
            <strong>Browse Solo</strong>
            <span>Explore listings</span>
          </router-link>
        </div>

        <section class="card between" aria-label="My preferences">
          <div>
            <p class="eyebrow">My preferences</p>
            <p class="pref-line">Set your budget, move-in date, and home requirements.</p>
          </div>
          <router-link class="link edit" :to="{ path: '/preferences', query: { edit: '1' } }">
            <AppIcon name="edit" :size="13" /> Edit
          </router-link>
        </section>

        <section class="group-section" aria-labelledby="groups-title">
          <div class="between">
            <h2 id="groups-title" class="section-title">My Groups</h2>
            <span class="small muted">{{ groups.length }} {{ groups.length === 1 ? 'group' : 'groups' }}</span>
          </div>

          <div v-if="groups.length" class="group-list">
            <GroupCard
              v-for="group in groups"
              :key="group.id"
              :group="group"
              :active="group.id === activeGroupId"
              @view-group="openGroupPreview"
            />
          </div>
          <article v-else class="card empty-groups">
            <span class="empty-icon"><AppIcon name="users" :size="20" /></span>
            <h3>You haven’t joined a group yet</h3>
            <p>Create a group for your house hunt or join one with an invite code.</p>
            <button class="btn btn-primary btn-sm" type="button" @click="openDialog('create')">
              Create your first group
            </button>
          </article>
          <p class="hint">Your rental groups are shared securely with members only.</p>
        </section>

        <div class="between">
          <h2 class="section-title">{{ picksHeading }}</h2>
          <router-link class="link" to="/listings">See all</router-link>
        </div>
        <p v-if="!canScore && picks.length" class="small muted" style="margin: -4px 0 10px">
          Agree your group's preferences to see which listings actually fit.
        </p>
        <article v-for="pick in picks" :key="pick.id" class="pick">
          <!-- The gradient is the fallback, not the design: 99.co photo URLs
               are signed and expire, so a dead one falls back to it. -->
          <div class="thumb" :class="pick.tone" aria-hidden="true">
            <img
              v-if="pick.image && !brokenImages.has(pick.id)"
              :src="pick.image"
              alt=""
              loading="lazy"
              @error="brokenImages.add(pick.id)"
            />
          </div>
          <div class="pick-body">
            <div class="between" style="align-items: flex-start">
              <h3>{{ pick.title }}</h3>
              <span v-if="pick.match !== null" class="pill">{{ pick.match }}%</span>
            </div>
            <p class="price">{{ pick.price }}<span class="muted">/mo</span></p>
            <p class="small muted row-inline"><AppIcon name="pin" :size="11" /> {{ pick.area }}</p>
          </div>
        </article>
      </div>
    </div>

    <div v-if="activeDialog" class="modal-backdrop" @click.self="closeDialog">
      <section
        class="modal group-modal"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="
          activeDialog === 'create'
            ? 'create-group-title'
            : activeDialog === 'join'
              ? 'join-group-title'
              : 'group-preview-title'
        "
      >
        <div class="between modal-heading">
          <div>
            <h2 v-if="activeDialog === 'create'" id="create-group-title">Create a group</h2>
            <h2 v-else-if="activeDialog === 'join'" id="join-group-title">Join a group</h2>
            <h2 v-else id="group-preview-title">Group preview</h2>
            <p class="small muted">
              {{
                activeDialog === 'create'
                  ? 'Give your house hunt a name.'
                  : activeDialog === 'join'
                    ? 'Enter the six-digit invite code.'
                    : 'Review your group before exploring its summary.'
              }}
            </p>
          </div>
          <button class="icon-btn" type="button" aria-label="Close" @click="closeDialog">
            <AppIcon name="x" :size="18" />
          </button>
        </div>

        <form v-if="activeDialog === 'create'" @submit.prevent="createGroup">
          <div class="field">
            <label for="group-name">Group name</label>
            <input
              id="group-name"
              v-model="groupName"
              class="input"
              type="text"
              maxlength="48"
              placeholder="e.g. Our first flat"
              required
            />
          </div>
          <p v-if="groupError" class="field-error" role="alert">{{ groupError }}</p>
          <button class="btn btn-primary btn-block" type="submit" :disabled="groupActionLoading"> {{ groupActionLoading ? 'Creating…' : 'Create group' }} </button>
        </form>

        <form v-else-if="activeDialog === 'join'" @submit.prevent="joinGroup">
          <div class="field">
            <label for="group-invite-code">Invite code</label>
            <input
              id="group-invite-code"
              v-model="inviteCode"
              class="input"
              type="text"
              inputmode="numeric"
              maxlength="6"
              autocomplete="off"
              placeholder="000000"
              required
            />
          </div>
          <p v-if="groupError" class="field-error" role="alert">{{ groupError }}</p>
          <button class="btn btn-primary btn-block" type="submit" :disabled="groupActionLoading"> {{ groupActionLoading ? 'Joining…' : 'Join group' }} </button>
        </form>
        <div v-else-if="selectedGroup" class="preview-details">
          <div class="preview-detail">
            <span>Group name</span>
            <strong>{{ selectedGroup.name }}</strong>
          </div>
          <div class="preview-detail">
            <span>Members</span>
            <strong>{{ selectedGroup.memberCount }}</strong>
          </div>
          <div class="preview-detail">
            <span>Invite code</span>
            <strong class="invite-code">{{ selectedGroup.inviteCode }}</strong>
          </div>
          <p class="hint">Open group details to view its members and invitation link.</p>
             <div class="preview-actions">
              <button
                class="btn btn-block"
                type="button"
                @click="closeDialog"
              >
                Close
              </button>

              <button
                class="btn btn-primary btn-block"
                type="button"
                @click="viewGroupDetails"
              >
                View group details
              </button>
            </div>           
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
}

.action {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  min-width: 0;
  text-align: left;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 0.9rem;
  color: var(--text);
  font: inherit;
  cursor: pointer;
  text-decoration: none;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.action strong { font-size: 13px; margin-top: 0.5rem; }
.action span { font-size: 11px; color: var(--muted); }
.action-primary { background: var(--red); border-color: var(--red); color: #fff; }
.action-primary span { color: #f6d3d3; }
.action-primary:hover { background: var(--red-dark); }

.pref-line { font-size: 12.5px; margin-top: 0.3rem; }
.edit { display: inline-flex; align-items: center; gap: 0.25rem; }
.row-inline { display: inline-flex; align-items: center; gap: 0.25rem; }

.group-section { display: grid; gap: 0.7rem; }
.group-list { display: grid; gap: 0.65rem; }
.empty-groups { display: grid; justify-items: center; gap: 0.55rem; text-align: center; padding: 1.4rem; }
.empty-groups p { max-width: 300px; color: var(--muted); font-size: 12px; }
.empty-groups h3 { font-size: 13px; }
.empty-icon { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 50%; background: var(--red-tint); color: var(--red); }
.group-section .hint { margin-top: -0.3rem; }

.pick {
  display: flex;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}
.pick .thumb { width: 64px; min-height: 64px; overflow: hidden; border-radius: 8px; }
.pick .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.pick-body { flex: 1; min-width: 0; padding: 0.65rem 0.8rem; display: grid; gap: 2px; }
.price { color: var(--red); font-weight: 700; font-size: 13px; }
.price span { font-weight: 400; font-size: 11px; }

.group-modal { display: grid; gap: 1.2rem; }
.modal-heading { align-items: flex-start; }
.modal-heading > div { display: grid; gap: 0.25rem; }
.group-modal .field { margin: 0; }
.group-modal .field-error { margin: -0.7rem 0 0; }
.preview-details { display: grid; gap: 0.85rem; }
.preview-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;}
.preview-detail { display: grid; gap: 0.2rem; }
.preview-detail span { color: var(--muted); font-size: 11px; }
.preview-detail strong { font-size: 13px; }
.invite-code { letter-spacing: 0.1em; }

@media (max-width: 560px) {
  .actions { grid-template-columns: 1fr 1fr; }
  .actions .action:last-child { grid-column: 1 / -1; }
}
</style>
