import {
  deleteUser,
  EmailAuthProvider,
  GoogleAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import { auth } from '../firebase'
import { deletePreferences } from './preferencesService'

// TEMP dev-only test account, read from VITE_DEV_TEST_EMAIL / VITE_DEV_TEST_PASSWORD
// in .env.local. The ternary folds to null in production builds, so the
// credentials are never bundled. Remove once the real login page exists.
const DEV_TEST_ACCOUNT = import.meta.env.DEV
  ? {
      email: import.meta.env.VITE_DEV_TEST_EMAIL,
      password: import.meta.env.VITE_DEV_TEST_PASSWORD,
    }
  : null

function signInDevTestAccount() {
  if (!DEV_TEST_ACCOUNT?.email || !DEV_TEST_ACCOUNT?.password) return Promise.resolve()
  return signInWithEmailAndPassword(auth, DEV_TEST_ACCOUNT.email, DEV_TEST_ACCOUNT.password).catch(
    (error) => console.warn('[dev] Test account sign-in failed:', error.code),
  )
}

let authReady = null

/**
 * Resolves with the signed-in user (or null) once Firebase has restored the
 * session. Safe to call from route guards before the first auth event fires.
 * In dev, signs in the test account on first load if nobody is signed in.
 */
export function getCurrentUser() {
  if (!authReady) {
    authReady = new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, () => {
        unsubscribe()
        resolve()
      })
    }).then(() => (auth.currentUser ? undefined : signInDevTestAccount()))
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
 * requires a recent login), removes their preference docs, then the Auth user.
 */
export async function deleteAccount(password) {
  const user = auth.currentUser
  if (!user) throw new Error('No user is signed in.')

  await reauthenticate(user, password)
  await deletePreferences(user.uid)
  await deleteUser(user)
}
