import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, RefreshControl,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import ScreenWrapper from '../../components/ScreenWrapper';
import CelebrationCard from '../../components/CelebrationCard';
import { EmployeeAPI } from '../../services/employee.api';
import {
  startTracking, stopTracking, getCurrentLocation, reverseGeocode, flushQueue,
} from '../../services/LocationTracker';

const StatCard = ({ icon, label, value, color, bg }) => {
  const { colors } = useTheme();
  return (
    <View style={[statStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[statStyles.iconWrap, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={[statStyles.value, { color: colors.text }]}>{value ?? '—'}</Text>
      <Text style={[statStyles.label, { color: colors.text2 }]}>{label}</Text>
    </View>
  );
};

const statStyles = StyleSheet.create({
  card: {
    flex: 1, borderRadius: 16, padding: 14, alignItems: 'center',
    borderWidth: 1.5, minWidth: '46%', gap: 6,
  },
  iconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  value: { fontSize: 24, fontWeight: '800' },
  label: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
});

export default function DashboardScreen({ navigation }) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);
  const [checking, setChecking] = useState(false);

  const fetchDashboard = async () => {
    try {
      const res = await EmployeeAPI.getDashboard();
      setData(res.data?.data || res.data);
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchStatus = async () => {
    try {
      const res = await EmployeeAPI.getAttendanceStatus();
      const st = res.data?.data || {};
      setCheckedIn(!!st.isCheckedIn);
      // If checked in but tracking not running (e.g. app restarted), resume it
      if (st.isCheckedIn) {
        startTracking().catch(() => { });
        flushQueue().catch(() => { });
      }
    } catch { }
  };

  useEffect(() => {
    fetchDashboard();
    fetchStatus();
  }, []);

  const onRefresh = useCallback(() => { setRefreshing(true); fetchDashboard(); }, []);

  const s = styles(colors);

  const handleCheckInOut = async () => {
    try {
      setChecking(true);

      // Capture a location fix for the check-in/out stamp
      const loc = await getCurrentLocation();
      let address = null;
      if (loc) address = await reverseGeocode(loc.latitude, loc.longitude);
      const payload = loc ? { ...loc, address } : {};

      if (!checkedIn) {
        // CHECK IN → start tracking
        const res = await EmployeeAPI.checkIn(payload);
        await AsyncStorage.setItem('attendanceId', res.data?.data?.attendanceId || '');
        const track = await startTracking();
        setCheckedIn(true);
        if (track.ok && !track.background) {
          Alert.alert(
            'Checked In',
            'Tracking started. For continuous tracking when the app is in the background, please allow "Always" location permission in settings.'
          );
        } else if (track.ok) {
          Alert.alert('Checked In', 'You are now on duty. Location sharing is active.');
        } else {
          Alert.alert('Checked In', 'Note: location permission was denied, so route tracking is off.');
        }
      } else {
        // CHECK OUT → stop tracking
        await EmployeeAPI.checkOut(payload);
        await stopTracking();
        await AsyncStorage.removeItem('attendanceId');
        setCheckedIn(false);
        Alert.alert('Checked Out', 'You are now off duty. Location sharing stopped.');
      }

      fetchDashboard();
    } catch (e) {
      Alert.alert('Error', e.message || 'Action failed');
    } finally {
      setChecking(false);
    }
  };

  if (loading) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );

  const activity = data?.recent_activity || data?.recentActivity || [];

  return (
    <ScreenWrapper isScrollable={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >

        <LinearGradient colors={[colors.gradStart, colors.gradEnd]} style={s.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <View>
            <Text style={s.greeting}>Good day, {user?.name?.split(' ')[0] || 'Employee'} 👋</Text>
            <Text style={s.heroSub}>Here's your overview for today</Text>
          </View>
          {/* <View style={s.avatarCircle}>
            <Text style={s.avatarText}>{user?.name ? user.name[0].toUpperCase() : 'E'}</Text>
          </View> */}
        </LinearGradient>



        <View style={[s.checkCard, { backgroundColor: colors.card, borderColor: checkedIn ? '#22C55E' : colors.border }]}>

          <View style={s.checkHeader}>
            <View style={[s.statusIconWrap, { backgroundColor: checkedIn ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.1)' }]}>
              <Ionicons
                name={checkedIn ? 'radio-outline' : 'power-outline'}
                size={20}
                color={checkedIn ? '#22C55E' : '#EF4444'}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.statusText, { color: colors.text }]}>
                {checkedIn ? 'On Duty' : 'Off Duty'}
              </Text>
              <Text style={[s.timeText, { color: colors.text2 }]}>
                {checkedIn ? 'Location sharing is active' : 'Check in to start your day'}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[
              s.checkBtnNew,
              { backgroundColor: checkedIn ? '#EF4444' : '#22C55E' }
            ]}
            onPress={handleCheckInOut}
            disabled={checking}
          >
            {checking ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons
                  name={checkedIn ? 'log-out-outline' : 'log-in-outline'}
                  size={20}
                  color="#fff"
                />
                <Text style={s.checkText}>
                  {checkedIn ? 'Check Out' : 'Check In'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {checkedIn && (
          <View style={[s.trackingBanner, { backgroundColor: 'rgba(34,197,94,0.1)', borderColor: '#22C55E' }]}>
            <View style={s.pulseDot} />
            <Text style={{ flex: 1, fontSize: 12, fontWeight: '600', color: '#16A34A' }}>
              Location sharing active — you're on duty
            </Text>
            <Ionicons name="navigate" size={16} color="#16A34A" />
          </View>
        )}

        <CelebrationCard />
        <View style={s.cardBody}>

          {(data?.today_meetings > 0) && (
            <View style={[s.meetingBanner, { backgroundColor: 'rgba(168,85,247,0.1)', borderColor: '#A855F7' }]}>
              <Ionicons name="videocam-outline" size={20} color="#A855F7" />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: '#A855F7' }}>
                  {data.today_meetings} meeting{data.today_meetings === 1 ? '' : 's'} scheduled today
                </Text>
                <Text style={{ fontSize: 11, color: colors.text2, marginTop: 1 }}>Tap Meetings to view & close deals</Text>
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('Meetings')}>
                <Ionicons name="chevron-forward" size={20} color="#A855F7" />
              </TouchableOpacity>
            </View>
          )}

          <Text style={s.sectionTitle}>Meetings & Deals</Text>
          <View style={s.statsGrid}>
            <StatCard
              icon="videocam-outline" label="Open Meetings"
              value={data?.open_meetings}
              color="#A855F7" bg="rgba(168,85,247,0.12)"
            />
            <StatCard
              icon="calendar-outline" label="Today's Meetings"
              value={data?.today_meetings}
              color="#3B82F6" bg="rgba(59,130,246,0.12)"
            />
            <StatCard
              icon="checkmark-done-circle-outline" label="Converted"
              value={data?.converted}
              color="#22C55E" bg="rgba(34,197,94,0.12)"
            />
            <StatCard
              icon="trending-up-outline" label="Conversion Rate"
              value={data?.conversion_rate != null ? `${data.conversion_rate}%` : '—'}
              color="#F59E0B" bg="rgba(245,158,11,0.12)"
            />
          </View>

          <Text style={s.sectionTitle}>Overview</Text>
          <View style={s.statsGrid}>
            <StatCard
              icon="people-outline" label="Total Clients"
              value={data?.total_clients ?? data?.totalClients}
              color="#3B82F6" bg="rgba(59,130,246,0.12)"
            />
            <StatCard
              icon="calendar-outline" label="Today Visits"
              value={data?.today_visits ?? data?.todayVisits}
              color="#22C55E" bg="rgba(34,197,94,0.12)"
            />
            <StatCard
              icon="time-outline" label="Pending Visits"
              value={data?.pending_visits ?? data?.pendingVisits}
              color="#F59E0B" bg="rgba(245,158,11,0.12)"
            />
            <StatCard
              icon="checkmark-circle-outline" label="Completed"
              value={data?.completed_visits ?? data?.completedVisits}
              color="#A855F7" bg="rgba(168,85,247,0.12)"
            />
          </View>


          <Text style={s.sectionTitle}>Quick Actions</Text>
          <View style={s.actionsRow}>
            {[
              { icon: 'videocam-outline', label: 'Meetings', screen: 'Meetings', color: '#A855F7', bg: 'rgba(168,85,247,0.1)' },
              { icon: 'people-outline', label: 'Clients', screen: 'Clients', color: '#22C55E', bg: 'rgba(34,197,94,0.1)' },
              { icon: 'person-add-outline', label: 'Add Client', screen: 'AddClient', color: '#3B82F6', bg: 'rgba(59,130,246,0.1)' },
              { icon: 'map-outline', label: 'Visits', screen: 'Visits', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
              { icon: 'calendar-number-outline', label: 'Apply Leave', screen: 'Leaves', color: '#EF4444', bg: 'rgba(239,68,68,0.1)' },
            ].map((a, i) => (
              <TouchableOpacity key={i} style={[s.actionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => navigation.navigate(a.screen)}>
                <View style={[s.actionIcon, { backgroundColor: a.bg }]}>
                  <Ionicons name={a.icon} size={22} color={a.color} />
                </View>
                <Text style={[s.actionLabel, { color: colors.text }]}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {activity.length > 0 && (
            <>
              <Text style={s.sectionTitle}>Recent Activity</Text>
              <View style={[s.card, { borderColor: colors.border }]}>
                {activity.slice(0, 5).map((item, i) => (
                  <View key={i} style={[s.activityRow, i === 0 && { paddingTop: 0 }, i === activity.length - 1 && { borderBottomWidth: 0 }]}>
                    <View style={[s.actDot, { backgroundColor: colors.primary }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[s.actTitle, { color: colors.text }]}>{item.title || item.description || item.message}</Text>
                      <Text style={[s.actTime, { color: colors.text3 }]}>{item.time || item.created_at || item.date || ''}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = (c) => StyleSheet.create({
  hero: {
    paddingTop: 30,
    paddingBottom: 40,
    paddingHorizontal: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff'
  },
  heroSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 4
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff'
  },
  cardBody: {
    padding: 20
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: c.text,
    marginBottom: 12,
    marginTop: 4
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24
  },
  actionCard: {
    flexBasis: '46%',
    flexGrow: 1,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center'
  },
  actionLabel: { fontSize: 11, fontWeight: '700' },
  card: {
    backgroundColor: c.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    marginBottom: 16
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: c.border
  },
  actDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5
  },
  actTitle: {
    fontSize: 13,
    fontWeight: '600'
  },
  actTime: {
    fontSize: 11,
    marginTop: 2
  },
  checkCard: {
    marginHorizontal: 20,
    marginTop: -20,
    marginBottom: 10,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1.5,
    elevation: 4,
  },

  checkHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },

  statusIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },

  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  statusText: {
    fontSize: 16,
    fontWeight: '800',
  },

  timeText: {
    fontSize: 12,
    marginTop: 2,
  },

  checkBtnNew: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  checkText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  meetingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
  },
  trackingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  pulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22C55E',
  },
});