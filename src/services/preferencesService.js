import { doc, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore'
import { db } from '../firebase'

const COLLECTION = 'User_Preferences'

// Fields the profile form owns. Anything else passed in (e.g. CreatedAt from a
// previous read) is ignored so it can never overwrite server-managed values.
const PREFERENCE_FIELDS = [
  'IsBudgetPrivate',
  'BudgetMin',
  'BudgetMax',
  'MaxCommuteTime',
  'CommuteDestination',
  'BedroomsMin',
  'BedroomsMax',
  'PreferredMoveInDate',
  'PropertyType',
  'LeaseDuration',
  'CoTenants',
  'FurnishingLevel',
  'CookingAccess',
  'AirconCoverage',
  'SmokingPreference',
  'StudyEnvironment',
  'GuestPolicy',
  'Amenities',
  'PreferredLocations',
]

const preferencesRef = (uid) => doc(db, COLLECTION, uid)
const privateBudgetRef = (uid) => doc(db, COLLECTION, uid, 'Private', 'Budget')

function pickPreferenceFields(data) {
  return Object.fromEntries(
    PREFERENCE_FIELDS.filter((field) => field in data).map((field) => [field, data[field]]),
  )
}

/**
 * Reads the user's preferences. The budget always comes from the private doc,
 * because the main doc holds null there when the budget is private.
 * Resolves to null when the user has not created a profile yet.
 */
export async function getPreferences(uid) {
  const [mainSnap, budgetSnap] = await Promise.all([
    getDoc(preferencesRef(uid)),
    getDoc(privateBudgetRef(uid)),
  ])
  if (!mainSnap.exists()) return null

  const preferences = mainSnap.data()
  if (budgetSnap.exists()) {
    const { BudgetMin, BudgetMax } = budgetSnap.data()
    Object.assign(preferences, { BudgetMin, BudgetMax })
  }
  return preferences
}

/**
 * Creates or updates the user's preferences. The private budget doc is always
 * written; the main doc only carries the budget when IsBudgetPrivate is false.
 * Both writes go through one batch so they succeed or fail together.
 */
export async function savePreferences(uid, data) {
  const mainRef = preferencesRef(uid)
  const existing = await getDoc(mainRef)
  const isBudgetPrivate = Boolean(data.IsBudgetPrivate)
  // Firestore rejects undefined, so a missing budget is stored as "not set".
  const budgetMin = data.BudgetMin ?? null
  const budgetMax = data.BudgetMax ?? null

  const mainDoc = {
    ...pickPreferenceFields(data),
    UserID: uid,
    IsBudgetPrivate: isBudgetPrivate,
    BudgetMin: isBudgetPrivate ? null : budgetMin,
    BudgetMax: isBudgetPrivate ? null : budgetMax,
    UpdatedAt: serverTimestamp(),
  }
  if (!existing.exists()) mainDoc.CreatedAt = serverTimestamp()

  const batch = writeBatch(db)
  batch.set(
    privateBudgetRef(uid),
    { BudgetMin: budgetMin, BudgetMax: budgetMax, UpdatedAt: serverTimestamp() },
    { merge: true },
  )
  batch.set(mainRef, mainDoc, { merge: true })
  await batch.commit()
}

/**
 * Deletes the main doc and everything under Private: the budget and the
 * notification read state (Firestore does not cascade).
 */
export async function deletePreferences(uid) {
  const batch = writeBatch(db)
  batch.delete(privateBudgetRef(uid))
  batch.delete(doc(db, COLLECTION, uid, 'Private', 'Notifications'))
  batch.delete(preferencesRef(uid))
  await batch.commit()
}
