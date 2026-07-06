import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { SERVICES } from '../constants/data';
import { ProgressBar } from './HomeScreen';
import ScreenWrapper from '../components/ScreenWrapper';

export default function RenewalsScreen({ navigation }) {
  const { colors } = useTheme();
  const s = styles(colors);
  const critical = SERVICES.find(sv => sv.status === 'critical');
  const expiring = SERVICES.filter(sv => sv.status === 'expiring');

  return (
    <ScreenWrapper>
      <View style={s.container}>
        <View style={s.headerBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="chevron-back" size={18} color={colors.text} />
          </TouchableOpacity>
          <Text style={s.title}>Renewals</Text>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 30 }}>
          {/* Critical Renewal Hero */}
          {critical && (
            <LinearGradient colors={[colors.gradStart, colors.gradEnd]} style={s.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Text style={{ fontSize: 60, fontWeight: '800', color: 'white', lineHeight: 64 }}>5</Text>
              <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', marginTop: 4, marginBottom: 16 }}>days remaining</Text>
              <Text style={{ fontSize: 18, fontWeight: '700', color: 'white' }}>{critical.name}</Text>
              <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 4, marginBottom: 16 }}>Expires on {critical.renewalDate}</Text>
              <TouchableOpacity style={s.renewBtn} onPress={() => Alert.alert('Renewal initiated! 🎉')}>
                <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 16 }}>Renew Now → {critical.monthlyValue}/yr</Text>
              </TouchableOpacity>
            </LinearGradient>
          )}

          {/* Plan Details */}
          <Text style={s.sectionTitle}>Plan Details</Text>
          <View style={s.planCard}>
            <Text style={{ fontSize: 32, fontWeight: '800', color: colors.text }}>₹6,000 <Text style={{ fontSize: 16, color: colors.text2, fontWeight: '500' }}>/year</Text></Text>
            <Text style={{ fontSize: 13, color: colors.text2, marginTop: 2, marginBottom: 16 }}>SSL Certificate + Shared Cloud Hosting</Text>
            {['SSL Certificate (Wildcard)', '10 GB SSD Storage', '99.9% Uptime Guarantee', 'Daily Backups', '24/7 Support'].map((f, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <Ionicons name="checkmark" size={18} color={colors.green} />
                <Text style={{ fontSize: 14, color: colors.text }}>{f}</Text>
              </View>
            ))}
          </View>

          {/* Other expiring */}
          {expiring.length > 0 && (
            <>
              <Text style={s.sectionTitle}>Also Expiring Soon</Text>
              {expiring.map(sv => (
                <View key={sv.id} style={s.alertCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Text style={{ fontSize: 22 }}>{sv.icon}</Text>
                      <View>
                        <Text style={{ fontWeight: '700', fontSize: 14, color: colors.text }}>{sv.name}</Text>
                        <Text style={{ fontSize: 12, color: colors.text2 }}>Expires {sv.renewalDate}</Text>
                      </View>
                    </View>
                  </View>
                  <ProgressBar progress={sv.progress} color="#F59E0B" startDate={sv.startDate} endDate={sv.renewalDate} />
                </View>
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
  headerBar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12 },
  backBtn: { width: 36, height: 36, backgroundColor: c.card2, borderWidth: 1.5, borderColor: c.border, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '800', color: c.text },
  hero: { borderRadius: 20, padding: 24, marginBottom: 20, alignItems: 'center' },
  renewBtn: { width: '100%', padding: 16, backgroundColor: 'white', borderRadius: 12, alignItems: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: c.text, marginBottom: 12 },
  planCard: { backgroundColor: c.card, borderWidth: 1.5, borderColor: c.border, borderRadius: 16, padding: 20, marginBottom: 20 },
  alertCard: { backgroundColor: 'rgba(245,158,11,0.04)', borderWidth: 1.5, borderColor: 'rgba(245,158,11,0.3)', borderRadius: 12, padding: 16, marginBottom: 10 },
});