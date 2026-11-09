import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore'

import { db } from '@/firebase'

const groupsCollection = collection(db, 'groups')

function createMember(user) {
  return {
    id: user.uid,
    name:
      user.displayName ||
      user.email?.split('@')[0] ||
      'Group member',
    email: user.email || '',
    // Stored because Firebase Auth only ever hands the client the signed-in
    // user's photoURL. Without a copy on the group record there is no way to
    // show a teammate's picture beside their vote. Members who joined before
    // this have no photo and fall back to initials.
    photo: user.photoURL || '',
    preferencesReady: false,
  }
}

async function generateUniqueInviteCode() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const inviteCode = Math.floor(
      100000 + Math.random() * 900000,
    ).toString()

    const codeQuery = query(
      groupsCollection,
      where('inviteCode', '==', inviteCode),
      limit(1),
    )

    const result = await getDocs(codeQuery)

    if (result.empty) {
      return inviteCode
    }
  }

  throw new Error('Unable to generate a unique invitation code.')
}

export async function createGroup(groupName, user) {
  const name = groupName.trim()

  if (!name) {
    throw new Error('Enter a name for your group.')
  }

  if (!user?.uid) {
    throw new Error('You must be signed in to create a group.')
  }

  const member = createMember(user)
  const inviteCode = await generateUniqueInviteCode()

  const groupReference = await addDoc(groupsCollection, {
    name,
    inviteCode,
    memberIds: [user.uid],
    members: [member],
    memberCount: 1,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  return {
    id: groupReference.id,
    name,
    inviteCode,
    memberIds: [user.uid],
    members: [member],
    memberCount: 1,
  }
}

export async function getUserGroups(userId) {
  if (!userId) return []

  const groupsQuery = query(
    groupsCollection,
    where('memberIds', 'array-contains', userId),
  )

  const result = await getDocs(groupsQuery)

  return result.docs.map((groupDocument) => ({
    id: groupDocument.id,
    ...groupDocument.data(),
  }))
}

export async function getGroupById(groupId) {
  if (!groupId) {
    throw new Error('A group ID is required.')
  }

  const groupReference = doc(db, 'groups', groupId)
  const result = await getDoc(groupReference)

  if (!result.exists()) {
    throw new Error('The selected group could not be found.')
  }

  return {
    id: result.id,
    ...result.data(),
  }
}

export async function joinGroupByInviteCode(inviteCode, user) {
  const code = inviteCode.trim()

  if (!/^\d{6}$/.test(code)) {
    throw new Error('Enter a valid six-digit invitation code.')
  }

  if (!user?.uid) {
    throw new Error('You must be signed in to join a group.')
  }

  const codeQuery = query(
    groupsCollection,
    where('inviteCode', '==', code),
    limit(1),
  )

  const result = await getDocs(codeQuery)

  if (result.empty) {
    throw new Error('No group was found with that invitation code.')
  }

  const groupDocument = result.docs[0]
  const groupReference = groupDocument.ref

  await runTransaction(db, async (transaction) => {
    const latestGroup = await transaction.get(groupReference)

    if (!latestGroup.exists()) {
      throw new Error('This group is no longer available.')
    }

    const groupData = latestGroup.data()
    const memberIds = groupData.memberIds || []
    const members = groupData.members || []

    if (memberIds.includes(user.uid)) {
      throw new Error('You are already a member of this group.')
    }

    const updatedMembers = [...members, createMember(user)]

    transaction.update(groupReference, {
      memberIds: [...memberIds, user.uid],
      members: updatedMembers,
      memberCount: updatedMembers.length,
      updatedAt: serverTimestamp(),
    })
  })

  return groupDocument.id
}

// Everything stored under a group. Firestore does not delete subcollections
// with their parent, so deleting a group has to remove these itself.
const GROUP_SUBCOLLECTIONS = ['shortlist', 'votes', 'listingVotes', 'enquiries', 'listingComments']
const BATCH_LIMIT = 450

async function deleteInBatches(references) {
  for (let start = 0; start < references.length; start += BATCH_LIMIT) {
    const batch = writeBatch(db)
    references.slice(start, start + BATCH_LIMIT).forEach((reference) => batch.delete(reference))
    await batch.commit()
  }
}

// Runs every clean-up step even if one fails, and names the ones that did, so a
// single refused collection does not stop the rest from being removed.
async function runCleanup(steps) {
  const results = await Promise.allSettled(Object.values(steps).map((step) => step()))
  return Object.keys(steps).filter((_, index) => results[index].status === 'rejected')
}

const ownDocs = (groupId, name, userId) =>
  getDocs(query(collection(db, 'groups', groupId, name), where('userId', '==', userId))).then(
    (snapshot) => snapshot.docs.map((item) => item.ref),
  )

// A member who leaves takes their ballots with them, so their preference votes
// and listing votes stop counting towards the group's results. Their listing
// comments go too.
function removeMemberVotes(groupId, userId) {
  return runCleanup({
    'preference votes': () => deleteInBatches([doc(db, 'groups', groupId, 'votes', userId)]),
    'listing votes': async () => deleteInBatches(await ownDocs(groupId, 'listingVotes', userId)),
    comments: async () => deleteInBatches(await ownDocs(groupId, 'listingComments', userId)),
  })
}

// The last member leaving deletes the group, so remove everything stored under
// it and its agreed preferences too, rather than leaving them orphaned.
function deleteGroupData(groupId) {
  return runCleanup({
    ...Object.fromEntries(
      GROUP_SUBCOLLECTIONS.map((name) => [
        name,
        async () =>
          deleteInBatches(
            (await getDocs(collection(db, 'groups', groupId, name))).docs.map((item) => item.ref),
          ),
      ]),
    ),
    'agreed preferences': () => deleteInBatches([doc(db, 'Group_Preferences', groupId)]),
  })
}

/** Thrown by leaveGroup when the user's data could not all be removed first. */
export const CLEANUP_FAILED = 'group/cleanup-failed'

/**
 * Removes the user from a group. If they were its last member the group is
 * deleted along with all of its data.
 *
 * The user's data is removed first, while they are still a member, because
 * the rules only let members do it. If any of it cannot be removed, nothing
 * changes and an error with code CLEANUP_FAILED is thrown (error.failed lists
 * what was left), so the caller can tell the user and offer to retry. Pass
 * { force: true } to leave anyway once the user has agreed.
 * @returns {Promise<{ deleted: boolean, leftBehind: string[] }>}
 */
export async function leaveGroup(groupId, userId, { force = false } = {}) {
  if (!groupId || !userId) {
    throw new Error('Group and user information is required.')
  }

  const groupReference = doc(db, 'groups', groupId)
  const before = await getDoc(groupReference)

  if (!before.exists()) {
    throw new Error('This group is no longer available.')
  }

  const memberIdsBefore = before.data().memberIds || []

  if (!memberIdsBefore.includes(userId)) {
    throw new Error('You are not a member of this group.')
  }

  const isLast = memberIdsBefore.length === 1
  const leftBehind = isLast
    ? await deleteGroupData(groupId)
    : await removeMemberVotes(groupId, userId)

  if (leftBehind.length && !force) {
    const what = leftBehind.join(', ')
    const error = new Error(
      isLast
        ? `Some of the group's data (${what}) could not be deleted, so the group has not been deleted yet.`
        : `Your ${what} could not be removed from the group, so you have not left it yet.`,
    )
    error.code = CLEANUP_FAILED
    error.failed = leftBehind
    throw error
  }

  let deleted = false

  await runTransaction(db, async (transaction) => {
    const groupDocument = await transaction.get(groupReference)

    if (!groupDocument.exists()) {
      throw new Error('This group is no longer available.')
    }

    const groupData = groupDocument.data()
    const memberIds = groupData.memberIds || []
    const members = groupData.members || []

    if (!memberIds.includes(userId)) {
      throw new Error('You are not a member of this group.')
    }

    const updatedMemberIds = memberIds.filter(
      (memberId) => memberId !== userId,
    )

    const updatedMembers = members.filter(
      (member) => member.id !== userId,
    )

    if (updatedMemberIds.length === 0) {
      transaction.delete(groupReference)
      deleted = true
      return
    }

    transaction.update(groupReference, {
      memberIds: updatedMemberIds,
      members: updatedMembers,
      memberCount: updatedMembers.length,
      updatedAt: serverTimestamp(),
    })
  })

  return { deleted, leftBehind }
}