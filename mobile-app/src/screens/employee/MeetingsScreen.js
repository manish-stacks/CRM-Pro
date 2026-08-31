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

// Move an ISO date string by N days (slot-view day navigation).
const shiftISO = (iso, days) => {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return toISO(d);
};

const TABS = [
  { key: 'today', label: 'Today', params: { range: 'today' } },
  { key: 'tomorrow', label: 'Tomorrow', params: { range: 'tomorrow' } },
  { key: 'upcoming', label: 'Upcoming', params: { range: 'upcoming' } },
  { key: 'week', label: 'Next 7 days', params: { range: 'week' } },
  { key: 'rebook', label: 'To Rebook', params: { range: 'rebook' } },
  { key: 'done', label: 'Meeting Done', params: { status: 'meeting_done' } },
  { key: 'converted', label: 'Converted', params: { status: 'converted' } },
  { key: 'all', label: 'All', params: {} },
  { key: 'past', label: 'Past', params: { range: 'past' } },
];

function MeetingCard({ item, colors, onPress }) {
  const todayISO = toISO(new Date());
  const isToday = item.meeting_date === todayISO;
  const isPast = item.meeting_date && item.meeting_date < todayISO && item.status === 'meeting_scheduled';
  const isMeetingDone = item.status === 'meeting_done';

  return (
    <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={[s.card, { backgroundColor: colors.card, borderColor: isPast ? 'rgba(229,9,20,0.35)' : isMeetingDone ? 'rgba(20,184,166,0.4)' : colors.border }]}>
      <View style={s.top}>
        <View style={{ flex: 1 }}>
          <Text style={[s.client, { color: colors.text }]} numberOfLines={1}>
            {item.client_name || 'Client'}
          </Text>
          {item.company ? (
            <Text style={[s.company, { color: colors.text2 }]} numberOfLines={1}>{item.company}</Text>
          ) : null}
        </View>
        <View style={[s.badge, { backgroundColor: isMeetingDone ? 'rgba(20,184,166,0.14)' : isToday ? 'rgba(34,197,94,0.14)' : isPast ? 'rgba(229,9,20,0.12)' : 'rgba(59,130,246,0.12)' }]}>
          <Ionicons name={isMeetingDone ? 'checkmark-done-outline' : 'calendar-outline'} size={12} color={isMeetingDone ? '#14B8A6' : isToday ? '#16A34A' : isPast ? colors.primary : colors.blueText} />
          <Text style={[s.badgeTxt, { color: isMeetingDone ? '#14B8A6' : isToday ? '#16A34A' : isPast ? colors.primary : colors.blueText }]}>
            {isMeetingDone ? 'Decide Deal' : isToday ? 'Today' : isPast ? 'Missed' : 'Meeting'}
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

  const [tab, setTab] = useState(route?.params?.tab || 'today');
  const [pickedDate, setPickedDate] = useState('');
  const [dateModal, setDateModal] = useState(false);
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  // 'list' = the usual card feed, 'slots' = the whole day laid out slot by
  // slot (every office slot, booked or free) so the day is visible at a glance.
  const [viewMode, setViewMode] = useState('list');
  const [schedule, setSchedule] = useState(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleDate, setScheduleDate] = useState(toISO(new Date()));
  // Past-tab history filter — an explicit from/to range on top of "past", so a
  // marketing person can pull up "meri last month ki meetings".
  const [pastFrom, setPastFrom] = useState('');
  const [pastTo, setPastTo] = useState('');
  const [rangePicker, setRangePicker] = useState(null); // 'from' | 'to' | null

  // Current location — sent to the backend to calculate ETA
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
      // Date range only applies to the Past (history) tab.
      ...(!pickedDate && tab === 'past' && pastFrom ? { dateFrom: pastFrom } : {}),
      ...(!pickedDate && tab === 'past' && pastTo ? { dateTo: pastTo } : {}),
      ...(search ? { search } : {}),
      ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
    };
  }, [tab, pickedDate, search, coords, pastFrom, pastTo]);

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

  const fetchSchedule = useCallback(async () => {
    if (viewMode !== 'slots') return;
    setScheduleLoading(true);
    try {
      const r = await EmployeeAPI.getMySchedule({ date: scheduleDate, days: 1 });
      setSchedule(r.data?.data?.days?.[0] || null);
    } catch {
      setSchedule(null);
    } finally { setScheduleLoading(false); }
  }, [viewMode, scheduleDate]);

  useEffect(() => { fetchSchedule(); }, [fetchSchedule]);
  useFocusEffect(useCallback(() => { fetchMeetings(true); }, [fetchMeetings]));

  useEffect(() => {
    if (route?.params?.refresh) fetchMeetings(true);
  }, [route?.params?.refresh]);

  // Dashboard stat cards deep-link straight into a tab. The screen may already
  // be mounted (it's a tab), so react to the param rather than only reading it
  // on first render.
  useEffect(() => {
    if (route?.params?.tab) {
      setTab(route.params.tab);
      setPickedDate('');
    }
  }, [route?.params?.tab]);

  const onRefresh = () => { setRefreshing(true); fetchMeetings(true); };

  const badgeFor = (key) => {
    if (key === 'today') return counts.today;
    if (key === 'tomorrow') return counts.tomorrow;
    if (key === 'upcoming') return counts.upcoming;
    if (key === 'all') return counts.all;
    if (key === 'past') return counts.past;
    if (key === 'week') return counts.week;
    if (key === 'done') return counts.done;
    if (key === 'rebook') return counts.rebook;
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
            style={[s.iconBtn, {
              backgroundColor: viewMode === 'slots' ? colors.primary : colors.bg2,
              borderColor: viewMode === 'slots' ? colors.primary : colors.border,
            }]}
            onPress={() => setViewMode(v => (v === 'slots' ? 'list' : 'slots'))}
          >
            <Ionicons name="grid-outline" size={18} color={viewMode === 'slots' ? '#fff' : colors.text2} />
          </TouchableOpacity>
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

      {viewMode === 'slots' ? (
        /* ---- Slot-by-slot view of one day ---- */
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 10 }}>
            <TouchableOpacity
              onPress={() => setScheduleDate(shiftISO(scheduleDate, -1))}
              style={[s.iconBtn, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
              <Ionicons name="chevron-back" size={16} color={colors.text2} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setScheduleDate(toISO(new Date()))}
              style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 13.5, fontWeight: '800', color: colors.text }}>
                {prettyDate(scheduleDate)}
              </Text>
              {schedule ? (
                <Text style={{ fontSize: 11, color: colors.text3, marginTop: 1 }}>
                  {schedule.bookedCount} booked · {schedule.freeCount} free
                </Text>
              ) : null}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setScheduleDate(shiftISO(scheduleDate, 1))}
              style={[s.iconBtn, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
              <Ionicons name="chevron-forward" size={16} color={colors.text2} />
            </TouchableOpacity>
          </View>

          {scheduleLoading ? (
            <View style={s.center}><ActivityIndicator size="large" color={colors.primary} /></View>
          ) : !schedule || schedule.slots.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="grid-outline" size={40} color={colors.text3} />
              <Text style={[s.emptyTxt, { color: colors.text3 }]}>No slots for this day</Text>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={{ padding: 16, paddingTop: 0, paddingBottom: 30, gap: 8 }}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchSchedule().finally(() => setRefreshing(false)); }} tintColor={colors.primary} />}
            >
              {schedule.slots.map((sl, i) => (
                <TouchableOpacity
                  key={`${sl.label}-${i}`}
                  activeOpacity={sl.lead ? 0.8 : 1}
                  disabled={!sl.lead}
                  onPress={() => sl.lead && navigation.navigate('MeetingDetail', { meetingId: sl.lead.id })}
                  style={{
                    flexDirection: 'row', gap: 12, padding: 13, borderRadius: 14, borderWidth: 1.5,
                    backgroundColor: sl.lead ? colors.card : 'transparent',
                    borderColor: sl.lead ? colors.border : 'rgba(34,197,94,0.35)',
                    borderStyle: sl.lead ? 'solid' : 'dashed',
                  }}>
                  <View style={{ width: 62 }}>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: sl.lead ? colors.text : '#16A34A' }}>
                      {sl.start || sl.label}
                    </Text>
                    {sl.end ? (
                      <Text style={{ fontSize: 10.5, color: colors.text3, marginTop: 1 }}>{sl.end}</Text>
                    ) : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    {sl.lead ? (
                      <>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }} numberOfLines={1}>
                          {sl.lead.company || sl.lead.client_name}
                        </Text>
                        {sl.lead.company && sl.lead.client_name ? (
                          <Text style={{ fontSize: 11.5, color: colors.text2, marginTop: 1 }} numberOfLines={1}>
                            {sl.lead.client_name}
                          </Text>
                        ) : null}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 }}>
                          {sl.lead.city ? (
                            <Text style={{ fontSize: 11, color: colors.text3 }}>📍 {sl.lead.city}</Text>
                          ) : null}
                          {sl.lead.telecaller ? (
                            <Text style={{ fontSize: 11, color: colors.text3 }}>👤 {sl.lead.telecaller}</Text>
                          ) : null}
                        </View>
                      </>
                    ) : (
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#16A34A', paddingVertical: 4 }}>
                        Free
                      </Text>
                    )}
                  </View>
                  {sl.lead ? (
                    <Ionicons name="chevron-forward" size={16} color={colors.text3} style={{ alignSelf: 'center' }} />
                  ) : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      ) : (
        <>
      {/* Filter tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 44 }} contentContainerStyle={s.tabsWrap}>
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

      {tab === 'past' && !pickedDate ? (
        <View style={{ paddingHorizontal: 16, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity
            onPress={() => setRangePicker('from')}
            style={[s.activeFilter, { flex: 1, backgroundColor: colors.bg2, borderColor: pastFrom ? colors.primary : colors.border }]}>
            <Ionicons name="calendar-outline" size={13} color={pastFrom ? colors.primary : colors.text3} />
            <Text style={{ color: pastFrom ? colors.text : colors.text3, fontSize: 12, fontWeight: '700' }} numberOfLines={1}>
              {pastFrom ? prettyDate(pastFrom) : 'From'}
            </Text>
          </TouchableOpacity>
          <Text style={{ color: colors.text3, fontSize: 12 }}>→</Text>
          <TouchableOpacity
            onPress={() => setRangePicker('to')}
            style={[s.activeFilter, { flex: 1, backgroundColor: colors.bg2, borderColor: pastTo ? colors.primary : colors.border }]}>
            <Ionicons name="calendar-outline" size={13} color={pastTo ? colors.primary : colors.text3} />
            <Text style={{ color: pastTo ? colors.text : colors.text3, fontSize: 12, fontWeight: '700' }} numberOfLines={1}>
              {pastTo ? prettyDate(pastTo) : 'To'}
            </Text>
          </TouchableOpacity>
          {(pastFrom || pastTo) ? (
            <TouchableOpacity onPress={() => { setPastFrom(''); setPastTo(''); }}>
              <Ionicons name="close-circle" size={18} color={colors.text3} />
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <FlatList
          data={meetings}
          style={{ flex: 1 }}
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

        </>
      )}

      {/* History range picker — same CalendarModal, reused for From and To. */}
      <CalendarModal
        visible={!!rangePicker}
        value={rangePicker === 'from' ? pastFrom : pastTo}
        title={rangePicker === 'from' ? 'History from' : 'History to'}
        onClose={() => setRangePicker(null)}
        onPick={(iso) => {
          if (rangePicker === 'from') setPastFrom(iso); else setPastTo(iso);
          setRangePicker(null);
        }}
      />

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
  tabsWrap: { paddingHorizontal: 16, gap: 8 },
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
