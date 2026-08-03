import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import ScreenWrapper from '../components/ScreenWrapper';
import TicketCard from '../components/TicketCard';
import { ClientAPI } from '../services/client.api';
import { shapeTicket } from '../lib/shape';

const PAGE_SIZE = 5;
const POLL_INTERVAL_MS = 12000; // 12s — matches SupportScreen's live-update behavior

export default function AllTicketsScreen({ navigation }) {
  const { colors } = useTheme();
  const s = styles(colors);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchTickets();
  }, []);

  // Poll only while this screen is focused.
  useFocusEffect(
    useCallback(() => {
      const id = setInterval(() => fetchTickets({ silent: true }), POLL_INTERVAL_MS);
      return () => clearInterval(id);
    }, [])
  );

  const fetchTickets = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const res = await ClientAPI.getTickets();
      // API already returns newest-first (orderBy createdAt desc)
      setTickets((res?.data?.data || []).map(shapeTicket));
    } catch (e) {
      if (!silent) console.log('Tickets fetch error:', e);
    } finally {
      if (!silent) setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchTickets();
  };

  const handleReply = async (ticketId, body) => {
    await ClientAPI.replyTicket(ticketId, body);
    await fetchTickets();
  };

  const totalPages = Math.max(1, Math.ceil(tickets.length / PAGE_SIZE));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages]);
  const pageItems = tickets.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <ScreenWrapper isScrollable={false}>
      <View style={s.container}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>All Tickets</Text>
            <Text style={s.sub}>{tickets.length} total</Text>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 20, paddingBottom: 20 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
        >
          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
          ) : tickets.length === 0 ? (
            <Text style={{ color: colors.text2, fontStyle: 'italic', textAlign: 'center', marginTop: 40 }}>
              No tickets raised yet.
            </Text>
          ) : (
            <>
              {pageItems.map(t => (
                <TicketCard key={t.id} ticket={t} onReply={handleReply} />
              ))}

              {/* Pagination controls */}
              {totalPages > 1 && (
                <View style={s.pagination}>
                  <TouchableOpacity
                    disabled={page === 1}
                    onPress={() => setPage(p => Math.max(1, p - 1))}
                    style={[s.pageBtn, page === 1 && s.pageBtnDisabled]}
                  >
                    <Ionicons name="chevron-back" size={16} color={page === 1 ? colors.text3 : colors.text} />
                  </TouchableOpacity>

                  <Text style={{ fontSize: 13, color: colors.text2, fontWeight: '600' }}>
                    Page {page} of {totalPages}
                  </Text>

                  <TouchableOpacity
                    disabled={page === totalPages}
                    onPress={() => setPage(p => Math.min(totalPages, p + 1))}
                    style={[s.pageBtn, page === totalPages && s.pageBtnDisabled]}
                  >
                    <Ionicons name="chevron-forward" size={16} color={page === totalPages ? colors.text3 : colors.text} />
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </View>
    </ScreenWrapper>
  );
}

const styles = (c) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: c.card2, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '800', color: c.text },
  sub: { fontSize: 12, color: c.text2, marginTop: 2 },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 8, marginBottom: 12 },
  pageBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: c.card2, borderWidth: 1.5, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
  pageBtnDisabled: { opacity: 0.4 },
});