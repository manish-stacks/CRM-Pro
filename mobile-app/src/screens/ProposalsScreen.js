import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Alert, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { AxiosInstance } from '../lib/Axios.instance';
import { StatusChip } from './HomeScreen';
import ScreenWrapper from '../components/ScreenWrapper';

const proposalStatusMap = { pending: 'expiring', accepted: 'active', rejected: 'expired', expired: 'expired' };

export default function ProposalsScreen({ navigation }) {
  const { colors } = useTheme();
  const s = styles(colors);
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const fetchProposals = async () => {
    try {
      const res = await AxiosInstance.get('/client-portal/proposals');
      setProposals(res.data?.data || []);
    } catch (e) {
      setProposals([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchProposals(); }, []);

  const onRefresh = () => { setRefreshing(true); fetchProposals(); };

  const respond = (proposal, action) => {
    const verb = action === 'accept' ? 'Accept' : 'Decline';
    Alert.alert(`${verb} Proposal`, `Are you sure you want to ${action} "${proposal.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: verb,
        style: action === 'reject' ? 'destructive' : 'default',
        onPress: async () => {
          setBusyId(proposal.id);
          try {
            await AxiosInstance.post(`/client-portal/proposals/${proposal.id}/respond`, { action });
            Alert.alert('Done', action === 'accept' ? 'Proposal accepted 🎉' : 'Proposal declined');
            fetchProposals();
          } catch (e) {
            Alert.alert('Error', e.message || 'Could not submit your response.');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  return (
    <ScreenWrapper isScrollable={false}>
      <View style={s.container}>
        <View style={s.headerBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="chevron-back" size={18} color={colors.text} />
          </TouchableOpacity>
          <Text style={s.title}>Proposals</Text>
        </View>

        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: 20 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          >
            {proposals.length === 0 ? (
              <Text style={{ color: colors.text3, textAlign: 'center', marginTop: 40, fontSize: 13 }}>
                No proposals yet.
              </Text>
            ) : proposals.map(p => (
              <View key={p.id} style={[s.card, p.status !== 'pending' && { opacity: 0.7 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                  <Text style={{ fontWeight: '700', fontSize: 15, color: colors.text, flex: 1, marginRight: 8 }}>{p.title}</Text>
                  <StatusChip status={proposalStatusMap[p.status] || 'expired'} />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <Text style={{ fontWeight: '700', fontSize: 13, color: colors.text }}>{p.price}</Text>
                  <Text style={{ color: colors.text3 }}>•</Text>
                  <Text style={{ fontSize: 12, color: colors.text2 }}>Sent {p.sent}</Text>
                </View>
                {p.desc ? (
                  <Text style={{ fontSize: 13, color: colors.text2, lineHeight: 20, marginBottom: 14 }}>{p.desc}</Text>
                ) : null}
                {p.status === 'pending' && (
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity style={s.declineBtn} disabled={busyId === p.id} onPress={() => respond(p, 'reject')}>
                      <Text style={{ fontWeight: '700', fontSize: 13, color: colors.text }}>✕ Decline</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={{ flex: 1 }} disabled={busyId === p.id} onPress={() => respond(p, 'accept')}>
                      <LinearGradient colors={[colors.gradStart, colors.gradEnd]} style={s.acceptBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                        {busyId === p.id
                          ? <ActivityIndicator color="#fff" size="small" />
                          : <Text style={{ color: 'white', fontWeight: '700', fontSize: 13 }}>✓ Accept Proposal</Text>}
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}
          </ScrollView>
        )}
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
