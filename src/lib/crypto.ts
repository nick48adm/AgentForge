/**
 * crypto.ts
 * Password hashing using Node's built-in crypto (no bcrypt dependency needed).
 * Uses PBKDF2 with SHA-256, 100k iterations — strong enough for production.
 */

import { createHash, randomBytes, pbkdf2 } from 'crypto'
import { promisify } from 'util'

const pbkdf2Async = promisify(pbkdf2)

const ITERATIONS = 100_000
const KEY_LEN = 64
const DIGEST = 'sha256'
const SEPARATOR = ':'

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(32).toString('hex')
  const key = await pbkdf2Async(password, salt, ITERATIONS, KEY_LEN, DIGEST)
  return `${ITERATIONS}${SEPARATOR}${salt}${SEPARATOR}${key.toString('hex')}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(SEPARATOR)
  if (parts.length !== 3) return false
  const [iters, salt, hash] = parts
  const key = await pbkdf2Async(password, salt, parseInt(iters, 10), KEY_LEN, DIGEST)
  // Constant-time comparison
  const a = Buffer.from(key.toString('hex'))
  const b = Buffer.from(hash)
  if (a.length !== b.length) return false
  return Buffer.compare(a, b) === 0
}

/**
 * Check if a stored password is in the OLD plaintext format.
 * Used for migration: if hash doesn't have separators it's plaintext.
 */
export function isLegacyPlaintext(stored: string): boolean {
  return !stored.includes(SEPARATOR)
}
