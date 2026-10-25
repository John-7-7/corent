import { ref } from 'vue'

const STORAGE_KEY = 'corent-shortlist'
const listingIds = ref([])
const storageError = ref('')
let initialized = false

function initialize() {
  if (initialized) return
  initialized = true
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (!Array.isArray(parsed) || !parsed.every((id) => typeof id === 'string')) {
        throw new Error('Saved shortlist data is invalid.')
      }
      listingIds.value = parsed
    }
  } catch (error) {
    storageError.value = error instanceof Error ? error.message : 'Unable to load your shortlist.'
  }
}

function save(nextIds) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextIds))
  listingIds.value = nextIds
  storageError.value = ''
}

export function useShortlist() {
  initialize()

  function toggleShortlist(id) {
    const nextIds = listingIds.value.includes(id)
      ? listingIds.value.filter((savedId) => savedId !== id)
      : [...listingIds.value, id]
    save(nextIds)
  }

  function removeFromShortlist(id) {
    save(listingIds.value.filter((savedId) => savedId !== id))
  }

  return { listingIds, storageError, toggleShortlist, removeFromShortlist }
}

window.addEventListener('storage', (event) => {
  if (event.key !== STORAGE_KEY) return
  try {
    const parsed = event.newValue ? JSON.parse(event.newValue) : []
    if (!Array.isArray(parsed) || !parsed.every((id) => typeof id === 'string')) {
      throw new Error('Saved shortlist data is invalid.')
    }
    listingIds.value = parsed
    storageError.value = ''
  } catch (error) {
    storageError.value = error instanceof Error ? error.message : 'Unable to sync your shortlist.'
  }
})
