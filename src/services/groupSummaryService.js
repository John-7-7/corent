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

// Firestore access for the group summary page (F-REQ-010 to 013).
// groups/{groupId} is read only; each member's ballots and confirmations live in
// groups/{groupId}/votes/{uid} as { Votes: { key: ballot }, Ready: { key: { result, round } } }.

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

export async function getMemberProfiles(uids) {
  const snaps = await Promise.all(
    uids.map((uid) => getDoc(doc(db, 'User_Preferences', uid)).catch(() => null)),
  )
  return snaps.filter((snap) => snap?.exists()).map((snap) => ({ UserID: snap.id, ...snap.data() }))
}

// The signed-in user's private budget; only the owner can read it.
export async function getMyPrivateBudget(uid) {
  const snap = await getDoc(doc(db, 'User_Preferences', uid, 'Private', 'Budget'))
  if (!snap.exists()) return null
  const { BudgetMin, BudgetMax } = snap.data()
  return { BudgetMin, BudgetMax }
}

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

export function saveVote(groupId, uid, key, value) {
  return setDoc(
    doc(db, 'groups', groupId, 'votes', uid),
    { UserID: uid, Votes: { [key]: value }, UpdatedAt: serverTimestamp() },
    { merge: true },
  )
}

export function saveReady(groupId, uid, key, value) {
  return setDoc(
    doc(db, 'groups', groupId, 'votes', uid),
    { UserID: uid, Ready: { [key]: value ?? deleteField() }, UpdatedAt: serverTimestamp() },
    { merge: true },
  )
}
