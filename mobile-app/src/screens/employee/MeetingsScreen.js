import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Linking, Platform, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import ScreenWrapper from '../../components/ScreenWrapper';
import { EmployeeAPI } from '../../services/employee.api';

// ── Open an address (or lat,lng) in the device's maps app ──
function openInMaps(address) {
  if (!address) {
    Alert.alert('No location', 'This meeting has no address set yet.');
    return;
  }
  const q = encodeURIComponent(address);
  // Universal Google Maps URL — works on Android, iOS and web fallback.
  const url = Platform.select({
    ios: `https://www.google.com/maps/search/?api=1&query=${q}`,
    android: `https://www.google.com/maps/search/?api=1&query=${q}`,
    default: `https://www.google.com/maps/search/?api=1&query=${q}`,
  });
  Linking.openURL(url).catch(() =>
    Alert.alert('Could not open maps', 'No maps app is available on this device.')
  );
}

function callPhone(phone) {
  if (!phone) return;
  Linking.openURL(`tel:${phone}`).catch(() => {});
}

function MeetingCard({ item, colors, onPress }) {
  return (
    <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={s.top}>
        <View style={{ flex: 1 }}>
          <Text style={[s.client, { color: colors.text }]} numberOfLines={1}>
            {item.client_name || 'Client'}
          </Text>
          {item.company ? (
            <Text style={[s.company, { color: colors.text2 }]} numberOfLines={1}>{item.company}</Text>
          ) : null}
        </View>
        <View style={[s.badge, { backgroundColor: 'rgba(59,130,246,0.12)' }]}>
          <Ionicons name="calendar-outline" size={12} color={colors.blueText} />
          <Text style={[s.badgeTxt, { color: colors.blueText }]}>Meeting</Text>
        </View>
      </View>

      <View style={s.infoRow}>
        {item.meeting_date ? (
          <View style={s.chip}>
            <Ionicons name="calendar-outline" size={12} color={colors.text3} />
            <Text style={[s.chipTxt, { color: colors.text3 }]}>{item.meeting_date}</Text>
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
          onPress={() => openInMaps(item.address)}
        >
          <Ionicons name="navigate" size={15} color="#fff" />
          <Text style={s.mapBtnTxt}>Open in Maps</Text>
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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMeetings = useCallback(async () => {
    try {
      const res = await EmployeeAPI.getMeetings();
      setMeetings(res.data?.data || []);
    } catch {
      setMeetings([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchMeetings(); }, [fetchMeetings]);

  // Re-fetch when navigated to from a push-notification tap
  useEffect(() => {
    if (route?.params?.refresh) fetchMeetings();
  }, [route?.params?.refresh, fetchMeetings]);

  const onRefresh = () => { setRefreshing(true); fetchMeetings(); };

  if (loading) {
    return (
      <ScreenWrapper isScrollable={false}>
        <View style={s.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper isScrollable={false}>
      <View style={s.header}>
        <Text style={[s.title, { color: colors.text }]}>My Meetings</Text>
        <Text style={[s.subtitle, { color: colors.text2 }]}>
          {meetings.length} assigned meeting{meetings.length === 1 ? '' : 's'}
        </Text>
      </View>

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
        contentContainerStyle={{ padding: 16, paddingTop: 4 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="calendar-clear-outline" size={40} color={colors.text3} />
            <Text style={[s.emptyTxt, { color: colors.text3 }]}>No meetings assigned yet</Text>
            <Text style={[s.emptySub, { color: colors.text3 }]}>
              Jab manager aapko koi meeting assign karega, wo yahan (aur notification me) dikhega.
            </Text>
          </View>
        }
      />
    </ScreenWrapper>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  title: { fontSize: 22, fontWeight: '800' },
  subtitle: { fontSize: 13, marginTop: 2 },
  card: { borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1.5 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  client: { fontSize: 15, fontWeight: '700' },
  company: { fontSize: 12, marginTop: 2 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeTxt: { fontSize: 11, fontWeight: '700' },
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