import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Image, RefreshControl, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import ScreenWrapper from '../components/ScreenWrapper';
import { useEffect, useState } from 'react';
import { AxiosInstance } from '../lib/Axios.instance';
import { shapeService, fmtMoney } from '../lib/shape';


function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning ☀️';
  if (h < 17) return 'Good Afternoon 🌤';
  return 'Good Evening 🌙';
}

// Status chip component (reusable across screens)
export function StatusChip({ status }) {
  const map = {
    active: { bg: 'rgba(34,197,94,0.12)', color: '#16A34A', label: 'Active' },
    expiring: { bg: 'rgba(245,158,11,0.12)', color: '#D97706', label: 'Expiring' },
    critical: { bg: 'rgba(229,9,20,0.12)', color: '#E50914', label: 'Critical' },
    expired: { bg: 'rgba(150,150,150,0.1)', color: '#888', label: 'Expired' },
  };
  const m = map[status] || map.expired;
  return (
    <View style={{ backgroundColor: m.bg, borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: m.color }} />
      <Text style={{ color: m.color, fontSize: 11, fontWeight: '700' }}>{m.label}</Text>
    </View>
  );
}

// Progress bar component (reusable)
export function ProgressBar({ progress, color, startDate, endDate }) {
  return (
    <View>
      <View style={{ height: 6, backgroundColor: '#EDEEF2', borderRadius: 100, overflow: 'hidden', marginBottom: 6 }}>
        <View style={{ width: `${progress}%`, height: '100%', backgroundColor: color, borderRadius: 100 }} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 11, color: '#999' }}>{startDate}</Text>
        <Text style={{ fontSize: 11, color: '#999' }}>{endDate}</Text>
      </View>
    </View>
  );
}

export default function HomeScreen({ navigation }) {
  const { colors } = useTheme();
  const s = styles(colors);
  const [dashboard, setDashboard] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboard = async () => {
    try {
      // No dedicated client dashboard endpoint — compose it from the existing
      // (web-shared) endpoints so nothing on the backend has to change.
      const [profileRes, servicesRes, invoicesRes] = await Promise.all([
        AxiosInstance.get('/client-portal/profile'),
        AxiosInstance.get('/client-portal/services'),
        AxiosInstance.get('/client-portal/invoices'),
      ]);

      const client = profileRes.data?.data || {};
      const services = (servicesRes.data?.data || []).map(shapeService);
      const invoices = invoicesRes.data?.data || [];

      // Account Manager = Marketing Executive who conducted the meeting and onboarded the client. If no executive is assigned, the backend returns "Hover".
      // const am = profileRes.data?.accountManager || client.accountManager || null;
      let am =
        profileRes.data?.accountManager ||
        profileRes.data?.data?.accountManager ||
        profileRes.data?.data?.account_manager ||
        client.accountManager ||
        null;

      if (!am?.name) {
        try {
          const cached = await userData?.();
          am = cached?.account_manager || cached?.reporting_person || null;
        } catch { }
      }
      if (!am?.name) am = { name: 'Hover', email: null, phone: null, is_default: true };

      const expiringList = services.filter(s => s.status === 'expiring' || s.status === 'critical');
      const totalPaid = invoices.reduce((sum, i) => sum + (i.paidAmount || 0), 0);

      setDashboard({
        stats: {
          active: services.filter(s => s.status !== 'expired').length,
          expiring: expiringList.length,
          totalPaid: fmtMoney(totalPaid),
        },
        expiringServices: expiringList.slice(0, 5),
        recentServices: services.slice(0, 5),
        user: {
          client_name: client.clientName || 'Client',
          company_name: client.companyName || '',
          image: client.image || null,
        },
        accountManager: am,
        totalNotifications: 0,
      });
    } catch (error) {
      console.log('Dashboard Error:', error);
      setDashboard({ stats: {}, expiringServices: [], recentServices: [], user: {}, accountManager: null, totalNotifications: 0 });
    } finally {
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboard();
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const activeCount = dashboard?.stats?.active || 0;
  const expiringCount = dashboard?.stats?.expiring || 0;
  const totalPaid = dashboard?.stats?.totalPaid || 0;
  const expiring = dashboard?.expiringServices || [];
  const recent = dashboard?.recentServices || [];
  const user = dashboard?.user;
  const manager = dashboard?.accountManager;
  const managerInitials = manager?.name
    ? manager.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'H';
  const totalNotifications = dashboard?.totalNotifications || 0;
  const userImage = dashboard?.user?.image;
  if (!dashboard) {
    return (
      <View style={{
        flex: 1,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <ActivityIndicator size="large" color="#6C63FF" />
        <Text style={{ marginTop: 15, fontSize: 18, fontWeight: '500' }}>
          Please wait...
        </Text>
      </View>
    );
  }


  // console.log("Dashboard data on HomeScreen:", dashboard);
  return (
    <ScreenWrapper isScrollable={false}>
      <View style={s.container}>
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.greeting}>{getGreeting()}</Text>
            <Text style={s.headerSub}>
              {user?.client_name || 'User'} • {user?.company_name || 'Company'}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity style={s.iconBtn} onPress={() => navigation.navigate('Notifications')}>
              <Ionicons name="notifications-outline" size={20} color={colors.text} />
              <View style={s.badge}><Text style={{ color: 'white', fontSize: 9, fontWeight: '700' }}>{totalNotifications}</Text></View>
            </TouchableOpacity>
            <TouchableOpacity style={[s.iconBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]} onPress={() => navigation.navigate('Profile')}>
              {userImage ? (
                <Image source={{ uri: userImage }} style={s.avatarImg} />
              ) : (
                <Text style={{ color: 'white', fontWeight: '800', fontSize: 14 }}>
                  {user?.client_name ? user.client_name.split(' ').map(n => n[0]).join('') : 'RS'}
                </Text>
              )}

            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
        >
          {/* Greeting Card */}
          <LinearGradient colors={[colors.gradStart, colors.gradEnd]} style={s.greetCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ fontSize: 28, marginBottom: 6 }}>🚀</Text>
              <Text style={{ fontSize: 20, fontWeight: '800', color: 'white' }}>Your growth is on track!</Text>
            </View>
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 4 }}>{activeCount} services active • {expiringCount} renewals due soon</Text>
          </LinearGradient>

          {/* Stats Row */}
          <View style={s.statsRow}>
            {[
              { value: activeCount, label: 'Active\nServices', icon: 'checkmark-circle', iconColor: '#16A34A', bg: 'rgba(34,197,94,0.12)' },
              { value: expiringCount, label: 'Expiring\nSoon', icon: 'time', iconColor: '#D97706', bg: 'rgba(245,158,11,0.12)' },
              { value: totalPaid, label: 'Total\nPaid', icon: 'cash', iconColor: colors.primary, bg: 'rgba(229,9,20,0.1)' },
            ].map((item, i) => (
              <View key={i} style={s.statCard}>
                <View style={[s.statIcon, { backgroundColor: item.bg }]}>
                  <Ionicons name={item.icon} size={18} color={item.iconColor} />
                </View>
                <Text style={s.statValue}>{item.value}</Text>
                <Text style={s.statLabel}>{item.label}</Text>
              </View>
            ))}
          </View>

          {/* Account Manager — web portal ki tarah dashboard pe */}
          {manager?.name ? (
            <View style={s.managerCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <LinearGradient
                  colors={[colors.gradStart, colors.gradEnd]}
                  style={s.managerAvatar}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                >
                  <Text style={{ color: 'white', fontWeight: '800', fontSize: 17 }}>{managerInitials}</Text>
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <Text style={s.managerLabel}>YOUR ACCOUNT MANAGER</Text>
                  <Text style={{ fontWeight: '800', fontSize: 15, color: colors.text, marginTop: 2 }}>
                    {manager.name}
                  </Text>
                  {manager.email ? (
                    <Text style={{ fontSize: 11, color: colors.text2, marginTop: 1 }} numberOfLines={1}>
                      {manager.email}
                    </Text>
                  ) : null}
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                {manager.phone ? (
                  <TouchableOpacity
                    style={[s.managerBtn, { backgroundColor: 'rgba(34,197,94,0.1)' }]}
                    onPress={() => Linking.openURL(`tel:${manager.phone}`)}
                  >
                    <Ionicons name="call-outline" size={15} color="#16A34A" />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#16A34A' }}>Call</Text>
                  </TouchableOpacity>
                ) : null}
                {manager.email ? (
                  <TouchableOpacity
                    style={[s.managerBtn, { backgroundColor: 'rgba(59,130,246,0.1)' }]}
                    onPress={() => Linking.openURL(`mailto:${manager.email}`)}
                  >
                    <Ionicons name="mail-outline" size={15} color="#3B82F6" />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#3B82F6' }}>Email</Text>
                  </TouchableOpacity>
                ) : null}
                {manager.phone ? (
                  <TouchableOpacity
                    style={[s.managerBtn, { backgroundColor: 'rgba(37,211,102,0.12)' }]}
                    onPress={() => Linking.openURL(`https://wa.me/${String(manager.phone).replace(/[^0-9]/g, '')}`)}
                  >
                    <Ionicons name="logo-whatsapp" size={15} color="#25D366" />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#25D366' }}>WhatsApp</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          ) : null}

          {/* Renewal Alerts */}
          {expiring.length > 0 && (
            <>
              <View style={s.sectionHeader}>
                <Text style={s.sectionTitle}>⚠️ Renewal Alerts</Text>
                <TouchableOpacity onPress={() => navigation.navigate('Renewals')}><Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>View all</Text></TouchableOpacity>
              </View>

              {expiring.map(sv => (
                <View key={sv.id} style={[s.alertCard, sv.status === 'critical' ? s.alertDanger : s.alertWarning]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Text style={{ fontSize: 22 }}>{sv.icon}</Text>
                      <View>
                        <Text style={{ fontWeight: '700', fontSize: 14, color: colors.text }}>{sv.name}</Text>
                        <Text style={{ fontSize: 12, color: colors.text2 }}>Expires {sv.renewalDate}</Text>
                      </View>
                    </View>
                    <StatusChip status={sv.status} />
                  </View>
                  <ProgressBar
                    progress={sv.progress}
                    color={sv.status === 'critical' ? '#E50914' : '#F59E0B'}
                    startDate={sv.startDate}
                    endDate={sv.renewalDate}
                  />
                </View>
              ))}
            </>
          )}
          {/* Recent Services */}
          {recent.length > 0 && (
            <>
              <View style={[s.sectionHeader, { marginTop: 8 }]}>
                <Text style={s.sectionTitle}>📦 Recent Services</Text>
                <TouchableOpacity onPress={() => navigation.navigate('Services')}><Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>See all</Text></TouchableOpacity>
              </View>

              {recent.map(sv => (
                <TouchableOpacity key={sv.id} style={s.serviceCard} onPress={() => navigation.navigate('ServiceDetail', { service: sv })}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                    <View style={[s.serviceIcon, { backgroundColor: sv.iconBg }]}><Text style={{ fontSize: 22 }}>{sv.icon}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '700', fontSize: 16, color: colors.text }}>{sv.name}</Text>
                      <Text style={{ fontSize: 12, color: colors.text2, marginTop: 2 }}>{sv.type}</Text>
                    </View>
                    <StatusChip status={sv.status} />
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}><Text style={{ fontSize: 11, color: colors.text2 }}>Started</Text><Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>{sv.startDate}</Text></View>
                    <View style={{ width: 1, height: 30, backgroundColor: colors.border, marginHorizontal: 12 }} />
                    <View style={{ flex: 1 }}><Text style={{ fontSize: 11, color: colors.text2 }}>Renewal</Text><Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>{sv.renewalDate}</Text></View>
                    <View style={s.chevron}><Ionicons name="chevron-forward" size={14} color={colors.text2} /></View>
                  </View>
                </TouchableOpacity>
              ))}
            </>
          )}
        </ScrollView>
      </View>
    </ScreenWrapper>
  );
}

const styles = (c) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 0, paddingBottom: 12, backgroundColor: c.bg },
  greeting: { fontSize: 22, fontWeight: '800', color: c.text },
  headerSub: { fontSize: 13, color: c.text2, marginTop: 2 },
  iconBtn: { width: 40, height: 40, backgroundColor: c.card2, borderWidth: 1.5, borderColor: c.border, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -4, right: -4, width: 16, height: 16, backgroundColor: c.primary, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 20, paddingBottom: 20 },
  greetCard: { borderRadius: 20, padding: 20, marginBottom: 20 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard: { flex: 1, backgroundColor: c.card2, borderWidth: 1.5, borderColor: c.border, borderRadius: 12, padding: 12, alignItems: 'center' },
  statIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  statValue: { fontSize: 20, fontWeight: '800', color: c.text },
  statLabel: { fontSize: 10, color: c.text2, fontWeight: '500', marginTop: 2, textAlign: 'center' },
  managerCard: { backgroundColor: c.card, borderWidth: 1.5, borderColor: c.border, borderRadius: 16, padding: 16, marginBottom: 20 },
  managerAvatar: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  managerLabel: { fontSize: 10, fontWeight: '800', color: c.text3, letterSpacing: 0.6 },
  managerBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: c.text },
  alertCard: { borderRadius: 12, padding: 16, marginBottom: 10, borderWidth: 1.5 },
  alertWarning: { backgroundColor: 'rgba(245,158,11,0.04)', borderColor: 'rgba(245,158,11,0.3)' },
  alertDanger: { backgroundColor: 'rgba(229,9,20,0.04)', borderColor: 'rgba(229,9,20,0.25)' },
  serviceCard: { backgroundColor: c.card, borderWidth: 1.5, borderColor: c.border, borderRadius: 16, padding: 16, marginBottom: 12 },
  serviceIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  chevron: { width: 32, height: 32, backgroundColor: c.bg3, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginLeft: 'auto' },
  avatarImg: {
    width: 50, height: 50, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'rgba(255,255,255,0.3)'
  },
});