import { collection, doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'

import { db } from '@/firebase'
import { subscribeToGroupComments } from './commentService'
import { subscribeToGroupEnquiries } from './enquiryService'
import { watchGroupPreference } from './groupPreferencesService'

/**
 * Activity in a group, as notification events, from data the app already
 * stores (no extra Firestore fields):
 *
 *   enquiry    groups/{id}/enquiries          userId, submittedAt
 *   comment    groups/{id}/listingComments    userId, createdAt
 *   shortlist  groups/{id}/shortlist          addedBy, addedAt
 *   prefs      Group_Preferences/{id}         UpdatedBy, UpdatedAt
 *   profile    User_Preferences/{uid}         UpdatedAt (a teammate's own profile)
 *
 * Joins and leaves have no stored timestamp, so the notification centre works
 * them out from the live member list instead.
 *
 * Event: { key, type, groupId, actorId, at (ms), listingId?, snippet? }
 */

const millis = (value) => value?.toMillis?.() ?? (value instanceof Date ? value.getTime() : null)

/**
 * Listens to everything that happens in one group. Calls back with the full,
 * current list of events whenever any source changes.
 * @returns {() => void} stop listening
 */
export function subscribeToGroupActivity(groupId, callback, onError) {
  const sources = { enquiry: [], comment: [], shortlist: [], prefs: [] }
  const emit = () => callback(Object.values(sources).flat())

  const stops = [
    subscribeToGroupEnquiries(
      groupId,
      (items) => {
        sources.enquiry = items.map((item) => ({
          key: `${groupId}/enquiry/${item.id}`,
          type: 'enquiry',
          groupId,
          actorId: item.userId,
          at: millis(item.submittedAt) ?? Date.now(),
          listingId: item.listingId,
          listingTitle: item.listingTitle,
        }))
        emit()
      },
      onError,
    ),
    subscribeToGroupComments(
      groupId,
      (items) => {
        sources.comment = items
          .filter((item) => !item.pending)
          .map((item) => ({
            key: `${groupId}/comment/${item.id}`,
            type: 'comment',
            groupId,
            actorId: item.userId,
            at: item.createdAtMs,
            listingId: item.listingId,
            snippet: String(item.text ?? '').slice(0, 80),
          }))
        emit()
      },
      onError,
    ),
    onSnapshot(
      collection(db, 'groups', groupId, 'shortlist'),
      (snapshot) => {
        sources.shortlist = snapshot.docs
          .map((entry) => ({ id: entry.id, ...entry.data({ serverTimestamps: 'estimate' }) }))
          .filter((entry) => entry.addedBy)
          .map((entry) => ({
            key: `${groupId}/shortlist/${entry.id}/${millis(entry.addedAt) ?? 0}`,
            type: 'shortlist',
            groupId,
            actorId: entry.addedBy,
            at: millis(entry.addedAt) ?? Date.now(),
            listingId: entry.listingId ?? entry.id,
          }))
        emit()
      },
      onError,
    ),
    watchGroupPreference(
      groupId,
      (saved) => {
        const at = millis(saved?.UpdatedAt)
        // Only the latest save is stored, so it is one event that moves on.
        sources.prefs =
          saved?.UpdatedBy && at
            ? [{ key: `${groupId}/prefs/${at}`, type: 'prefs', groupId, actorId: saved.UpdatedBy, at }]
            : []
        emit()
      },
      onError,
    ),
  ]
  return () => stops.forEach((stop) => stop?.())
}

/**
 * A teammate saving their own rental preferences.
 * @returns {() => void} stop listening
 */
export function subscribeToProfileUpdates(uid, callback, onError) {
  return onSnapshot(
    doc(db, 'User_Preferences', uid),
    (snapshot) => {
      const at = millis(snapshot.data({ serverTimestamps: 'estimate' })?.UpdatedAt)
      callback(at ? { key: `profile/${uid}/${at}`, type: 'profile', actorId: uid, at } : null)
    },
    onError,
  )
}

/**
 * What the user has read, and the member lists used to spot joins and leaves,
 * so they follow the user between devices. Stored at
 * User_Preferences/{uid}/Private/Notifications, which the rules already keep
 * owner-only (the same place as the private budget):
 *
 *   Seen        keys of notifications already read (latest 500)
 *   Since       when the user first opened the app; older activity is read
 *   Members     { groupId: { uid: name } } as last seen
 *   MembersLog  join and leave events worked out from Members
 *   Profiles    { uid: ms } when each teammate's profile was first seen
 *   SavedAt     ms, to tell which copy is newer than this browser's
 */
const notificationStateRef = (uid) => doc(db, 'User_Preferences', uid, 'Private', 'Notifications')

/** @returns {Promise<object|null>} the saved state, or null if there is none */
export async function loadNotificationState(uid) {
  const snapshot = await getDoc(notificationStateRef(uid))
  if (!snapshot.exists()) return null
  const data = snapshot.data()
  return {
    seen: data.Seen ?? [],
    since: data.Since ?? null,
    members: data.Members ?? {},
    membersLog: data.MembersLog ?? [],
    profiles: data.Profiles ?? {},
    savedAt: data.SavedAt ?? 0,
  }
}

export function saveNotificationState(uid, state) {
  return setDoc(notificationStateRef(uid), {
    Seen: state.seen,
    Since: state.since,
    Members: state.members,
    MembersLog: state.membersLog,
    Profiles: state.profiles,
    SavedAt: state.savedAt,
    UpdatedAt: serverTimestamp(),
  })
}

/**
 * Combines this browser's copy with the saved one: everything read anywhere
 * stays read, the earliest start wins, and the newer copy's member lists are
 * the baseline so a join seen on another device is not announced twice.
 */
export function mergeNotificationStates(local, remote) {
  if (!remote) return local
  const [older, newer] = (remote.savedAt ?? 0) > (local.savedAt ?? 0) ? [local, remote] : [remote, local]
  const log = new Map([...older.membersLog, ...newer.membersLog].map((event) => [event.key, event]))
  const profiles = { ...remote.profiles }
  for (const [id, at] of Object.entries(local.profiles)) profiles[id] = Math.min(at, profiles[id] ?? at)
  const starts = [local.since, remote.since].filter((value) => typeof value === 'number')
  return {
    seen: [...new Set([...older.seen, ...newer.seen])].slice(-500),
    since: starts.length ? Math.min(...starts) : null,
    members: { ...older.members, ...newer.members },
    membersLog: [...log.values()].sort((a, b) => b.at - a.at).slice(0, 50),
    profiles,
    savedAt: Math.max(local.savedAt ?? 0, remote.savedAt ?? 0),
  }
}
