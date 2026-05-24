import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { db } from './db'
import { verifyPassword, isLegacyPlaintext, hashPassword } from './crypto'

if (!process.env.NEXTAUTH_SECRET) {
  throw new Error('NEXTAUTH_SECRET environment variable is not set. Generate one with: openssl rand -hex 32')
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
          valid = user.password === credentials.password
          if (valid) {
            const hashed = await hashPassword(credentials.password)
            await db.user.update({ where: { id: user.id }, data: { password: hashed } })
          }
        } else {
          valid = await verifyPassword(credentials.password, user.password)
        }

        if (!valid) return null

        return { id: user.id, name: user.name, email: user.email, image: user.image, role: user.role, plan: user.plan } as any
      },
    }),
  ],
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 }, // 30 days
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role
        token.plan = (user as any).plan
        token.userId = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        ;(session.user as any).role = token.role
        ;(session.user as any).plan = token.plan
        ;(session.user as any).id = token.userId
      }
      return session
    },
  },
  pages: { signIn: '/' },
  secret: process.env.NEXTAUTH_SECRET,
}
