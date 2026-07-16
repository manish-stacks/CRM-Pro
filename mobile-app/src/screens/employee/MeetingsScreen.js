import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Linking, Platform, Alert, TextInput,
  ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import ScreenWrapper from '../../components/ScreenWrapper';
import { CalendarModal, toISO, prettyDate } from '../../components/DatePickerField';
import { EmployeeAPI } from '../../services/employee.api';
import { getCurrentLocation } from '../../services/LocationTracker';

// ── Open an address (or lat,lng) in the device's maps app ──
function openInMaps(item) {
  const target = item?.lat != null && item?.lng != null
    ? `${item.lat},${item.lng}`
    : item?.address;
  if (!target) {
    Alert.alert('No location', 'This meeting has no address set yet.');
    return;
  }
  const q = encodeURIComponent(target);
  const url = `https://www.google.com/maps/dir/?api=1&destination=${q}&travelmode=driving`;
  Linking.openURL(url).catch(() =>
    Alert.alert('Could not open maps', 'No maps app is available on this device.')
  );
}

function callPhone(phone) {
  if (!phone) return;
  Linking.openURL(`tel:${phone}`).catch(() => {});
}

const TABS = [
  { key: 'today', label: 'Today', params: { range: 'today' } },
  { key: 'tomorrow', label: 'Tomorrow', params: { range: 'tomorrow' } },
  { key: 'upcoming', label: 'Upcoming', params: { range: 'upcoming' } },
  { key: 'week', label: 'Next 7 days', params: { range: 'week' } },
  { key: 'all', label: 'All', params: {} },
  { key: 'past', label: 'Past', params: { range: 'past' } },
];

function MeetingCard({ item, colors, onPress }) {
  const todayISO = toISO(new Date());
  const isToday = item.meeting_date === todayISO;
  const isPast = item.meeting_date && item.meeting_date < todayISO && item.status === 'meeting_scheduled';

  return (
    <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={[s.card, { backgroundColor: colors.card, borderColor: isPast ? 'rgba(229,9,20,0.35)' : colors.border }]}>
      <View style={s.top}>
        <View style={{ flex: 1 }}>
          <Text style={[s.client, { color: colors.text }]} numberOfLines={1}>
            {item.client_name || 'Client'}
          </Text>
          {item.company ? (
            <Text style={[s.company, { color: colors.text2 }]} numberOfLines={1}>{item.company}</Text>
          ) : null}
        </View>
        <View style={[s.badge, { backgroundColor: isToday ? 'rgba(34,197,94,0.14)' : isPast ? 'rgba(229,9,20,0.12)' : 'rgba(59,130,246,0.12)' }]}>
          <Ionicons name="calendar-outline" size={12} color={isToday ? '#16A34A' : isPast ? colors.primary : colors.blueText} />
          <Text style={[s.badgeTxt, { color: isToday ? '#16A34A' : isPast ? colors.primary : colors.blueText }]}>
            {isToday ? 'Today' : isPast ? 'Missed' : 'Meeting'}
          </Text>
        </View>
      </View>

      {/* ── Zomato-style distance + ETA ── */}
      {item.eta_text || item.distance_text ? (
        <View style={[s.etaBar, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
          <Ionicons name="car-sport" size={15} color={colors.primary} />
          <Text style={[s.etaMain, { color: colors.text }]}>
            {item.distance_text}{item.distance_text && item.eta_text ? ' · ' : ''}{item.eta_text}
          </Text>
          <Text style={[s.etaSub, { color: colors.text3 }]}>
            {item.eta_approx ? 'approx' : 'live traffic'}
          </Text>
        </View>
      ) : null}

      <View style={s.infoRow}>
        {item.meeting_date ? (
          <View style={s.chip}>
            <Ionicons name="calendar-outline" size={12} color={colors.text3} />
            <Text style={[s.chipTxt, { color: colors.text3 }]}>{prettyDate(item.meeting_date)}</Text>
          </View>
        ) : null}
        {item.meeting_time ? (
          <View style={s.chip}>
            <Ionicons name="time-outline" size={12} color={colors.text3} />
            <Text style={[s.chipTxt, { color: colors.text3 }]}>{item.meeting_time}</Text>
          </View>
        ) : null}
        {item.lead_number ? (
          <View style={s.chip}>
            <Ionicons name="pricetag-outline" size={12} color={colors.text3} />
            <Text style={[s.chipTxt, { color: colors.text3 }]}>{item.lead_number}</Text>
          </View>
        ) : null}
      </View>

      {item.address ? (
        <View style={[s.addressBox, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
          <Ionicons name="location-outline" size={14} color={colors.primary} style={{ marginTop: 1 }} />
          <Text style={[s.addressTxt, { color: colors.text2 }]}>{item.address}</Text>
        </View>
      ) : null}

      {item.notes ? (
        <Text style={[s.notes, { color: colors.text3 }]} numberOfLines={2}>“{item.notes}”</Text>
      ) : null}

      <View style={s.actions}>
        <TouchableOpacity
          style={[s.mapBtn, { backgroundColor: colors.primary }]}
          onPress={() => openInMaps(item)}
        >
          <Ionicons name="navigate" size={15} color="#fff" />
          <Text style={s.mapBtnTxt}>Directions</Text>
        </TouchableOpacity>

        {item.client_phone ? (
          <TouchableOpacity
            style={[s.callBtn, { borderColor: colors.green }]}
            onPress={() => callPhone(item.client_phone)}
          >
            <Ionicons name="call-outline" size={15} color={colors.greenText} />
            <Text style={[s.callBtnTxt, { color: colors.greenText }]}>Call</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={s.viewDetailRow}>
        <Text style={[s.viewDetailTxt, { color: colors.primary }]}>Tap to view details, log activity & close deal</Text>
        <Ionicons name="chevron-forward" size={14} color={colors.primary} />
      </View>
    </TouchableOpacity>
  );
}

export default function MeetingsScreen({ route, navigation }) {
  const { colors } = useTheme();
  const [meetings, setMeetings] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [tab, setTab] = useState('today');
  const [pickedDate, setPickedDate] = useState('');
  const [dateModal, setDateModal] = useState(false);
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  // Current location — ETA calculate karne ke liye backend ko bhejte hain
  const [coords, setCoords] = useState(null);

  useEffect(() => {
    let alive = true;
    getCurrentLocation()
      .then(loc => { if (alive && loc) setCoords({ lat: loc.latitude, lng: loc.longitude }); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const activeParams = useMemo(() => {
    const base = pickedDate
      ? { date: pickedDate }
      : (TABS.find(t => t.key === tab) || TABS[0]).params;
    return {
      ...base,
      ...(search ? { search } : {}),
      ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
    };
  }, [tab, pickedDate, search, coords]);

  const fetchMeetings = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await EmployeeAPI.getMeetings(activeParams);
      setMeetings(res.data?.data || []);
      setCounts(res.data?.counts || {});
    } catch {
      setMeetings([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeParams]);

  useEffect(() => { fetchMeetings(); }, [fetchMeetings]);
  useFocusEffect(useCallback(() => { fetchMeetings(true); }, [fetchMeetings]));

  useEffect(() => {
    if (route?.params?.refresh) fetchMeetings(true);
  }, [route?.params?.refresh]);

  const onRefresh = () => { setRefreshing(true); fetchMeetings(true); };

  const badgeFor = (key) => {
    if (key === 'today') return counts.today;
    if (key === 'tomorrow') return counts.tomorrow;
    if (key === 'upcoming') return counts.upcoming;
    if (key === 'all') return counts.all;
    if (key === 'past') return counts.past;
    return undefined;
  };

  return (
    <ScreenWrapper isScrollable={false}>
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: colors.text }]}>My Meetings</Text>
          <Text style={[s.subtitle, { color: colors.text2 }]}>
            {meetings.length} meeting{meetings.length === 1 ? '' : 's'}
            {coords ? ' · ETA live' : ' · location off'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            style={[s.iconBtn, { backgroundColor: colors.bg2, borderColor: colors.border }]}
            onPress={() => setShowSearch(v => !v)}
          >
            <Ionicons name={showSearch ? 'close' : 'search'} size={18} color={colors.text2} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.iconBtn, { backgroundColor: pickedDate ? colors.primary : colors.bg2, borderColor: pickedDate ? colors.primary : colors.border }]}
            onPress={() => setDateModal(true)}
          >
            <Ionicons name="calendar" size={18} color={pickedDate ? '#fff' : colors.text2} />
          </TouchableOpacity>
        </View>
      </View>

      {showSearch && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          <View style={[s.searchWrap, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
            <Ionicons name="search" size={16} color={colors.text3} />
            <TextInput
              style={{ flex: 1, fontSize: 14, paddingVertical: 10, color: colors.text }}
              placeholder="Client, company, lead no."
              placeholderTextColor={colors.text3}
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
            />
            {search ? <TouchableOpacity onPress={() => setSearch('')}><Ionicons name="close-circle" size={16} color={colors.text3} /></TouchableOpacity> : null}
          </View>
        </View>
      )}

      {pickedDate ? (
        <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          <View style={[s.activeFilter, { backgroundColor: colors.bg2, borderColor: colors.primary }]}>
            <Ionicons name="calendar" size={13} color={colors.primary} />
            <Text style={{ color: colors.text, fontSize: 12, fontWeight: '700', flex: 1 }}>{prettyDate(pickedDate)}</Text>
            <TouchableOpacity onPress={() => setPickedDate('')}>
              <Ionicons name="close-circle" size={16} color={colors.text3} />
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {/* Filter tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 50 }} contentContainerStyle={s.tabsWrap}>
        {TABS.map(t => {
          const active = !pickedDate && tab === t.key;
          const n = badgeFor(t.key);
          return (
            <TouchableOpacity
              key={t.key}
              style={[s.tabBtn, { backgroundColor: colors.bg2, borderColor: colors.border }, active && { backgroundColor: colors.primary, borderColor: colors.primary }]}
              onPress={() => { setPickedDate(''); setTab(t.key); }}
            >
              <Text style={[s.tabTxt, { color: active ? '#fff' : colors.text2 }]}>{t.label}</Text>
              {n ? (
                <View style={[s.tabBadge, { backgroundColor: active ? 'rgba(255,255,255,0.28)' : colors.border }]}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: active ? '#fff' : colors.text2 }}>{n}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <FlatList
          data={meetings}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => (
            <MeetingCard
              item={item}
              colors={colors}
              onPress={() => navigation.navigate('MeetingDetail', { meetingId: item.id })}
            />
          )}
          contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 30 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="calendar-clear-outline" size={40} color={colors.text3} />
              <Text style={[s.emptyTxt, { color: colors.text3 }]}>No meetings here</Text>
              <Text style={[s.emptySub, { color: colors.text3 }]}>
                Doosra filter ya date choose karke dekho. Jab manager meeting assign karega, wo yahan aur notification me dikhega.
              </Text>
            </View>
          }
        />
      )}

      <CalendarModal
        visible={dateModal}
        value={pickedDate}
        title="Filter by Date"
        onClose={() => setDateModal(false)}
        onPick={(iso) => { setPickedDate(iso); setDateModal(false); }}
      />
    </ScreenWrapper>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8, gap: 8 },
  title: { fontSize: 22, fontWeight: '800' },
  subtitle: { fontSize: 12, marginTop: 2 },
  iconBtn: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14 },
  activeFilter: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5 },
  tabsWrap: { paddingHorizontal: 16, gap: 8, paddingBottom: 10 },
  tabBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5 },
  tabTxt: { fontSize: 13, fontWeight: '600' },
  tabBadge: { minWidth: 18, paddingHorizontal: 5, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1.5 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  client: { fontSize: 15, fontWeight: '700' },
  company: { fontSize: 12, marginTop: 2 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeTxt: { fontSize: 11, fontWeight: '700' },
  etaBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, borderWidth: 1, marginBottom: 10 },
  etaMain: { fontSize: 13, fontWeight: '800', flex: 1 },
  etaSub: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  infoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chipTxt: { fontSize: 11 },
  addressBox: { flexDirection: 'row', gap: 6, padding: 10, borderRadius: 10, borderWidth: 1, marginTop: 8 },
  addressTxt: { fontSize: 12, flex: 1, lineHeight: 17 },
  notes: { fontSize: 12, fontStyle: 'italic', marginTop: 8 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  mapBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10 },
  mapBtnTxt: { color: '#fff', fontSize: 13, fontWeight: '700' },
  callBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 18, borderWidth: 1.5, borderRadius: 10 },
  callBtnTxt: { fontSize: 13, fontWeight: '700' },
  viewDetailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)' },
  viewDetailTxt: { fontSize: 11, fontWeight: '700' },
  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 30 },
  emptyTxt: { fontSize: 15, fontWeight: '600', marginTop: 12 },
  emptySub: { fontSize: 12, textAlign: 'center', marginTop: 6, lineHeight: 18 },
});
