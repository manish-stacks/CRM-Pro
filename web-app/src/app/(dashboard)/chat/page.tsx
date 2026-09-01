'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '@/hooks/useAuth'
import api from '@/lib/axios'
import { Button, Input, Select, Modal } from '@/components/ui'
import { getInitials } from '@/lib/utils'
import {
  MessageSquare, Search, Plus, Send, Loader2, Users2, User,
  Paperclip, X, ChevronLeft, Smile, Trash2, Image as ImageIcon,
  UserPlus, ShieldCheck, MoreVertical, LogOut, Info, Pin, Reply,
  Check, CheckCheck, SmilePlus
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function ChatPage() {
  const { user } = useAuth()
  const [groups, setGroups] = useState<any[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [loadingGroups, setLoadingGroups] = useState(true)
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const [msgText, setMsgText] = useState('')
  const [sending, setSending] = useState(false)
  const [showEmoji, setShowEmoji] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [users, setUsers] = useState<any[]>([])
  const [showNewChat, setShowNewChat] = useState(false)
  const [newChatForm, setNewChatForm] = useState({ type: 'DIRECT', name: '', memberIds: [] as string[] })
  const [memberSearch, setMemberSearch] = useState('')

  // Group members management
  const [showMembers, setShowMembers] = useState(false)
  const [showAddMembers, setShowAddMembers] = useState(false)
  const [addMemberIds, setAddMemberIds] = useState<string[]>([])
  const [memberActionId, setMemberActionId] = useState<string | null>(null) // userId currently being acted on

  // @mention picker
  const [showMentionPicker, setShowMentionPicker] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [pendingMentionIds, setPendingMentionIds] = useState<string[]>([])

  // Per-message action menu + delete
  const [openMsgMenu, setOpenMsgMenu] = useState<string | null>(null)
  const [deletingMsgId, setDeletingMsgId] = useState<string | null>(null)
  // Both floating menus below render via a portal into <body> with a
  // computed fixed position, instead of `absolute` inside the scrollable
  // message list — an `absolute bottom-full` menu on a message near the
  // top of that list has nowhere to open upward into and gets clipped by
  // the list's own overflow (looks "hidden behind the header").
  const [msgMenuPos, setMsgMenuPos] = useState<{ top: number; left: number } | null>(null)
  const [reactionPickerPos, setReactionPickerPos] = useState<{ top: number; left: number } | null>(null)
  const msgMenuRef = useRef<HTMLDivElement>(null)
  const reactionPickerRef = useRef<HTMLDivElement>(null)

  // Typing indicator
  const [typingUsers, setTypingUsers] = useState<any[]>([])
  const lastTypingPingRef = useRef(0)

  // Reply / quote
  const [replyingTo, setReplyingTo] = useState<any | null>(null)

  // Reactions
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null)
  const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏']

  // Pinned messages
  const [pinnedMessages, setPinnedMessages] = useState<any[]>([])
  const [showPinned, setShowPinned] = useState(false)

  // Global message search
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)

  // Edit message
  const [editingMessage, setEditingMessage] = useState<any | null>(null)

  // Forward message
  const [forwardingMessage, setForwardingMessage] = useState<any | null>(null)
  const [forwardGroupIds, setForwardGroupIds] = useState<string[]>([])
  const [forwarding, setForwarding] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const pollRef = useRef<any>(null)
  // Per-group message cache — switching back to a chat shows instantly,
  // exactly like WhatsApp, instead of flashing a spinner every time.
  const msgCacheRef = useRef<Record<string, any[]>>({})
  const activeIdRef = useRef<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const wishHandled = useRef(false)

  // Works out where a floating menu should land on screen, given the
  // trigger button's rect: opens upward when that has more room, downward
  // otherwise, and keeps it clamped inside the viewport horizontally.
  const computeFloatingPos = (triggerEl: HTMLElement, width: number, height: number, alignRight: boolean) => {
    const rect = triggerEl.getBoundingClientRect()
    const spaceAbove = rect.top
    const spaceBelow = window.innerHeight - rect.bottom
    const openUp = spaceBelow < height + 8 && spaceAbove > spaceBelow
    const top = openUp ? rect.top - height - 4 : rect.bottom + 4
    let left = alignRight ? rect.right - width : rect.left
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8))
    return { top, left }
  }

  // Close the message-action menu on an outside click, or on scroll/resize
  // (its fixed position isn't tracked live, so keeping it open through a
  // scroll would leave it floating over the wrong message).
  useEffect(() => {
    if (!openMsgMenu || openMsgMenu === '__chat__') return
    const handleMouseDown = (e: MouseEvent) => {
      if (msgMenuRef.current && !msgMenuRef.current.contains(e.target as Node)) setOpenMsgMenu(null)
    }
    const close = () => setOpenMsgMenu(null)
    document.addEventListener('mousedown', handleMouseDown)
    scrollRef.current?.addEventListener('scroll', close)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      scrollRef.current?.removeEventListener('scroll', close)
      window.removeEventListener('resize', close)
    }
  }, [openMsgMenu])

  useEffect(() => {
    if (!reactionPickerFor) return
    const handleMouseDown = (e: MouseEvent) => {
      if (reactionPickerRef.current && !reactionPickerRef.current.contains(e.target as Node)) setReactionPickerFor(null)
    }
    const close = () => setReactionPickerFor(null)
    document.addEventListener('mousedown', handleMouseDown)
    scrollRef.current?.addEventListener('scroll', close)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      scrollRef.current?.removeEventListener('scroll', close)
      window.removeEventListener('resize', close)
    }
  }, [reactionPickerFor])

  const EMOJIS = ['😀','😁','😂','🤣','😊','😍','😘','😎','🤩','🥳','👍','👏','🙏','💪','🔥','🎉','🎂','🥂','❤️','💯','✅','👌','🙌','😅','😉','😇','🤔','😢','😭','😡','🚀','⭐','💡','📌','☕','👋']

  const loadGroups = useCallback(async () => {
    try {
      const r = await api.get('/chat/groups')
      setGroups(r.data.data || [])
    } catch {} finally { setLoadingGroups(false) }
  }, [])

  /** Is the user parked at the bottom of the thread? (within ~80px) */
  const isAtBottom = () => {
    const el = scrollRef.current
    if (!el) return true
    return el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  /**
   * `silent` = background poll: never show a spinner, never yank the scroll
   * position, and don't re-render when nothing actually changed.
   */
  const loadMessages = useCallback(async (groupId: string, silent = false) => {
    const cached = msgCacheRef.current[groupId]
    if (!silent) {
      // Show cached messages immediately; only spin when we have nothing at all.
      if (cached) { setMessages(cached); setLoadingMsgs(false) }
      else { setMessages([]); setLoadingMsgs(true) }
    }
    try {
      const r = await api.get(`/chat/groups/${groupId}/messages?limit=100`)
      const payload = r.data.data || {}
      const next = payload.messages || []
      msgCacheRef.current[groupId] = next
      // Ignore a response that landed after the user switched chats
      if (activeIdRef.current !== groupId) return

      setTypingUsers(payload.typingUsers || [])
      setPinnedMessages(payload.pinned || [])

      const stick = isAtBottom()
      setMessages(prev => {
        // No change → skip the state update entirely (no flicker, no re-render)
        if (prev.length === next.length &&
            prev.length > 0 &&
            prev[prev.length - 1]?.id === next[next.length - 1]?.id &&
            !prev.some((m: any) => m._optimistic)) {
          return prev
        }
        return next
      })
      if (!silent || stick) {
        setTimeout(() => {
          const el = scrollRef.current
          if (el) el.scrollTo({ top: el.scrollHeight, behavior: silent ? 'smooth' : 'auto' })
        }, 40)
      }
    } catch {} finally { if (!silent) setLoadingMsgs(false) }
  }, [])

  useEffect(() => { loadGroups() }, [loadGroups])

  // Wishing flow: /chat?wish=<userId>&name=..&type=birthday|anniversary
  // → open/create DIRECT chat with that person and auto-send a wish message.
  useEffect(() => {
    if (wishHandled.current) return
    const params = new URLSearchParams(window.location.search)
    const wishUserId = params.get('wish')
    if (!wishUserId) return
    wishHandled.current = true
    const name = params.get('name') || 'there'
    const type = params.get('type') || 'birthday'
    const text = type === 'anniversary'
      ? `🎊 Happy Work Anniversary, ${name}! Thank you for your wonderful contribution — here's to many more! 🙌`
      : `🎉🎂 Happy Birthday, ${name}! Wishing you a fantastic year ahead full of joy and success. 🥳`
    ;(async () => {
      try {
        const r = await api.post('/chat/groups', { type: 'DIRECT', memberIds: [wishUserId] })
        const gid = r.data.data.id
        await api.post(`/chat/groups/${gid}/messages`, { content: text })
        await loadGroups()
        setActiveId(gid)
        toast.success('Wish sent 🎉')
      } catch { toast.error('Failed to send wish') }
      finally { window.history.replaceState({}, '', '/chat') }
    })()
  }, [loadGroups])
  useEffect(() => {
    api.get('/users/by-role?roles=EMPLOYEE,MANAGER,TELECALLER,MARKETING_EXECUTIVE,ADMIN,SUPER_ADMIN')
      .then(r => setUsers((r.data.data || []).filter((u: any) => u.id !== user?.id)))
      .catch(() => {})
  }, [user?.id])

  // Presence heartbeat — lets other people see "Online" / "Last seen ...".
  useEffect(() => {
    const ping = () => api.post('/users/heartbeat').catch(() => {})
    ping()
    const t = setInterval(ping, 20000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    activeIdRef.current = activeId
    if (!activeId) return
    loadMessages(activeId)
    // Poll for new messages every 5s — silent, so the thread never flickers
    pollRef.current = setInterval(() => {
      if (document.visibilityState === 'visible') loadMessages(activeId, true)
    }, 5000)
    return () => clearInterval(pollRef.current)
  }, [activeId, loadMessages])

  const send = async () => {
    if (!msgText.trim() || !activeId) return
    if (editingMessage) return saveEdit()
    setSending(true)
    const optimistic = {
      id: 'tmp-' + Date.now(),
      content: msgText,
      sender: { id: user?.id, name: user?.name, avatar: user?.avatar },
      createdAt: new Date().toISOString(),
      replyTo: replyingTo ? { id: replyingTo.id, content: replyingTo.content, sender: replyingTo.sender, isDeleted: replyingTo.isDeleted, attachmentName: replyingTo.attachmentName } : null,
      _optimistic: true,
    }
    setMessages(m => [...m, optimistic])
    const mentionIds = pendingMentionIds
    const replyToId = replyingTo?.id
    setMsgText('')
    setPendingMentionIds([])
    setReplyingTo(null)
    pingTyping(true) // tell others we stopped typing
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 50)
    try {
      await api.post(`/chat/groups/${activeId}/messages`, { content: optimistic.content, mentionUserIds: mentionIds, replyToId })
      loadMessages(activeId, true)
      loadGroups()  // bump order
    } catch { toast.error('Failed to send'); loadMessages(activeId, true) }
    finally { setSending(false) }
  }

  // Throttled "I'm typing" ping — at most once every 3s while actively
  // typing, plus an explicit "stopped" ping on send/blur/empty box.
  const pingTyping = (stopped = false) => {
    if (!activeId) return
    const now = Date.now()
    if (!stopped && now - lastTypingPingRef.current < 3000) return
    lastTypingPingRef.current = now
    api.post(`/chat/groups/${activeId}/typing`, { stopped }).catch(() => {})
  }

  const insertEmoji = (e: string) => {
    setMsgText(t => t + e)
  }

  // Detect "@" so we can show a mention picker (GROUP chats only).
  const onComposeChange = (val: string) => {
    setMsgText(val)
    if (val.trim()) pingTyping(false)
    else pingTyping(true)
    if (activeGroup?.type !== 'GROUP') { setShowMentionPicker(false); return }
    const atIdx = val.lastIndexOf('@')
    if (atIdx === -1) { setShowMentionPicker(false); return }
    const after = val.slice(atIdx + 1)
    if (/\s/.test(after) || after.length > 30) { setShowMentionPicker(false); return }
    setMentionQuery(after.toLowerCase())
    setShowMentionPicker(true)
  }

  const pickMention = (m: any) => {
    setMsgText(t => {
      const atIdx = t.lastIndexOf('@')
      return t.slice(0, atIdx) + `@${m.name} `
    })
    setPendingMentionIds(ids => Array.from(new Set([...ids, m.id])))
    setShowMentionPicker(false)
  }

  const sendImage = async (file: File) => {
    if (!activeId || !file) return
    if (file.size > 8 * 1024 * 1024) { toast.error('Max 8MB'); return }
    setUploading(true)
    try {
      const dataUrl: string = await new Promise((res, rej) => {
        const r = new FileReader()
        r.onload = () => res(r.result as string)
        r.onerror = rej
        r.readAsDataURL(file)
      })
      const up = await api.post('/upload', { dataUrl, folder: 'chat-attachments' })
      await api.post(`/chat/groups/${activeId}/messages`, {
        content: '',
        attachmentUrl: up.data.data.url,
        attachmentType: file.type,
        attachmentName: file.name,
      })
      loadMessages(activeId, true)
      loadGroups()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Upload failed')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const deleteGroup = async (forEveryone = false) => {
    if (!activeId || !activeGroup) return
    const label = activeGroup.type === 'DIRECT' ? 'chat' : 'group'
    const msg = forEveryone
      ? `Delete this ${label} for everyone? This removes all messages for every member.`
      : `Delete this ${label} for yourself? The other ${activeGroup.type === 'DIRECT' ? 'person' : 'members'} will keep it as-is.`
    if (!confirm(msg)) return
    setDeleting(true)
    try {
      await api.delete(`/chat/groups/${activeId}${forEveryone ? '?forEveryone=1' : ''}`)
      toast.success(forEveryone ? 'Deleted for everyone' : 'Chat removed from your list')
      delete msgCacheRef.current[activeId]
      setActiveId(null)
      setMessages([])
      setShowMembers(false)
      await loadGroups()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Delete failed')
    } finally { setDeleting(false) }
  }

  const addMembers = async () => {
    if (!activeId || addMemberIds.length === 0) return
    try {
      await api.post(`/chat/groups/${activeId}/members`, { memberIds: addMemberIds })
      toast.success('Members added')
      setShowAddMembers(false)
      setAddMemberIds([])
      await loadGroups()
    } catch (e: any) { toast.error(e.response?.data?.error || 'Failed to add members') }
  }

  const removeMember = async (userId: string, selfLeave = false) => {
    if (!activeId) return
    if (!confirm(selfLeave ? 'Leave this group?' : 'Remove this member from the group?')) return
    setMemberActionId(userId)
    try {
      await api.delete(`/chat/groups/${activeId}/members`, { data: { userId } })
      toast.success(selfLeave ? 'You left the group' : 'Member removed')
      if (selfLeave) { setActiveId(null); setMessages([]); setShowMembers(false) }
      await loadGroups()
    } catch (e: any) { toast.error(e.response?.data?.error || 'Failed') }
    finally { setMemberActionId(null) }
  }

  const changeRole = async (userId: string, role: 'ADMIN' | 'MEMBER') => {
    if (!activeId) return
    setMemberActionId(userId)
    try {
      await api.patch(`/chat/groups/${activeId}/members`, { userId, role })
      toast.success(role === 'ADMIN' ? 'Made admin' : 'Removed as admin')
      await loadGroups()
    } catch (e: any) { toast.error(e.response?.data?.error || 'Failed') }
    finally { setMemberActionId(null) }
  }

  const deleteMessage = async (messageId: string, forEveryone: boolean) => {
    if (!activeId) return
    if (!confirm(forEveryone ? 'Delete this message for everyone?' : 'Delete this message for yourself?')) return
    setDeletingMsgId(messageId)
    setOpenMsgMenu(null)
    try {
      await api.delete(`/chat/messages/${messageId}${forEveryone ? '?forEveryone=1' : ''}`)
      setMessages(prev => forEveryone
        ? prev.map(m => m.id === messageId ? { ...m, isDeleted: true, content: '' } : m)
        : prev.filter(m => m.id !== messageId))
      if (msgCacheRef.current[activeId]) {
        msgCacheRef.current[activeId] = forEveryone
          ? msgCacheRef.current[activeId].map(m => m.id === messageId ? { ...m, isDeleted: true, content: '' } : m)
          : msgCacheRef.current[activeId].filter(m => m.id !== messageId)
      }
    } catch (e: any) { toast.error(e.response?.data?.error || 'Delete failed') }
    finally { setDeletingMsgId(null) }
  }

  const toggleReaction = async (messageId: string, emoji: string) => {
    setReactionPickerFor(null)
    const msg = messages.find(m => m.id === messageId)
    const mine = msg?.reactions?.find((r: any) => r.user?.id === user?.id)
    // Optimistic update
    setMessages(prev => prev.map(m => {
      if (m.id !== messageId) return m
      let reactions = (m.reactions || []).filter((r: any) => r.user?.id !== user?.id)
      if (!(mine && mine.emoji === emoji)) reactions = [...reactions, { user: { id: user?.id, name: user?.name }, emoji }]
      return { ...m, reactions }
    }))
    try {
      if (mine && mine.emoji === emoji) await api.delete(`/chat/messages/${messageId}/react`)
      else await api.post(`/chat/messages/${messageId}/react`, { emoji })
      if (activeId) loadMessages(activeId, true)
    } catch { toast.error('Failed'); if (activeId) loadMessages(activeId, true) }
  }

  const togglePin = async (messageId: string) => {
    try {
      await api.post(`/chat/messages/${messageId}/pin`)
      if (activeId) { loadMessages(activeId, true); loadGroups() }
    } catch (e: any) { toast.error(e.response?.data?.error || 'Failed to pin') }
  }

  const runSearch = async (q: string) => {
    setSearchQuery(q)
    if (q.trim().length < 2) { setSearchResults([]); return }
    setSearching(true)
    try {
      const r = await api.get(`/chat/search?q=${encodeURIComponent(q.trim())}`)
      setSearchResults(r.data.data || [])
    } catch { /* ignore */ }
    finally { setSearching(false) }
  }

  const openSearchResult = (result: any) => {
    setShowSearch(false)
    setSearchQuery('')
    setSearchResults([])
    setActiveId(result.groupId)
  }

  const startEdit = (m: any) => {
    setEditingMessage(m)
    setReplyingTo(null)
    setMsgText(m.content || '')
    setOpenMsgMenu(null)
  }

  const cancelEdit = () => {
    setEditingMessage(null)
    setMsgText('')
  }

  const saveEdit = async () => {
    if (!editingMessage || !msgText.trim()) return
    setSending(true)
    const msgId = editingMessage.id
    const newContent = msgText.trim()
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: newContent, isEdited: true } : m))
    setEditingMessage(null)
    setMsgText('')
    try {
      await api.patch(`/chat/messages/${msgId}/edit`, { content: newContent })
      if (activeId) loadMessages(activeId, true)
    } catch (e: any) { toast.error(e.response?.data?.error || 'Edit failed'); if (activeId) loadMessages(activeId, true) }
    finally { setSending(false) }
  }

  const openForward = (m: any) => {
    setForwardingMessage(m)
    setForwardGroupIds([])
    setOpenMsgMenu(null)
  }

  const submitForward = async () => {
    if (!forwardingMessage || forwardGroupIds.length === 0) return
    setForwarding(true)
    try {
      await api.post(`/chat/messages/${forwardingMessage.id}/forward`, { groupIds: forwardGroupIds })
      toast.success('Forwarded')
      setForwardingMessage(null)
      setForwardGroupIds([])
      await loadGroups()
    } catch (e: any) { toast.error(e.response?.data?.error || 'Forward failed') }
    finally { setForwarding(false) }
  }

  // "Online" (active within 60s) or a friendly "Last seen ..." string.
  const formatPresence = (lastActiveAt?: string | null): string => {
    if (!lastActiveAt) return ''
    const diffMs = Date.now() - new Date(lastActiveAt).getTime()
    if (diffMs < 60000) return 'Online'
    const mins = Math.floor(diffMs / 60000)
    if (mins < 60) return `Last seen ${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `Last seen ${hrs}h ago`
    const days = Math.floor(hrs / 24)
    if (days === 1) return 'Last seen yesterday'
    if (days < 7) return `Last seen ${days}d ago`
    return `Last seen ${new Date(lastActiveAt).toLocaleDateString('en-IN')}`
  }

  const startNewChat = async () => {
    if (newChatForm.memberIds.length === 0) { toast.error('Pick members'); return }
    try {
      const r = await api.post('/chat/groups', newChatForm)
      toast.success('Chat created')
      setShowNewChat(false)
      setNewChatForm({ type: 'DIRECT', name: '', memberIds: [] })
      await loadGroups()
      setActiveId(r.data.data.id)
    } catch { toast.error('Failed') }
  }

  const activeGroup = groups.find(g => g.id === activeId)
  const myChatRole = activeGroup?.members?.find((m: any) => m.id === user?.id)?.chatRole
  const isAppAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(user?.role || '')
  const isGroupChat = activeGroup?.type === 'GROUP'
  const canManageMembers = isGroupChat && (isAppAdmin || myChatRole === 'ADMIN')
  const canDeleteForEveryone = !!activeGroup && (isAppAdmin || myChatRole === 'ADMIN')
  const mentionCandidates = (activeGroup?.members || [])
    .filter((m: any) => m.id !== user?.id && (!mentionQuery || m.name?.toLowerCase().includes(mentionQuery)))
  const filteredGroups = groups.filter(g =>
    !searchTerm || g.name?.toLowerCase().includes(searchTerm.toLowerCase())
  )
  // DIRECT-chat read receipts: a message is "seen" once the other person's
  // lastReadAt is at/after the message's createdAt. For GROUP chats we just
  // show a generic double-check once anyone else has read it.
  const otherMembers = (activeGroup?.members || []).filter((m: any) => m.id !== user?.id)
  const readTickState = (msg: any): 'sent' | 'read' => {
    if (!otherMembers.length) return 'sent'
    const t = new Date(msg.createdAt).getTime()
    const seenByAny = otherMembers.some((m: any) => m.lastReadAt && new Date(m.lastReadAt).getTime() >= t)
    return seenByAny ? 'read' : 'sent'
  }
  const typingLabel = typingUsers.length === 0 ? '' :
    typingUsers.length === 1 ? `${typingUsers[0].name} is typing…` :
    `${typingUsers.map((t: any) => t.name).join(', ')} are typing…`
  // Presence, for DIRECT chats only (a group has no single "other person").
  const directOtherMember = activeGroup?.type === 'DIRECT' ? otherMembers[0] : null
  const presenceLabel = directOtherMember ? formatPresence(directOtherMember.lastActiveAt) : ''
  const isOtherOnline = presenceLabel === 'Online'
  const totalUnread = groups.reduce((s, g) => s + (g.unreadCount || 0), 0)

  return (
    <div className="h-[calc(100vh-4rem)] -m-6 flex bg-slate-50">
      {/* Groups sidebar */}
      <div className={`${activeId ? 'hidden md:flex' : 'flex'} w-full md:w-80 flex-col bg-white border-r border-gray-200`}>
        <div className="p-3 border-b border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold text-gray-900">Chats</h2>
            <div className="flex items-center gap-1">
              <button onClick={() => setShowSearch(true)} title="Search all messages" className="text-gray-500 hover:bg-gray-100 rounded p-1.5"><Search size={15} /></button>
              <button onClick={() => setShowNewChat(true)} className="text-brand-600 hover:bg-brand-50 rounded p-1.5"><Plus size={16} /></button>
            </div>
          </div>
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-8 text-sm" placeholder="Search chats" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingGroups ? (
            <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-gray-400" /></div>
          ) : filteredGroups.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">
              <MessageSquare size={28} className="mx-auto mb-2" />
              No chats yet. Click + to start.
            </div>
          ) : filteredGroups.map(g => {
            const otherM = g.type === 'DIRECT' ? (g.members || []).find((m: any) => m.id !== user?.id) : null
            const online = otherM && formatPresence(otherM.lastActiveAt) === 'Online'
            return (
            <button key={g.id} onClick={() => setActiveId(g.id)}
              className={`w-full text-left p-3 border-b border-gray-100 hover:bg-slate-50 ${activeId === g.id ? 'bg-brand-50' : ''}`}>
              <div className="flex items-center gap-3">
                <div className="relative flex-shrink-0">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${g.type === 'DIRECT' ? 'bg-gradient-to-br from-brand-500 to-brand-600' : 'bg-gradient-to-br from-brand-600 to-brand-800'}`}>
                    {g.type === 'DIRECT' ? (g.avatar ? <img src={g.avatar} className="w-full h-full rounded-full object-cover" /> : getInitials(g.name || 'X')) : <Users2 size={18} />}
                  </div>
                  {online && <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <p className={`text-sm truncate ${g.unreadCount > 0 ? 'font-bold text-gray-900' : 'font-medium'}`}>{g.name || 'Unnamed'}</p>
                    {g.type !== 'DIRECT' && !g.unreadCount && <span className="text-[10px] text-gray-400 flex-shrink-0">{g.memberCount}</span>}
                    {g.unreadCount > 0 && (
                      <span className="flex-shrink-0 bg-emerald-600 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
                        {g.unreadCount > 99 ? '99+' : g.unreadCount}
                      </span>
                    )}
                  </div>
                  <p className={`text-xs truncate ${g.unreadCount > 0 ? 'text-gray-700 font-medium' : 'text-gray-500'}`}>
                    {g.lastMessage ? `${g.lastMessage.sender?.name}: ${g.lastMessage.content}` : 'No messages yet'}
                  </p>
                </div>
              </div>
            </button>
          )})}
        </div>
      </div>

      {/* Chat panel */}
      <div className={`${!activeId ? 'hidden md:flex' : 'flex'} flex-1 flex-col`}>
        {!activeGroup ? (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <MessageSquare size={48} className="mx-auto mb-3" />
              <p className="text-sm">Select a chat to start messaging</p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="bg-white border-b border-gray-200 p-3 flex items-center gap-3">
              <button onClick={() => setActiveId(null)} className="md:hidden text-gray-500 hover:text-gray-700">
                <ChevronLeft size={18} />
              </button>
              <button onClick={() => isGroupChat && setShowMembers(true)} className="relative flex-shrink-0">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold ${activeGroup.type === 'DIRECT' ? 'bg-gradient-to-br from-brand-500 to-brand-600' : 'bg-gradient-to-br from-brand-600 to-brand-800'}`}>
                  {activeGroup.type === 'DIRECT' ? getInitials(activeGroup.name || 'X') : <Users2 size={16} />}
                </div>
                {isOtherOnline && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full" />}
              </button>
              <button className="flex-1 text-left min-w-0" onClick={() => isGroupChat && setShowMembers(true)}>
                <p className="font-semibold text-sm truncate">{activeGroup.name || 'Chat'}</p>
                <p className={`text-xs truncate ${isOtherOnline ? 'text-emerald-600 font-medium' : 'text-gray-500'}`}>
                  {typingLabel ? <span className="text-emerald-600 font-medium">{typingLabel}</span> :
                    activeGroup.type === 'DIRECT' ? (presenceLabel || 'Direct message') : `${activeGroup.memberCount} members · ${activeGroup.members?.slice(0, 3).map((m: any) => m.name).join(', ')}${activeGroup.memberCount > 3 ? '…' : ''}`}
                </p>
              </button>
              {pinnedMessages.length > 0 && (
                <button onClick={() => setShowPinned(true)} className="relative text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg p-2 flex-shrink-0" title="Pinned messages">
                  <Pin size={16} />
                  <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center">{pinnedMessages.length}</span>
                </button>
              )}
              {isGroupChat && (
                <button onClick={() => setShowMembers(true)} className="text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg p-2 flex-shrink-0" title="Group info & members">
                  <Info size={16} />
                </button>
              )}
              <div className="relative">
                <button onClick={() => setOpenMsgMenu(m => m === '__chat__' ? null : '__chat__')} disabled={deleting}
                  className="text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg p-2 flex-shrink-0" title="Delete chat">
                  {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                </button>
                {openMsgMenu === '__chat__' && (
                  <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 w-56 z-20 text-sm">
                    <button onClick={() => { setOpenMsgMenu(null); deleteGroup(false) }} className="w-full text-left px-3 py-2 hover:bg-gray-50">
                      Delete for me
                      <span className="block text-xs text-gray-400">Other {activeGroup.type === 'DIRECT' ? 'person keeps it' : 'members keep it'}</span>
                    </button>
                    {canDeleteForEveryone && (
                      <button onClick={() => { setOpenMsgMenu(null); deleteGroup(true) }} className="w-full text-left px-3 py-2 hover:bg-red-50 text-red-600">
                        Delete for everyone
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 bg-slate-50" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'40\' height=\'40\'%3E%3Ccircle cx=\'20\' cy=\'20\' r=\'1\' fill=\'%23cbd5e1\'/%3E%3C/svg%3E")' }}>
              {loadingMsgs ? (
                <div className="space-y-3 py-2">
                  {[70, 45, 60, 35, 55].map((w, i) => (
                    <div key={i} className={`flex ${i % 2 ? 'justify-end' : 'justify-start'}`}>
                      <div className="h-9 rounded-2xl bg-gray-200/70 animate-pulse" style={{ width: `${w}%`, maxWidth: 320 }} />
                    </div>
                  ))}
                </div>
              ) : messages.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-12">No messages yet. Say hi 👋</p>
              ) : (
                <div className="space-y-2 mx-auto">
                  {messages.map(m => {
                    const isMe = m.sender?.id === user?.id
                    const isMentioned = (m.mentions || []).some((mn: any) => mn.userId === user?.id || mn.user?.id === user?.id)
                    const tick = isMe && !m._optimistic ? readTickState(m) : null
                    // Group reactions by emoji → count + whether I reacted
                    const reactionGroups: Record<string, { count: number; mine: boolean; names: string[] }> = {}
                    for (const r of (m.reactions || [])) {
                      if (!reactionGroups[r.emoji]) reactionGroups[r.emoji] = { count: 0, mine: false, names: [] }
                      reactionGroups[r.emoji].count++
                      reactionGroups[r.emoji].names.push(r.user?.name || '')
                      if (r.user?.id === user?.id) reactionGroups[r.emoji].mine = true
                    }
                    return (
                      <div key={m.id} className={`flex gap-2 ${isMe ? 'justify-end' : 'justify-start'} group`}>
                        {!isMe && (
                          <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                            {getInitials(m.sender?.name || 'X')}
                          </div>
                        )}
                        {!m._optimistic && !m.isDeleted && (
                          <div className={`relative self-center flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ${isMe ? 'order-1' : ''}`}>
                            <button onClick={(e) => {
                              setReactionPickerPos(computeFloatingPos(e.currentTarget, 220, 40, isMe))
                              setReactionPickerFor(o => o === m.id ? null : m.id)
                            }}
                              className="text-gray-400 hover:text-gray-600 p-1" title="React"><SmilePlus size={14} /></button>
                            <button onClick={() => { setReplyingTo(m); setOpenMsgMenu(null) }}
                              className="text-gray-400 hover:text-gray-600 p-1" title="Reply"><Reply size={14} /></button>
                            <button onClick={(e) => {
                              setMsgMenuPos(computeFloatingPos(e.currentTarget, 192, 180, isMe))
                              setOpenMsgMenu(o => o === m.id ? null : m.id)
                            }}
                              className="text-gray-400 hover:text-gray-600 p-1"><MoreVertical size={14} /></button>
                            {reactionPickerFor === m.id && reactionPickerPos && createPortal(
                              <div ref={reactionPickerRef} className="fixed bg-white border border-gray-200 rounded-full shadow-lg px-2 py-1 flex gap-1 z-50"
                                style={{ top: reactionPickerPos.top, left: reactionPickerPos.left }}>
                                {QUICK_REACTIONS.map(e => (
                                  <button key={e} onClick={() => toggleReaction(m.id, e)} className="text-lg hover:scale-125 transition-transform">{e}</button>
                                ))}
                              </div>, document.body
                            )}
                            {openMsgMenu === m.id && msgMenuPos && createPortal(
                              <div ref={msgMenuRef} className="fixed bg-white border border-gray-200 rounded-lg shadow-lg py-1 w-48 z-50 text-sm"
                                style={{ top: msgMenuPos.top, left: msgMenuPos.left }}>
                                <button onClick={() => { setOpenMsgMenu(null); openForward(m) }} className="w-full text-left px-3 py-1.5 hover:bg-gray-50">Forward</button>
                                {isMe && !m.attachmentUrl && (
                                  <button onClick={() => startEdit(m)} className="w-full text-left px-3 py-1.5 hover:bg-gray-50">Edit</button>
                                )}
                                <button onClick={() => togglePin(m.id)} className="w-full text-left px-3 py-1.5 hover:bg-gray-50 flex items-center gap-1.5">
                                  <Pin size={12} /> {m.isPinned ? 'Unpin' : 'Pin message'}
                                </button>
                                <button onClick={() => deleteMessage(m.id, false)} className="w-full text-left px-3 py-1.5 hover:bg-gray-50">Delete for me</button>
                                {isMe && <button onClick={() => deleteMessage(m.id, true)} className="w-full text-left px-3 py-1.5 hover:bg-red-50 text-red-600">Delete for everyone</button>}
                              </div>, document.body
                            )}
                          </div>
                        )}
                        <div className="max-w-md">
                          {m.isPinned && !m.isDeleted && (
                            <p className={`text-[10px] text-amber-600 flex items-center gap-1 mb-0.5 ${isMe ? 'justify-end' : ''}`}><Pin size={10} /> Pinned</p>
                          )}
                          <div className={`px-3 py-2 rounded-2xl ${m.isDeleted ? 'bg-gray-100 text-gray-400 italic' : isMe ? 'bg-emerald-100 text-emerald-950' : isMentioned ? 'bg-amber-50 ring-1 ring-amber-300' : 'bg-white'} shadow-sm ${m._optimistic ? 'opacity-70' : ''}`}>
                            {m.isForwarded && !m.isDeleted && (
                              <p className="text-[10px] text-gray-400 italic mb-0.5">↪ Forwarded</p>
                            )}
                            {!isMe && activeGroup.type !== 'DIRECT' && !m.isDeleted && (
                              <p className="text-xs font-semibold text-brand-600 mb-0.5">{m.sender?.name}</p>
                            )}
                            {m.isDeleted ? (
                              <p className="text-sm">🚫 This message was deleted</p>
                            ) : (
                              <>
                                {m.replyTo && (
                                  <div className="border-l-2 border-brand-400 bg-black/5 rounded px-2 py-1 mb-1.5 text-xs">
                                    <p className="font-semibold text-brand-700">{m.replyTo.sender?.name}</p>
                                    <p className="text-gray-600 truncate">
                                      {m.replyTo.isDeleted ? 'Message deleted' : (m.replyTo.content || m.replyTo.attachmentName || 'Attachment')}
                                    </p>
                                  </div>
                                )}
                                {m.attachmentUrl && (
                                  m.attachmentType?.startsWith('image/') ? (
                                    <img src={m.attachmentUrl} onClick={() => window.open(m.attachmentUrl, '_blank')}
                                      className="rounded-lg max-w-[220px] max-h-[240px] object-cover cursor-pointer mb-1" />
                                  ) : (
                                    <a href={m.attachmentUrl} target="_blank" rel="noreferrer"
                                      className="flex items-center gap-1 text-xs text-brand-600 underline mb-1">
                                      <Paperclip size={11} /> {m.attachmentName || 'Attachment'}
                                    </a>
                                  )
                                )}
                                {m.content && <p className="text-sm whitespace-pre-wrap break-words">{m.content}</p>}
                              </>
                            )}
                            <p className="text-[10px] text-gray-500 text-right mt-0.5 flex items-center justify-end gap-1">
                              {m.isEdited && !m.isDeleted && <span className="italic">edited</span>}
                              {new Date(m.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                              {tick === 'read' && <CheckCheck size={13} className="text-brand-500" />}
                              {tick === 'sent' && <Check size={13} className="text-gray-400" />}
                            </p>
                          </div>
                          {Object.keys(reactionGroups).length > 0 && (
                            <div className={`flex flex-wrap gap-1 mt-1 ${isMe ? 'justify-end' : ''}`}>
                              {Object.entries(reactionGroups).map(([emoji, g]) => (
                                <button key={emoji} onClick={() => toggleReaction(m.id, emoji)}
                                  title={g.names.join(', ')}
                                  className={`text-xs rounded-full px-1.5 py-0.5 border flex items-center gap-0.5 ${g.mine ? 'bg-brand-50 border-brand-300' : 'bg-white border-gray-200'}`}>
                                  <span>{emoji}</span><span className="text-gray-500">{g.count}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Compose */}
            <div className="bg-white border-t border-gray-200 p-3">
              {editingMessage ? (
                <div className="max-w-2xl mx-auto mb-2 flex items-center gap-2 bg-amber-50 border-l-2 border-amber-400 rounded px-3 py-1.5 text-xs">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-amber-700">Editing message</p>
                  </div>
                  <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-600 flex-shrink-0"><X size={14} /></button>
                </div>
              ) : replyingTo && (
                <div className="max-w-2xl mx-auto mb-2 flex items-center gap-2 bg-slate-50 border-l-2 border-brand-400 rounded px-3 py-1.5 text-xs">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-brand-700">Replying to {replyingTo.sender?.name}</p>
                    <p className="text-gray-500 truncate">{replyingTo.content || replyingTo.attachmentName || 'Attachment'}</p>
                  </div>
                  <button onClick={() => setReplyingTo(null)} className="text-gray-400 hover:text-gray-600 flex-shrink-0"><X size={14} /></button>
                </div>
              )}
              <div className="relative flex items-end gap-2 max-w-2xl mx-auto">
                {/* Mention picker popover */}
                {showMentionPicker && mentionCandidates.length > 0 && (
                  <div className="absolute bottom-14 left-0 bg-white border border-gray-200 rounded-xl shadow-lg py-1 w-64 max-h-52 overflow-y-auto z-10">
                    {mentionCandidates.map((m: any) => (
                      <button key={m.id} type="button" onClick={() => pickMention(m)}
                        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 text-left text-sm">
                        <div className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                          {getInitials(m.name || 'X')}
                        </div>
                        {m.name}
                      </button>
                    ))}
                  </div>
                )}
                {/* Emoji picker popover */}
                {showEmoji && (
                  <div className="absolute bottom-14 left-0 bg-white border border-gray-200 rounded-xl shadow-lg p-2 grid grid-cols-9 gap-1 w-[320px] z-10">
                    {EMOJIS.map(e => (
                      <button key={e} type="button" onClick={() => insertEmoji(e)}
                        className="text-xl hover:bg-gray-100 rounded p-0.5 leading-none">{e}</button>
                    ))}
                  </div>
                )}
                <button type="button" onClick={() => setShowEmoji(s => !s)}
                  className="w-10 h-10 rounded-full hover:bg-gray-100 text-gray-500 flex items-center justify-center flex-shrink-0" title="Emoji">
                  <Smile size={18} />
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) sendImage(f) }} />
                <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                  className="w-10 h-10 rounded-full hover:bg-gray-100 text-gray-500 flex items-center justify-center flex-shrink-0 disabled:opacity-50" title="Send image">
                  {uploading ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={18} />}
                </button>
                <textarea className="flex-1 border border-gray-200 rounded-2xl px-4 py-2 text-sm resize-none focus:outline-none focus:border-brand-500"
                  placeholder={editingMessage ? 'Edit message...' : isGroupChat ? 'Type a message... (@ to mention)' : 'Type a message...'} value={msgText}
                  onChange={e => onComposeChange(e.target.value)} rows={1}
                  onFocus={() => setShowEmoji(false)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} />
                <button onClick={send} disabled={sending || !msgText.trim()}
                  className="w-10 h-10 rounded-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white flex items-center justify-center flex-shrink-0">
                  {editingMessage ? <Check size={16} /> : <Send size={15} />}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* New chat modal */}
      <Modal open={showNewChat} onClose={() => { setShowNewChat(false); setMemberSearch('') }} title="New Chat">
        <div className="space-y-3">
          <select value={newChatForm.type} onChange={e => setNewChatForm(p => ({...p, type: e.target.value}))} className="input w-full">
            <option value="DIRECT">Direct Message (1-1)</option>
            <option value="GROUP">Group Chat</option>
          </select>
          {newChatForm.type === 'GROUP' && (
            <Input label="Group Name" value={newChatForm.name} onChange={e => setNewChatForm(p => ({...p, name: e.target.value}))}
              placeholder="e.g. Sales Team" />
          )}
          <div>
            <label className="label">Select {newChatForm.type === 'DIRECT' ? 'person' : 'members'}</label>
            <input
              type="text"
              value={memberSearch}
              onChange={e => setMemberSearch(e.target.value)}
              placeholder="Search by name or role..."
              className="input w-full mb-2"
            />
            <div className="max-h-60 overflow-y-auto border rounded-lg divide-y divide-gray-100">
              {users
                .filter(u => {
                  const q = memberSearch.trim().toLowerCase()
                  if (!q) return true
                  return u.name?.toLowerCase().includes(q) || u.role?.replace(/_/g, ' ').toLowerCase().includes(q)
                })
                .map(u => (
                <label key={u.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 cursor-pointer text-sm">
                  <input type={newChatForm.type === 'DIRECT' ? 'radio' : 'checkbox'}
                    name="members"
                    checked={newChatForm.memberIds.includes(u.id)}
                    onChange={() => {
                      setNewChatForm(p => ({
                        ...p,
                        memberIds: p.type === 'DIRECT' ? [u.id] :
                          p.memberIds.includes(u.id) ? p.memberIds.filter(x => x !== u.id) : [...p.memberIds, u.id],
                      }))
                    }} />
                  <div className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold">
                    {getInitials(u.name)}
                  </div>
                  <div className="flex-1">
                    <p>{u.name}</p>
                    <p className="text-xs text-gray-500">{u.role?.replace(/_/g, ' ')}</p>
                  </div>
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">{newChatForm.memberIds.length} selected</p>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setShowNewChat(false)}>Cancel</Button>
            <Button onClick={startNewChat}>Start Chat</Button>
          </div>
        </div>
      </Modal>

      {/* Group info & members modal */}
      <Modal open={showMembers} onClose={() => setShowMembers(false)} title={activeGroup?.name || 'Group info'}>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">{activeGroup?.memberCount} members</p>
            {canManageMembers && (
              <button onClick={() => { setShowAddMembers(true) }}
                className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:bg-brand-50 rounded-lg px-2 py-1">
                <UserPlus size={14} /> Add members
              </button>
            )}
          </div>
          <div className="max-h-72 overflow-y-auto border rounded-lg divide-y divide-gray-100">
            {(activeGroup?.members || []).map((m: any) => (
              <div key={m.id} className="flex items-center gap-2 p-2 text-sm">
                <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {getInitials(m.name || 'X')}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate">{m.name} {m.id === user?.id && <span className="text-gray-400">(you)</span>}</p>
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    {m.chatRole === 'ADMIN' && <ShieldCheck size={11} className="text-brand-600" />}
                    {m.chatRole === 'ADMIN' ? 'Group admin' : m.role?.replace(/_/g, ' ')}
                  </p>
                </div>
                {memberActionId === m.id ? (
                  <Loader2 size={14} className="animate-spin text-gray-400" />
                ) : m.id === user?.id ? (
                  <button onClick={() => removeMember(m.id, true)} title="Leave group"
                    className="text-gray-400 hover:text-red-600 hover:bg-red-50 rounded p-1.5"><LogOut size={14} /></button>
                ) : canManageMembers ? (
                  <div className="flex items-center gap-1">
                    <button onClick={() => changeRole(m.id, m.chatRole === 'ADMIN' ? 'MEMBER' : 'ADMIN')}
                      title={m.chatRole === 'ADMIN' ? 'Remove as admin' : 'Make admin'}
                      className={`p-1.5 rounded hover:bg-brand-50 ${m.chatRole === 'ADMIN' ? 'text-brand-600' : 'text-gray-400'}`}>
                      <ShieldCheck size={14} />
                    </button>
                    <button onClick={() => removeMember(m.id)} title="Remove from group"
                      className="text-gray-400 hover:text-red-600 hover:bg-red-50 rounded p-1.5"><X size={14} /></button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          <div className="flex justify-end pt-1">
            <Button variant="secondary" onClick={() => setShowMembers(false)}>Close</Button>
          </div>
        </div>
      </Modal>

      {/* Add members modal */}
      <Modal open={showAddMembers} onClose={() => { setShowAddMembers(false); setAddMemberIds([]) }} title="Add members">
        <div className="space-y-3">
          <div className="max-h-60 overflow-y-auto border rounded-lg divide-y divide-gray-100">
            {users
              .filter(u => !(activeGroup?.members || []).some((m: any) => m.id === u.id))
              .map(u => (
                <label key={u.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 cursor-pointer text-sm">
                  <input type="checkbox" checked={addMemberIds.includes(u.id)}
                    onChange={() => setAddMemberIds(ids => ids.includes(u.id) ? ids.filter(x => x !== u.id) : [...ids, u.id])} />
                  <div className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold">
                    {getInitials(u.name)}
                  </div>
                  <div className="flex-1">
                    <p>{u.name}</p>
                    <p className="text-xs text-gray-500">{u.role?.replace(/_/g, ' ')}</p>
                  </div>
                </label>
              ))}
          </div>
          <p className="text-xs text-gray-500">{addMemberIds.length} selected</p>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => { setShowAddMembers(false); setAddMemberIds([]) }}>Cancel</Button>
            <Button onClick={addMembers} disabled={addMemberIds.length === 0}>Add</Button>
          </div>
        </div>
      </Modal>

      {/* Pinned messages modal */}
      <Modal open={showPinned} onClose={() => setShowPinned(false)} title="Pinned messages">
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {pinnedMessages.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No pinned messages</p>
          ) : pinnedMessages.map((m: any) => (
            <div key={m.id} className="border border-amber-200 bg-amber-50 rounded-lg p-2.5 text-sm">
              <div className="flex items-center justify-between mb-1">
                <p className="font-semibold text-xs text-brand-700">{m.sender?.name}</p>
                <button onClick={() => togglePin(m.id)} className="text-gray-400 hover:text-red-600" title="Unpin"><X size={14} /></button>
              </div>
              <p className="text-gray-700 break-words">{m.content || m.attachmentName || 'Attachment'}</p>
              <p className="text-[10px] text-gray-400 mt-1">{new Date(m.createdAt).toLocaleString('en-IN')}</p>
            </div>
          ))}
        </div>
      </Modal>

      {/* Global message search modal */}
      <Modal open={showSearch} onClose={() => { setShowSearch(false); setSearchQuery(''); setSearchResults([]) }} title="Search messages">
        <div className="space-y-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input autoFocus className="input pl-9 w-full" placeholder="Search across all your chats..."
              value={searchQuery} onChange={e => runSearch(e.target.value)} />
          </div>
          <div className="max-h-96 overflow-y-auto space-y-1">
            {searching ? (
              <div className="text-center py-6"><Loader2 className="animate-spin mx-auto text-gray-400" size={20} /></div>
            ) : searchQuery.trim().length >= 2 && searchResults.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No messages found</p>
            ) : searchResults.map((r: any) => (
              <button key={r.id} onClick={() => openSearchResult(r)}
                className="w-full text-left p-2.5 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-200">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-brand-700">{r.groupName}</p>
                  <p className="text-[10px] text-gray-400">{new Date(r.createdAt).toLocaleDateString('en-IN')}</p>
                </div>
                <p className="text-sm text-gray-700 truncate">
                  <span className="text-gray-400">{r.sender?.name}: </span>{r.content}
                </p>
              </button>
            ))}
          </div>
        </div>
      </Modal>

      {/* Forward message modal */}
      <Modal open={!!forwardingMessage} onClose={() => { setForwardingMessage(null); setForwardGroupIds([]) }} title="Forward message">
        <div className="space-y-3">
          {forwardingMessage && (
            <div className="bg-slate-50 rounded-lg p-2 text-xs text-gray-600 border-l-2 border-brand-400">
              {forwardingMessage.content || forwardingMessage.attachmentName || 'Attachment'}
            </div>
          )}
          <p className="label">Send to</p>
          <div className="max-h-60 overflow-y-auto border rounded-lg divide-y divide-gray-100">
            {groups.filter(g => g.id !== activeId).map(g => (
              <label key={g.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 cursor-pointer text-sm">
                <input type="checkbox" checked={forwardGroupIds.includes(g.id)}
                  onChange={() => setForwardGroupIds(ids => ids.includes(g.id) ? ids.filter(x => x !== g.id) : [...ids, g.id])} />
                <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold ${g.type === 'DIRECT' ? 'bg-gradient-to-br from-brand-500 to-brand-600' : 'bg-gradient-to-br from-brand-600 to-brand-800'}`}>
                  {g.type === 'DIRECT' ? getInitials(g.name || 'X') : <Users2 size={12} />}
                </div>
                <p className="flex-1 truncate">{g.name || 'Unnamed'}</p>
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => { setForwardingMessage(null); setForwardGroupIds([]) }}>Cancel</Button>
            <Button onClick={submitForward} disabled={forwardGroupIds.length === 0 || forwarding}>
              {forwarding ? <Loader2 size={14} className="animate-spin" /> : 'Forward'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
