import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator,
  KeyboardAvoidingView, Platform, Modal, Alert, Image, Linking, ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { ChatAPI, presenceLabel, isOnline, unreadBus } from '../../services/chat.api';
import { ChatAvatar, PersonPicker } from '../../components/chat/ChatParts';
import ScreenWrapper from '../../components/ScreenWrapper';

const EMOJIS = ['😀','😁','😂','🤣','😊','😍','😘','😎','🤩','🥳','👍','👏','🙏','💪','🔥','🎉','🎂','🥂','❤️','💯','✅','👌','🙌','😅','😉','😇','🤔','😢','😭','😡','🚀','⭐','💡','📌','☕','👋'];
const QUICK = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

const fmtTime = (iso) => new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
function dayLabel(iso) {
  const d = new Date(iso), today = new Date().toDateString(), yest = new Date(Date.now() - 86400000).toDateString();
  if (d.toDateString() === today) return 'Today';
  if (d.toDateString() === yest) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined });
}
const signature = (list) => list.map(m => `${m.id}${m.isEdited ? 'e' : ''}${m.isDeleted ? 'd' : ''}${m.isPinned ? 'p' : ''}${m.reactions?.length || 0}`).join(',');

// Message text with @mentions highlighted (same idea as web).
function MentionText({ content, mentions, color, mentionColor }) {
  const names = [...new Set((mentions || []).map(mn => mn.user?.name).filter(Boolean))].sort((a, b) => b.length - a.length);
  if (!content || !names.length) return <Text style={{ color, fontSize: 14, lineHeight: 20 }}>{content}</Text>;
  const re = new RegExp(`(@(?:${names.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')}))(?=\\s|$)`, 'g');
  return (
    <Text style={{ color, fontSize: 14, lineHeight: 20 }}>
      {content.split(re).map((part, i) => part.startsWith('@') && names.includes(part.slice(1))
        ? <Text key={i} style={{ color: mentionColor, fontWeight: '800' }}>{part}</Text> : part)}
    </Text>
  );
}

export default function ChatConversationScreen({ route, navigation }) {
  const { groupId, groupName, unread = 0 } = route.params || {};
  const { colors } = useTheme();
  const { user } = useAuth();

  const [messages, setMessages] = useState([]);
  const [group, setGroup] = useState(null);
  const [allGroups, setAllGroups] = useState([]);
  const [pinned, setPinned] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [editing, setEditing] = useState(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [mentionIds, setMentionIds] = useState([]);
  const [showJump, setShowJump] = useState(false);
  const unreadAtOpen = unread; // from route params; cleared when the screen loses focus

  const [actionMsg, setActionMsg] = useState(null);
  const [showPinned, setShowPinned] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [forwardMsg, setForwardMsg] = useState(null);
  const [forwardIds, setForwardIds] = useState([]);
  const [forwarding, setForwarding] = useState(false);

  // group info
  const [nameDraft, setNameDraft] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [addIds, setAddIds] = useState([]);
  const [busy, setBusy] = useState(false);

  const listRef = useRef(null);
  const atBottom = useRef(true);
  const sigRef = useRef('');
  const lastTypingPing = useRef(0);

  const isAppAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(user?.role);
  const isGroupChat = group?.type && group.type !== 'DIRECT';
  const myChatRole = group?.members?.find(m => m.id === user?.id)?.chatRole;
  const canManage = isGroupChat && (isAppAdmin || myChatRole === 'ADMIN');
  const canDeleteForEveryone = !!group && (isAppAdmin || myChatRole === 'ADMIN');
  const otherMembers = (group?.members || []).filter(m => m.id !== user?.id);
  const directOther = group?.type === 'DIRECT' ? otherMembers[0] : null;

  const title = group?.name || groupName || 'Chat';
  const typingLabel = typingUsers.length === 0 ? '' : typingUsers.length === 1 ? `${typingUsers[0].name} is typing…` : `${typingUsers.map(t => t.name).join(', ')} are typing…`;
  const subtitle = typingLabel || (directOther ? presenceLabel(directOther.lastActiveAt) : isGroupChat ? `${group?.memberCount ?? group?.members?.length ?? ''} members` : '');

  // ── loading ──
  const loadGroups = useCallback(async () => {
    try {
      const r = await ChatAPI.getGroups();
      const list = r.data?.data || [];
      setAllGroups(list);
      unreadBus.emit(list.reduce((t, g) => t + (g.id === groupId ? 0 : (g.unreadCount || 0)), 0));
      setGroup(list.find(g => g.id === groupId) || null);
    } catch { /* ignore */ }
  }, [groupId]);

  const loadMessages = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const r = await ChatAPI.getMessages(groupId, 100);
      const payload = r.data?.data || {};
      const next = payload.messages || [];
      setTypingUsers(payload.typingUsers || []);
      setPinned(payload.pinned || []);
      const sig = signature(next);
      setMessages(prev => {
        if (sig === sigRef.current && !prev.some(m => m._optimistic)) return prev;
        sigRef.current = sig;
        return next;
      });
    } catch { /* keep what's shown */ }
    finally { setLoading(false); }
  }, [groupId]);

  useFocusEffect(useCallback(() => {
    // this screen instance is reused for every chat — start clean for this groupId
    sigRef.current = ''; setMessages([]); setShowJump(false);
    loadGroups(); loadMessages(false);
    ChatAPI.heartbeat().catch(() => {});
    const m = setInterval(() => loadMessages(true), 4000);
    const g = setInterval(loadGroups, 12000);
    const h = setInterval(() => ChatAPI.heartbeat().catch(() => {}), 20000);
    return () => {
      clearInterval(m); clearInterval(g); clearInterval(h);
      ChatAPI.typing(groupId, true).catch(() => {});
      navigation.setParams({ unread: 0 }); // messages are read now — don't show the divider next time
    };
  }, [groupId, loadGroups, loadMessages, navigation]));

  // ── typing ──
  const onChangeText = (v) => {
    setText(v);
    if (v.trim() && Date.now() - lastTypingPing.current > 3000) {
      lastTypingPing.current = Date.now();
      ChatAPI.typing(groupId, false).catch(() => {});
    }
  };

  // @mention picker (group chats)
  const mentionMatch = isGroupChat ? text.match(/@(\w*)$/) : null;
  const mentionCandidates = useMemo(() => {
    if (!mentionMatch) return [];
    const q = mentionMatch[1].toLowerCase();
    return (group?.members || []).filter(m => m.id !== user?.id && (!q || m.name?.toLowerCase().includes(q))).slice(0, 6);
  }, [mentionMatch?.[1], group?.members, user?.id, isGroupChat]); // eslint-disable-line
  const pickMention = (m) => {
    setText(t => t.replace(/@(\w*)$/, `@${m.name} `));
    setMentionIds(ids => (ids.includes(m.id) ? ids : [...ids, m.id]));
  };

  // ── send / edit ──
  const scrollEnd = (animated = true) => setTimeout(() => listRef.current?.scrollToEnd({ animated }), 60);

  const send = async () => {
    const content = text.trim();
    if (!content || sending) return;
    if (editing) return saveEdit();
    setSending(true);
    const opt = {
      id: 'tmp-' + Date.now(), content, _optimistic: true, createdAt: new Date().toISOString(),
      sender: { id: user?.id, name: user?.name, avatar: user?.image },
      replyTo: replyingTo ? { id: replyingTo.id, content: replyingTo.content, sender: replyingTo.sender, isDeleted: replyingTo.isDeleted, attachmentName: replyingTo.attachmentName } : null,
    };
    setMessages(m => [...m, opt]);
    const ids = mentionIds, replyToId = replyingTo?.id;
    setText(''); setMentionIds([]); setReplyingTo(null); setShowEmoji(false);
    ChatAPI.typing(groupId, true).catch(() => {});
    atBottom.current = true; scrollEnd();
    try {
      await ChatAPI.sendMessage(groupId, { content, mentionUserIds: ids, replyToId });
    } catch (e) {
      Alert.alert('Failed to send', e.response?.data?.error || 'Please try again');
      setText(content);
    } finally {
      setSending(false);
      sigRef.current = '';
      loadMessages(true); loadGroups();
    }
  };

  const saveEdit = async () => {
    const id = editing.id, content = text.trim();
    setMessages(prev => prev.map(m => m.id === id ? { ...m, content, isEdited: true } : m));
    setEditing(null); setText('');
    try { await ChatAPI.editMessage(id, content); }
    catch (e) { Alert.alert('Edit failed', e.response?.data?.error || 'Please try again'); }
    finally { sigRef.current = ''; loadMessages(true); }
  };

  const pickImage = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6, base64: true });
      if (res.canceled || !res.assets?.[0]) return;
      const a = res.assets[0];
      setUploading(true);
      const type = a.mimeType || 'image/jpeg';
      const up = await ChatAPI.upload(`data:${type};base64,${a.base64}`);
      await ChatAPI.sendMessage(groupId, { content: '', attachmentUrl: up.data?.data?.url, attachmentType: type, attachmentName: a.fileName || 'image.jpg' });
      atBottom.current = true; sigRef.current = '';
      loadMessages(true); loadGroups(); scrollEnd();
    } catch (e) {
      Alert.alert('Upload failed', e.response?.data?.error || e.message || 'Could not send image');
    } finally { setUploading(false); }
  };

  // ── message actions ──
  const refresh = () => { sigRef.current = ''; loadMessages(true); };
  const toggleReaction = async (m, emoji) => {
    setActionMsg(null);
    const mine = (m.reactions || []).find(r => r.user?.id === user?.id);
    try { mine && mine.emoji === emoji ? await ChatAPI.unreact(m.id) : await ChatAPI.react(m.id, emoji); }
    catch { /* ignore */ }
    refresh();
  };
  const togglePin = async (m) => {
    setActionMsg(null);
    try { await ChatAPI.togglePin(m.id); } catch (e) { Alert.alert('Error', e.response?.data?.error || 'Could not pin'); }
    refresh();
  };
  const deleteMessage = (m, forEveryone) => {
    setActionMsg(null);
    Alert.alert(forEveryone ? 'Delete for everyone?' : 'Delete for me?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await ChatAPI.deleteMessage(m.id, forEveryone); } catch (e) { Alert.alert('Error', e.response?.data?.error || 'Delete failed'); }
        refresh();
      } },
    ]);
  };
  const startEdit = (m) => { setActionMsg(null); setEditing(m); setReplyingTo(null); setText(m.content || ''); };
  const startReply = (m) => { setActionMsg(null); setEditing(null); setReplyingTo(m); };
  const submitForward = async () => {
    if (!forwardMsg || !forwardIds.length) return;
    setForwarding(true);
    try {
      await ChatAPI.forward(forwardMsg.id, forwardIds);
      setForwardMsg(null); setForwardIds([]); loadGroups();
      Alert.alert('Forwarded');
    } catch (e) { Alert.alert('Forward failed', e.response?.data?.error || 'Please try again'); }
    finally { setForwarding(false); }
  };

  // ── chat / group management ──
  const deleteChat = () => {
    const opts = [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete for me', onPress: () => doDeleteChat(false) }];
    if (canDeleteForEveryone) opts.push({ text: 'Delete for everyone', style: 'destructive', onPress: () => doDeleteChat(true) });
    Alert.alert('Delete chat', 'Choose how to delete this chat.', opts);
  };
  const doDeleteChat = async (forEveryone) => {
    try { await ChatAPI.deleteGroup(groupId, forEveryone); navigation.goBack(); }
    catch (e) { Alert.alert('Error', e.response?.data?.error || 'Could not delete chat'); }
  };

  const openInfo = () => { if (isGroupChat) { setNameDraft(null); setShowAdd(false); setShowInfo(true); } };
  const saveName = async () => {
    if (!nameDraft?.trim()) return;
    setBusy(true);
    try { await ChatAPI.updateGroup(groupId, { name: nameDraft.trim() }); setNameDraft(null); await loadGroups(); }
    catch (e) { Alert.alert('Error', e.response?.data?.error || 'Could not rename'); }
    finally { setBusy(false); }
  };
  const changeGroupPhoto = async () => {
    if (!canManage) return;
    try {
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.5, base64: true, allowsEditing: true, aspect: [1, 1] });
      if (res.canceled || !res.assets?.[0]) return;
      const a = res.assets[0];
      setBusy(true);
      const up = await ChatAPI.upload(`data:${a.mimeType || 'image/jpeg'};base64,${a.base64}`, 'image');
      await ChatAPI.updateGroup(groupId, { avatar: up.data?.data?.url });
      await loadGroups();
    } catch { Alert.alert('Error', 'Failed to update photo'); }
    finally { setBusy(false); }
  };
  const openAdd = async () => {
    setShowAdd(true); setAddIds([]);
    if (!allUsers.length) {
      try { const r = await ChatAPI.getUsers(); setAllUsers(r.data?.data || []); } catch { /* ignore */ }
    }
  };
  const addMembers = async () => {
    setBusy(true);
    try { await ChatAPI.addMembers(groupId, addIds); setShowAdd(false); setAddIds([]); await loadGroups(); }
    catch (e) { Alert.alert('Error', e.response?.data?.error || 'Could not add members'); }
    finally { setBusy(false); }
  };
  const removeMember = (m, leaving) => {
    Alert.alert(leaving ? 'Leave group?' : `Remove ${m.name}?`, '', [
      { text: 'Cancel', style: 'cancel' },
      { text: leaving ? 'Leave' : 'Remove', style: 'destructive', onPress: async () => {
        try {
          await ChatAPI.removeMember(groupId, m.id);
          if (leaving) { setShowInfo(false); navigation.goBack(); } else await loadGroups();
        } catch (e) { Alert.alert('Error', e.response?.data?.error || 'Failed'); }
      } },
    ]);
  };
  const changeRole = async (m) => {
    try { await ChatAPI.changeRole(groupId, m.id, m.chatRole === 'ADMIN' ? 'MEMBER' : 'ADMIN'); await loadGroups(); }
    catch (e) { Alert.alert('Error', e.response?.data?.error || 'Failed'); }
  };

  // ── rendering ──
  const readTick = (m) => {
    if (!otherMembers.length) return 'sent';
    const t = new Date(m.createdAt).getTime();
    return otherMembers.some(o => o.lastReadAt && new Date(o.lastReadAt).getTime() >= t) ? 'read' : 'sent';
  };

  const renderMessage = ({ item: m, index }) => {
    const mine = m.sender?.id === user?.id;
    const prev = messages[index - 1];
    const newDay = !prev || new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString();
    const mentioned = (m.mentions || []).some(mn => mn.userId === user?.id || mn.user?.id === user?.id);
    const groupedReactions = {};
    (m.reactions || []).forEach(r => {
      const g = groupedReactions[r.emoji] || (groupedReactions[r.emoji] = { count: 0, mine: false });
      g.count++; if (r.user?.id === user?.id) g.mine = true;
    });
    const bg = m.isDeleted ? colors.bg2 : mine ? colors.primary + '26' : mentioned ? '#FEF3C7' : colors.card;
    const fg = m.isDeleted ? colors.text3 : colors.text;
    const tick = mine && !m._optimistic ? readTick(m) : null;
    return (
      <View>
        {m.id === firstUnreadId && (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 8, gap: 8 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: '#16A34A' }} />
            <Text style={{ color: '#16A34A', fontSize: 11, fontWeight: '800' }}>{unreadAtOpen} UNREAD MESSAGE{unreadAtOpen > 1 ? 'S' : ''}</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: '#16A34A' }} />
          </View>
        )}
        {newDay && (
          <View style={{ alignItems: 'center', marginVertical: 10 }}>
            <Text style={[s.dayChip, { color: colors.text3, backgroundColor: colors.bg2, borderColor: colors.border }]}>{dayLabel(m.createdAt)}</Text>
          </View>
        )}
        <View style={[s.msgRow, { justifyContent: mine ? 'flex-end' : 'flex-start' }]}>
          {!mine && <View style={{ marginRight: 6, alignSelf: 'flex-end' }}><ChatAvatar name={m.sender?.name} avatar={m.sender?.avatar} size={26} colors={colors} /></View>}
          <View style={{ maxWidth: '78%' }}>
            {m.isPinned && !m.isDeleted && <Text style={[s.tiny, { color: '#D97706', textAlign: mine ? 'right' : 'left' }]}>📌 Pinned</Text>}
            <TouchableOpacity
              activeOpacity={0.85}
              disabled={m._optimistic || m.isDeleted}
              onPress={() => setActionMsg(m)}
              onLongPress={() => setActionMsg(m)}
              style={[s.bubble, { backgroundColor: bg, borderColor: colors.border, opacity: m._optimistic ? 0.6 : 1 }]}
            >
              {m.isForwarded && !m.isDeleted && <Text style={[s.tiny, { color: colors.text3, fontStyle: 'italic' }]}>↪ Forwarded</Text>}
              {!mine && isGroupChat && !m.isDeleted && <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 12, marginBottom: 2 }}>{m.sender?.name}</Text>}
              {m.isDeleted ? (
                <Text style={{ color: fg, fontStyle: 'italic', fontSize: 14 }}>🚫 This message was deleted</Text>
              ) : (
                <>
                  {m.replyTo && (
                    <View style={[s.quote, { borderColor: colors.primary, backgroundColor: 'rgba(0,0,0,0.05)' }]}>
                      <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 12 }}>{m.replyTo.sender?.name}</Text>
                      <Text style={{ color: colors.text2, fontSize: 12 }} numberOfLines={2}>
                        {m.replyTo.isDeleted ? 'Message deleted' : (m.replyTo.content || m.replyTo.attachmentName || 'Attachment')}
                      </Text>
                    </View>
                  )}
                  {m.attachmentUrl ? (
                    m.attachmentType?.startsWith('image/') ? (
                      <TouchableOpacity onPress={() => Linking.openURL(m.attachmentUrl)}>
                        <Image source={{ uri: m.attachmentUrl }} style={s.img} resizeMode="cover" />
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity onPress={() => Linking.openURL(m.attachmentUrl)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                        <Ionicons name="attach" size={14} color={colors.primary} />
                        <Text style={{ color: colors.primary, textDecorationLine: 'underline', fontSize: 13 }}>{m.attachmentName || 'Attachment'}</Text>
                      </TouchableOpacity>
                    )
                  ) : null}
                  {m.content ? <MentionText content={m.content} mentions={m.mentions} color={fg} mentionColor={colors.primary} /> : null}
                </>
              )}
              <View style={s.meta}>
                {m.isEdited && !m.isDeleted && <Text style={[s.tiny, { color: colors.text3, fontStyle: 'italic' }]}>edited </Text>}
                <Text style={[s.tiny, { color: colors.text3 }]}>{fmtTime(m.createdAt)}</Text>
                {tick && <Ionicons name={tick === 'read' ? 'checkmark-done' : 'checkmark'} size={14} color={tick === 'read' ? '#2563EB' : colors.text3} style={{ marginLeft: 3 }} />}
              </View>
            </TouchableOpacity>
            {Object.keys(groupedReactions).length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 3, justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                {Object.entries(groupedReactions).map(([emoji, g]) => (
                  <TouchableOpacity key={emoji} onPress={() => toggleReaction(m, emoji)}
                    style={[s.reaction, { backgroundColor: g.mine ? colors.primary + '20' : colors.card, borderColor: g.mine ? colors.primary : colors.border }]}>
                    <Text style={{ fontSize: 12 }}>{emoji} <Text style={{ color: colors.text3 }}>{g.count}</Text></Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  const firstUnreadId = useMemo(() => {
    if (!unreadAtOpen) return null;
    let seen = 0;
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.sender?.id !== user?.id && !m.isDeleted && !m._optimistic) { seen++; if (seen === unreadAtOpen) return m.id; }
    }
    return null;
  }, [messages, unreadAtOpen, user?.id]);

  const memberIdsInGroup = (group?.members || []).map(m => m.id);

  return (
    <ScreenWrapper isScrollable={false}>
      {/* header */}
      <View style={[s.header, { borderColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}><Ionicons name="arrow-back" size={22} color={colors.text} /></TouchableOpacity>
        <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }} onPress={openInfo} activeOpacity={isGroupChat ? 0.7 : 1}>
          <ChatAvatar name={title} avatar={group?.avatar} isGroup={isGroupChat} online={directOther && isOnline(directOther.lastActiveAt)} size={38} colors={colors} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }} numberOfLines={1}>{title}</Text>
            {subtitle ? <Text style={{ color: typingLabel || subtitle === 'Online' ? '#16A34A' : colors.text3, fontSize: 11 }} numberOfLines={1}>{subtitle}</Text> : null}
          </View>
        </TouchableOpacity>
        {pinned.length > 0 && (
          <TouchableOpacity onPress={() => setShowPinned(true)} style={s.hBtn}>
            <Ionicons name="pin" size={19} color="#D97706" />
          </TouchableOpacity>
        )}
        {isGroupChat && <TouchableOpacity onPress={openInfo} style={s.hBtn}><Ionicons name="information-circle-outline" size={22} color={colors.text2} /></TouchableOpacity>}
        <TouchableOpacity onPress={deleteChat} style={s.hBtn}><Ionicons name="trash-outline" size={20} color="#EF4444" /></TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color={colors.primary} /></View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={renderMessage}
            contentContainerStyle={{ padding: 12, paddingBottom: 16 }}
            onScroll={(e) => {
              const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
              atBottom.current = contentSize.height - contentOffset.y - layoutMeasurement.height < 80;
              setShowJump(contentSize.height - contentOffset.y - layoutMeasurement.height > 300);
            }}
            scrollEventThrottle={100}
            onContentSizeChange={() => { if (atBottom.current) listRef.current?.scrollToEnd({ animated: false }); }}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingTop: 60 }}>
                <Ionicons name="chatbubble-ellipses-outline" size={44} color={colors.text3} />
                <Text style={{ color: colors.text3, marginTop: 10 }}>Say hi 👋</Text>
              </View>
            }
          />
        )}

        {showJump && (
          <TouchableOpacity onPress={() => { atBottom.current = true; scrollEnd(); }} style={[s.jumpBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="chevron-down" size={22} color={colors.primary} />
          </TouchableOpacity>
        )}

        {/* reply / edit banner */}
        {(replyingTo || editing) && (
          <View style={[s.banner, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
            <Ionicons name={editing ? 'create-outline' : 'arrow-undo'} size={16} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 12 }}>{editing ? 'Editing message' : `Replying to ${replyingTo.sender?.name}`}</Text>
              {!editing && <Text style={{ color: colors.text2, fontSize: 12 }} numberOfLines={1}>{replyingTo.content || replyingTo.attachmentName || 'Attachment'}</Text>}
            </View>
            <TouchableOpacity onPress={() => { setReplyingTo(null); setEditing(null); if (editing) setText(''); }}><Ionicons name="close" size={18} color={colors.text3} /></TouchableOpacity>
          </View>
        )}

        {/* mention picker */}
        {mentionCandidates.length > 0 && (
          <View style={[s.mentionBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {mentionCandidates.map(mm => (
              <TouchableOpacity key={mm.id} style={s.mentionRow} onPress={() => pickMention(mm)}>
                <ChatAvatar name={mm.name} avatar={mm.avatar} size={26} colors={colors} />
                <Text style={{ color: colors.text, fontSize: 14 }}>{mm.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* emoji panel */}
        {showEmoji && (
          <View style={[s.emojiPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {EMOJIS.map(e => (
              <TouchableOpacity key={e} onPress={() => setText(t => t + e)} style={{ padding: 6 }}><Text style={{ fontSize: 22 }}>{e}</Text></TouchableOpacity>
            ))}
          </View>
        )}

        {/* composer */}
        <View style={[s.inputBar, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <TouchableOpacity onPress={() => setShowEmoji(v => !v)} style={s.sideBtn}><Ionicons name={showEmoji ? 'happy' : 'happy-outline'} size={24} color={colors.text2} /></TouchableOpacity>
          <TouchableOpacity onPress={pickImage} disabled={uploading} style={s.sideBtn}>
            {uploading ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="image-outline" size={23} color={colors.text2} />}
          </TouchableOpacity>
          <TextInput
            style={[s.input, { color: colors.text, backgroundColor: colors.bg2 }]}
            value={text}
            onChangeText={onChangeText}
            placeholder={editing ? 'Edit message...' : isGroupChat ? 'Message (@ to mention)' : 'Message...'}
            placeholderTextColor={colors.text3}
            multiline
          />
          <TouchableOpacity style={[s.sendBtn, { backgroundColor: text.trim() ? colors.primary : colors.border }]} onPress={send} disabled={!text.trim() || sending}>
            {sending ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name={editing ? 'checkmark' : 'send'} size={17} color="#fff" />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* message action sheet */}
      <Modal visible={!!actionMsg} transparent animationType="fade" onRequestClose={() => setActionMsg(null)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setActionMsg(null)}>
          {actionMsg && (
            <View style={[s.actionCard, { backgroundColor: colors.card }]}>
              <View style={s.quickRow}>
                {QUICK.map(e => <TouchableOpacity key={e} onPress={() => toggleReaction(actionMsg, e)} style={{ padding: 6 }}><Text style={{ fontSize: 26 }}>{e}</Text></TouchableOpacity>)}
              </View>
              {[
                ['Reply', 'arrow-undo-outline', () => startReply(actionMsg), true],
                ['Forward', 'arrow-redo-outline', () => { setForwardMsg(actionMsg); setForwardIds([]); setActionMsg(null); }, true],
                ['Edit', 'create-outline', () => startEdit(actionMsg), actionMsg.sender?.id === user?.id && !!actionMsg.content],
                [actionMsg.isPinned ? 'Unpin' : 'Pin', 'pin-outline', () => togglePin(actionMsg), true],
                ['Delete for me', 'trash-outline', () => deleteMessage(actionMsg, false), true],
                ['Delete for everyone', 'trash', () => deleteMessage(actionMsg, true), actionMsg.sender?.id === user?.id || canDeleteForEveryone],
              ].filter(o => o[3]).map(([label, icon, fn]) => (
                <TouchableOpacity key={label} style={s.actionRow} onPress={fn}>
                  <Ionicons name={icon} size={20} color={label.includes('Delete') ? '#EF4444' : colors.text2} />
                  <Text style={{ color: label.includes('Delete') ? '#EF4444' : colors.text, fontSize: 15, fontWeight: '600' }}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </TouchableOpacity>
      </Modal>

      {/* pinned */}
      <Modal visible={showPinned} transparent animationType="slide" onRequestClose={() => setShowPinned(false)}>
        <View style={s.backdrop}>
          <View style={[s.sheet, { backgroundColor: colors.card }]}>
            <View style={s.sheetHead}>
              <Text style={{ color: colors.text, fontWeight: '800', fontSize: 17 }}>📌 Pinned messages</Text>
              <TouchableOpacity onPress={() => setShowPinned(false)}><Ionicons name="close" size={22} color={colors.text2} /></TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 360 }}>
              {pinned.map(pm => (
                <View key={pm.id} style={[s.pinRow, { borderColor: colors.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 12 }}>{pm.sender?.name}</Text>
                    <Text style={{ color: colors.text, fontSize: 13 }} numberOfLines={3}>{pm.content || pm.attachmentName || 'Attachment'}</Text>
                  </View>
                  <TouchableOpacity onPress={() => togglePin(pm)}><Ionicons name="close-circle" size={22} color={colors.text3} /></TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* forward */}
      <Modal visible={!!forwardMsg} transparent animationType="slide" onRequestClose={() => setForwardMsg(null)}>
        <View style={s.backdrop}>
          <View style={[s.sheet, { backgroundColor: colors.card }]}>
            <View style={s.sheetHead}>
              <Text style={{ color: colors.text, fontWeight: '800', fontSize: 17 }}>Forward to…</Text>
              <TouchableOpacity onPress={() => setForwardMsg(null)}><Ionicons name="close" size={22} color={colors.text2} /></TouchableOpacity>
            </View>
            <FlatList
              data={allGroups}
              keyExtractor={(g) => g.id}
              style={{ maxHeight: 340 }}
              renderItem={({ item: g }) => {
                const sel = forwardIds.includes(g.id);
                return (
                  <TouchableOpacity style={[s.pinRow, { borderColor: colors.border }]} onPress={() => setForwardIds(ids => sel ? ids.filter(x => x !== g.id) : [...ids, g.id])}>
                    <ChatAvatar name={g.name} avatar={g.avatar} isGroup={g.type !== 'DIRECT'} size={36} colors={colors} />
                    <Text style={{ flex: 1, color: colors.text, fontWeight: '600', marginLeft: 10 }} numberOfLines={1}>{g.name}</Text>
                    <Ionicons name={sel ? 'checkbox' : 'square-outline'} size={22} color={sel ? colors.primary : colors.text3} />
                  </TouchableOpacity>
                );
              }}
            />
            <TouchableOpacity style={[s.primaryBtn, { backgroundColor: colors.primary, opacity: !forwardIds.length || forwarding ? 0.5 : 1 }]} onPress={submitForward} disabled={!forwardIds.length || forwarding}>
              {forwarding ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800' }}>Forward ({forwardIds.length})</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* group info */}
      <Modal visible={showInfo} transparent animationType="slide" onRequestClose={() => setShowInfo(false)}>
        <View style={s.backdrop}>
          <View style={[s.sheet, { backgroundColor: colors.card, maxHeight: '92%' }]}>
            <View style={s.sheetHead}>
              <Text style={{ color: colors.text, fontWeight: '800', fontSize: 17 }}>{showAdd ? 'Add members' : 'Group info'}</Text>
              <TouchableOpacity onPress={() => (showAdd ? setShowAdd(false) : setShowInfo(false))}><Ionicons name={showAdd ? 'arrow-back' : 'close'} size={22} color={colors.text2} /></TouchableOpacity>
            </View>

            {showAdd ? (
              <>
                <PersonPicker users={allUsers} selectedIds={addIds} multi onToggle={(u) => setAddIds(ids => ids.includes(u.id) ? ids.filter(x => x !== u.id) : [...ids, u.id])} colors={colors} excludeIds={memberIdsInGroup} maxHeight={320} />
                <TouchableOpacity style={[s.primaryBtn, { backgroundColor: colors.primary, opacity: !addIds.length || busy ? 0.5 : 1 }]} onPress={addMembers} disabled={!addIds.length || busy}>
                  {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800' }}>Add ({addIds.length})</Text>}
                </TouchableOpacity>
              </>
            ) : (
              <ScrollView keyboardShouldPersistTaps="handled">
                <View style={{ alignItems: 'center', marginBottom: 14 }}>
                  <TouchableOpacity onPress={changeGroupPhoto} disabled={!canManage}>
                    <ChatAvatar name={title} avatar={group?.avatar} isGroup size={78} colors={colors} />
                    {canManage && <View style={[s.camBadge, { backgroundColor: colors.primary }]}><Ionicons name="camera" size={13} color="#fff" /></View>}
                  </TouchableOpacity>
                  {nameDraft !== null ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
                      <TextInput style={[s.nameInput, { color: colors.text, backgroundColor: colors.bg2, borderColor: colors.border }]} value={nameDraft} onChangeText={setNameDraft} autoFocus />
                      <TouchableOpacity onPress={saveName} disabled={busy}><Ionicons name="checkmark-circle" size={28} color={colors.primary} /></TouchableOpacity>
                      <TouchableOpacity onPress={() => setNameDraft(null)}><Ionicons name="close-circle" size={28} color={colors.text3} /></TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity disabled={!canManage} onPress={() => setNameDraft(group?.name || '')} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}>
                      <Text style={{ color: colors.text, fontWeight: '800', fontSize: 18 }}>{title}</Text>
                      {canManage && <Ionicons name="pencil" size={15} color={colors.text3} />}
                    </TouchableOpacity>
                  )}
                  <Text style={{ color: colors.text3, fontSize: 12, marginTop: 2 }}>{group?.members?.length || 0} members</Text>
                </View>

                {canManage && (
                  <TouchableOpacity style={[s.addRow, { borderColor: colors.border }]} onPress={openAdd}>
                    <Ionicons name="person-add-outline" size={20} color={colors.primary} />
                    <Text style={{ color: colors.primary, fontWeight: '700' }}>Add members</Text>
                  </TouchableOpacity>
                )}

                {(group?.members || []).map(m => (
                  <View key={m.id} style={[s.memberRow, { borderColor: colors.border }]}>
                    <ChatAvatar name={m.name} avatar={m.avatar} online={isOnline(m.lastActiveAt)} size={38} colors={colors} />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={{ color: colors.text, fontWeight: '700' }} numberOfLines={1}>{m.name}{m.id === user?.id ? ' (You)' : ''}</Text>
                      <Text style={{ color: colors.text3, fontSize: 12 }}>{m.chatRole === 'ADMIN' ? 'Group admin' : 'Member'}</Text>
                    </View>
                    {m.id === user?.id ? (
                      <TouchableOpacity onPress={() => removeMember(m, true)}><Text style={{ color: '#EF4444', fontWeight: '700', fontSize: 12 }}>Leave</Text></TouchableOpacity>
                    ) : canManage ? (
                      <View style={{ flexDirection: 'row', gap: 14 }}>
                        <TouchableOpacity onPress={() => changeRole(m)}><Ionicons name={m.chatRole === 'ADMIN' ? 'shield' : 'shield-outline'} size={20} color={m.chatRole === 'ADMIN' ? colors.primary : colors.text3} /></TouchableOpacity>
                        <TouchableOpacity onPress={() => removeMember(m, false)}><Ionicons name="person-remove-outline" size={20} color="#EF4444" /></TouchableOpacity>
                      </View>
                    ) : null}
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </ScreenWrapper>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 10, borderBottomWidth: 1.5 },
  jumpBtn: { position: 'absolute', right: 14, bottom: 70, width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  hBtn: { padding: 6 },
  msgRow: { flexDirection: 'row', marginBottom: 6 },
  bubble: { borderRadius: 16, paddingHorizontal: 11, paddingVertical: 7, borderWidth: 1 },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 2 },
  tiny: { fontSize: 10 },
  dayChip: { fontSize: 11, fontWeight: '700', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  quote: { borderLeftWidth: 3, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, marginBottom: 5 },
  img: { width: 210, height: 210, borderRadius: 12, marginBottom: 4 },
  reaction: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 7, paddingVertical: 2 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1 },
  mentionBox: { borderTopWidth: 1, paddingVertical: 4 },
  mentionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 7 },
  emojiPanel: { flexDirection: 'row', flexWrap: 'wrap', padding: 6, borderTopWidth: 1, maxHeight: 170 },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, paddingHorizontal: 8, paddingVertical: 8, borderTopWidth: 1.5 },
  sideBtn: { width: 34, height: 40, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9, fontSize: 14, maxHeight: 100 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 30 },
  actionCard: { borderRadius: 18, paddingVertical: 8, overflow: 'hidden' },
  quickRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 6, paddingHorizontal: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#9993' },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, paddingVertical: 13 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18 },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  pinRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1 },
  primaryBtn: { marginTop: 12, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  camBadge: { position: 'absolute', right: 0, bottom: 0, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  nameInput: { minWidth: 180, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, fontSize: 15 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1 },
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1 },
});
