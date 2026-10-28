import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../firebase'

// Group_Preferences/{GroupID}: the search preferences a group agreed on
// (buildGroupPreference in groupAggregation.js), for listing search to read.
// Finalised holds the locked-in votes ({ factorKey: { value, label } }) so every
// member sees the same results.
const COLLECTION = 'Group_Preferences'

// Fields this page writes. Anything else is ignored so callers can never
// overwrite the server-managed timestamps.
const GROUP_PREFERENCE_FIELDS = [
  'GroupID',
  'HouseholdSize',
  'BudgetPerPersonMax',
  'MonthlyRentMax',
  'PreferredRegions',
  'PropertyType',
  'BedroomsMin',
  'BedroomsMax',
  'Priorities',
  'PendingPreferences',
  'IsComplete',
  'Finalised',
]

const groupPreferenceRef = (groupId) => doc(db, COLLECTION, groupId)

/** Reads a group's saved preference. Resolves to null when none is saved yet. */
export async function getGroupPreference(groupId) {
  const snap = await getDoc(groupPreferenceRef(groupId))
  return snap.exists() ? snap.data() : null
}

/** Calls back with the group's saved preference whenever it changes (or null). */
export function watchGroupPreference(groupId, callback, onError) {
  return onSnapshot(
    groupPreferenceRef(groupId),
    (snap) => callback(snap.exists() ? snap.data() : null),
    onError,
  )
}

/**
 * Creates or replaces the group's preference. IsComplete tells listing search
 * whether every filter has been agreed; a reopened vote saves IsComplete false.
 */
export async function saveGroupPreference(groupPreference, uid) {
  const groupId = groupPreference?.GroupID
  if (!groupId) throw new Error('A GroupID is needed to save group preferences.')
  const ref = groupPreferenceRef(groupId)
  const existing = await getDoc(ref)

  // A full write (not a merge), so a reopened vote is removed from Finalised.
  await setDoc(ref, {
    ...Object.fromEntries(
      GROUP_PREFERENCE_FIELDS.map((field) => [field, groupPreference[field] ?? null]),
    ),
    UpdatedBy: uid,
    UpdatedAt: serverTimestamp(),
    CreatedAt: (existing.exists() && existing.data().CreatedAt) || serverTimestamp(),
  })
}
