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

const LEAVE_TYPES = ['PAID', 'UNPAID', 'SICK', 'CASUAL', 'MATERNITY', 'PATERNITY'];
const DURATIONS = [
  { key: 'SINGLE_DAY', label: 'Single', icon: 'calendar-outline' },
  { key: 'MULTIPLE_DAYS', label: 'Multiple', icon: 'calendar-number-outline' },
  { key: 'SHORT_HOURLY', label: 'Hourly', icon: 'time-outline' },
];

const STATUS_COLORS = {
  PENDING: { bg: 'rgba(245,158,11,0.12)', text: '#D97706', icon: 'time-outline' },
  APPROVED: { bg: 'rgba(34,197,94,0.12)', text: '#16A34A', icon: 'checkmark-circle-outline' },
  REJECTED: { bg: 'rgba(239,68,68,0.12)', text: '#DC2626', icon: 'close-circle-outline' },
  CANCELLED: { bg: 'rgba(148,163,184,0.15)', text: '#64748B', icon: 'ban-outline' },
};

function fmtDate(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return d; }
}

function LeaveCard({ leave, colors, onPressReason }) {
  const sc = STATUS_COLORS[leave.status] || STATUS_COLORS.PENDING;
  return (
    <View style={[lStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={lStyles.top}>
        <View style={{ flex: 1 }}>
          <Text style={[lStyles.typeText, { color: colors.text }]}>{leave.leave_type}</Text>
          <View style={lStyles.infoRow}>
            <Ionicons
              name={leave.duration === 'SHORT_HOURLY' ? 'time-outline' : leave.duration === 'MULTIPLE_DAYS' ? 'calendar-number-outline' : 'calendar-outline'}
              size={12} color={colors.text3}
            />
            <Text style={[lStyles.dateText, { color: colors.text3 }]}>
              {leave.duration === 'SHORT_HOURLY'
                ? `${fmtDate(leave.start_date)} · ${leave.hourly_start}–${leave.hourly_end}`
                : leave.duration === 'MULTIPLE_DAYS'
                  ? `${fmtDate(leave.start_date)} → ${fmtDate(leave.end_date)}`
                  : fmtDate(leave.start_date)}
            </Text>
          </View>
        </View>
        <View style={[lStyles.badge, { backgroundColor: sc.bg }]}>
          <Ionicons name={sc.icon} size={12} color={sc.text} />
          <Text style={[lStyles.badgeTxt, { color: sc.text }]}>{leave.status}</Text>
        </View>
      </View>

      <View style={lStyles.bottomRow}>
        <Text style={[lStyles.daysText, { color: colors.text }]}>
          {leave.duration === 'SHORT_HOURLY' ? `${leave.hourly_hours}h` : `${leave.days}d`}
        </Text>
        <TouchableOpacity style={{ flex: 1 }} onPress={() => onPressReason(leave)}>
          <Text numberOfLines={1} style={[lStyles.reasonText, { color: colors.text2 }]}>
            {leave.reason || '—'}
          </Text>
        </TouchableOpacity>
      </View>

      {leave.status === 'REJECTED' && leave.rejection_reason ? (
        <Text style={[lStyles.rejectText, { color: '#DC2626' }]} numberOfLines={2}>
          Reason: {leave.rejection_reason}
        </Text>
      ) : null}
    </View>
  );
}

const lStyles = StyleSheet.create({
  card: { borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1.5 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  typeText: { fontSize: 15, fontWeight: '700' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  dateText: { fontSize: 12 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeTxt: { fontSize: 11, fontWeight: '700' },
  bottomRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  daysText: { fontSize: 13, fontWeight: '800' },
  reasonText: { fontSize: 12, textDecorationLine: 'underline', textDecorationStyle: 'dotted' },
  rejectText: { fontSize: 11, marginTop: 8, fontWeight: '600' },
});

export default function LeavesScreen({ navigation }) {
  const { colors } = useTheme();
  const [leaves, setLeaves] = useState([]);
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('ALL');
  const [showApply, setShowApply] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reasonModal, setReasonModal] = useState(null);

  const [form, setForm] = useState({
    leaveType: 'PAID',
    duration: 'SINGLE_DAY',
    startDate: '',
    endDate: '',
    hourlyStart: '',
    hourlyEnd: '',
    reason: '',
  });

  const fetchLeaves = async () => {
    try {
      const res = await EmployeeAPI.getLeaves();
      setLeaves(res.data?.data || []);
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to load leaves');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchBalance = async () => {
    try {
      const res = await EmployeeAPI.getLeaveBalance();
      setBalance(res.data?.data || null);
    } catch { }
  };

  useEffect(() => { fetchLeaves(); fetchBalance(); }, []);
  const onRefresh = useCallback(() => { setRefreshing(true); fetchLeaves(); fetchBalance(); }, []);

  const filtered = leaves.filter(l => tab === 'ALL' || l.status === tab);

  const openApply = () => {
    setForm({
      leaveType: 'PAID', duration: 'SINGLE_DAY',
      startDate: '', endDate: '', hourlyStart: '', hourlyEnd: '',
      reason: '',
    });
    setShowApply(true);
  };

  const submitApply = async () => {
    if (!form.reason.trim()) { Alert.alert('Error', 'Reason is required'); return; }
    if (form.duration === 'SINGLE_DAY' && !form.startDate.trim()) { Alert.alert('Error', 'Date is required'); return; }
    if (form.duration === 'MULTIPLE_DAYS' && (!form.startDate.trim() || !form.endDate.trim())) { Alert.alert('Error', 'Start & end dates are required'); return; }
    if (form.duration === 'SHORT_HOURLY' && (!form.startDate.trim() || !form.hourlyStart.trim() || !form.hourlyEnd.trim())) { Alert.alert('Error', 'Date + start/end times are required'); return; }

    setSubmitting(true);
    try {
      const payload = {
        leave_type: form.leaveType,
        duration: form.duration,
        start_date: form.startDate,
        end_date: form.duration === 'SINGLE_DAY' ? form.startDate : form.endDate,
        hourly_start: form.hourlyStart,
        hourly_end: form.hourlyEnd,
        reason: form.reason.trim(),
      };
      await EmployeeAPI.applyLeave(payload);
      setShowApply(false);
      Alert.alert('Applied', 'Your leave request has been submitted.');
      fetchLeaves();
      fetchBalance();
    } catch (e) {
      Alert.alert('Error', e.response?.data?.message || e.message || 'Failed to apply leave');
    } finally {
      setSubmitting(false);
    }
  };

  const s = styles(colors);
  const TABS = ['ALL', 'PENDING', 'APPROVED', 'REJECTED'];

  return (
    <ScreenWrapper isScrollable={false}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Leaves</Text>
        <TouchableOpacity style={[s.addBtn, { backgroundColor: colors.primary }]} onPress={openApply}>
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item, i) => (item.id || i).toString()}
          renderItem={({ item }) => <LeaveCard leave={item} colors={colors} onPressReason={setReasonModal} />}
          contentContainerStyle={{ padding: 16, paddingTop: 8 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListHeaderComponent={
            <>
              {/* Balance card */}
              {balance ? (
                <LinearGradient colors={[colors.gradStart, colors.gradEnd]} style={s.balanceCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View>
                      <Text style={s.balanceLabel}>Available paid leaves</Text>
                      <Text style={s.balanceValue}>{balance.available}</Text>
                      <Text style={s.balanceSub}>Max carry-forward: {balance.max_cap} · {balance.monthly_accrual}/month</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 14 }}>
                      <View style={{ alignItems: 'center' }}>
                        <Text style={s.miniVal}>{balance.accrued}</Text>
                        <Text style={s.miniLabel}>Earned</Text>
                      </View>
                      <View style={{ alignItems: 'center' }}>
                        <Text style={s.miniVal}>{balance.taken}</Text>
                        <Text style={s.miniLabel}>Taken</Text>
                      </View>
                      {balance.lapsed > 0 && (
                        <View style={{ alignItems: 'center' }}>
                          <Text style={[s.miniVal, { color: '#FDE68A' }]}>{balance.lapsed}</Text>
                          <Text style={s.miniLabel}>Lapsed</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </LinearGradient>
              ) : null}

              {/* Tabs */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 46 }} contentContainerStyle={s.tabsWrap}>
                {TABS.map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[s.tabBtn, { backgroundColor: colors.bg2, borderColor: colors.border }, tab === t && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                    onPress={() => setTab(t)}
                  >
                    <Text style={[s.tabTxt, { color: tab === t ? '#fff' : colors.text2 }]}>
                      {t.charAt(0) + t.slice(1).toLowerCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 40 }}>
              <Ionicons name="calendar-outline" size={48} color={colors.text3} />
              <Text style={{ color: colors.text2, marginTop: 12, fontSize: 15, fontWeight: '600' }}>No leave requests</Text>
              <Text style={{ color: colors.text3, marginTop: 4, fontSize: 12 }}>Tap + to apply for a leave</Text>
            </View>
          }
        />
      )}

      {/* Apply Leave Modal */}
      <Modal visible={showApply} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowApply(false)}>
        <View style={[s.modal, { backgroundColor: colors.bg, paddingTop: 40 }]}>
          <View style={s.modalHeader}>
            <Text style={[s.modalTitle, { color: colors.text }]}>Apply for Leave</Text>
            <TouchableOpacity onPress={() => setShowApply(false)}>
              <Ionicons name="close" size={24} color={colors.text2} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            <Text style={s.fieldLabel}>LEAVE TYPE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {LEAVE_TYPES.map(t => (
                <TouchableOpacity
                  key={t}
                  style={[s.typeChip, { borderColor: colors.border }, form.leaveType === t && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                  onPress={() => setForm(p => ({ ...p, leaveType: t }))}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: form.leaveType === t ? '#fff' : colors.text2 }}>{t}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={s.fieldLabel}>DURATION</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
              {DURATIONS.map(d => (
                <TouchableOpacity
                  key={d.key}
                  style={[s.durationBtn, { borderColor: colors.border }, form.duration === d.key && { backgroundColor: colors.primary + '18', borderColor: colors.primary }]}
                  onPress={() => setForm(p => ({ ...p, duration: d.key }))}
                >
                  <Ionicons name={d.icon} size={16} color={form.duration === d.key ? colors.primary : colors.text2} />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: form.duration === d.key ? colors.primary : colors.text2 }}>{d.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {form.duration === 'SINGLE_DAY' && (
              <View style={{ marginBottom: 16 }}>
                <Text style={s.fieldLabel}>DATE *</Text>
                <View style={[s.fieldWrap, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
                  <Ionicons name="calendar-outline" size={17} color={colors.text3} />
                  <TextInput
                    style={{ flex: 1, fontSize: 15, paddingVertical: 12, color: colors.text }}
                    placeholder="YYYY-MM-DD" placeholderTextColor={colors.text3}
                    value={form.startDate} onChangeText={v => setForm(p => ({ ...p, startDate: v }))}
                  />
                </View>
              </View>
            )}

            {form.duration === 'MULTIPLE_DAYS' && (
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLabel}>START DATE *</Text>
                  <View style={[s.fieldWrap, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
                    <Ionicons name="calendar-outline" size={17} color={colors.text3} />
                    <TextInput
                      style={{ flex: 1, fontSize: 15, paddingVertical: 12, color: colors.text }}
                      placeholder="YYYY-MM-DD" placeholderTextColor={colors.text3}
                      value={form.startDate} onChangeText={v => setForm(p => ({ ...p, startDate: v }))}
                    />
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLabel}>END DATE *</Text>
                  <View style={[s.fieldWrap, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
                    <Ionicons name="calendar-outline" size={17} color={colors.text3} />
                    <TextInput
                      style={{ flex: 1, fontSize: 15, paddingVertical: 12, color: colors.text }}
                      placeholder="YYYY-MM-DD" placeholderTextColor={colors.text3}
                      value={form.endDate} onChangeText={v => setForm(p => ({ ...p, endDate: v }))}
                    />
                  </View>
                </View>
              </View>
            )}

            {form.duration === 'SHORT_HOURLY' && (
              <>
                <View style={{ marginBottom: 16 }}>
                  <Text style={s.fieldLabel}>DATE *</Text>
                  <View style={[s.fieldWrap, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
                    <Ionicons name="calendar-outline" size={17} color={colors.text3} />
                    <TextInput
                      style={{ flex: 1, fontSize: 15, paddingVertical: 12, color: colors.text }}
                      placeholder="YYYY-MM-DD" placeholderTextColor={colors.text3}
                      value={form.startDate} onChangeText={v => setForm(p => ({ ...p, startDate: v }))}
                    />
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fieldLabel}>START TIME *</Text>
                    <View style={[s.fieldWrap, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
                      <Ionicons name="time-outline" size={17} color={colors.text3} />
                      <TextInput
                        style={{ flex: 1, fontSize: 15, paddingVertical: 12, color: colors.text }}
                        placeholder="HH:MM" placeholderTextColor={colors.text3}
                        value={form.hourlyStart} onChangeText={v => setForm(p => ({ ...p, hourlyStart: v }))}
                      />
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fieldLabel}>END TIME *</Text>
                    <View style={[s.fieldWrap, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
                      <Ionicons name="time-outline" size={17} color={colors.text3} />
                      <TextInput
                        style={{ flex: 1, fontSize: 15, paddingVertical: 12, color: colors.text }}
                        placeholder="HH:MM" placeholderTextColor={colors.text3}
                        value={form.hourlyEnd} onChangeText={v => setForm(p => ({ ...p, hourlyEnd: v }))}
                      />
                    </View>
                  </View>
                </View>
              </>
            )}

            <Text style={s.fieldLabel}>REASON *</Text>
            <View style={[s.fieldWrap, { backgroundColor: colors.bg2, borderColor: colors.border, alignItems: 'flex-start', paddingVertical: 10, marginBottom: 8 }]}>
              <TextInput
                style={{ flex: 1, fontSize: 15, color: colors.text, minHeight: 70 }}
                placeholder="Briefly explain why..." placeholderTextColor={colors.text3}
                value={form.reason} onChangeText={v => setForm(p => ({ ...p, reason: v }))}
                multiline textAlignVertical="top"
              />
            </View>

            <TouchableOpacity onPress={submitApply} disabled={submitting}>
              <LinearGradient colors={[colors.gradStart, colors.gradEnd]} style={s.submitBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>Submit Application</Text>}
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Reason viewer */}
      <Modal visible={!!reasonModal} transparent animationType="fade" onRequestClose={() => setReasonModal(null)}>
        <TouchableOpacity style={s.reasonOverlay} activeOpacity={1} onPress={() => setReasonModal(null)}>
          <View style={[s.reasonBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[s.modalTitle, { color: colors.text, fontSize: 16, marginBottom: 10 }]}>Leave Reason</Text>
            <Text style={{ color: colors.text2, fontSize: 14, lineHeight: 20 }}>{reasonModal?.reason || '—'}</Text>
            {reasonModal?.status === 'REJECTED' && reasonModal?.rejection_reason ? (
              <View style={{ marginTop: 12, backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: 10, padding: 10 }}>
                <Text style={{ color: '#DC2626', fontSize: 12, fontWeight: '700' }}>Rejection reason:</Text>
                <Text style={{ color: '#DC2626', fontSize: 12, marginTop: 2 }}>{reasonModal.rejection_reason}</Text>
              </View>
            ) : null}
          </View>
        </TouchableOpacity>
      </Modal>
    </ScreenWrapper>
  );
}

const styles = (c) => StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: c.text },
  addBtn: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  balanceCard: { borderRadius: 18, padding: 18, marginBottom: 14 },
  balanceLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 12 },
  balanceValue: { color: '#fff', fontSize: 30, fontWeight: '800', marginTop: 2 },
  balanceSub: { color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 2 },
  miniVal: { color: '#fff', fontSize: 16, fontWeight: '800' },
  miniLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 10, marginTop: 2 },
  tabsWrap: { gap: 8, paddingBottom: 14 },
  tabBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5 },
  tabTxt: { fontSize: 13, fontWeight: '600' },
  modal: { flex: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: c.border },
  modalTitle: { fontSize: 20, fontWeight: '800' },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: c.text2, marginBottom: 8, letterSpacing: 0.5 },
  fieldWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14 },
  typeChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, marginRight: 8 },
  durationBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5 },
  submitBtn: { padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 8, marginBottom: 40 },
  reasonOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  reasonBox: { borderRadius: 16, padding: 20, borderWidth: 1.5, maxHeight: '70%' },
});