import { deleteField, doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../firebase'

// Group_Preferences/{GroupID}: the search preferences a group agreed on
// (buildGroupPreference in groupAggregation.js), for listing search to read.
// Finalised holds the locked-in votes ({ factorKey: { value, label } }), Issues the
// raised issues ({ factorKey: { message, open, by } }, by is never shown) and Rounds
// each factor's voting round, so every member sees the same results.
const COLLECTION = 'Group_Preferences'

// Fields this page writes. Anything else is ignored so callers can never
// overwrite the server-managed timestamps.
const GROUP_PREFERENCE_FIELDS = [
  'GroupID',
  'HouseholdSize',
  'BudgetPerPersonMin',
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
  'Issues',
  'Rounds',
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

// Maps members change one key at a time (Finalised, Issues, Rounds).
const DECISION_FIELDS = ['Finalised', 'Issues', 'Rounds']

/**
 * Creates or updates the group's preference. IsComplete tells listing search
 * whether every filter has been agreed; a reopened vote saves IsComplete false.
 * changes: { Finalised: { key: value | null }, Issues: {...}, Rounds: {...} }
 * writes only those keys (null removes one), so two members acting at once never
 * overwrite each other's results, issues or rounds.
 */
export async function saveGroupPreference(groupPreference, uid, changes = {}) {
  const groupId = groupPreference?.GroupID
  if (!groupId) throw new Error('A GroupID is needed to save group preferences.')
  const ref = groupPreferenceRef(groupId)
  const existing = await getDoc(ref)

  const summary = Object.fromEntries(
    GROUP_PREFERENCE_FIELDS.filter((field) => !DECISION_FIELDS.includes(field)).map((field) => [
      field,
      groupPreference[field] ?? null,
    ]),
  )
  const decisions = Object.fromEntries(
    DECISION_FIELDS.filter((field) => changes[field]).map((field) => [
      field,
      Object.fromEntries(
        Object.entries(changes[field]).map(([key, value]) => [key, value ?? deleteField()]),
      ),
    ]),
  )
  // A merge: the summary fields are replaced whole, decision maps only per key.
  await setDoc(
    ref,
    {
      ...summary,
      ...decisions,
      UpdatedBy: uid,
      UpdatedAt: serverTimestamp(),
      CreatedAt: (existing.exists() && existing.data().CreatedAt) || serverTimestamp(),
    },
    { merge: true },
  )
}
