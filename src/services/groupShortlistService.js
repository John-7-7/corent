import {
  collection,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore'

import { db } from '@/firebase'

// Listing votes for the group shortlist. Adding and removing listings lives in
// shortlistService.js (groups/{id}/shortlist), which Browse also uses.

// Listing votes are separate from group preference votes.
function getVotesCollection(groupId) {
  return collection(db, 'groups', groupId, 'listingVotes')
}

// Vote document ID is based on both user and listing.
// This ensures one vote per user per listing.
function getVoteDocumentId(userId, listingId) {
  return `${userId}_${listingId}`
}

// Add a vote for a listing.
export async function voteForListing(groupId, listingId, userId) {
  if (!groupId || !listingId || !userId) {
    throw new Error('Group, listing and user information are required.')
  }

  const voteRef = doc(
    getVotesCollection(groupId),
    getVoteDocumentId(userId, listingId),
  )

  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(voteRef)

    if (existing.exists()) return

    transaction.set(voteRef, {
      userId,
      listingId,
      votedAt: serverTimestamp(),
    })
  })
}

// Remove a member's vote for a listing.
export async function removeListingVote(groupId, listingId, userId) {
  if (!groupId || !listingId || !userId) {
    throw new Error('Group, listing and user information are required.')
  }

  const voteRef = doc(
    getVotesCollection(groupId),
    getVoteDocumentId(userId, listingId),
  )

  await runTransaction(db, async (transaction) => {
    transaction.delete(voteRef)
  })
}

// Listen for vote changes in real time.
export function subscribeToGroupVotes(groupId, callback, onError) {
  return onSnapshot(
    getVotesCollection(groupId),
    (snapshot) => {
      callback(snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      })))
    },
    onError,
  )
}
