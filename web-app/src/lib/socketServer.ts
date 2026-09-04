// src/lib/socketServer.ts
// Thin accessor for the Socket.io instance server.js attaches to
// `global.__chatIO`. Deliberately fire-and-forget: if the socket layer
// isn't running (still `next start` instead of `node server.js`, or a
// user's browser never connected), these are no-ops — the request that
// wrote to the DB has already succeeded, and the existing polling in
// chat/page.tsx picks the change up regardless. Real-time is additive,
// never load-bearing.
export function emitToGroup(groupId: string, event: string, payload: any) {
  try {
    const io = (global as any).__chatIO
    if (!io) return
    io.to(`group:${groupId}`).emit(event, payload)
  } catch {
    // never let a broadcast failure affect the API response
  }
}

export function emitToUser(userId: string, event: string, payload: any) {
  try {
    const io = (global as any).__chatIO
    if (!io) return
    io.to(`user:${userId}`).emit(event, payload)
  } catch {
    // ignore
  }
}
