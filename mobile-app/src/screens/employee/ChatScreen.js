import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  ActivityIndicator, RefreshControl, Alert, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { ChatAPI, isOnline, unreadBus } from '../../services/chat.api';
import { ChatAvatar, PersonPicker } from '../../components/chat/ChatParts';
import ScreenWrapper from '../../components/ScreenWrapper';

function timeAgo(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

export default function ChatScreen({ navigation }) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // new chat
  const [showNew, setShowNew] = useState(false);
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [form, setForm] = useState({ type: 'DIRECT', name: '', memberIds: [] });
  const [creating, setCreating] = useState(false);

  // search all messages
  const [showSearch, setShowSearch] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef(null);

  const fetchGroups = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await ChatAPI.getGroups();
      const list = res.data?.data || [];
      setGroups(list);
      unreadBus.emit(list.reduce((t, g) => t + (g.unreadCount || 0), 0));
    } catch (e) {
      if (!silent) Alert.alert('Error', e.response?.data?.error || e.message || 'Failed to load chats');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Refresh on focus + poll every 8s; heartbeat every 20s so others see me online.
  useFocusEffect(useCallback(() => {
    fetchGroups(true);
    ChatAPI.heartbeat().catch(() => {});
    const poll = setInterval(() => fetchGroups(true), 8000);
    const beat = setInterval(() => ChatAPI.heartbeat().catch(() => {}), 20000);
    return () => { clearInterval(poll); clearInterval(beat); };
  }, [fetchGroups]));
  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  const openChat = (g) => {
    navigation.navigate('ChatConversation', { groupId: g.id, groupName: g.name, unread: g.unreadCount || 0 });
    // optimistic: this chat is about to be marked read
    setGroups(prev => { const next = prev.map(x => x.id === g.id ? { ...x, unreadCount: 0 } : x); unreadBus.emit(next.reduce((t, y) => t + (y.unreadCount || 0), 0)); return next; });
  };

  // ── new chat ──
  const openNew = async () => {
    setForm({ type: 'DIRECT', name: '', memberIds: [] });
    setShowNew(true);
    setUsersLoading(true);
    try {
      const res = await ChatAPI.getUsers();
      setUsers((res.data?.data || []).filter(u => u.id !== user?.id));
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to load people');
    } finally { setUsersLoading(false); }
  };

  const togglePerson = (u) => setForm(f => ({
    ...f,
    memberIds: f.type === 'DIRECT' ? [u.id] : f.memberIds.includes(u.id) ? f.memberIds.filter(x => x !== u.id) : [...f.memberIds, u.id],
  }));

  const startChat = async () => {
    if (form.memberIds.length === 0) return Alert.alert('Select', form.type === 'DIRECT' ? 'Choose a person' : 'Choose at least one member');
    if (form.type === 'GROUP' && !form.name.trim()) return Alert.alert('Group name', 'Enter a group name');
    setCreating(true);
    try {
      const res = await ChatAPI.createGroup({ type: form.type, name: form.name.trim(), memberIds: form.memberIds });
      const g = res.data?.data;
      setShowNew(false);
      fetchGroups(true);
      const person = users.find(u => u.id === form.memberIds[0]);
      navigation.navigate('ChatConversation', { groupId: g.id, groupName: g.name || person?.name || 'Chat' });
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'Could not start chat');
    } finally { setCreating(false); }
  };

  // ── message search ──
  const runSearch = (q) => {
    setQuery(q);
    clearTimeout(searchTimer.current);
    if (q.trim().length < 2) { setResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try { const r = await ChatAPI.search(q.trim()); setResults(r.data?.data || []); }
      catch { /* ignore */ }
      finally { setSearching(false); }
    }, 350);
  };

  const totalUnread = groups.reduce((t, g) => t + (g.unreadCount || 0), 0);
  const filtered = groups.filter(g => !search || (g.name || '').toLowerCase().includes(search.toLowerCase()));

  const renderGroup = ({ item: g }) => {
    const other = g.type === 'DIRECT' ? (g.members || []).find(m => m.id !== user?.id) : null;
    const lm = g.lastMessage;
    const preview = lm ? (lm.attachmentUrl && !lm.content?.trim() ? `📎 ${lm.attachmentName || 'Attachment'}` : (lm.content || '')) : 'No messages yet';
    return (
      <TouchableOpacity activeOpacity={0.75} style={[s.row, { borderColor: colors.border }]} onPress={() => openChat(g)}>
        <ChatAvatar name={g.name} avatar={g.avatar} isGroup={g.type !== 'DIRECT'} online={other && isOnline(other.lastActiveAt)} colors={colors} />
        <View style={{ flex: 1 }}>
          <View style={s.rowTop}>
            <Text style={[s.name, { color: colors.text, fontWeight: g.unreadCount ? '800' : '700' }]} numberOfLines={1}>{g.name || 'Unnamed'}</Text>
            <Text style={[s.time, { color: g.unreadCount ? '#16A34A' : colors.text3 }]}>{timeAgo(lm?.createdAt || g.updatedAt)}</Text>
          </View>
          <View style={s.rowTop}>
            <Text style={[s.preview, { color: g.unreadCount ? colors.text : colors.text3, fontWeight: g.unreadCount ? '600' : '400' }]} numberOfLines={1}>
              {lm ? `${lm.sender?.name}: ` : ''}{preview}
            </Text>
            {g.unreadCount > 0 ? (
              <View style={s.badge}><Text style={s.badgeTxt}>{g.unreadCount > 99 ? '99+' : g.unreadCount}</Text></View>
            ) : g.type !== 'DIRECT' ? (
              <Text style={{ fontSize: 10, color: colors.text3 }}>{g.memberCount}</Text>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ScreenWrapper isScrollable={false}>
      <View style={s.header}>
        <Text style={[s.headerTitle, { color: colors.text }]}>Team Chat{totalUnread > 0 ? <Text style={{ color: '#16A34A', fontSize: 16 }}>  {totalUnread} new</Text> : null}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={[s.iconBtn, { backgroundColor: colors.bg2, borderColor: colors.border }]} onPress={() => { setShowSearch(true); setQuery(''); setResults([]); }}>
            <Ionicons name="search" size={19} color={colors.text2} />
          </TouchableOpacity>
          <TouchableOpacity style={[s.iconBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]} onPress={openNew}>
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={[s.searchWrap, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
        <Ionicons name="search-outline" size={18} color={colors.text3} />
        <TextInput style={[s.searchInput, { color: colors.text }]} value={search} onChangeText={setSearch} placeholder="Search chats" placeholderTextColor={colors.text3} />
        {search ? <TouchableOpacity onPress={() => setSearch('')}><Ionicons name="close-circle" size={18} color={colors.text3} /></TouchableOpacity> : null}
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(g) => g.id}
          renderItem={renderGroup}
          contentContainerStyle={{ paddingBottom: 30 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchGroups(true); }} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <Ionicons name="chatbubbles-outline" size={48} color={colors.text3} />
              <Text style={{ color: colors.text2, marginTop: 12, fontSize: 15, fontWeight: '600' }}>No chats yet</Text>
              <Text style={{ color: colors.text3, marginTop: 4, fontSize: 12 }}>Tap + to start a chat</Text>
            </View>
          }
        />
      )}

      {/* New chat */}
      <Modal visible={showNew} animationType="slide" transparent onRequestClose={() => setShowNew(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.backdrop}>
          <View style={[s.sheet, { backgroundColor: colors.card }]}>
            <View style={s.sheetHead}>
              <Text style={[s.sheetTitle, { color: colors.text }]}>New Chat</Text>
              <TouchableOpacity onPress={() => setShowNew(false)}><Ionicons name="close" size={22} color={colors.text2} /></TouchableOpacity>
            </View>

            <View style={[s.seg, { backgroundColor: colors.bg2 }]}>
              {[['DIRECT', 'Direct (1-1)'], ['GROUP', 'Group']].map(([t, label]) => (
                <TouchableOpacity key={t} style={[s.segBtn, form.type === t && { backgroundColor: colors.primary }]}
                  onPress={() => setForm(f => ({ ...f, type: t, memberIds: t === 'DIRECT' ? f.memberIds.slice(0, 1) : f.memberIds }))}>
                  <Text style={{ color: form.type === t ? '#fff' : colors.text2, fontWeight: '700', fontSize: 13 }}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {form.type === 'GROUP' && (
              <TextInput
                style={[s.nameInput, { color: colors.text, backgroundColor: colors.bg2, borderColor: colors.border }]}
                value={form.name} onChangeText={(v) => setForm(f => ({ ...f, name: v }))}
                placeholder="Group name (e.g. Sales Team)" placeholderTextColor={colors.text3}
              />
            )}

            {usersLoading ? <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 30 }} /> : (
              <PersonPicker users={users} selectedIds={form.memberIds} multi={form.type === 'GROUP'} onToggle={togglePerson} colors={colors} maxHeight={300} />
            )}

            <TouchableOpacity style={[s.startBtn, { backgroundColor: colors.primary, opacity: creating ? 0.6 : 1 }]} onPress={startChat} disabled={creating}>
              {creating ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>Start Chat{form.memberIds.length ? ` (${form.memberIds.length})` : ''}</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Search all messages */}
      <Modal visible={showSearch} animationType="slide" onRequestClose={() => setShowSearch(false)}>
        <ScreenWrapper isScrollable={false}>
          <View style={s.header}>
            <Text style={[s.headerTitle, { color: colors.text, fontSize: 18 }]}>Search messages</Text>
            <TouchableOpacity onPress={() => setShowSearch(false)}><Ionicons name="close" size={24} color={colors.text2} /></TouchableOpacity>
          </View>
          <View style={[s.searchWrap, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
            <Ionicons name="search-outline" size={18} color={colors.text3} />
            <TextInput autoFocus style={[s.searchInput, { color: colors.text }]} value={query} onChangeText={runSearch} placeholder="Search across all your chats..." placeholderTextColor={colors.text3} />
            {searching ? <ActivityIndicator size="small" color={colors.primary} /> : null}
          </View>
          <FlatList
            data={results}
            keyExtractor={(r) => r.id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item: r }) => (
              <TouchableOpacity style={[s.row, { borderColor: colors.border, alignItems: 'flex-start' }]}
                onPress={() => { setShowSearch(false); navigation.navigate('ChatConversation', { groupId: r.groupId, groupName: r.groupName }); }}>
                <View style={{ flex: 1 }}>
                  <View style={s.rowTop}>
                    <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 13 }} numberOfLines={1}>{r.groupName}</Text>
                    <Text style={{ color: colors.text3, fontSize: 11 }}>{timeAgo(r.createdAt)}</Text>
                  </View>
                  <Text style={{ color: colors.text, marginTop: 3, fontSize: 13 }} numberOfLines={2}><Text style={{ fontWeight: '700' }}>{r.sender?.name}: </Text>{r.content}</Text>
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={{ color: colors.text3, textAlign: 'center', paddingTop: 40 }}>{query.trim().length < 2 ? 'Type at least 2 characters' : searching ? '' : 'No messages found'}</Text>}
          />
        </ScreenWrapper>
      </Modal>
    </ScreenWrapper>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 },
  headerTitle: { fontSize: 24, fontWeight: '800' },
  iconBtn: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginBottom: 8, borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 },
  searchInput: { flex: 1, fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 1 },
  name: { fontSize: 15, flex: 1, marginRight: 8 },
  time: { fontSize: 11, fontWeight: '600' },
  preview: { fontSize: 13, flex: 1, marginRight: 8 },
  badge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: '#16A34A', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  badgeTxt: { color: '#fff', fontSize: 11, fontWeight: '800' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, maxHeight: '90%' },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sheetTitle: { fontSize: 17, fontWeight: '800' },
  seg: { flexDirection: 'row', borderRadius: 12, padding: 3, marginBottom: 12 },
  segBtn: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 10 },
  nameInput: { borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, marginBottom: 10 },
  startBtn: { marginTop: 12, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
});
