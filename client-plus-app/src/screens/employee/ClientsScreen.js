import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { EmployeeAPI } from '../../services/employee.api';
import ScreenWrapper from '../../components/ScreenWrapper';

function ClientCard({ client, onPress, colors }) {
  const initials = client.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??';
  const services = client.services || client.assigned_services || [];
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
            {client.email ? (
              <View style={cStyles.chip}>
                <Ionicons name="mail-outline" size={11} color={colors.text3} />
                <Text style={[cStyles.chipTxt, { color: colors.text3 }]} numberOfLines={1}>{client.email}</Text>
              </View>
            ) : null}
          </View>
          {client.services_count > 0 && (
            <View style={cStyles.serviceRow}>
              <View style={[cStyles.serviceBadge, { backgroundColor: colors.primary + '15' }]}>
                <Text style={[cStyles.serviceTxt, { color: colors.primary }]}>
                  {client.services_count} service{client.services_count > 1 ? 's' : ''}
                </Text>
              </View>
            </View>
          )}
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
  infoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  chipTxt: { fontSize: 11 },
  serviceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  serviceBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  serviceTxt: { fontSize: 11, fontWeight: '600' },
});

export default function ClientsScreen({ navigation }) {
  const { colors } = useTheme();
  const [clients, setClients] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchClients = async () => {
    try {
      const res = await EmployeeAPI.getClients();
      const list = res.data?.data || res.data?.clients || res.data || [];
      setClients(list);
      setFiltered(list);
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to load clients');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchClients(); }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    if (!q) { setFiltered(clients); return; }
    setFiltered(clients.filter(c =>
      c.name?.toLowerCase().includes(q) ||
      c.company?.toLowerCase().includes(q) ||
      c.phone?.includes(q) ||
      c.email?.toLowerCase().includes(q)
    ));
  }, [search, clients]);

  const onRefresh = useCallback(() => { setRefreshing(true); fetchClients(); }, []);

  const s = styles(colors);
  return (
    <ScreenWrapper isScrollable={false}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Clients</Text>
        <TouchableOpacity style={[s.addBtn, { backgroundColor: colors.primary }]} onPress={() => navigation.navigate('AddClient')}>
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
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
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={colors.text3} />
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item, i) => (item.id || i).toString()}
          renderItem={({ item }) => (
            <ClientCard
              client={item}
              colors={colors}
              onPress={(c) => navigation.navigate('ClientDetail', { client: c })}
            />
          )}
          contentContainerStyle={{ padding: 16, paddingTop: 8 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <Ionicons name="people-outline" size={48} color={colors.text3} />
              <Text style={{ color: colors.text2, marginTop: 12, fontSize: 15, fontWeight: '600' }}>
                {search ? 'No clients match your search' : 'No clients yet'}
              </Text>
            </View>
          }
        />
      )}
    </ScreenWrapper>
  );
}

const styles = (c) => StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: c.text },
  addBtn: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginBottom: 8, borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 },
  searchInput: { flex: 1, fontSize: 14 },
});
