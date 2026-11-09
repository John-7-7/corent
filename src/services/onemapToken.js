import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'

/**
 * The OneMap access token, shared by every OneMap-backed service.
 *
 * OneMap issues a short-lived token (about three days) from an account email
 * and password. The password must never reach the client, it would ship in
 * the bundle, so the app only ever sees a token someone else minted. Two
 * sources, in order:
 *
 *   1. Firestore config/onemap { token }, readable by signed-in users,
 *      writable by nobody (see firestore.rules). Rotating it needs no deploy,
 *      which is what lets scripts/refresh-onemap-token.mjs run on a schedule.
 *   2. VITE_ONEMAP_TOKEN in .env, simpler for local work, but bundled.
 *
 * Resolved once per page load and memoised; call resetToken() after a rotation.
 */
let tokenPromise = null

async function readToken() {
  try {
    const snap = await getDoc(doc(db, 'config', 'onemap'))
    const token = snap.exists() ? snap.data().token : null
    if (token) return token
  } catch {
    // Unreadable config (rules, offline) just falls through to the env var.
  }
  return import.meta.env.VITE_ONEMAP_TOKEN || null
}

export function getToken() {
  if (!tokenPromise) tokenPromise = readToken()
  return tokenPromise
}

/** Call after rotating the token so the next request picks it up. */
export function resetToken() {
  tokenPromise = null
}
