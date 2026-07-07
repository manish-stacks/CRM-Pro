import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert,
  ActivityIndicator, Linking, Platform, Modal, TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import ScreenWrapper from '../../components/ScreenWrapper';
import { EmployeeAPI } from '../../services/employee.api';

function openInMaps(address) {
  if (!address) { Alert.alert('No location', 'This meeting has no address set yet.'); return; }
  const q = encodeURIComponent(address);
  const url = Platform.select({
    ios: `https://www.google.com/maps/search/?api=1&query=${q}`,
    android: `https://www.google.com/maps/search/?api=1&query=${q}`,
    default: `https://www.google.com/maps/search/?api=1&query=${q}`,
  });
  Linking.openURL(url).catch(() => Alert.alert('Could not open maps', 'No maps app is available on this device.'));
}
function callPhone(phone) { if (phone) Linking.openURL(`tel:${phone}`).catch(() => {}); }

const STATUS_COLORS = {
  MEETING_SCHEDULED: { bg: 'rgba(168,85,247,0.12)', text: '#A855F7' },
  CONVERTED: { bg: 'rgba(34,197,94,0.12)', text: '#22C55E' },
  CLOSED: { bg: 'rgba(100,116,139,0.12)', text: '#64748B' },
  NOT_INTERESTED: { bg: 'rgba(239,68,68,0.12)', text: '#EF4444' },
};

const ACTIVITY_TYPES = [
  { key: 'CALL', label: '📞 Call' },
  { key: 'REMARK', label: '💬 Remark' },
  { key: 'NOTE', label: '📝 Note' },
];

export default function MeetingDetailScreen({ route, navigation }) {
  const { colors } = useTheme();
  const { meetingId } = route.params;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Log activity modal
  const [showActivity, setShowActivity] = useState(false);
  const [actType, setActType] = useState('CALL');
  const [actTitle, setActTitle] = useState('');
  const [actDesc, setActDesc] = useState('');

  // Close modals
  const [showConvert, setShowConvert] = useState(false);
  const [convertNote, setConvertNote] = useState('');
  const [showLost, setShowLost] = useState(false);
  const [lostReason, setLostReason] = useState('');

  const fetchDetail = useCallback(async () => {
    try {
      const res = await EmployeeAPI.getMeetingById(meetingId);
      setData(res.data?.data);
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to load meeting');
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  const s = styles(colors);

  if (loading || !data) {
    return (
      <ScreenWrapper isScrollable={false}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenWrapper>
    );
  }

  const statusStyle = STATUS_COLORS[data.status] || STATUS_COLORS.MEETING_SCHEDULED;

  const submitActivity = async () => {
    if (!actTitle.trim()) { Alert.alert('Error', 'Title is required'); return; }
    setSaving(true);
    try {
      await EmployeeAPI.logMeetingActivity(meetingId, { type: actType, title: actTitle, description: actDesc });
      setShowActivity(false);
      setActTitle(''); setActDesc(''); setActType('CALL');
      fetchDetail();
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to log activity');
    } finally { setSaving(false); }
  };

  const submitConvert = async () => {
    setSaving(true);
    try {
      const res = await EmployeeAPI.closeMeeting(meetingId, { action: 'convert', note: convertNote });
      const clientId = res.data?.data?.clientId;
      setShowConvert(false);
      Alert.alert(
        '🎉 Deal Done!',
        'Client has been created. Ab aap client ke services / proposal / invoice add kar sakte ho.',
        [
          clientId
            ? { text: 'Open Client', onPress: () => navigation.replace('ClientDetail', { client: { id: clientId } }) }
            : { text: 'OK' },
          { text: 'Stay Here', style: 'cancel', onPress: fetchDetail },
        ]
      );
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to convert');
    } finally { setSaving(false); }
  };

  const submitLost = async (action) => {
    setSaving(true);
    try {
      await EmployeeAPI.closeMeeting(meetingId, { action, reason: lostReason });
      setShowLost(false);
      setLostReason('');
      Alert.alert('Updated', action === 'lost' ? 'Marked as Lost' : 'Marked as Not Interested');
      fetchDetail();
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to update');
    } finally { setSaving(false); }
  };

  return (
    <ScreenWrapper isScrollable={false}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <LinearGradient colors={[colors.gradStart, colors.gradEnd]} style={s.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color="rgba(255,255,255,0.9)" />
          </TouchableOpacity>
          <Text style={s.name}>{data.client_name}</Text>
          {data.company ? <Text style={s.company}>{data.company}</Text> : null}
          <View style={[s.statusBadge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <Text style={s.statusBadgeTxt}>{data.status.replace(/_/g, ' ')}</Text>
          </View>
        </LinearGradient>

        <View style={{ padding: 20 }}>
          {data.client_id && (
            <TouchableOpacity
              style={[s.clientLinkCard, { borderColor: colors.green, backgroundColor: 'rgba(34,197,94,0.08)' }]}
              onPress={() => navigation.navigate('ClientDetail', { client: { id: data.client_id } })}
            >
              <Ionicons name="checkmark-circle" size={18} color={colors.green} />
              <Text style={{ flex: 1, fontSize: 13, fontWeight: '700', color: colors.greenText }}>
                Client created ({data.client_code}) — tap to add services / proposal / invoice
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.greenText} />
            </TouchableOpacity>
          )}

          {/* Contact + meeting info */}
          <View style={[s.card, { borderColor: colors.border }]}>
            <Text style={[s.cardTitle, { color: colors.text }]}>Meeting Info</Text>
            {[
              { icon: 'call-outline', label: 'Phone', val: data.client_phone },
              { icon: 'mail-outline', label: 'Email', val: data.client_email },
              { icon: 'calendar-outline', label: 'Date', val: data.meeting_date },
              { icon: 'time-outline', label: 'Time', val: data.meeting_time },
              { icon: 'location-outline', label: 'Location', val: data.address },
              { icon: 'pricetag-outline', label: 'Service Pitched', val: data.service_pitched },
            ].filter(i => i.val).map((item, i) => (
              <View key={i} style={[s.infoRow, i === 0 && { marginTop: 12 }]}>
                <View style={[s.infoIcon, { backgroundColor: colors.bg2 }]}>
                  <Ionicons name={item.icon} size={16} color={colors.text2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.infoLabel, { color: colors.text3 }]}>{item.label}</Text>
                  <Text style={[s.infoVal, { color: colors.text }]}>{item.val}</Text>
                </View>
              </View>
            ))}
            {data.notes ? (
              <View style={[s.notesBox, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
                <Text style={{ fontSize: 12, fontStyle: 'italic', color: colors.text2 }}>"{data.notes}"</Text>
              </View>
            ) : null}

            <View style={s.quickActions}>
              <TouchableOpacity style={[s.mapBtn, { backgroundColor: colors.primary }]} onPress={() => openInMaps(data.address)}>
                <Ionicons name="navigate" size={15} color="#fff" />
                <Text style={s.mapBtnTxt}>Open in Maps</Text>
              </TouchableOpacity>
              {data.client_phone ? (
                <TouchableOpacity style={[s.callBtn, { borderColor: colors.green }]} onPress={() => callPhone(data.client_phone)}>
                  <Ionicons name="call-outline" size={15} color={colors.greenText} />
                  <Text style={[s.callBtnTxt, { color: colors.greenText }]}>Call</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {/* Deal actions */}
          {!data.is_closed && (
            <View style={[s.card, { borderColor: colors.border }]}>
              <Text style={[s.cardTitle, { color: colors.text }]}>Deal Actions</Text>
              <TouchableOpacity style={[s.actionRow, { borderColor: colors.border }]} onPress={() => setShowActivity(true)}>
                <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.text2} />
                <Text style={[s.actionRowTxt, { color: colors.text }]}>Log Call / Remark</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.text3} />
              </TouchableOpacity>
              <TouchableOpacity style={[s.dealBtn, { backgroundColor: '#22C55E' }]} onPress={() => setShowConvert(true)}>
                <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                <Text style={s.dealBtnTxt}>Deal Done — Convert to Client</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.lostBtn, { borderColor: '#EF4444' }]} onPress={() => setShowLost(true)}>
                <Ionicons name="close-circle-outline" size={17} color="#EF4444" />
                <Text style={[s.lostBtnTxt, { color: '#EF4444' }]}>Mark Lost / Not Interested</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Activity timeline */}
          <View style={[s.card, { borderColor: colors.border }]}>
            <Text style={[s.cardTitle, { color: colors.text }]}>Activity Timeline</Text>
            {(!data.activities || data.activities.length === 0) ? (
              <Text style={{ color: colors.text3, fontSize: 13, textAlign: 'center', paddingVertical: 16 }}>No activity yet</Text>
            ) : data.activities.map((a) => (
              <View key={a.id} style={[s.actRow, { borderColor: colors.border }]}>
                <Text style={[s.actTitle, { color: colors.text }]}>{a.title}</Text>
                {a.description ? <Text style={[s.actDesc, { color: colors.text2 }]}>{a.description}</Text> : null}
                <Text style={[s.actMeta, { color: colors.text3 }]}>
                  {a.created_by ? `${a.created_by} · ` : ''}{new Date(a.created_at).toLocaleString('en-IN')}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Log Activity Modal */}
      <Modal visible={showActivity} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowActivity(false)}>
        <View style={[s.modal, { backgroundColor: colors.bg, paddingTop: 40 }]}>
          <View style={s.modalHeader}>
            <Text style={[s.modalTitle, { color: colors.text }]}>Log Activity</Text>
            <TouchableOpacity onPress={() => setShowActivity(false)}>
              <Ionicons name="close" size={24} color={colors.text2} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            <Text style={s.fieldLabel}>TYPE</Text>
            <View style={s.typeRow}>
              {ACTIVITY_TYPES.map(t => (
                <TouchableOpacity
                  key={t.key}
                  onPress={() => setActType(t.key)}
                  style={[s.typeChip, { borderColor: actType === t.key ? colors.primary : colors.border, backgroundColor: actType === t.key ? colors.primary + '15' : 'transparent' }]}
                >
                  <Text style={{ fontSize: 13, fontWeight: '600', color: actType === t.key ? colors.primary : colors.text2 }}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={s.fieldLabel}>TITLE *</Text>
            <View style={[s.fieldWrap, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
              <TextInput
                style={{ flex: 1, fontSize: 15, paddingVertical: 12, color: colors.text }}
                placeholder="e.g. Client asked for a discount"
                placeholderTextColor={colors.text3}
                value={actTitle}
                onChangeText={setActTitle}
              />
            </View>
            <Text style={[s.fieldLabel, { marginTop: 16 }]}>DESCRIPTION</Text>
            <View style={[s.fieldWrap, { backgroundColor: colors.bg2, borderColor: colors.border, alignItems: 'flex-start' }]}>
              <TextInput
                style={{ flex: 1, fontSize: 14, paddingVertical: 12, color: colors.text, minHeight: 80 }}
                placeholder="Details..."
                placeholderTextColor={colors.text3}
                value={actDesc}
                onChangeText={setActDesc}
                multiline
              />
            </View>
            <TouchableOpacity onPress={submitActivity} disabled={saving} style={{ marginTop: 20 }}>
              <LinearGradient colors={[colors.gradStart, colors.gradEnd]} style={s.submitBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>Log Activity</Text>}
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Convert (Deal Done) Modal */}
      <Modal visible={showConvert} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowConvert(false)}>
        <View style={[s.modal, { backgroundColor: colors.bg, paddingTop: 40 }]}>
          <View style={s.modalHeader}>
            <Text style={[s.modalTitle, { color: colors.text }]}>🎉 Deal Done</Text>
            <TouchableOpacity onPress={() => setShowConvert(false)}>
              <Ionicons name="close" size={24} color={colors.text2} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            <View style={[s.infoBanner, { backgroundColor: 'rgba(34,197,94,0.1)', borderColor: '#22C55E' }]}>
              <Text style={{ fontSize: 13, color: '#16A34A' }}>
                This will mark the lead as CONVERTED and create a Client record. You'll then be able to add services, proposals and invoices from the Client page.
              </Text>
            </View>
            <Text style={s.fieldLabel}>NOTES (OPTIONAL)</Text>
            <View style={[s.fieldWrap, { backgroundColor: colors.bg2, borderColor: colors.border, alignItems: 'flex-start' }]}>
              <TextInput
                style={{ flex: 1, fontSize: 14, paddingVertical: 12, color: colors.text, minHeight: 70 }}
                placeholder="Any final notes about the deal..."
                placeholderTextColor={colors.text3}
                value={convertNote}
                onChangeText={setConvertNote}
                multiline
              />
            </View>
            <TouchableOpacity onPress={submitConvert} disabled={saving} style={{ marginTop: 20, backgroundColor: '#22C55E', borderRadius: 12, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
              {saving ? <ActivityIndicator color="#fff" /> : <><Ionicons name="checkmark-circle" size={18} color="#fff" /><Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>Confirm Deal Done</Text></>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Lost / Not Interested Modal */}
      <Modal visible={showLost} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowLost(false)}>
        <View style={[s.modal, { backgroundColor: colors.bg, paddingTop: 40 }]}>
          <View style={s.modalHeader}>
            <Text style={[s.modalTitle, { color: colors.text }]}>Close Lead</Text>
            <TouchableOpacity onPress={() => setShowLost(false)}>
              <Ionicons name="close" size={24} color={colors.text2} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            <Text style={s.fieldLabel}>REASON</Text>
            <View style={[s.fieldWrap, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
              <TextInput
                style={{ flex: 1, fontSize: 14, paddingVertical: 12, color: colors.text }}
                placeholder="e.g. Client chose competitor, budget issue"
                placeholderTextColor={colors.text3}
                value={lostReason}
                onChangeText={setLostReason}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
              <TouchableOpacity onPress={() => submitLost('not_interested')} disabled={saving} style={{ flex: 1, borderWidth: 1.5, borderColor: '#F59E0B', borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}>
                <Text style={{ color: '#F59E0B', fontWeight: '700', fontSize: 13 }}>Not Interested</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => submitLost('lost')} disabled={saving} style={{ flex: 1, backgroundColor: '#EF4444', borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Close as Lost</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </ScreenWrapper>
  );
}

const styles = (c) => StyleSheet.create({
  hero: { paddingTop: 54, paddingBottom: 30, alignItems: 'center' },
  backBtn: { position: 'absolute', top: 16, left: 16, padding: 8, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12 },
  name: { fontSize: 20, fontWeight: '800', color: '#fff', textAlign: 'center', paddingHorizontal: 40 },
  company: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  statusBadge: { marginTop: 10, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  statusBadgeTxt: { fontSize: 11, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  clientLinkCard: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderRadius: 12, padding: 12, marginBottom: 14 },
  card: { backgroundColor: c.card, borderRadius: 16, padding: 16, borderWidth: 1.5, marginBottom: 14 },
  cardTitle: { fontSize: 15, fontWeight: '800', marginBottom: 4 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: c.border },
  infoIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  infoLabel: { fontSize: 11, marginBottom: 2 },
  infoVal: { fontSize: 13, fontWeight: '600' },
  notesBox: { borderWidth: 1, borderRadius: 10, padding: 10, marginTop: 10 },
  quickActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  mapBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10 },
  mapBtnTxt: { color: '#fff', fontSize: 13, fontWeight: '700' },
  callBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 18, borderWidth: 1.5, borderRadius: 10 },
  callBtnTxt: { fontSize: 13, fontWeight: '700' },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderTopWidth: 1, marginTop: 10 },
  actionRowTxt: { flex: 1, fontSize: 13, fontWeight: '600' },
  dealBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 12, marginTop: 14 },
  dealBtnTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },
  lostBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, marginTop: 10 },
  lostBtnTxt: { fontWeight: '700', fontSize: 13 },
  actRow: { paddingVertical: 10, borderTopWidth: 1, marginTop: 4 },
  actTitle: { fontSize: 13, fontWeight: '700' },
  actDesc: { fontSize: 12, marginTop: 3 },
  actMeta: { fontSize: 11, marginTop: 4 },
  modal: { flex: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: '#888', marginBottom: 6 },
  fieldWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12 },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  typeChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5 },
  submitBtn: { padding: 14, borderRadius: 12, alignItems: 'center' },
  infoBanner: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 16 },
});