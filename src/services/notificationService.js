import { collection, doc, onSnapshot } from 'firebase/firestore'

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
