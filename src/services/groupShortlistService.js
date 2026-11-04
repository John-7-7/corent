import {
  collection,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore'

import { db } from '@/firebase'

// Get the shared shortlist collection for a particular group.
function getShortlistCollection(groupId) {
  return collection(db, 'groups', groupId, 'shortlistedListings')
}

// Listing votes are separate from group preference votes.
function getVotesCollection(groupId) {
  return collection(db, 'groups', groupId, 'listingVotes')
}

// Add a listing to the group's shared shortlist.
export async function addGroupShortlist(groupId, listingId, userId) {
  if (!groupId || !listingId || !userId) {
    throw new Error('Group, listing and user information are required.')
  }

  const listingRef = doc(getShortlistCollection(groupId), listingId)

  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(listingRef)

    if (existing.exists()) return

    transaction.set(listingRef, {
      listingId,
      addedBy: userId,
      addedAt: serverTimestamp(),
    })
  })
}

// Remove a listing and its votes from the group's shortlist.
export async function removeGroupShortlist(groupId, listingId) {
  if (!groupId || !listingId) {
    throw new Error('Group and listing information are required.')
  }

  const listingRef = doc(getShortlistCollection(groupId), listingId)

  await runTransaction(db, async (transaction) => {
    transaction.delete(listingRef)
  })
}

// Listen for shared shortlist changes in real time.
export function subscribeToGroupShortlist(groupId, callback, onError) {
  return onSnapshot(
    getShortlistCollection(groupId),
    (snapshot) => {
      callback(snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      })))
    },
    onError,
  )
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
