import { collection, doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../firebase'

// Firestore reads and writes for the group summary page (F-REQ-010 to 013).
//
// Collections this page expects:
// - Groups/{GroupID}: { GroupID, GroupName, Members: [UserID, ...] }
//   Created by whoever owns group creation (Home). This page only reads it.
// - Users/{UserID}: { UserID, Username }. Read for member names, if it exists.
// - User_Preferences/{UserID}: each member's public profile (profile feature).
// - Groups/{GroupID}/Votes/{UserID}: { UserID, Votes: { factorKey: value }, UpdatedAt }
//   Written here: one doc per member with their ballot on each search filter.

/** Calls back with the group whenever it changes (null if it doesn't exist). */
export function watchGroup(groupId, callback, onError) {
  return onSnapshot(
    doc(db, 'Groups', groupId),
    (snap) => callback(snap.exists() ? { GroupID: snap.id, ...snap.data() } : null),
    onError,
  )
}

/**
 * Public profiles and names of the given members. A member without a profile is
 * left out; a member without a Users doc gets no Username.
 */
export async function getMembers(uids) {
  const read = (path) =>
    Promise.all(uids.map((uid) => getDoc(doc(db, path, uid)).catch(() => null)))
  const [profileSnaps, userSnaps] = await Promise.all([read('User_Preferences'), read('Users')])
  return {
    profiles: profileSnaps
      .filter((snap) => snap?.exists())
      .map((snap) => ({ UserID: snap.id, ...snap.data() })),
    users: userSnaps
      .filter((snap) => snap?.exists())
      .map((snap) => ({ UserID: snap.id, ...snap.data() })),
  }
}

/**
 * The signed-in user's own budget from User_Preferences/{uid}/Private/Budget.
 * Only the owner can read it, and it is only shown back to them.
 */
export async function getMyPrivateBudget(uid) {
  const snap = await getDoc(doc(db, 'User_Preferences', uid, 'Private', 'Budget'))
  if (!snap.exists()) return null
  const { BudgetMin, BudgetMax } = snap.data()
  return { BudgetMin, BudgetMax }
}

/** Calls back with every ballot in the group as { factorKey: { uid: value } }. */
export function watchVotes(groupId, callback, onError) {
  return onSnapshot(
    collection(db, 'Groups', groupId, 'Votes'),
    (snap) => {
      const votes = {}
      snap.forEach((voteDoc) => {
        Object.entries(voteDoc.data().Votes || {}).forEach(([key, value]) => {
          votes[key] ??= {}
          votes[key][voteDoc.id] = value
        })
      })
      callback(votes)
    },
    onError,
  )
}

/** Saves the signed-in member's ballot on one factor, keeping their other ballots. */
export function saveVote(groupId, uid, key, value) {
  return setDoc(
    doc(db, 'Groups', groupId, 'Votes', uid),
    { UserID: uid, Votes: { [key]: value }, UpdatedAt: serverTimestamp() },
    { merge: true },
  )
}
