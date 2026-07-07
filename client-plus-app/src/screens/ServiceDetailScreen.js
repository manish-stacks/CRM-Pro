import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';
import { useTheme } from '../context/ThemeContext';
import ScreenWrapper from '../components/ScreenWrapper';
import { AxiosInstance } from '../lib/Axios.instance';
import { useAuth } from '../context/AuthContext';
import * as Linking from 'expo-linking';
import { ClientAPI } from '../services/client.api';

export default function ServiceDetailScreen({ navigation, route }) {
  const { colors } = useTheme();
  const s = styles(colors);
  const { userData } = useAuth();
  const [sv, setSv] = useState(route.params?.service || null);
  const [manager, setManager] = useState(null);
  const [reports, setReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadManager = async () => {
    try {
      const u = await userData?.();
      const rp = u?.reporting_person;
      if (rp?.name) {
        setManager({
          initials: rp.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(),
          name: rp.name,
          role: 'Account Manager',
          phone: rp.phone || '',
          email: rp.email || '',
        });
      }
    } catch {}
  };

  // Reports live on a separate endpoint (/client-portal/reports), scoped to the
  // client, not embedded in the service record. Fetch them here and filter to
  // this service — this is what web's "Reports" tab shows per service.
  const loadReports = async () => {
    try {
      const svId = route.params?.service?.id;
      const res = await ClientAPI.getReports();
      const all = res?.data?.data || [];
      const forThisService = all.filter(r => r.clientServiceId === svId);
      setReports(forThisService.map(r => ({
        id: r.id,
        title: r.title,
        month: r.reportPeriod || new Date(r.reportDate).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
        generated: new Date(r.reportDate).toLocaleDateString('en-IN'),
        file: r.fileUrl || null,
        description: r.description || null,
        content: r.content || null,
      })));
    } catch (e) {
      console.log('Reports fetch error:', e);
    } finally {
      setReportsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    // The shaped service is passed in via navigation params; use it directly.
    // (There's no single-service endpoint — the list route ignores ?id.)
    if (route.params?.service) setSv(route.params.service);
    loadManager();
    loadReports();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadManager();
    loadReports();
  };

  const pct = sv?.progress ?? 0;

  if (!sv) {
    return <Text style={{ textAlign: 'center', marginTop: 50 }}>Loading...</Text>;
  }
  // console.log("service details: ", sv)
  const handleOpenFile = async (url) => {
    try {
      const supported = await Linking.canOpenURL(url);

      if (supported) {
        await Linking.openURL(url);
      } else {
        alert("Can't open this file");
      }
    } catch (e) {
      console.log("File open error:", e);
    }
  };
  return (
    <ScreenWrapper refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}>
      <View style={s.container}>
          {/* Hero */}
          <LinearGradient colors={[colors.gradStart, colors.gradEnd]} style={s.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
                <Ionicons name="chevron-back" size={20} color="white" />
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 20, fontWeight: '800', color: 'white' }}>{sv.name}</Text>
                <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>{sv.type}</Text>
              </View>
            </View>
            {/* Progress Circle (simplified) */}
            <View style={s.circleWrap}>
              <View style={s.circleOuter}>
                <View style={s.circleInner}>
                  <Text style={{ fontSize: 28, fontWeight: '800', color: 'white' }}>{pct}%</Text>
                  <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>Complete</Text>
                </View>
              </View>
            </View>
          </LinearGradient>

          <View style={{ padding: 20 }}>
            {/* Info Grid */}
            <View style={s.infoGrid}>
              {[
                { label: 'Start Date', value: sv.startDate },
                { label: 'Renewal Date', value: sv.renewalDate },
                { label: 'Plan', value: sv.type },
                { label: 'Amount', value: sv.amount },
              ].map((item, i) => (
                <View key={i} style={s.infoBox}>
                  <Text style={s.infoLabel}>{item.label.toUpperCase()}</Text>
                  <Text style={s.infoValue}>{item.value}</Text>
                </View>
              ))}
            </View>

            {/* Account Manager */}
            {manager && (
              <>
                <Text style={s.sectionTitle}>👤 Your Account Manager</Text>
                <View style={s.managerCard}>
                  <LinearGradient colors={[colors.gradStart, colors.gradEnd]} style={s.managerAvatar} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                    <Text style={{ color: 'white', fontWeight: '800', fontSize: 18 }}>{manager.initials}</Text>
                  </LinearGradient>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '700', fontSize: 15, color: colors.text }}>{manager.name}</Text>
                    <Text style={{ fontSize: 12, color: colors.text2, marginTop: 2 }}>{manager.role}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {manager.phone ? (
                      <TouchableOpacity
                        style={[s.contactBtn, { backgroundColor: 'rgba(34,197,94,0.1)' }]}
                        onPress={() => Linking.openURL(`tel:${manager.phone}`)}
                      >
                        <Ionicons name="call-outline" size={18} color="#22C55E" />
                      </TouchableOpacity>
                    ) : null}
                    {manager.email ? (
                      <TouchableOpacity
                        style={[s.contactBtn, { backgroundColor: 'rgba(59,130,246,0.1)' }]}
                        onPress={() => Linking.openURL(`mailto:${manager.email}`)}
                      >
                        <Ionicons name="mail-outline" size={18} color="#3B82F6" />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              </>
            )}

            {/* Chart — only if data exists */}
            {/* {sv.chartData && sv.chartData.length > 0 && (
              <>
                <Text style={s.sectionTitle}>📊 Performance</Text>
                <View style={s.chartCard}>
                  <Text style={{ fontWeight: '700', fontSize: 15, color: colors.text, marginBottom: 12 }}>Organic Traffic (last 6 months)</Text>
                  <LineChart
                    data={{ labels: sv.chartLabels, datasets: [{ data: sv.chartData }] }}
                    width={320}
                    height={150}
                    chartConfig={{
                      backgroundColor: colors.card,
                      backgroundGradientFrom: colors.card,
                      backgroundGradientTo: colors.card,
                      decimalPlaces: 0,
                      color: () => colors.primary,
                      labelColor: () => colors.text3,
                      propsForDots: { r: '4', strokeWidth: '2', stroke: colors.primary },
                    }}
                    bezier
                    style={{ borderRadius: 12 }}
                    withShadow={false}
                  />
                </View>
              </>
            )} */}

            {/* Monthly Reports */}
            <Text style={s.sectionTitle}>📑 Reports</Text>
            {reportsLoading ? (
              <View style={s.chartCard}><Text style={{ fontSize: 13, color: colors.text2 }}>Loading reports...</Text></View>
            ) : reports.length === 0 ? (
              <View style={s.chartCard}><Text style={{ fontSize: 13, color: colors.text2 }}>No reports shared for this service yet.</Text></View>
            ) : (
              <View style={s.chartCard}>
                {reports.map((r, i) => {
                  const isPDF = r.file ? r.file.toLowerCase().includes('.pdf') : false;
                  return (
                    <View key={r.id} style={[s.reportItem, i === reports.length - 1 && { borderBottomWidth: 0 }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 }}>
                        <View style={s.reportIcon}><Ionicons name="document-text-outline" size={18} color={colors.primary} /></View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{r.title || `${r.month} Report`}</Text>
                          <Text style={{ fontSize: 11, color: colors.text2, marginTop: 2 }}>Generated {r.generated}</Text>
                          {r.description ? <Text style={{ fontSize: 12, color: colors.text2, marginTop: 2 }}>{r.description}</Text> : null}
                          {r.content ? <Text style={{ fontSize: 12, color: colors.text, marginTop: 4 }}>{r.content}</Text> : null}
                        </View>
                      </View>
                      {r.file ? (
                        <TouchableOpacity style={s.dlBtn} onPress={() => handleOpenFile(r.file)}>
                          <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 12 }}>
                            {isPDF ? 'PDF' : 'View'}
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
      </View>
    </ScreenWrapper>
  );
}

const styles = (c) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  hero: { padding: 20, paddingTop: 18 },
  backBtn: { width: 36, height: 36, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  circleWrap: { alignItems: 'center', paddingVertical: 10 },
  circleOuter: { width: 140, height: 140, borderRadius: 70, borderWidth: 10, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' },
  circleInner: { alignItems: 'center' },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  infoBox: { flex: 1, minWidth: '45%', backgroundColor: c.card2, borderWidth: 1.5, borderColor: c.border, borderRadius: 12, padding: 14 },
  infoLabel: { fontSize: 11, color: c.text2, fontWeight: '500', marginBottom: 6, letterSpacing: 0.4 },
  infoValue: { fontSize: 15, fontWeight: '700', color: c.text },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: c.text, marginBottom: 12 },
  managerCard: { backgroundColor: c.card, borderWidth: 1.5, borderColor: c.border, borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 },
  managerAvatar: { width: 50, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  contactBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  chartCard: { backgroundColor: c.card, borderWidth: 1.5, borderColor: c.border, borderRadius: 16, padding: 16, marginBottom: 20 },
  reportItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border },
  reportIcon: { width: 36, height: 36, backgroundColor: 'rgba(229,9,20,0.08)', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  dlBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: 'rgba(229,9,20,0.08)', borderRadius: 8 },
});