'use client'
// src/hooks/useChatSocket.ts
// Thin wrapper around socket.io-client for the chat page. Deliberately
// dumb: it doesn't touch React state for message content itself — it just
// tells the page "something changed, go refetch" via the callbacks below,
// so the page reuses its already-correct loadMessages/loadGroups logic
// instead of us hand-merging raw socket payloads into state.
import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { getImpersonationToken } from '@/lib/impersonation'

interface ChatSocketHandlers {
  onMessage?: (msg: any) => void
  onMessageEdited?: (msg: any) => void
  onMessageDeleted?: (data: { id: string; chatGroupId: string }) => void
  onReaction?: (data: { messageId: string; chatGroupId: string }) => void
  onPinToggled?: (data: { messageId: string; chatGroupId: string; isPinned: boolean }) => void
  onGroupUpdated?: (data: { chatGroupId: string }) => void
  onTyping?: (data: { groupId: string; userId: string; userName: string }) => void
}

export function useChatSocket(handlers: ChatSocketHandlers) {
  const [connected, setConnected] = useState(false)
  const socketRef = useRef<Socket | null>(null)
  // Always-latest handlers without needing to reconnect the socket when
  // the page's callbacks change identity across renders.
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    const socket = io({
      path: '/socket.io',
      auth: { token: getImpersonationToken() || undefined },
      withCredentials: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      timeout: 8000,
    })
    socketRef.current = socket

    socket.on('connect', () => setConnected(true))
    socket.on('disconnect', () => setConnected(false))
    socket.on('connect_error', () => setConnected(false))

    socket.on('chat:message', (m) => handlersRef.current.onMessage?.(m))
    socket.on('chat:messageEdited', (m) => handlersRef.current.onMessageEdited?.(m))
    socket.on('chat:messageDeleted', (d) => handlersRef.current.onMessageDeleted?.(d))
    socket.on('chat:reaction', (d) => handlersRef.current.onReaction?.(d))
    socket.on('chat:pinToggled', (d) => handlersRef.current.onPinToggled?.(d))
    socket.on('chat:groupUpdated', (d) => handlersRef.current.onGroupUpdated?.(d))
    socket.on('chat:typing', (d) => handlersRef.current.onTyping?.(d))

    return () => { socket.disconnect() }
  }, [])

  const joinGroups = useCallback((groupIds: string[]) => {
    socketRef.current?.emit('chat:join', groupIds)
  }, [])

  const leaveGroup = useCallback((groupId: string) => {
    socketRef.current?.emit('chat:leave', groupId)
  }, [])

  const sendTyping = useCallback((groupId: string, userName: string) => {
    socketRef.current?.emit('chat:typing', { groupId, userName })
  }, [])

  return { connected, joinGroups, leaveGroup, sendTyping }
}
