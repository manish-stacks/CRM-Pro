// src/screens/ReportsScreen.js
// Client-side Reports list — same behaviour as the web portal's Reports page:
// search, service / month / type filters, newest-oldest sort, pagination and a
// direct link to the PDF. SEO + GMB monthly reports land here automatically
// once the agency submits them.
import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, TextInput, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import ScreenWrapper from '../components/ScreenWrapper';
import { ClientAPI } from '../services/client.api';

const PAGE_SIZE = 6;

function Chip({ label, active, onPress, colors }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1.5,
        borderColor: active ? colors.primary : colors.border,
        backgroundColor: active ? colors.primary : colors.card,
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: '700', color: active ? '#fff' : colors.text2 }}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function ReportsScreen({ navigation }) {
  const { colors } = useTheme();
  const s = styles(colors);

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);

  const [search, setSearch] = useState('');
  const [service, setService] = useState('ALL');
  const [period, setPeriod] = useState('ALL');
  const [type, setType] = useState('ALL');
  const [newestFirst, setNewestFirst] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const fetchReports = async () => {
    try {
      const res = await ClientAPI.getReports();
      setReports(res?.data?.data || []);
    } catch (e) {
      console.log('Reports fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchReports(); }, []);

  const onRefresh = () => { setRefreshing(true); fetchReports(); };

  const services = useMemo(
    () => Array.from(new Set(reports.map(r => r.clientService?.serviceName).filter(Boolean))),
    [reports]
  );
  const periods = useMemo(() => {
    const list = Array.from(new Set(reports.map(r => r.reportPeriod).filter(Boolean)));
    return list.sort((a, b) => {
      const da = Date.parse(`1 ${a}`), db = Date.parse(`1 ${b}`);
      if (!isNaN(da) && !isNaN(db)) return db - da;
      return String(b).localeCompare(String(a));
    });
  }, [reports]);
  const types = useMemo(
    () => Array.from(new Set(reports.map(r => r.reportType).filter(Boolean))),
    [reports]
  );

  const filtered = useMemo(() => {
    let list = [...reports];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(r =>
        `${r.title || ''} ${r.description || ''} ${r.reportPeriod || ''} ${r.clientService?.serviceName || ''}`
          .toLowerCase().includes(q)
      );
    }
    if (service !== 'ALL') list = list.filter(r => r.clientService?.serviceName === service);
    if (period !== 'ALL') list = list.filter(r => r.reportPeriod === period);
    if (type !== 'ALL') list = list.filter(r => r.reportType === type);
    list.sort((a, b) => {
      const da = new Date(a.reportDate || a.createdAt).getTime();
      const db = new Date(b.reportDate || b.createdAt).getTime();
      return newestFirst ? db - da : da - db;
    });
    return list;
  }, [reports, search, service, period, type, newestFirst]);

  useEffect(() => { setPage(1); }, [search, service, period, type, newestFirst]);

  const activeFilters = [service, period, type].filter(v => v !== 'ALL').length + (search ? 1 : 0);
  const clearFilters = () => { setSearch(''); setService('ALL'); setPeriod('ALL'); setType('ALL'); };

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <ScreenWrapper isScrollable={false}>
      <View style={s.container}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Reports</Text>
            <Text style={s.sub}>{filtered.length} of {reports.length} report(s)</Text>
          </View>
          <TouchableOpacity onPress={() => setShowFilters(v => !v)} style={s.backBtn}>
            <Ionicons name="options-outline" size={19} color={activeFilters ? colors.primary : colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
        >
          {/* Search */}
          <View style={s.searchBox}>
            <Ionicons name="search" size={16} color={colors.text3} />
            <TextInput
              style={s.searchInput}
              placeholder="Search title, month, service..."
              placeholderTextColor={colors.text3}
              value={search}
              onChangeText={setSearch}
            />
            {!!search && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={16} color={colors.text3} />
              </TouchableOpacity>
            )}
          </View>

          {showFilters && (
            <View style={s.filterCard}>
              {services.length > 0 && (
                <>
                  <Text style={s.filterLabel}>SERVICE</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
                    <Chip label="All" active={service === 'ALL'} onPress={() => setService('ALL')} colors={colors} />
                    {services.map(n => (
                      <Chip key={n} label={n} active={service === n} onPress={() => setService(n)} colors={colors} />
                    ))}
                  </ScrollView>
                </>
              )}

              {periods.length > 0 && (
                <>
                  <Text style={s.filterLabel}>MONTH</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
                    <Chip label="All" active={period === 'ALL'} onPress={() => setPeriod('ALL')} colors={colors} />
                    {periods.map(p => (
                      <Chip key={p} label={p} active={period === p} onPress={() => setPeriod(p)} colors={colors} />
                    ))}
                  </ScrollView>
                </>
              )}

              {types.length > 1 && (
                <>
                  <Text style={s.filterLabel}>TYPE</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
                    <Chip label="All" active={type === 'ALL'} onPress={() => setType('ALL')} colors={colors} />
                    {types.map(t => (
                      <Chip key={t} label={t} active={type === t} onPress={() => setType(t)} colors={colors} />
                    ))}
                  </ScrollView>
                </>
              )}

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 }}>
                <TouchableOpacity onPress={() => setNewestFirst(v => !v)} style={s.sortBtn}>
                  <Ionicons name={newestFirst ? 'arrow-down' : 'arrow-up'} size={14} color={colors.text2} />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text2 }}>
                    {newestFirst ? 'Latest first' : 'Oldest first'}
                  </Text>
                </TouchableOpacity>
                {activeFilters > 0 && (
                  <TouchableOpacity onPress={clearFilters}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>Clear filters</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
          ) : reports.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="document-text-outline" size={34} color={colors.text3} />
              <Text style={s.emptyText}>No reports shared yet</Text>
            </View>
          ) : filtered.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="search-outline" size={30} color={colors.text3} />
              <Text style={s.emptyText}>No reports match your filters</Text>
            </View>
          ) : (
            <>
              {pageItems.map(r => (
                <View key={r.id} style={s.card}>
                  <View style={s.badgeRow}>
                    {!!r.reportPeriod && (
                      <View style={[s.badge, { backgroundColor: 'rgba(168,85,247,0.14)' }]}>
                        <Text style={[s.badgeText, { color: '#9333EA' }]}>{r.reportPeriod}</Text>
                      </View>
                    )}
                    {!!r.clientService?.serviceName && (
                      <View style={[s.badge, { backgroundColor: 'rgba(59,130,246,0.12)' }]}>
                        <Text style={[s.badgeText, { color: '#3B82F6' }]}>{r.clientService.serviceName}</Text>
                      </View>
                    )}
                    {!!r.reportType && (
                      <View style={[s.badge, { backgroundColor: colors.card2 }]}>
                        <Text style={[s.badgeText, { color: colors.text2 }]}>{r.reportType}</Text>
                      </View>
                    )}
                  </View>

                  <Text style={s.cardTitle}>{r.title}</Text>
                  {!!r.description && <Text style={s.cardDesc}>{r.description}</Text>}
                  {!!r.content && (
                    <View style={s.contentBox}>
                      <Text style={{ fontSize: 12.5, color: colors.text, lineHeight: 19 }}>{r.content}</Text>
                    </View>
                  )}

                  {!!r.fileUrl && (
                    <TouchableOpacity style={s.openBtn} onPress={() => Linking.openURL(r.fileUrl)}>
                      <Ionicons name="download-outline" size={15} color={colors.primary} />
                      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primary }}>Open report</Text>
                    </TouchableOpacity>
                  )}

                  <Text style={s.meta}>
                    {r.uploadedBy?.name ? `By ${r.uploadedBy.name} · ` : ''}
                    {new Date(r.reportDate || r.createdAt).toLocaleDateString('en-IN')}
                  </Text>
                </View>
              ))}

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

  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.card,
    borderWidth: 1.5, borderColor: c.border, borderRadius: 14, paddingHorizontal: 12, height: 44, marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 13.5, color: c.text, padding: 0 },

  filterCard: { backgroundColor: c.card, borderWidth: 1.5, borderColor: c.border, borderRadius: 16, padding: 14, marginBottom: 14 },
  filterLabel: { fontSize: 10, fontWeight: '800', color: c.text3, letterSpacing: 0.6, marginBottom: 8, marginTop: 4 },
  chipRow: { flexDirection: 'row', gap: 8, paddingRight: 8 },
  sortBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: c.border,
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7,
  },

  card: { backgroundColor: c.card, borderWidth: 1.5, borderColor: c.border, borderRadius: 16, padding: 16, marginBottom: 12 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 10, fontWeight: '800' },
  cardTitle: { fontSize: 15, fontWeight: '800', color: c.text },
  cardDesc: { fontSize: 13, color: c.text2, marginTop: 4, lineHeight: 19 },
  contentBox: { backgroundColor: c.card2, borderRadius: 12, padding: 12, marginTop: 10 },
  openBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    marginTop: 12, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10, backgroundColor: 'rgba(229,9,20,0.08)',
  },
  meta: { fontSize: 11, color: c.text3, marginTop: 10 },

  empty: { alignItems: 'center', gap: 8, marginTop: 50 },
  emptyText: { color: c.text2, fontSize: 13.5, fontStyle: 'italic' },

  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 8, marginBottom: 12 },
  pageBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: c.card2, borderWidth: 1.5, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
  pageBtnDisabled: { opacity: 0.4 },
});
