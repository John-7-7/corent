import { computed, ref } from 'vue'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '@/firebase'
import { getUserGroups } from './groupService'
import { onAuthChange } from './authService'

// Which group the user is currently working in. The app lets a user belong to
// several groups, but Browse and Shortlist act on one at a time, so that choice
// lives here instead of being threaded through every view.
//
// This is the single source of truth for the signed-in user's groups. Every
// group here has exactly the shape groupService returns ({ id, ...the
// Firestore document }), and the list is kept live with a listener, so a member
// joining or leaving shows up on every page without a reload. Pages read from
// here rather than keeping their own copy: separate copies in different shapes
// is how the active group used to lose its members' photos and outlive a group
// the user had left.
//
// A null group is a valid state (signed out, or signed in with no group yet):
// callers fall back to personal, device-local behaviour.

const STORAGE_KEY = 'corent-active-group'

/** The user's groups, live. */
export const availableGroups = ref([])
export const groupsLoading = ref(false)
export const groupsError = ref('')

const selectedId = ref(readStoredId())

// The remembered group while the user is still a member of it, otherwise their
// first group, otherwise none.
export const activeGroup = computed(
  () =>
    availableGroups.value.find((group) => group.id === selectedId.value) ??
    availableGroups.value[0] ??
    null,
)
export const activeGroupId = computed(() => activeGroup.value?.id ?? null)

function readStoredId() {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function writeStoredId(id) {
  try {
    if (id) localStorage.setItem(STORAGE_KEY, id)
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // A blocked localStorage only costs us the remembered choice, so carry on.
  }
}

/**
 * Switches the active group. Accepts a group object or a group id. A group the
 * live list has not caught up with yet (e.g. one created a moment ago) is added
 * provisionally so the switch is immediate; the listener replaces it shortly.
 */
export function setActiveGroup(groupOrId) {
  const id = typeof groupOrId === 'string' ? groupOrId : (groupOrId?.id ?? null)
  if (
    groupOrId &&
    typeof groupOrId === 'object' &&
    !availableGroups.value.some((group) => group.id === id)
  ) {
    availableGroups.value = [...availableGroups.value, groupOrId]
  }
  selectedId.value = id
  writeStoredId(id)
}

/**
 * Drops a group the user has just left or deleted, straight away, so nothing
 * keeps listening to a group they no longer have access to while the listener
 * catches up.
 */
export function forgetGroup(groupId) {
  availableGroups.value = availableGroups.value.filter((group) => group.id !== groupId)
  if (selectedId.value === groupId) {
    selectedId.value = availableGroups.value[0]?.id ?? null
    writeStoredId(selectedId.value)
  }
}

let unsubscribeGroups = null
let currentUser = null

function watchUserGroups(user) {
  unsubscribeGroups?.()
  unsubscribeGroups = null
  currentUser = user
  groupsError.value = ''

  if (!user) {
    availableGroups.value = []
    groupsLoading.value = false
    return
  }

  groupsLoading.value = true
  unsubscribeGroups = onSnapshot(
    query(collection(db, 'groups'), where('memberIds', 'array-contains', user.uid)),
    (snapshot) => {
      availableGroups.value = snapshot.docs.map((groupDoc) => ({
        id: groupDoc.id,
        ...groupDoc.data(),
      }))
      groupsLoading.value = false
      groupsError.value = ''
    },
    (error) => {
      groupsError.value =
        error instanceof Error ? error.message : 'Unable to load the groups you belong to.'
      availableGroups.value = []
      groupsLoading.value = false
    },
  )
}

let started = false

/** Starts tracking the signed-in user's groups. Safe to call more than once. */
export function startActiveGroupTracking() {
  if (started) return
  started = true
  onAuthChange(watchUserGroups)
}

/**
 * Re-reads the user's groups once, e.g. straight after joining one, so the
 * caller does not have to wait for the listener. The listener stays in charge.
 */
export async function refreshGroups(user = currentUser) {
  if (!user) return
  try {
    availableGroups.value = await getUserGroups(user.uid)
  } catch (error) {
    groupsError.value =
      error instanceof Error ? error.message : 'Unable to load the groups you belong to.'
  }
}
