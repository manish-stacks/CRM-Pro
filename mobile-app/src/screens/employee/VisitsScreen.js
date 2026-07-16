import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, Modal,
  TextInput, ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import ScreenWrapper from '../../components/ScreenWrapper';
import DatePickerField, { CalendarModal, TimePickerField, toISO, prettyDate } from '../../components/DatePickerField';
import { EmployeeAPI } from '../../services/employee.api';
import { getCurrentLocation, reverseGeocode } from '../../services/LocationTracker';

const STATUS_COLORS = {
  pending: { bg: 'rgba(245,158,11,0.12)', text: '#D97706', icon: 'time-outline' },
  in_progress: { bg: 'rgba(59,130,246,0.12)', text: '#2563EB', icon: 'navigate-outline' },
  completed: { bg: 'rgba(34,197,94,0.12)', text: '#16A34A', icon: 'checkmark-circle-outline' },
  cancelled: { bg: 'rgba(148,163,184,0.15)', text: '#64748B', icon: 'close-circle-outline' },
};

const SOURCE_LABEL = { MANUAL: 'Manual', MEETING_ASSIGNED: 'Meeting', DEAL_DONE: 'Deal' };

// Filter tabs: server-side ranges so date-wise filtering is accurate
const TABS = [
  { key: 'all', label: 'All', params: {} },
  { key: 'today', label: 'Today', params: { range: 'today' } },
  { key: 'pending', label: 'Pending', params: { status: 'pending' } },
  { key: 'upcoming', label: 'Upcoming', params: { range: 'upcoming' } },
  { key: 'overdue', label: 'Overdue', params: { range: 'overdue' } },
  { key: 'completed', label: 'Completed', params: { status: 'completed' } },
];

function VisitCard({ visit, colors, onStart, onComplete, busyId }) {
  const status = visit.status?.toLowerCase() || 'pending';
  const sc = STATUS_COLORS[status] || STATUS_COLORS.pending;
  const isBusy = busyId === visit.id;
  const todayISO = toISO(new Date());
  const overdue = visit.visit_date && visit.visit_date < todayISO && ['pending', 'in_progress'].includes(status);
  const isToday = visit.visit_date === todayISO;

  return (
    <View style={[vStyles.card, { backgroundColor: colors.card, borderColor: overdue ? 'rgba(229,9,20,0.35)' : colors.border }]}>
      <View style={vStyles.top}>
        <View style={{ flex: 1 }}>
          <Text style={[vStyles.clientName, { color: colors.text }]}>{visit.client_name || 'Client'}</Text>
          {visit.purpose || visit.notes ? (
            <Text style={[vStyles.purpose, { color: colors.text2 }]} numberOfLines={1}>{visit.purpose || visit.notes}</Text>
          ) : null}
        </View>
        <View style={[vStyles.badge, { backgroundColor: sc.bg }]}>
          <Ionicons name={sc.icon} size={12} color={sc.text} />
          <Text style={[vStyles.badgeTxt, { color: sc.text }]}>{status.replace('_', ' ')}</Text>
        </View>
      </View>

      <View style={vStyles.tagRow}>
        {visit.source && visit.source !== 'MANUAL' ? (
          <View style={[vStyles.tag, { backgroundColor: colors.bg2 }]}>
            <Text style={[vStyles.tagTxt, { color: colors.text3 }]}>{SOURCE_LABEL[visit.source] || visit.source}</Text>
          </View>
        ) : null}
        {isToday ? (
          <View style={[vStyles.tag, { backgroundColor: 'rgba(59,130,246,0.12)' }]}>
            <Text style={[vStyles.tagTxt, { color: '#2563EB' }]}>Today</Text>
          </View>
        ) : null}
        {overdue ? (
          <View style={[vStyles.tag, { backgroundColor: 'rgba(229,9,20,0.12)' }]}>
            <Text style={[vStyles.tagTxt, { color: colors.primary }]}>Overdue</Text>
          </View>
        ) : null}
        {visit.outcome ? (
          <View style={[vStyles.tag, { backgroundColor: 'rgba(34,197,94,0.12)' }]}>
            <Text style={[vStyles.tagTxt, { color: '#16A34A' }]}>{visit.outcome.replace(/_/g, ' ')}</Text>
          </View>
        ) : null}
      </View>

      <View style={vStyles.infoRow}>
        {visit.visit_date ? (
          <View style={vStyles.chip}>
            <Ionicons name="calendar-outline" size={12} color={overdue ? colors.primary : colors.text3} />
            <Text style={[vStyles.chipTxt, { color: overdue ? colors.primary : colors.text3 }]}>{prettyDate(visit.visit_date)}</Text>
          </View>
        ) : null}
        {visit.visit_time ? (
          <View style={vStyles.chip}>
            <Ionicons name="time-outline" size={12} color={colors.text3} />
            <Text style={[vStyles.chipTxt, { color: colors.text3 }]}>{visit.visit_time}</Text>
          </View>
        ) : null}
        {visit.duration_mins != null ? (
          <View style={vStyles.chip}>
            <Ionicons name="hourglass-outline" size={12} color={colors.text3} />
            <Text style={[vStyles.chipTxt, { color: colors.text3 }]}>{visit.duration_mins} min</Text>
          </View>
        ) : null}
        {visit.location ? (
          <View style={[vStyles.chip, { flex: 1 }]}>
            <Ionicons name="location-outline" size={12} color={colors.text3} />
            <Text style={[vStyles.chipTxt, { color: colors.text3 }]} numberOfLines={1}>{visit.location}</Text>
          </View>
        ) : null}
      </View>

      {status === 'pending' && (
        <TouchableOpacity style={[vStyles.startBtn, { backgroundColor: colors.primary }]} onPress={() => onStart(visit)} disabled={isBusy}>
          {isBusy ? <ActivityIndicator color="#fff" size="small" /> : (
            <>
              <Ionicons name="navigate" size={16} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Start Visit (Check-in here)</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {status === 'in_progress' && (
        <TouchableOpacity style={[vStyles.completeBtn, { borderColor: colors.green }]} onPress={() => onComplete(visit)} disabled={isBusy}>
          {isBusy ? <ActivityIndicator color={colors.greenText} size="small" /> : (
            <>
              <Ionicons name="checkmark-circle-outline" size={16} color={colors.greenText} />
              <Text style={{ color: colors.greenText, fontSize: 13, fontWeight: '700' }}>Complete Meeting</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const vStyles = StyleSheet.create({
  card: { borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1.5 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  clientName: { fontSize: 15, fontWeight: '700' },
  purpose: { fontSize: 12, marginTop: 2 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeTxt: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  tag: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  tagTxt: { fontSize: 10, fontWeight: '800', textTransform: 'capitalize' },
  infoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chipTxt: { fontSize: 11 },
  completeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, paddingVertical: 8, borderWidth: 1.5, borderRadius: 10 },
  startBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, paddingVertical: 10, borderRadius: 10 },
});

export default function VisitsScreen({ navigation }) {
  const { colors } = useTheme();
  const [visits, setVisits] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [tab, setTab] = useState('all');
  const [pickedDate, setPickedDate] = useState('');   // exact date filter
  const [dateModal, setDateModal] = useState(false);
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newVisit, setNewVisit] = useState({ client_id: '', client_name: '', visit_date: '', visit_time: '', purpose: '', location: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const activeParams = useMemo(() => {
    if (pickedDate) return { date: pickedDate, ...(search ? { search } : {}) };
    const t = TABS.find(x => x.key === tab) || TABS[0];
    return { ...t.params, ...(search ? { search } : {}) };
  }, [tab, pickedDate, search]);

  const fetchVisits = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await EmployeeAPI.getVisits(activeParams);
      setVisits(res.data?.data || []);
      setCounts(res.data?.counts || {});
    } catch (e) {
      Alert.alert('Error', e.response?.data?.message || e.message || 'Failed to load visits');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeParams]);

  useEffect(() => { fetchVisits(); }, [fetchVisits]);

  // Refresh when returning to the screen (e.g. after closing a deal → auto visit)
  useFocusEffect(useCallback(() => { fetchVisits(true); }, [fetchVisits]));

  const onRefresh = useCallback(() => { setRefreshing(true); fetchVisits(true); }, [fetchVisits]);

  const handleStart = async (visit) => {
    setBusyId(visit.id);
    try {
      const loc = await getCurrentLocation();
      let address = null;
      if (loc) address = await reverseGeocode(loc.latitude, loc.longitude);
      await EmployeeAPI.startVisit(visit.id, loc ? { ...loc, address } : {});
      Alert.alert('Visit Started', 'Your arrival location has been recorded.');
      fetchVisits(true);
    } catch (e) {
      Alert.alert('Error', e.response?.data?.message || e.message || 'Failed to start visit');
    } finally { setBusyId(null); }
  };

  const handleComplete = async (visit) => {
    Alert.alert('Complete Meeting', 'Mark this meeting as completed?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Complete', onPress: async () => {
          setBusyId(visit.id);
          try {
            const loc = await getCurrentLocation();
            await EmployeeAPI.completeVisit(visit.id, loc || {});
            fetchVisits(true);
            Alert.alert('Done', 'Meeting completed and logged.');
          } catch (e) {
            Alert.alert('Error', e.response?.data?.message || e.message);
          } finally { setBusyId(null); }
        }
      }
    ]);
  };

  const openAdd = () => {
    setNewVisit({ client_id: '', client_name: '', visit_date: toISO(new Date()), visit_time: '', purpose: '', location: '', notes: '' });
    setShowAddModal(true);
  };

  const handleAddVisit = async () => {
    if (!newVisit.client_name.trim()) { Alert.alert('Error', 'Client name is required'); return; }
    if (!newVisit.visit_date) { Alert.alert('Error', 'Please select a visit date'); return; }
    setSubmitting(true);
    try {
      await EmployeeAPI.createVisit(newVisit);
      setShowAddModal(false);
      fetchVisits(true);
      Alert.alert('Success', 'Visit scheduled!');
    } catch (e) {
      Alert.alert('Error', e.response?.data?.message || e.message || 'Failed to schedule visit');
    } finally { setSubmitting(false); }
  };

  const setN = (key) => (val) => setNewVisit(v => ({ ...v, [key]: val }));
  const s = styles(colors);

  const badgeFor = (key) => {
    if (key === 'all') return counts.all;
    if (key === 'today') return counts.today;
    if (key === 'pending') return counts.pending;
    if (key === 'upcoming') return counts.upcoming;
    if (key === 'overdue') return counts.overdue;
    if (key === 'completed') return counts.completed;
    return undefined;
  };

  return (
    <ScreenWrapper isScrollable={false}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Visits</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={[s.iconBtn, { backgroundColor: colors.bg2, borderColor: colors.border }]} onPress={() => setShowSearch(v => !v)}>
            <Ionicons name={showSearch ? 'close' : 'search'} size={18} color={colors.text2} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.iconBtn, { backgroundColor: pickedDate ? colors.primary : colors.bg2, borderColor: pickedDate ? colors.primary : colors.border }]}
            onPress={() => setDateModal(true)}
          >
            <Ionicons name="calendar" size={18} color={pickedDate ? '#fff' : colors.text2} />
          </TouchableOpacity>
          <TouchableOpacity style={[s.addBtn, { backgroundColor: colors.primary }]} onPress={openAdd}>
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {showSearch && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          <View style={[s.fieldWrap, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
            <Ionicons name="search" size={16} color={colors.text3} />
            <TextInput
              style={{ flex: 1, fontSize: 14, paddingVertical: 10, color: colors.text }}
              placeholder="Search client or purpose"
              placeholderTextColor={colors.text3}
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
            />
            {search ? <TouchableOpacity onPress={() => setSearch('')}><Ionicons name="close-circle" size={16} color={colors.text3} /></TouchableOpacity> : null}
          </View>
        </View>
      )}

      {/* Active date filter pill */}
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

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 50 }} contentContainerStyle={s.tabsWrap}>
        {TABS.map(t => {
          const active = !pickedDate && tab === t.key;
          const n = badgeFor(t.key);
          return (
            <TouchableOpacity
              key={t.key}
              style={[s.tabBtn, active && { backgroundColor: colors.primary, borderColor: colors.primary }]}
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
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={visits}
          keyExtractor={(item, i) => (item.id || i).toString()}
          renderItem={({ item }) => <VisitCard visit={item} colors={colors} onStart={handleStart} onComplete={handleComplete} busyId={busyId} />}
          contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: 30 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <Ionicons name="map-outline" size={48} color={colors.text3} />
              <Text style={{ color: colors.text2, marginTop: 12, fontSize: 15, fontWeight: '600' }}>No visits found</Text>
              <Text style={{ color: colors.text3, marginTop: 4, fontSize: 12 }}>Try another filter or schedule a new visit</Text>
            </View>
          }
        />
      )}

      {/* Date filter calendar */}
      <CalendarModal
        visible={dateModal}
        value={pickedDate}
        title="Filter by Date"
        onClose={() => setDateModal(false)}
        onPick={(iso) => { setPickedDate(iso); setDateModal(false); }}
      />

      {/* Add Visit Modal */}
      <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet">
        <View style={[s.modal, { backgroundColor: colors.bg, paddingTop: 40 }]}>
          <View style={s.modalHeader}>
            <Text style={[s.modalTitle, { color: colors.text }]}>Schedule Visit</Text>
            <TouchableOpacity onPress={() => setShowAddModal(false)}>
              <Ionicons name="close" size={24} color={colors.text2} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            <View style={{ marginBottom: 16 }}>
              <Text style={s.fieldLabel}>CLIENT NAME *</Text>
              <View style={[s.fieldWrap, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
                <Ionicons name="person-outline" size={17} color={colors.text3} />
                <TextInput
                  style={{ flex: 1, fontSize: 15, paddingVertical: 12, color: colors.text }}
                  placeholder="Enter client name"
                  placeholderTextColor={colors.text3}
                  value={newVisit.client_name}
                  onChangeText={setN('client_name')}
                />
              </View>
            </View>

            <DatePickerField
              label="VISIT DATE *"
              value={newVisit.visit_date}
              onChange={setN('visit_date')}
              placeholder="Tap to choose a date"
            />

            <TimePickerField
              label="VISIT TIME"
              value={newVisit.visit_time}
              onChange={setN('visit_time')}
              placeholder="Tap to choose a time"
            />

            {[
              { key: 'purpose', label: 'PURPOSE', placeholder: 'Reason for visit', icon: 'document-text-outline' },
              { key: 'location', label: 'LOCATION', placeholder: 'Visit location', icon: 'location-outline' },
              { key: 'notes', label: 'NOTES', placeholder: 'Any extra detail', icon: 'create-outline' },
            ].map((f, i) => (
              <View key={i} style={{ marginBottom: 16 }}>
                <Text style={s.fieldLabel}>{f.label}</Text>
                <View style={[s.fieldWrap, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
                  <Ionicons name={f.icon} size={17} color={colors.text3} />
                  <TextInput
                    style={{ flex: 1, fontSize: 15, paddingVertical: 12, color: colors.text }}
                    placeholder={f.placeholder}
                    placeholderTextColor={colors.text3}
                    value={newVisit[f.key]}
                    onChangeText={setN(f.key)}
                  />
                </View>
              </View>
            ))}

            <TouchableOpacity onPress={handleAddVisit} disabled={submitting}>
              <LinearGradient colors={[colors.gradStart, colors.gradEnd]} style={s.submitBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>Schedule Visit</Text>}
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </ScreenWrapper>
  );
}

const styles = (c) => StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: c.text },
  addBtn: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  iconBtn: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  tabsWrap: { paddingHorizontal: 16, gap: 8, paddingBottom: 10 },
  tabBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: c.bg2, borderWidth: 1.5, borderColor: c.border },
  tabTxt: { fontSize: 13, fontWeight: '600' },
  tabBadge: { minWidth: 18, paddingHorizontal: 5, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  activeFilter: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5 },
  modal: { flex: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: c.border },
  modalTitle: { fontSize: 20, fontWeight: '800' },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: c.text2, marginBottom: 8, letterSpacing: 0.5 },
  fieldWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14 },
  submitBtn: { padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 8, marginBottom: 40 },
});
