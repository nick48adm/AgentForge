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
        // Public pages — always accessible
        if (path === '/' || path === '/login' || path === '/signup') return true
        // Static assets
        if (path.startsWith('/_next') || path.startsWith('/api/auth')) return true
        // Protected pages — require auth
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
