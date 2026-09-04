// server.js
// Wraps Next.js in a plain Node http server so Socket.io can attach to it —
// this is what powers real-time chat. If this file isn't used to start the
// app (e.g. still running the old `next start`), the chat simply falls
// back to its existing polling — see src/lib/socketServer.ts, every emit
// there is a safe no-op when there's no socket layer running.
const { createServer } = require('http')
const next = require('next')
const { Server } = require('socket.io')
const { jwtVerify } = require('jose')

const dev = process.env.NODE_ENV !== 'production'
const port = parseInt(process.env.PORT || '3008', 10)
const app = next({ dev })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  // Read after prepare() — Next.js loads .env / .env.local / .env.production
  // as part of its own bootstrap, so process.env is only reliably filled in
  // by this point.
  const JWT_SECRET = new TextEncoder().encode(
    process.env.JWT_SECRET || 'fallback-secret-change-in-production'
  )

  const httpServer = createServer((req, res) => handle(req, res))

  const io = new Server(httpServer, {
    path: '/socket.io',
    cors: { origin: true, credentials: true },
  })

  // Same JWT the rest of the app already trusts. Two ways in:
  //  - handshake.auth.token: an explicit token the client read from
  //    sessionStorage — used only by an impersonation tab, since the
  //    normal auth-token cookie is httpOnly and JS can't read it anyway.
  //  - the auth-token cookie itself: sent automatically by the browser on
  //    the WebSocket handshake request (same-origin), same as any other
  //    request — this is how a normal (non-impersonating) tab authenticates.
  function parseCookie(header, name) {
    if (!header) return null
    const match = header.split(';').map(s => s.trim()).find(s => s.startsWith(name + '='))
    return match ? decodeURIComponent(match.slice(name.length + 1)) : null
  }

  io.use(async (socket, nextFn) => {
    try {
      const token = socket.handshake.auth?.token || parseCookie(socket.handshake.headers.cookie, 'auth-token')
      if (!token) return nextFn(new Error('No token'))
      const { payload } = await jwtVerify(token, JWT_SECRET)
      socket.data.userId = payload.userId
      socket.data.role = payload.role
      nextFn()
    } catch {
      nextFn(new Error('Invalid token'))
    }
  })

  io.on('connection', (socket) => {
    const userId = socket.data.userId
    if (userId) socket.join(`user:${userId}`)

    // Client tells us which chat groups it's a member of, so this socket
    // joins those rooms — every action is still permission-checked
    // server-side in the normal REST routes regardless, so this is just
    // "which rooms to relay to", not an access decision.
    socket.on('chat:join', (groupIds) => {
      if (Array.isArray(groupIds)) {
        groupIds.slice(0, 300).forEach((gid) => {
          if (typeof gid === 'string') socket.join(`group:${gid}`)
        })
      }
    })
    socket.on('chat:leave', (groupId) => {
      if (typeof groupId === 'string') socket.leave(`group:${groupId}`)
    })
    socket.on('chat:typing', ({ groupId, userName }) => {
      if (groupId) socket.to(`group:${groupId}`).emit('chat:typing', { groupId, userId, userName })
    })
  })

  // API route handlers run in this same process — stash the io instance
  // globally so they can emit after writing to the DB.
  global.__chatIO = io

  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port} — dev=${dev}, socket.io attached`)
  })
})
