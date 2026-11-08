
import {
  collection,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore'

import { db } from '@/firebase'

/**
 * Enquiries live under the group that made them: groups/{groupId}/enquiries.
 *
 * They used to sit in a top-level `enquiries` collection keyed
 * `{groupId}_{listingId}` and be read with a query filtered on groupId. That
 * cannot be secured. Firestore checks a list query against the rule before
 * running it, and a rule that has to get() the group document to learn whether
 * you are a member is not something it can verify in advance, so the query is
 * refused outright once real rules are deployed. Under the group, membership
 * is provable from the path alone and no document lookup is needed.
 *
 * The listing id alone is unique within a group, so the composite key goes too.
 */
const enquiriesRef = (groupId) => collection(db, 'groups', groupId, 'enquiries')

// Submit an enquiry for a shortlisted property.
// Each group can only submit one enquiry per listing.
export async function submitEnquiry(
  groupId,
  userId,
  listing,
  emailReceipt = false,
) {
  const enquiryRef = doc(enquiriesRef(groupId), String(listing.ListingID))

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
  return onSnapshot(
    enquiriesRef(groupId),
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
