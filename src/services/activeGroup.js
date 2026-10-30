import { computed, ref } from 'vue'
import { getUserGroups } from './groupService'
import { onAuthChange } from './authService'

// Which group the user is currently working in. The app lets a user belong to
// several groups, but Browse and Shortlist act on one at a time, so that choice
// lives here instead of being threaded through every view.
//
// A null group is a valid state (signed out, or signed in with no group yet) —
// callers fall back to personal, device-local behaviour.

const STORAGE_KEY = 'corent-active-group'

export const activeGroup = ref(null)
export const activeGroupId = computed(() => activeGroup.value?.id ?? null)
export const groupsLoading = ref(false)
export const groupsError = ref('')

/** The user's groups, so a picker can offer them without re-querying. */
export const availableGroups = ref([])

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

/** Switches the active group. Pass null to drop back to personal mode. */
export function setActiveGroup(group) {
  activeGroup.value = group ?? null
  writeStoredId(group?.id ?? null)
}

async function resolveForUser(user) {
  if (!user) {
    availableGroups.value = []
    activeGroup.value = null
    return
  }

  groupsLoading.value = true
  groupsError.value = ''
  try {
    const groups = await getUserGroups(user.uid)
    availableGroups.value = groups

    // Prefer the remembered group, but only while the user is still a member.
    const storedId = readStoredId()
    const remembered = groups.find((group) => group.id === storedId)
    const next = remembered ?? groups[0] ?? null

    activeGroup.value = next
    writeStoredId(next?.id ?? null)
  } catch (error) {
    groupsError.value =
      error instanceof Error ? error.message : 'Unable to load the groups you belong to.'
    availableGroups.value = []
    activeGroup.value = null
  } finally {
    groupsLoading.value = false
  }
}

let started = false

/** Starts tracking the signed-in user's groups. Safe to call more than once. */
export function startActiveGroupTracking() {
  if (started) return
  started = true
  onAuthChange((user) => {
    resolveForUser(user)
  })
}

/** Re-reads the user's groups, e.g. straight after creating or joining one. */
export async function refreshGroups(user) {
  await resolveForUser(user)
}
