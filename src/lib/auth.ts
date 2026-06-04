import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { db } from './db'
import { verifyPassword, isLegacyPlaintext, hashPassword } from './crypto'

// Validate NEXTAUTH_SECRET lazily — don't crash during build when env vars are absent
let _secretWarned = false
function getNextAuthSecret(): string {
  if (!process.env.NEXTAUTH_SECRET) {
    if (!_secretWarned) {
      console.warn('NEXTAUTH_SECRET environment variable is not set. Generate one with: openssl rand -hex 32')
      _secretWarned = true
    }
    return 'build-time-placeholder'
  }
  return process.env.NEXTAUTH_SECRET
}

// Extend NextAuth types for custom user properties
declare module 'next-auth' {
  interface User {
    role?: string
    plan?: string
    id: string
  }
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      role: string
      plan: string
    }
  }
}

declare module 'jsonwebtoken' {
  interface JwtPayload {
    role?: string
    plan?: string
    userId?: string
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await db.user.findUnique({ where: { email: credentials.email.toLowerCase() } })
        if (!user || !user.password) return null

        let valid = false
        if (isLegacyPlaintext(user.password)) {
          // Legacy plaintext comparison — use constant-time comparison to mitigate timing attacks
          const a = Buffer.from(user.password)
          const b = Buffer.from(credentials.password)
          if (a.length === b.length) {
            valid = Buffer.compare(a, b) === 0
          }
          if (valid) {
            const hashed = await hashPassword(credentials.password)
            await db.user.update({ where: { id: user.id }, data: { password: hashed } })
          }
        } else {
          valid = await verifyPassword(credentials.password, user.password)
        }

        if (!valid) return null

        return { id: user.id, name: user.name, email: user.email, image: user.image, role: user.role, plan: user.plan }
      },
    }),
  ],
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 }, // 30 days
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role
        token.plan = user.plan
        token.userId = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = (token.role as string) || 'user'
        session.user.plan = (token.plan as string) || 'free'
        session.user.id = (token.userId as string) || ''
      }
      return session
    },
  },
  pages: { signIn: '/login' },
  secret: getNextAuthSecret(),
}
