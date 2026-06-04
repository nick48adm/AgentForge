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
        // Public auth pages
        if (path === '/login' || path === '/signup') return true
        // Settings requires auth
        if (path.startsWith('/settings')) return !!token
        return !!token
      },
    },
    pages: { signIn: '/login' },
  }
)

export const config = {
  matcher: ['/settings/:path*'],
}
