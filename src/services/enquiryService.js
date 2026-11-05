
import {
  collection,
  doc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from 'firebase/firestore'

import { db } from '@/firebase'

// Submit an enquiry for a shortlisted property.
// Each group can only submit one enquiry per listing.
export async function submitEnquiry(
  groupId,
  userId,
  listing,
  emailReceipt = false,
) {
  // Use a predictable document ID to prevent duplicate enquiries.
  const enquiryRef = doc(
    db,
    'enquiries',
    `${groupId}_${listing.ListingID}`,
  )

  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(enquiryRef)

    if (existing.exists()) {
      throw new Error('This listing has already been submitted for enquiry.')
    }

    transaction.set(enquiryRef, {
      groupId,
      userId,
      listingId: listing.ListingID,
      listingTitle: listing.Title,
      status: 'submitted',
      submittedAt: serverTimestamp(),
      emailReceipt,
    })
  })

  return enquiryRef.id
}

// Listen for all enquiries submitted by a particular group.
export function subscribeToGroupEnquiries(groupId, callback, onError) {
  const enquiriesQuery = query(
    collection(db, 'enquiries'),
    where('groupId', '==', groupId),
  )

  return onSnapshot(
    enquiriesQuery,
    (snapshot) => {
      callback(
        snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })),
      )
    },
    onError,
  )
}
