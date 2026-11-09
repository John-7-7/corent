import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore'

import { db } from '@/firebase'

/**
 * Group comments on listings: groups/{groupId}/listingComments/{autoId}.
 *
 * Stored under the group for the same reason enquiries are: membership is
 * provable from the path, so a list query can be secured (see firestore.rules).
 * Comments are add/delete only. A member deletes their own; leaving the group
 * deletes all of theirs (groupService.leaveGroup), and the group's last member
 * leaving deletes the lot.
 *
 * Fields: listingId, userId, authorName, authorPhotoURL, text, createdAt.
 */
export const COMMENT_MAX_LENGTH = 1000

const commentsRef = (groupId) => collection(db, 'groups', groupId, 'listingComments')

// createdAt is a server timestamp, so a comment written a moment ago has no
// value yet in the local snapshot. Treat it as "now" so it sorts last instead
// of jumping to the top until the server answers.
function toComment(snapshot) {
  const data = snapshot.data({ serverTimestamps: 'estimate' })
  return {
    id: snapshot.id,
    ...data,
    createdAtMs: data.createdAt?.toMillis?.() ?? Date.now(),
    pending: snapshot.metadata.hasPendingWrites,
  }
}

const oldestFirst = (a, b) => a.createdAtMs - b.createdAtMs

function listen(source, callback, onError) {
  return onSnapshot(
    source,
    { includeMetadataChanges: true },
    (snapshot) => callback(snapshot.docs.map(toComment).sort(oldestFirst)),
    onError,
  )
}

/** Every comment in the group, oldest first. Used for per-listing counts. */
export function subscribeToGroupComments(groupId, callback, onError) {
  return listen(commentsRef(groupId), callback, onError)
}

/**
 * Comments on one listing, oldest first. Filtered on listingId only and sorted
 * here, so no composite index is needed.
 */
export function subscribeToListingComments(groupId, listingId, callback, onError) {
  return listen(
    query(commentsRef(groupId), where('listingId', '==', String(listingId))),
    callback,
    onError,
  )
}

/**
 * @param {{ uid: string, displayName?: string, email?: string, photoURL?: string }} user
 * @returns {Promise<string>} the new comment's id
 */
export async function addListingComment(groupId, listingId, user, text) {
  const body = String(text ?? '').trim()
  if (!groupId || !listingId || !user?.uid) {
    throw new Error('Group, listing and user information are required.')
  }
  if (!body) throw new Error('Write something before posting.')
  if (body.length > COMMENT_MAX_LENGTH) {
    throw new Error(`Comments can be at most ${COMMENT_MAX_LENGTH} characters.`)
  }

  const created = await addDoc(commentsRef(groupId), {
    listingId: String(listingId),
    userId: user.uid,
    authorName: (user.displayName || user.email?.split('@')[0] || 'CoRent member').slice(0, 100),
    authorPhotoURL: user.photoURL || '',
    text: body,
    createdAt: serverTimestamp(),
  })
  return created.id
}

export async function deleteListingComment(groupId, commentId) {
  if (!groupId || !commentId) throw new Error('Group and comment are required.')
  await deleteDoc(doc(commentsRef(groupId), commentId))
}
