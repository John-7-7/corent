import { computed, ref, watch } from 'vue'
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore'
import { auth, db } from '../firebase'
import { activeGroup, activeGroupId, startActiveGroupTracking } from './activeGroup'

/**
 * The shortlist of listings a group is considering (F-REQ-016).
 *
 * Two modes, one API:
 *   - group mode    — groups/{groupId}/shortlist, live for every member
 *   - personal mode — localStorage, used when the user has no group yet
 *
 * Entries are keyed by ListingID, so two members saving the same property
 * converge on one entry instead of creating duplicates.
 */

const STORAGE_KEY = 'corent-shortlist'

// [{ listingId, addedBy, addedByName, addedAt }]
const entries = ref([])
const storageError = ref('')
const loading = ref(false)

const listingIds = computed(() => entries.value.map((entry) => entry.listingId))
const isGroupMode = computed(() => activeGroupId.value !== null)

let unsubscribeSnapshot = null

/* ---------------- personal mode (localStorage) ---------------- */

function parseStoredIds(raw) {
  if (!raw) return []
  const parsed = JSON.parse(raw)
  if (!Array.isArray(parsed) || !parsed.every((id) => typeof id === 'string')) {
    throw new Error('Saved shortlist data is invalid.')
  }
  return parsed
}

const toLocalEntry = (listingId) => ({
  listingId,
  addedBy: null,
  addedByName: null,
  addedAt: null,
})

function loadLocal() {
  try {
    entries.value = parseStoredIds(localStorage.getItem(STORAGE_KEY)).map(toLocalEntry)
    storageError.value = ''
  } catch (error) {
    entries.value = []
    storageError.value =
      error instanceof Error ? error.message : 'Unable to load your shortlist.'
  }
}

function saveLocal(nextIds) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextIds))
  entries.value = nextIds.map(toLocalEntry)
  storageError.value = ''
}

// Keep two tabs of the same browser in step while in personal mode.
window.addEventListener('storage', (event) => {
  if (event.key !== STORAGE_KEY || isGroupMode.value) return
  try {
    entries.value = parseStoredIds(event.newValue).map(toLocalEntry)
    storageError.value = ''
  } catch (error) {
    storageError.value =
      error instanceof Error ? error.message : 'Unable to sync your shortlist.'
  }
})

/* ---------------- group mode (Firestore) ---------------- */

const shortlistRef = (groupId) => collection(db, 'groups', groupId, 'shortlist')

function subscribeToGroup(groupId) {
  loading.value = true
  storageError.value = ''

  unsubscribeSnapshot = onSnapshot(
    shortlistRef(groupId),
    (snapshot) => {
      entries.value = snapshot.docs
        .map((entryDoc) => {
          const data = entryDoc.data()
          return {
            listingId: entryDoc.id,
            addedBy: data.addedBy ?? null,
            addedByName: data.addedByName ?? null,
            // Pending local writes have no server timestamp yet.
            addedAt: data.addedAt?.toDate?.() ?? null,
          }
        })
        .sort((a, b) => (a.addedAt?.getTime() ?? 0) - (b.addedAt?.getTime() ?? 0))
      loading.value = false
      storageError.value = ''
    },
    (error) => {
      loading.value = false
      entries.value = []
      storageError.value = error.message || "Unable to load your group's shortlist."
    },
  )
}

function teardown() {
  unsubscribeSnapshot?.()
  unsubscribeSnapshot = null
}

/* ---------------- mode switching ---------------- */

startActiveGroupTracking()

watch(
  activeGroupId,
  (groupId) => {
    teardown()
    entries.value = []
    storageError.value = ''
    if (groupId) subscribeToGroup(groupId)
    else loadLocal()
  },
  { immediate: true },
)

/* ---------------- public API ---------------- */

export function useShortlist() {
  const isShortlisted = (listingId) => listingIds.value.includes(listingId)

  /** Adds the listing if it is missing, removes it if it is already saved. */
  async function toggleShortlist(listingId) {
    if (isShortlisted(listingId)) return removeFromShortlist(listingId)

    if (!isGroupMode.value) {
      saveLocal([...listingIds.value, listingId])
      return
    }

    const user = auth.currentUser
    if (!user) throw new Error('Sign in to change your group shortlist.')

    // A transaction rather than setDoc (from Yi Phu's groupShortlistService): if
    // two members save the same listing at once, the first entry wins and the
    // second is a no-op instead of an update the rules reject.
    const entryRef = doc(shortlistRef(activeGroupId.value), listingId)
    await runTransaction(db, async (transaction) => {
      if ((await transaction.get(entryRef)).exists()) return
      transaction.set(entryRef, {
        listingId,
        addedBy: user.uid,
        addedByName: user.displayName || user.email?.split('@')[0] || 'Group member',
        addedAt: serverTimestamp(),
      })
    })
  }

  /** Any member may remove any entry — addedByName is shown for accountability. */
  async function removeFromShortlist(listingId) {
    if (!isGroupMode.value) {
      saveLocal(listingIds.value.filter((savedId) => savedId !== listingId))
      return
    }
    await deleteDoc(doc(shortlistRef(activeGroupId.value), listingId))
  }

  return {
    listingIds,
    entries,
    storageError,
    loading,
    isGroupMode,
    activeGroup,
    isShortlisted,
    toggleShortlist,
    removeFromShortlist,
  }
}
