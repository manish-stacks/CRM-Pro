import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, Modal,
  TextInput, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import ScreenWrapper from '../../components/ScreenWrapper';
import { EmployeeAPI } from '../../services/employee.api';
import { getCurrentLocation, reverseGeocode } from '../../services/LocationTracker';

const STATUS_COLORS = {
  pending: { bg: 'rgba(245,158,11,0.12)', text: '#D97706', icon: 'time-outline' },
  in_progress: { bg: 'rgba(59,130,246,0.12)', text: '#2563EB', icon: 'navigate-outline' },
  completed: { bg: 'rgba(34,197,94,0.12)', text: '#16A34A', icon: 'checkmark-circle-outline' },
  cancelled: { bg: 'rgba(148,163,184,0.15)', text: '#64748B', icon: 'close-circle-outline' },
  today: { bg: 'rgba(59,130,246,0.12)', text: '#2563EB', icon: 'calendar-outline' },
};

function VisitCard({ visit, colors, onStart, onComplete, busyId }) {
  const status = visit.status?.toLowerCase() || 'pending';
  const sc = STATUS_COLORS[status] || STATUS_COLORS.pending;
  const isBusy = busyId === visit.id;
  return (
    <View style={[vStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={vStyles.top}>
        <View style={{ flex: 1 }}>
          <Text style={[vStyles.clientName, { color: colors.text }]}>{visit.client_name || visit.clientName || 'Client'}</Text>
          {visit.purpose || visit.notes ? (
            <Text style={[vStyles.purpose, { color: colors.text2 }]} numberOfLines={1}>{visit.purpose || visit.notes}</Text>
          ) : null}
        </View>
        <View style={[vStyles.badge, { backgroundColor: sc.bg }]}>
          <Ionicons name={sc.icon} size={12} color={sc.text} />
          <Text style={[vStyles.badgeTxt, { color: sc.text }]}>{status.replace('_', ' ')}</Text>
        </View>
      </View>

      <View style={vStyles.infoRow}>
        {visit.visit_date || visit.date ? (
          <View style={vStyles.chip}>
            <Ionicons name="calendar-outline" size={12} color={colors.text3} />
            <Text style={[vStyles.chipTxt, { color: colors.text3 }]}>{visit.visit_date || visit.date}</Text>
          </View>
        ) : null}
        {visit.visit_time || visit.time ? (
          <View style={vStyles.chip}>
            <Ionicons name="time-outline" size={12} color={colors.text3} />
            <Text style={[vStyles.chipTxt, { color: colors.text3 }]}>{visit.visit_time || visit.time}</Text>
          </View>
        ) : null}
        {visit.duration_mins != null ? (
          <View style={vStyles.chip}>
            <Ionicons name="hourglass-outline" size={12} color={colors.text3} />
            <Text style={[vStyles.chipTxt, { color: colors.text3 }]}>{visit.duration_mins} min</Text>
          </View>
        ) : null}
        {visit.location ? (
          <View style={vStyles.chip}>
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
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  clientName: { fontSize: 15, fontWeight: '700' },
  purpose: { fontSize: 12, marginTop: 2 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeTxt: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  infoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chipTxt: { fontSize: 11 },
  completeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, paddingVertical: 8, borderWidth: 1.5, borderRadius: 10 },
  startBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, paddingVertical: 10, borderRadius: 10 },
});

export default function VisitsScreen({ navigation }) {
  const { colors } = useTheme();
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('all'); // 'all' | 'today' | 'pending' | 'completed'
  const [showAddModal, setShowAddModal] = useState(false);
  const [newVisit, setNewVisit] = useState({ client_id: '', client_name: '', visit_date: '', visit_time: '', purpose: '', location: '' });
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const fetchVisits = async () => {
    try {
      const res = await EmployeeAPI.getVisits();
      const list = res.data?.data || res.data?.visits || res.data || [];
      setVisits(list);
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to load visits');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchVisits(); }, []);
  const onRefresh = useCallback(() => { setRefreshing(true); fetchVisits(); }, []);

  const filtered = visits.filter(v => {
    const status = v.status?.toLowerCase();
    const today = new Date().toISOString().slice(0, 10);
    if (tab === 'today') return v.visit_date === today || v.date === today;
    if (tab === 'pending') return status === 'pending' || status === 'in_progress';
    if (tab === 'completed') return status === 'completed';
    return true;
  });

  // Start a visit → captures current location as check-in
  const handleStart = async (visit) => {
    setBusyId(visit.id);
    try {
      const loc = await getCurrentLocation();
      let address = null;
      if (loc) address = await reverseGeocode(loc.latitude, loc.longitude);
      await EmployeeAPI.startVisit(visit.id, loc ? { ...loc, address } : {});
      Alert.alert('Visit Started', 'Your arrival location has been recorded.');
      fetchVisits();
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to start visit');
    } finally {
      setBusyId(null);
    }
  };

  // Complete a visit → captures check-out location + duration
  const handleComplete = async (visit) => {
    Alert.alert('Complete Meeting', 'Mark this meeting as completed?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Complete', onPress: async () => {
          setBusyId(visit.id);
          try {
            const loc = await getCurrentLocation();
            await EmployeeAPI.completeVisit(visit.id, loc || {});
            fetchVisits();
            Alert.alert('Done', 'Meeting completed and logged.');
          } catch (e) {
            Alert.alert('Error', e.message);
          } finally {
            setBusyId(null);
          }
        }
      }
    ]);
  };

  const handleAddVisit = async () => {
    if (!newVisit.client_name.trim()) { Alert.alert('Error', 'Client name is required'); return; }
    if (!newVisit.visit_date.trim()) { Alert.alert('Error', 'Visit date is required'); return; }
    setSubmitting(true);
    try {
      await EmployeeAPI.createVisit(newVisit);
      setShowAddModal(false);
      setNewVisit({ client_id: '', client_name: '', visit_date: '', visit_time: '', purpose: '', location: '' });
      fetchVisits();
      Alert.alert('Success', 'Visit scheduled!');
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to schedule visit');
    } finally {
      setSubmitting(false);
    }
  };

  const setN = (key) => (val) => setNewVisit(v => ({ ...v, [key]: val }));
  const s = styles(colors);
  const TABS = ['all', 'today', 'pending', 'completed'];

  return (
    <ScreenWrapper isScrollable={false}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Visits</Text>
        <TouchableOpacity style={[s.addBtn, { backgroundColor: colors.primary }]} onPress={() => setShowAddModal(true)}>
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 50 }} contentContainerStyle={s.tabsWrap}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t}
            style={[s.tabBtn, tab === t && { backgroundColor: colors.primary }]}
            onPress={() => setTab(t)}
          >
            <Text style={[s.tabTxt, { color: tab === t ? '#fff' : colors.text2 }]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item, i) => (item.id || i).toString()}
          renderItem={({ item }) => <VisitCard visit={item} colors={colors} onStart={handleStart} onComplete={handleComplete} busyId={busyId} />}
          contentContainerStyle={{ padding: 16, paddingTop: 8 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <Ionicons name="map-outline" size={48} color={colors.text3} />
              <Text style={{ color: colors.text2, marginTop: 12, fontSize: 15, fontWeight: '600' }}>No visits found</Text>
            </View>
          }
        />
      )}

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
            {[
              { key: 'client_name', label: 'CLIENT NAME *', placeholder: 'Enter client name', icon: 'person-outline' },
              { key: 'visit_date', label: 'VISIT DATE *', placeholder: 'YYYY-MM-DD', icon: 'calendar-outline' },
              { key: 'visit_time', label: 'VISIT TIME', placeholder: 'HH:MM', icon: 'time-outline' },
              { key: 'purpose', label: 'PURPOSE', placeholder: 'Reason for visit', icon: 'document-text-outline' },
              { key: 'location', label: 'LOCATION', placeholder: 'Visit location', icon: 'location-outline' },
            ].map((f, i) => (
              <View key={i} style={{ marginBottom: 16 }}>
                <Text style={s.fieldLabel}>{f.label}</Text>
                <View style={[s.fieldWrap, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
                  <Ionicons name={f.icon} size={17} color={colors.text3} />
                  <TextInput
                    style={[{ flex: 1, fontSize: 15, paddingVertical: 12, color: colors.text }]}
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
  tabsWrap: { paddingHorizontal: 16, gap: 8, paddingBottom: 10 },
  tabBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, backgroundColor: c.bg2, borderWidth: 1.5, borderColor: c.border },
  tabTxt: { fontSize: 13, fontWeight: '600' },
  modal: { flex: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: c.border },
  modalTitle: { fontSize: 20, fontWeight: '800' },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: c.text2, marginBottom: 8, letterSpacing: 0.5 },
  fieldWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14 },
  submitBtn: { padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 8, marginBottom: 40 },
});
