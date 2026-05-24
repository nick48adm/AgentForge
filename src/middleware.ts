import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized({ token, req }) {
        const path = req.nextUrl.pathname
        const publicPaths = [
          '/api/auth',
          '/api/telegram/webhook',
          '/api/channels/widget',   // widget script + widget chat — public
          '/api/channels/whatsapp/webhook',
          '/api/channels/discord/webhook',
        ]
        if (publicPaths.some(p => path.startsWith(p))) return true
        return !!token
      },
    },
    pages: { signIn: '/' },
  }
)

export const config = {
  matcher: ['/api/admin/:path*'],
}
