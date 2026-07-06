import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { SERVICES } from '../constants/data';
import { StatusChip } from './HomeScreen';
import ScreenWrapper from '../components/ScreenWrapper';
import { AxiosInstance } from '../lib/Axios.instance';

const FILTERS = ['All', 'Active', 'Expiring', 'Critical', 'Expired'];

export default function ServicesScreen({ navigation }) {
  const { colors } = useTheme();
  const s = styles(colors);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [services, setServices] = useState([]);

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      const res = await AxiosInstance.get('/client-portal/services');
      setServices(res.data.services);
    } catch (e) {
      console.log(e);
    }
  };
  const filtered = services.filter(sv => {
    const matchFilter =
      filter === 'All' || sv.status?.toLowerCase() === filter.toLowerCase();

    const matchSearch =
      sv.name?.toLowerCase().includes(search.toLowerCase());

    return matchFilter && matchSearch;
  });

  // console.log("service data: ", services)
  return (
    <ScreenWrapper>
      <View style={s.container}>
        <View style={s.header}>
          <Text style={s.title}>My Services</Text>
          <Text style={s.sub}>{services.length} active services</Text>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 20 }}>
          {/* Search */}
          <View style={s.searchBar}>
            <Ionicons name="search-outline" size={18} color={colors.text3} />
            <TextInput
              style={s.searchInput}
              placeholder="Search services..."
              placeholderTextColor={colors.text3}
              value={search}
              onChangeText={setSearch}
            />
          </View>
          {/* Filter Chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            {FILTERS.map(f => (
              <TouchableOpacity key={f} onPress={() => setFilter(f)}
                style={[s.filterChip, filter === f && s.filterActive]}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: filter === f ? 'white' : colors.text2 }}>{f}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {/* Cards */}
          {filtered.map(sv => (
            <TouchableOpacity key={sv.id} style={s.card} onPress={() => navigation.navigate('ServiceDetail', { service: sv })}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <View style={[s.icon, { backgroundColor: sv.iconBg }]}><Text style={{ fontSize: 22 }}>{sv.icon}</Text></View>
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
        </ScrollView>
      </View>
    </ScreenWrapper>
  );
}

const styles = (c) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  title: { fontSize: 22, fontWeight: '800', color: c.text },
  sub: { fontSize: 13, color: c.text2, marginTop: 2 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.card2, borderWidth: 1.5, borderColor: c.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16 },
  searchInput: { flex: 1, fontSize: 14, color: c.text },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 100, marginRight: 8, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.card2 },
  filterActive: { backgroundColor: c.primary, borderColor: c.primary },
  card: { backgroundColor: c.card, borderWidth: 1.5, borderColor: c.border, borderRadius: 16, padding: 16, marginBottom: 12 },
  icon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  chevron: { width: 32, height: 32, backgroundColor: c.bg3, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});