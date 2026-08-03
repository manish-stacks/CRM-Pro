import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, RefreshControl, Alert, ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { EmployeeAPI } from '../../services/employee.api';
import ScreenWrapper from '../../components/ScreenWrapper';
import { CalendarModal, toISO, prettyDate } from '../../components/DatePickerField';

// Server-side filters — date-wise view is now accurate (not just on the loaded page)
const TABS = [
  { key: 'all', label: 'All', params: {} },
  { key: 'today', label: 'Today', params: { range: 'today' } },
  { key: 'week', label: 'This week', params: { range: 'week' } },
  { key: 'month', label: 'This month', params: { range: 'month' } },
  { key: 'expiring', label: 'Expiring 30d', params: { expiry: '30' } },
  { key: 'expired', label: 'Expired', params: { expiry: 'expired' } },
];

function ClientCard({ client, onPress, colors }) {
  const initials = client.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??';
  const expDays = client.next_expiry
    ? Math.ceil((new Date(`${client.next_expiry}T00:00:00`).getTime() - Date.now()) / 86400000)
    : null;
  const expColor = expDays == null ? colors.text3 : expDays < 0 ? colors.primary : expDays <= 15 ? '#D97706' : colors.text3;

  return (
    <TouchableOpacity style={[cStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => onPress(client)}>
      <View style={cStyles.row}>
        <View style={[cStyles.avatar, { backgroundColor: colors.primary + '20' }]}>
          <Text style={[cStyles.avatarTxt, { color: colors.primary }]}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[cStyles.name, { color: colors.text }]}>{client.name}</Text>
          {client.company ? <Text style={[cStyles.company, { color: colors.text2 }]}>{client.company}</Text> : null}
          <View style={cStyles.infoRow}>
            {client.phone ? (
              <View style={cStyles.chip}>
                <Ionicons name="call-outline" size={11} color={colors.text3} />
                <Text style={[cStyles.chipTxt, { color: colors.text3 }]}>{client.phone}</Text>
              </View>
            ) : null}
            {client.created_at ? (
              <View style={cStyles.chip}>
                <Ionicons name="calendar-outline" size={11} color={colors.text3} />
                <Text style={[cStyles.chipTxt, { color: colors.text3 }]}>
                  {prettyDate(String(client.created_at).slice(0, 10))}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={cStyles.serviceRow}>
            {client.services_count > 0 && (
              <View style={[cStyles.serviceBadge, { backgroundColor: colors.primary + '15' }]}>
                <Text style={[cStyles.serviceTxt, { color: colors.primary }]}>
                  {client.services_count} service{client.services_count > 1 ? 's' : ''}
                </Text>
              </View>
            )}
            {client.next_expiry ? (
              <View style={[cStyles.serviceBadge, { backgroundColor: expColor + '18' }]}>
                <Text style={[cStyles.serviceTxt, { color: expColor }]}>
                  {expDays < 0 ? `Expired ${Math.abs(expDays)}d ago` : expDays === 0 ? 'Expires today' : `Expires in ${expDays}d`}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.text3} />
      </View>
    </TouchableOpacity>
  );
}

const cStyles = StyleSheet.create({
  card: { borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontSize: 16, fontWeight: '800' },
  name: { fontSize: 15, fontWeight: '700' },
  company: { fontSize: 12, marginTop: 2 },
  infoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  chipTxt: { fontSize: 11 },
  serviceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  serviceBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  serviceTxt: { fontSize: 11, fontWeight: '700' },
});

export default function ClientsScreen({ navigation }) {
  const { colors } = useTheme();
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [tab, setTab] = useState('all');
  const [pickedDate, setPickedDate] = useState('');
  const [dateModal, setDateModal] = useState(false);

  const activeParams = useMemo(() => {
    const base = pickedDate ? { date: pickedDate } : (TABS.find(t => t.key === tab) || TABS[0]).params;
    return { ...base, ...(search ? { search } : {}) };
  }, [tab, pickedDate, search]);

  const fetchClients = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await EmployeeAPI.getClients(activeParams);
      setClients(res.data?.data || []);
    } catch (e) {
      Alert.alert('Error', e.response?.data?.message || e.message || 'Failed to load clients');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeParams]);

  useEffect(() => { fetchClients(); }, [fetchClients]);
  useFocusEffect(useCallback(() => { fetchClients(true); }, [fetchClients]));

  const onRefresh = useCallback(() => { setRefreshing(true); fetchClients(true); }, [fetchClients]);

  const s = styles(colors);
  return (
    <ScreenWrapper isScrollable={false}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Clients</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            style={[s.iconBtn, { backgroundColor: pickedDate ? colors.primary : colors.bg2, borderColor: pickedDate ? colors.primary : colors.border }]}
            onPress={() => setDateModal(true)}
          >
            <Ionicons name="calendar" size={18} color={pickedDate ? '#fff' : colors.text2} />
          </TouchableOpacity>
          <TouchableOpacity style={[s.addBtn, { backgroundColor: colors.primary }]} onPress={() => navigation.navigate('AddClient')}>
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search */}
      <View style={[s.searchWrap, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
        <Ionicons name="search-outline" size={18} color={colors.text3} />
        <TextInput
          style={[s.searchInput, { color: colors.text }]}
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name, company, phone..."
          placeholderTextColor={colors.text3}
          returnKeyType="search"
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={colors.text3} />
          </TouchableOpacity>
        ) : null}
      </View>

      {pickedDate ? (
        <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          <View style={[s.activeFilter, { backgroundColor: colors.bg2, borderColor: colors.primary }]}>
            <Ionicons name="calendar" size={13} color={colors.primary} />
            <Text style={{ color: colors.text, fontSize: 12, fontWeight: '700', flex: 1 }}>
              Added on {prettyDate(pickedDate)}
            </Text>
            <TouchableOpacity onPress={() => setPickedDate('')}>
              <Ionicons name="close-circle" size={16} color={colors.text3} />
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {/* Filter tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 48 }} contentContainerStyle={s.tabsWrap}>
        {TABS.map(t => {
          const active = !pickedDate && tab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[s.tabBtn, { backgroundColor: colors.bg2, borderColor: colors.border }, active && { backgroundColor: colors.primary, borderColor: colors.primary }]}
              onPress={() => { setPickedDate(''); setTab(t.key); }}
            >
              <Text style={[s.tabTxt, { color: active ? '#fff' : colors.text2 }]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={clients}
          keyExtractor={(item, i) => (item.id || i).toString()}
          renderItem={({ item }) => (
            <ClientCard
              client={item}
              colors={colors}
              onPress={(c) => navigation.navigate('ClientDetail', { client: c })}
            />
          )}
          contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: 30 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <Ionicons name="people-outline" size={48} color={colors.text3} />
              <Text style={{ color: colors.text2, marginTop: 12, fontSize: 15, fontWeight: '600' }}>
                {search || pickedDate || tab !== 'all' ? 'No clients match this filter' : 'No clients yet'}
              </Text>
            </View>
          }
        />
      )}

      <CalendarModal
        visible={dateModal}
        value={pickedDate}
        title="Filter by Added Date"
        onClose={() => setDateModal(false)}
        onPick={(iso) => { setPickedDate(iso); setDateModal(false); }}
      />
    </ScreenWrapper>
  );
}

const styles = (c) => StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: c.text },
  addBtn: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  iconBtn: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginBottom: 8, borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 },
  searchInput: { flex: 1, fontSize: 14 },
  activeFilter: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5 },
  tabsWrap: { paddingHorizontal: 16, gap: 8, paddingBottom: 10 },
  tabBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5 },
  tabTxt: { fontSize: 13, fontWeight: '600' },
});
