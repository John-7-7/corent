/**
 * Mints a fresh OneMap token and writes it to Firestore config/onemap.
 *
 *   node scripts/refresh-onemap-token.mjs
 *
 * OneMap tokens last about three days, which is short enough that doing this
 * by hand means it will eventually be expired at the worst moment. The app
 * degrades rather than breaks when that happens, routingService falls back to
 * straight-line estimates and labels them, but estimates do not count towards
 * the match percentage, so the numbers quietly get worse.
 *
 * Reads from the environment, never from a file in the repo:
 *   ONEMAP_EMAIL, ONEMAP_PASSWORD        the OneMap account
 *   GOOGLE_APPLICATION_CREDENTIALS       path to a Firebase service-account
 *                                        key, or FIREBASE_SERVICE_ACCOUNT
 *                                        holding the JSON itself (for CI)
 *
 * config/onemap is `allow write: if false` in firestore.rules, so no browser
 * can touch it. The Admin SDK bypasses rules, which is exactly why the
 * credentials live here and not in the app.
 */
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

const email = process.env.ONEMAP_EMAIL
const password = process.env.ONEMAP_PASSWORD
if (!email || !password) {
  console.error('Set ONEMAP_EMAIL and ONEMAP_PASSWORD.')
  process.exit(1)
}

const response = await fetch('https://www.onemap.gov.sg/api/auth/post/getToken', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
})
if (!response.ok) {
  console.error(`OneMap auth failed: ${response.status} ${response.statusText}`)
  process.exit(1)
}

const auth = await response.json()
const token = auth.access_token ?? auth.accessToken
if (!token) {
  console.error('OneMap returned no access_token. Response keys:', Object.keys(auth).join(', '))
  process.exit(1)
}

// expiry_timestamp is seconds since the epoch when OneMap sends it.
const expirySeconds = Number(auth.expiry_timestamp ?? auth.expiryTimestamp)
const expiresAt = Number.isFinite(expirySeconds) ? new Date(expirySeconds * 1000) : null

const inlineKey = process.env.FIREBASE_SERVICE_ACCOUNT
initializeApp(
  inlineKey ? { credential: cert(JSON.parse(inlineKey)) } : { credential: applicationDefault() },
)

await getFirestore()
  .doc('config/onemap')
  .set(
    {
      token,
      // Stored so a human can see at a glance whether the scheduled job is
      // still running, without decoding the JWT.
      expiresAt: expiresAt ?? null,
      rotatedAt: FieldValue.serverTimestamp(),
      rotatedBy: 'scripts/refresh-onemap-token.mjs',
    },
    { merge: true },
  )

console.log(
  `config/onemap updated${expiresAt ? `, expires ${expiresAt.toISOString()}` : ''}`,
)
