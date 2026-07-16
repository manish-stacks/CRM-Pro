'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import api from '@/lib/axios'
import { Button, Input, Select, Modal } from '@/components/ui'
import { getInitials } from '@/lib/utils'
import {
  MessageSquare, Search, Plus, Send, Loader2, Users2, User,
  Paperclip, X, ChevronLeft, Smile, Trash2, Image as ImageIcon
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

  const scrollRef = useRef<HTMLDivElement>(null)
  const pollRef = useRef<any>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const wishHandled = useRef(false)

  const EMOJIS = ['😀','😁','😂','🤣','😊','😍','😘','😎','🤩','🥳','👍','👏','🙏','💪','🔥','🎉','🎂','🥂','❤️','💯','✅','👌','🙌','😅','😉','😇','🤔','😢','😭','😡','🚀','⭐','💡','📌','☕','👋']

  const loadGroups = useCallback(async () => {
    try {
      const r = await api.get('/chat/groups')
      setGroups(r.data.data || [])
    } catch {} finally { setLoadingGroups(false) }
  }, [])

  const loadMessages = useCallback(async (groupId: string) => {
    setLoadingMsgs(true)
    try {
      const r = await api.get(`/chat/groups/${groupId}/messages?limit=100`)
      setMessages(r.data.data || [])
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 50)
    } catch {} finally { setLoadingMsgs(false) }
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
        toast.success('Wish bhej diya 🎉')
      } catch { toast.error('Failed to send wish') }
      finally { window.history.replaceState({}, '', '/chat') }
    })()
  }, [loadGroups])
  useEffect(() => {
    api.get('/users/by-role?roles=EMPLOYEE,MANAGER,TELECALLER,MARKETING_EXECUTIVE,ADMIN,SUPER_ADMIN')
      .then(r => setUsers((r.data.data || []).filter((u: any) => u.id !== user?.id)))
      .catch(() => {})
  }, [user?.id])

  useEffect(() => {
    if (activeId) {
      loadMessages(activeId)
      // Poll for new messages every 5s
      pollRef.current = setInterval(() => loadMessages(activeId), 5000)
      return () => clearInterval(pollRef.current)
    }
  }, [activeId, loadMessages])

  const send = async () => {
    if (!msgText.trim() || !activeId) return
    setSending(true)
    const optimistic = {
      id: 'tmp-' + Date.now(),
      content: msgText,
      sender: { id: user?.id, name: user?.name, avatar: user?.avatar },
      createdAt: new Date().toISOString(),
      _optimistic: true,
    }
    setMessages(m => [...m, optimistic])
    setMsgText('')
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 50)
    try {
      await api.post(`/chat/groups/${activeId}/messages`, { content: optimistic.content })
      loadMessages(activeId)
      loadGroups()  // bump order
    } catch { toast.error('Failed to send'); loadMessages(activeId) }
    finally { setSending(false) }
  }

  const insertEmoji = (e: string) => {
    setMsgText(t => t + e)
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
      loadMessages(activeId)
      loadGroups()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Upload failed')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const deleteGroup = async () => {
    if (!activeId) return
    if (!confirm('Ye chat delete karein? Saare messages hat jayenge.')) return
    setDeleting(true)
    try {
      await api.delete(`/chat/groups/${activeId}`)
      toast.success('Chat deleted')
      setActiveId(null)
      setMessages([])
      await loadGroups()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Delete failed')
    } finally { setDeleting(false) }
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
  const canDelete = !!activeGroup && (activeGroup.type === 'DIRECT' || isAppAdmin || myChatRole === 'ADMIN')
  const filteredGroups = groups.filter(g =>
    !searchTerm || g.name?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="h-[calc(100vh-4rem)] -m-6 flex bg-slate-50">
      {/* Groups sidebar */}
      <div className={`${activeId ? 'hidden md:flex' : 'flex'} w-full md:w-80 flex-col bg-white border-r border-gray-200`}>
        <div className="p-3 border-b border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold text-gray-900">Chats</h2>
            <button onClick={() => setShowNewChat(true)} className="text-blue-600 hover:bg-blue-50 rounded p-1.5"><Plus size={16} /></button>
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
          ) : filteredGroups.map(g => (
            <button key={g.id} onClick={() => setActiveId(g.id)}
              className={`w-full text-left p-3 border-b border-gray-100 hover:bg-slate-50 ${activeId === g.id ? 'bg-blue-50' : ''}`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold ${g.type === 'DIRECT' ? 'bg-gradient-to-br from-blue-500 to-indigo-500' : 'bg-gradient-to-br from-emerald-500 to-teal-500'}`}>
                  {g.type === 'DIRECT' ? (g.avatar ? <img src={g.avatar} className="w-full h-full rounded-full object-cover" /> : getInitials(g.name || 'X')) : <Users2 size={18} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm truncate">{g.name || 'Unnamed'}</p>
                    {g.type !== 'DIRECT' && <span className="text-[10px] text-gray-400 flex-shrink-0">{g.memberCount}</span>}
                  </div>
                  <p className="text-xs text-gray-500 truncate">
                    {g.lastMessage ? `${g.lastMessage.sender?.name}: ${g.lastMessage.content}` : 'No messages yet'}
                  </p>
                </div>
              </div>
            </button>
          ))}
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
              <div className={`w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold ${activeGroup.type === 'DIRECT' ? 'bg-gradient-to-br from-blue-500 to-indigo-500' : 'bg-gradient-to-br from-emerald-500 to-teal-500'}`}>
                {activeGroup.type === 'DIRECT' ? getInitials(activeGroup.name || 'X') : <Users2 size={16} />}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm">{activeGroup.name || 'Chat'}</p>
                <p className="text-xs text-gray-500">
                  {activeGroup.type === 'DIRECT' ? 'Direct message' : `${activeGroup.memberCount} members · ${activeGroup.members?.slice(0, 3).map((m: any) => m.name).join(', ')}${activeGroup.memberCount > 3 ? '…' : ''}`}
                </p>
              </div>
              {canDelete && (
                <button onClick={deleteGroup} disabled={deleting}
                  className="text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg p-2 flex-shrink-0" title="Delete chat">
                  {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                </button>
              )}
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 bg-slate-50" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'40\' height=\'40\'%3E%3Ccircle cx=\'20\' cy=\'20\' r=\'1\' fill=\'%23cbd5e1\'/%3E%3C/svg%3E")' }}>
              {loadingMsgs ? (
                <div className="text-center p-8"><Loader2 className="animate-spin mx-auto text-gray-400" /></div>
              ) : messages.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-12">No messages yet. Say hi 👋</p>
              ) : (
                <div className="space-y-2 mx-auto">
                  {messages.map(m => {
                    const isMe = m.sender?.id === user?.id
                    return (
                      <div key={m.id} className={`flex gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
                        {!isMe && (
                          <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                            {getInitials(m.sender?.name || 'X')}
                          </div>
                        )}
                        <div className={`max-w-md px-3 py-2 rounded-2xl ${isMe ? 'bg-emerald-100 text-emerald-950' : 'bg-white'} shadow-sm ${m._optimistic ? 'opacity-70' : ''}`}>
                          {!isMe && activeGroup.type !== 'DIRECT' && (
                            <p className="text-xs font-semibold text-blue-600 mb-0.5">{m.sender?.name}</p>
                          )}
                          {m.attachmentUrl && (
                            m.attachmentType?.startsWith('image/') ? (
                              <img src={m.attachmentUrl} onClick={() => window.open(m.attachmentUrl, '_blank')}
                                className="rounded-lg max-w-[220px] max-h-[240px] object-cover cursor-pointer mb-1" />
                            ) : (
                              <a href={m.attachmentUrl} target="_blank" rel="noreferrer"
                                className="flex items-center gap-1 text-xs text-blue-600 underline mb-1">
                                <Paperclip size={11} /> {m.attachmentName || 'Attachment'}
                              </a>
                            )
                          )}
                          {m.content && <p className="text-sm whitespace-pre-wrap break-words">{m.content}</p>}
                          <p className="text-[10px] text-gray-500 text-right mt-0.5">
                            {new Date(m.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Compose */}
            <div className="bg-white border-t border-gray-200 p-3">
              <div className="relative flex items-end gap-2 max-w-2xl mx-auto">
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
                <textarea className="flex-1 border border-gray-200 rounded-2xl px-4 py-2 text-sm resize-none focus:outline-none focus:border-blue-500"
                  placeholder="Type a message..." value={msgText}
                  onChange={e => setMsgText(e.target.value)} rows={1}
                  onFocus={() => setShowEmoji(false)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} />
                <button onClick={send} disabled={sending || !msgText.trim()}
                  className="w-10 h-10 rounded-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white flex items-center justify-center flex-shrink-0">
                  <Send size={15} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* New chat modal */}
      <Modal open={showNewChat} onClose={() => setShowNewChat(false)} title="New Chat">
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
            <div className="max-h-60 overflow-y-auto border rounded-lg divide-y divide-gray-100">
              {users.map(u => (
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
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
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
    </div>
  )
}
