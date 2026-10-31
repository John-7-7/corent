import {
  collection,
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import { db } from '../firebase'

// Firestore reads and writes for the group summary page (F-REQ-010 to 013).
//
// Collections this page uses:
// - groups/{groupId}: { name, inviteCode, memberIds: [uid], members: [{ id, name, email }] }
//   Created and joined through groupService.js (Home / Group Details). Read only here.
// - User_Preferences/{UserID}: each member's public profile (profile feature).
// - groups/{groupId}/votes/{UserID}: { UserID, Votes: { factorKey: ballot },
//   Ready: { factorKey: { result, round } }, UpdatedAt }
//   A ballot is { min, max, round } for budget and { value, round } otherwise;
//   only the factor's current round counts.
//   Written here: one doc per member with their ballot on each search filter and
//   which results they are ready to finalise.

/**
 * Calls back with the group whenever it changes (null if it doesn't exist), in
 * the shape this page uses: { GroupID, GroupName, Members: [uid], users: [{ UserID, Username }] }.
 */
export function watchGroup(groupId, callback, onError) {
  return onSnapshot(
    doc(db, 'groups', groupId),
    (snap) => {
      if (!snap.exists()) return callback(null)
      const data = snap.data()
      callback({
        GroupID: snap.id,
        GroupName: data.name,
        Members: data.memberIds || [],
        users: (data.members || []).map((member) => ({
          UserID: member.id,
          Username: member.name,
        })),
      })
    },
    onError,
  )
}

/** Public profiles of the given members. A member without a profile is left out. */
export async function getMemberProfiles(uids) {
  const snaps = await Promise.all(
    uids.map((uid) => getDoc(doc(db, 'User_Preferences', uid)).catch(() => null)),
  )
  return snaps.filter((snap) => snap?.exists()).map((snap) => ({ UserID: snap.id, ...snap.data() }))
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

/**
 * Calls back with every ballot and ready mark in the group, each as
 * { factorKey: { uid: value } }.
 */
export function watchVotes(groupId, callback, onError) {
  return onSnapshot(
    collection(db, 'groups', groupId, 'votes'),
    (snap) => {
      const votes = {}
      const ready = {}
      const collect = (target, entries, uid) =>
        Object.entries(entries || {}).forEach(([key, value]) => {
          target[key] ??= {}
          target[key][uid] = value
        })
      snap.forEach((voteDoc) => {
        collect(votes, voteDoc.data().Votes, voteDoc.id)
        collect(ready, voteDoc.data().Ready, voteDoc.id)
      })
      callback(votes, ready)
    },
    onError,
  )
}

/** Saves the signed-in member's ballot on one factor, keeping their other ballots. */
export function saveVote(groupId, uid, key, value) {
  return setDoc(
    doc(db, 'groups', groupId, 'votes', uid),
    { UserID: uid, Votes: { [key]: value }, UpdatedAt: serverTimestamp() },
    { merge: true },
  )
}

/** Marks the signed-in member ready to finalise one result, or clears it (null). */
export function saveReady(groupId, uid, key, value) {
  return setDoc(
    doc(db, 'groups', groupId, 'votes', uid),
    { UserID: uid, Ready: { [key]: value ?? deleteField() }, UpdatedAt: serverTimestamp() },
    { merge: true },
  )
}
