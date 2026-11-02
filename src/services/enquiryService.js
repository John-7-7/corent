import {
  collection,
  doc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'

import { db } from '@/firebase'

// Submit an enquiry for a shortlisted property.
export async function submitEnquiry(groupId, userId, listing) {
  if (!groupId || !userId || !listing?.ListingID) {
    throw new Error(
      'Group, user and listing information are required.',
    )
  }

  // Generate a new unique document reference.
  const enquiryRef = doc(collection(db, 'enquiries'))

  // Save the enquiry in Firestore.
  await setDoc(enquiryRef, {
    groupId,
    userId,
    listingId: listing.ListingID,
    listingTitle: listing.Title,
    status: 'submitted',
    submittedAt: serverTimestamp(),
  })

  return enquiryRef.id
}