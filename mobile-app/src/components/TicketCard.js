import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

// Matches web's statusPill() colors for ticket statuses.
const STATUS = {
  open: { bg: 'rgba(59,130,246,0.12)', color: '#2563EB', label: 'Open' },
  inprogress: { bg: 'rgba(245,158,11,0.12)', color: '#D97706', label: 'In Progress' },
  reopened: { bg: 'rgba(245,158,11,0.12)', color: '#D97706', label: 'Reopened' },
  resolved: { bg: 'rgba(34,197,94,0.12)', color: '#16A34A', label: 'Resolved' },
  closed: { bg: 'rgba(150,150,150,0.12)', color: '#888', label: 'Closed' },
};

const PRIORITY_COLOR = {
  LOW: '#64748B', MEDIUM: '#2563EB', HIGH: '#D97706', URGENT: '#DC2626',
};

export default function TicketCard({ ticket, onReply }) {
  const { colors } = useTheme();
  const s = styles(colors);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [threadOpen, setThreadOpen] = useState(false);
  const st = STATUS[ticket.status] || STATUS.open;
  const canReply = ticket.statusRaw !== 'CLOSED';
  const replyCount = ticket.replies.length;

  const send = async () => {
    if (!replyText.trim()) return;
    setSending(true);
    try {
      await onReply(ticket.id, replyText.trim());
      setReplyText('');
      setThreadOpen(true); // reveal the new reply right away
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={s.card}>
      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
        <Text style={{ fontFamily: 'monospace', fontSize: 11, color: colors.text3 }}>{ticket.ticketNumber}</Text>
        <View style={[s.badge, { backgroundColor: st.bg }]}><Text style={{ color: st.color, fontSize: 10, fontWeight: '700' }}>{st.label}</Text></View>
        <View style={[s.badge, { backgroundColor: colors.card2 }]}>
          <Text style={{ color: PRIORITY_COLOR[ticket.priority] || colors.text2, fontSize: 10, fontWeight: '700' }}>{ticket.priority}</Text>
        </View>
      </View>
      <Text style={{ fontWeight: '700', fontSize: 15, color: colors.text }}>{ticket.subject}</Text>
      <Text style={{ fontSize: 13, color: colors.text2, marginTop: 4 }}>{ticket.description}</Text>
      <Text style={{ fontSize: 11, color: colors.text3, marginTop: 8 }}>
        Assigned: {ticket.assignedToName || 'Unassigned'} · {ticket.date}
      </Text>

      {replyCount > 0 && (
        <TouchableOpacity
          style={s.threadToggle}
          onPress={() => setThreadOpen(v => !v)}
          activeOpacity={0.7}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={14} color={colors.primary} />
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary, flex: 1 }}>
            {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
          </Text>
          <Ionicons name={threadOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.primary} />
        </TouchableOpacity>
      )}

      {threadOpen && replyCount > 0 && (
        <View style={s.thread}>
          {ticket.replies.map(r => (
            <View key={r.id} style={s.replyBubble}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary, marginBottom: 2 }}>{r.userName}</Text>
              <Text style={{ fontSize: 13, color: colors.text }}>{r.body}</Text>
              <Text style={{ fontSize: 10, color: colors.text3, marginTop: 4 }}>{r.date}</Text>
            </View>
          ))}
        </View>
      )}

      {canReply && (
        <View style={s.replyRow}>
          <TextInput
            style={s.replyInput}
            placeholder="Write a reply..."
            placeholderTextColor={colors.text3}
            value={replyText}
            onChangeText={setReplyText}
          />
          <TouchableOpacity style={s.sendBtn} onPress={send} disabled={sending}>
            {sending ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="send" size={16} color="#fff" />}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = (c) => StyleSheet.create({
  card: { backgroundColor: c.card, borderWidth: 1.5, borderColor: c.border, borderRadius: 14, padding: 14, marginBottom: 12 },
  badge: { borderRadius: 100, paddingHorizontal: 8, paddingVertical: 3 },
  threadToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingVertical: 6 },
  thread: { backgroundColor: c.bg3 || c.card2, borderRadius: 10, padding: 10, marginTop: 6, gap: 8 },
  replyBubble: { backgroundColor: c.card, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: c.border },
  replyRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  replyInput: { flex: 1, borderWidth: 1.5, borderColor: c.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, color: c.text },
  sendBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
});