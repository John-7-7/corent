import {
  deleteUser,
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  GoogleAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  signInWithPopup,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  updateProfile,
} from 'firebase/auth'
import { auth } from '../firebase'
import { getUserGroups, leaveGroup } from './groupService'
import { deletePreferences } from './preferencesService'

let authReady = null

/**
 * Resolves with the signed-in user (or null) once Firebase has restored the
 * session. Safe to call from route guards before the first auth event fires.
 */
export function getCurrentUser() {
  if (!authReady) {
    authReady = new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, () => {
        unsubscribe()
        resolve()
      })
    })
  }
  return authReady.then(() => auth.currentUser)
}

/** Subscribes to sign-in/sign-out changes. Returns an unsubscribe function. */
export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback)
}

export function signOutUser() {
  return signOut(auth)
}

export async function registerAccount(name, email, password) {
  const displayName = name.trim()
  if (!displayName) throw new Error('Enter your name to continue.')
  const credential = await createUserWithEmailAndPassword(auth, email.trim(), password)
  await updateProfile(credential.user, { displayName })
  return credential.user
}

export async function signInWithGoogle() {
  const credential = await signInWithPopup(auth, new GoogleAuthProvider())
  return credential.user
}

export async function signInUser(email, password) {
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password)
  return credential.user
}

export async function updateAccountName(name) {
  const user = auth.currentUser
  if (!user) throw new Error('No user is signed in.')
  const displayName = name.trim()
  if (!displayName) throw new Error('Enter your name to continue.')
  await updateProfile(user, { displayName })
  return user
}

export async function changeAccountPassword(currentPassword, newPassword) {
  const user = auth.currentUser
  if (!user) throw new Error('No user is signed in.')
  if (!usesPasswordSignIn(user)) {
    throw new Error('Password changes are only available for email and password accounts.')
  }

  await reauthenticateWithCredential(
    user,
    EmailAuthProvider.credential(user.email, currentPassword),
  )
  await updatePassword(user, newPassword)
}

/** True when the user signed up with email + password (so re-auth needs a password). */
export function usesPasswordSignIn(user = auth.currentUser) {
  return Boolean(user?.providerData.some((p) => p.providerId === EmailAuthProvider.PROVIDER_ID))
}

function reauthenticate(user, password) {
  if (usesPasswordSignIn(user)) {
    return reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password))
  }
  return reauthenticateWithPopup(user, new GoogleAuthProvider())
}

/**
 * Deletes the signed-in user's account (F-REQ-006): re-authenticates (Firebase
 * requires a recent login), leaves every group, removes their preference docs,
 * then the Auth user.
 *
 * Leaving matters: group decisions finalise only once every member confirms,
 * so a deleted account still listed as a member would block its groups for
 * good and inflate the household size used for budgets. Leaving keeps the
 * group's shared shortlist and decisions for the remaining members, and
 * deletes the group outright if this was its last member.
 */
export async function deleteAccount(password) {
  const user = auth.currentUser
  if (!user) throw new Error('No user is signed in.')

  await reauthenticate(user, password)
  const groups = await getUserGroups(user.uid)

  // Try every group, so one failure does not hide how the others went. Data
  // that cannot be tidied up does not block it: the account is going anyway.
  const failed = []
  for (const group of groups) {
    try {
      await leaveGroup(group.id, user.uid, { force: true })
    } catch {
      failed.push(group.name || 'a group')
    }
  }
  // Stop before deleting anything else: an account still listed in a group
  // would block that group's decisions. Running delete again picks up where
  // this left off, because groups already left are no longer listed.
  if (failed.length) {
    const left = groups.length - failed.length
    throw new Error(
      `Your account was not deleted, because you could not be removed from ${failed.join(', ')}.` +
        (left ? ` You have already left ${left} other group${left === 1 ? '' : 's'}.` : '') +
        ' Please try again.',
    )
  }

  await deletePreferences(user.uid)
  await deleteUser(user)
}
