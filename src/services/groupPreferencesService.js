import { deleteField, doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../firebase'

// Group_Preferences/{GroupID}: the agreed search filters plus Finalised, Issues,
// Rounds and MemberPriorities ({ uid: { Budget: 1, ... } }). Rankings are kept
// per member; whoever reads them decides how to combine them.
const COLLECTION = 'Group_Preferences'

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
  'PendingPreferences',
  'IsComplete',
  'Finalised',
  'Issues',
  'Rounds',
  'MemberPriorities',
]

const groupPreferenceRef = (groupId) => doc(db, COLLECTION, groupId)

export async function getGroupPreference(groupId) {
  const snap = await getDoc(groupPreferenceRef(groupId))
  return snap.exists() ? snap.data() : null
}

export function watchGroupPreference(groupId, callback, onError) {
  return onSnapshot(
    groupPreferenceRef(groupId),
    (snap) => callback(snap.exists() ? snap.data() : null),
    onError,
  )
}

const DECISION_FIELDS = ['Finalised', 'Issues', 'Rounds', 'MemberPriorities']

// Merge-writes the summary plus only the changed decision keys (null removes
// one), so members acting at once never overwrite each other.
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
  await setDoc(
    ref,
    {
      ...summary,
      ...decisions,
      // Older records kept one shared ranking; MemberPriorities replaced it.
      Priorities: deleteField(),
      UpdatedBy: uid,
      UpdatedAt: serverTimestamp(),
      CreatedAt: (existing.exists() && existing.data().CreatedAt) || serverTimestamp(),
    },
    { merge: true },
  )
}
