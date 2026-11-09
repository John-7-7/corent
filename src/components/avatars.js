/**
 * Member pictures, shared by every avatar in the app.
 *
 * A member's own photo (Google sign-in) when there is one; otherwise a 3D
 * character chosen from their account id, so the same person has the same face
 * on every page and for every teammate. The characters are Microsoft Fluent
 * Emoji (MIT), kept in public/avatars so no third-party request is made.
 */
export const AVATAR_COUNT = 10

/** The 3D character for an account id. Stable: the id is only hashed locally. */
export function memojiFor(uid) {
  let hash = 0
  for (const char of String(uid ?? '')) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return `/avatars/avatar-${(hash % AVATAR_COUNT) + 1}.png`
}

/** The picture to show for a member: their photo, else their 3D character. */
export function avatarFor(uid, photo) {
  return photo || memojiFor(uid)
}
