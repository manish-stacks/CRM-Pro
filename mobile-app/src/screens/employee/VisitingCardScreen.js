import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Share, Linking, Image, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../../context/ThemeContext';
import ScreenWrapper from '../../components/ScreenWrapper';
import { EmployeeAPI } from '../../services/employee.api';
import logo from '../../../assets/hbs-logo.png';

const WEB_BASE = 'https://web-crm.hoverbusinessservices.com';

const buildVCard = (d) => {
  const esc = (v) => String(v || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
  return [
    'BEGIN:VCARD', 'VERSION:3.0', `FN:${esc(d.name)}`, `ORG:${esc(d.company.name)}`, `TITLE:${esc(d.position)}`,
    d.phone ? `TEL;TYPE=CELL:${d.phone}` : '', d.email ? `EMAIL:${d.email}` : '',
    d.company.website ? `URL:${d.company.website}` : '', d.company.address ? `ADR;TYPE=WORK:;;${esc(d.company.address)};;;;` : '', 'END:VCARD',
  ].filter(Boolean).join('\r\n');
};

export default function VisitingCardScreen({ navigation }) {
  const { colors } = useTheme();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await EmployeeAPI.getVisitingCard();
      const card = r.data?.data || r.data;
      if (!card?.name) throw new Error('Empty response');
      setData(card);
    } catch (e) {
      setError(e?.message || 'Could not load your visiting card.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const link = data ? `${WEB_BASE}/card/${data.employeeId}` : '';
  const profileUrl = data?.company?.profileUrl || '';

  const shareLink = () => Share.share({
    message: `Hi, this is ${data.name} from ${data.company.name}. My visiting card: ${link}`,
  }).catch(() => {});

  const shareProfile = () => Share.share({
    message: `${data.company.name} - Company Profile: ${profileUrl}`,
  }).catch(() => {});

  // Soft copy: contact file (.vcf) that opens straight in Contacts.
  const shareSoftCopy = async () => {
    try {
      setBusy(true);
      const uri = `${FileSystem.cacheDirectory}${data.name.replace(/\s+/g, '_')}.vcf`;
      await FileSystem.writeAsStringAsync(uri, buildVCard(data));
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'text/vcard', dialogTitle: 'Share visiting card' });
      else Alert.alert('Not supported', 'Sharing is not available on this device.');
    } catch (e) {
      Alert.alert('Error', 'Could not create the contact file.');
    } finally { setBusy(false); }
  };

  const s = styles(colors);
  const Btn = ({ icon, label, onPress, disabled }) => (
    <TouchableOpacity style={[s.btn, disabled && { opacity: 0.5 }]} onPress={onPress} disabled={disabled}>
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text style={s.btnTxt}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <ScreenWrapper isScrollable={false}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.title}>Visiting Card</Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : !data ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: colors.text2, fontSize: 13, textAlign: 'center', paddingHorizontal: 30, marginBottom: 10 }}>{error}</Text>
          <TouchableOpacity onPress={load}><Text style={{ color: colors.primary, fontWeight: '700' }}>Tap to retry</Text></TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <View style={s.card}>
            <View style={s.top}>
              <Image source={data.company.logo && /^https?:/i.test(data.company.logo) ? { uri: data.company.logo } : logo} style={s.logo} resizeMode="contain" />
              <Text style={s.company} numberOfLines={2}>{data.company.name}</Text>
            </View>
            <LinearGradient colors={['#303030', '#111111']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.body}>
              <View style={s.row}>
                {data.avatar ? <Image source={{ uri: data.avatar }} style={s.avatar} /> : (
                  <View style={[s.avatar, { alignItems: 'center', justifyContent: 'center' }]}>
                    <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800' }}>{data.name?.[0]}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={s.name}>{data.name}</Text>
                  <Text style={s.pos}>{data.position}</Text>
                </View>
              </View>
              {data.phone ? <Text style={s.line}>📞 {data.phone}</Text> : null}
              {data.email ? <Text style={s.line}>✉️ {data.email}</Text> : null}
              {data.company.website ? <Text style={s.line}>🌐 {data.company.website.replace(/^https?:\/\//, '')}</Text> : null}
              {data.company.address ? <Text style={s.line}>📍 {data.company.address}</Text> : null}
            </LinearGradient>
          </View>

          <Text style={s.section}>Share with client</Text>
          <View style={s.grid}>
            <Btn icon="share-social-outline" label="Share Link" onPress={shareLink} />
            <Btn icon="download-outline" label="Soft Copy (.vcf)" onPress={shareSoftCopy} disabled={busy} />
          </View>

          <Text style={s.section}>Company profile</Text>
          {profileUrl ? (
            <View style={s.grid}>
              <Btn icon="share-social-outline" label="Share Link" onPress={shareProfile} />
              <Btn icon="open-outline" label="Open / Download" onPress={() => Linking.openURL(profileUrl).catch(() => {})} />
            </View>
          ) : (
            <Text style={{ color: colors.text3, fontSize: 12 }}>Company profile link is not set yet. Ask an admin to add it in Settings.</Text>
          )}
        </ScrollView>
      )}
    </ScreenWrapper>
  );
}

const styles = (colors) => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
  title: { color: colors.text, fontSize: 18, fontWeight: '800' },
  card: { borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: '#fff' },
  logo: { width: 64, height: 40 },
  body: { padding: 18, borderTopWidth: 4, borderTopColor: '#E53030' },
  company: { flex: 1, color: '#111827', fontSize: 14, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.15)' },
  name: { color: '#fff', fontSize: 20, fontWeight: '800' },
  pos: { color: '#FF6B6B', fontSize: 13, marginTop: 2 },
  line: { color: '#fff', fontSize: 13, marginTop: 5, lineHeight: 18 },
  section: { color: colors.text2, fontSize: 12, fontWeight: '800', marginTop: 20, marginBottom: 8, textTransform: 'uppercase' },
  grid: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card },
  btnTxt: { color: colors.text, fontWeight: '700', fontSize: 13 },
});
