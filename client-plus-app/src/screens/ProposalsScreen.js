import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { PROPOSALS } from '../constants/data';
import { StatusChip } from './HomeScreen';
import ScreenWrapper from '../components/ScreenWrapper';

const proposalStatusMap = { new: 'active', pending: 'expiring', accepted: 'active' };

export default function ProposalsScreen({ navigation }) {
  const { colors } = useTheme();
  const s = styles(colors);
  return (
    <ScreenWrapper>
      <View style={s.container}>
        <View style={s.headerBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="chevron-back" size={18} color={colors.text} />
          </TouchableOpacity>
          <Text style={s.title}>Proposals</Text>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20 }}>
          {PROPOSALS.map(p => (
            <View key={p.id} style={[s.card, p.status === 'accepted' && { opacity: 0.6 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                <Text style={{ fontWeight: '700', fontSize: 15, color: colors.text, flex: 1, marginRight: 8 }}>{p.title}</Text>
                <StatusChip status={proposalStatusMap[p.status]} />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Text style={{ fontWeight: '700', fontSize: 13, color: colors.text }}>{p.price}</Text>
                <Text style={{ color: colors.text3 }}>•</Text>
                <Text style={{ fontSize: 12, color: colors.text2 }}>Sent {p.sent}</Text>
              </View>
              <Text style={{ fontSize: 13, color: colors.text2, lineHeight: 20, marginBottom: 14 }}>{p.desc}</Text>
              {p.status !== 'accepted' && (
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity style={s.declineBtn} onPress={() => Alert.alert('Declined')}><Text style={{ fontWeight: '700', fontSize: 13, color: colors.text }}>✕ Decline</Text></TouchableOpacity>
                  <TouchableOpacity style={{ flex: 1 }} onPress={() => Alert.alert('Accepted! 🎉')}>
                    <LinearGradient colors={[colors.gradStart, colors.gradEnd]} style={s.acceptBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                      <Text style={{ color: 'white', fontWeight: '700', fontSize: 13 }}>✓ Accept Proposal</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}
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
  card: { backgroundColor: c.card, borderWidth: 1.5, borderColor: c.border, borderRadius: 16, padding: 18, marginBottom: 12 },
  declineBtn: { flex: 1, padding: 11, borderWidth: 1.5, borderColor: c.border, borderRadius: 10, alignItems: 'center' },
  acceptBtn: { padding: 11, borderRadius: 10, alignItems: 'center' },
});