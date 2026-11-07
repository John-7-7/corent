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

export async function leaveGroup(groupId, userId) {
  if (!groupId || !userId) {
    throw new Error('Group and user information is required.')
  }

  const groupReference = doc(db, 'groups', groupId)

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
      return
    }

    transaction.update(groupReference, {
      memberIds: updatedMemberIds,
      members: updatedMembers,
      memberCount: updatedMembers.length,
      updatedAt: serverTimestamp(),
    })
  })
}