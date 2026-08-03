import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';

import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { EmployeeAPI } from '../../services/employee.api';
import ScreenWrapper from '../../components/ScreenWrapper';

/* ---------- INPUT FIELD ---------- */
function Field({ label, icon, ...props }) {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text2, marginBottom: 8, letterSpacing: 0.5 }}>
        {label}
      </Text>

      <View style={[fStyles.wrap, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
        {icon && <Ionicons name={icon} size={18} color={colors.text3} />}
        <TextInput
          placeholder={label}
          style={[fStyles.input, { color: colors.text }]}
          placeholderTextColor={colors.text3}
          {...props}
        />
      </View>
    </View>
  );
}

const fStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 2
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 12
  },
});

/* ---------- PERSON PICKER (Telecaller / Marketing Person / Reporting Person) ---------- */
function PersonPicker({ label, icon, colors, value, onValueChange, options }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text2, marginBottom: 8, letterSpacing: 0.5 }}>
        {label}
      </Text>
      <View style={[fStyles.wrap, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
        {icon && <Ionicons name={icon} size={18} color={colors.text3} />}
        <Picker selectedValue={value} style={{ flex: 1, color: colors.text }} onValueChange={onValueChange}>
          <Picker.Item label={`Select ${label.toLowerCase()}`} value={null} />
          {options.map(o => (
            <Picker.Item key={o.id} label={o.name} value={o.id} />
          ))}
        </Picker>
      </View>
    </View>
  );
}

/* ---------- MAIN ---------- */
export default function AddClientScreen({ navigation }) {

  const { colors } = useTheme();
  const { user } = useAuth();

  const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  /* CLIENT — same fields as the web "Add New Client" form */
  const [form, setForm] = useState({
    companyName: '',
    clientName: '',
    phone: '',
    altPhone: '',
    email: '',
    onboardingDate: todayStr,
    address: '',
    city: '',
    state: '',
    pincode: '',
    gstApplicable: false,
    gstNo: '',
    // A marketing exec / telecaller adding their own client doesn't need to
    // pick themselves — pre-fill it, same as the web form.
    telecallerId: user?.role === 'TELECALLER' ? (user.id || null) : null,
    marketingPersonId: user?.role === 'MARKETING_EXECUTIVE' ? (user.id || null) : null,
    sendWelcome: true,
  });

  const [loading, setLoading] = useState(false);
  const [clientCreated, setClientCreated] = useState(null);
  const [showService, setShowService] = useState(false);

  /* Dropdown options for Telecaller / Marketing Person (includes their team head) */
  const [telecallers, setTelecallers] = useState([]);
  const [marketingPeople, setMarketingPeople] = useState([]);

  /* ---------- FETCH PEOPLE ---------- */
  useEffect(() => {
    fetchPeople();
  }, []);

  const fetchPeople = async () => {
    try {
      const res = await EmployeeAPI.getUsersByRole('TELECALLER,MARKETING_EXECUTIVE,MANAGER');
      const users = res.data?.data || [];
      const heads = users.filter(u => u.role === 'MANAGER').map(u => ({ ...u, name: `${u.name} (Head)` }));
      setTelecallers([...users.filter(u => u.role === 'TELECALLER'), ...heads]);
      setMarketingPeople([...users.filter(u => u.role === 'MARKETING_EXECUTIVE'), ...heads]);
    } catch (e) {
      console.log('Users-by-role error:', e);
    }
  };

  /* ---------- HELPERS ---------- */
  const set = (key) => (val) => setForm(f => ({ ...f, [key]: val }));

  const validateForm = () => {
    if (!form.clientName.trim()) { Alert.alert('Error', 'Client name required'); return false; }
    if (!form.phone.trim()) { Alert.alert('Error', 'Phone required'); return false; }
    return true;
  };

  /* ---------- CREATE CLIENT ---------- */
  const handleCreate = async () => {

    if (!validateForm()) return;

    setLoading(true);

    try {

      const res = await EmployeeAPI.createClient(form);

      const client = res.data?.data || res.data;

      setClientCreated(client);
      setShowService(true);

      Alert.alert('Success', 'Client created!');

    } catch (e) {
      Alert.alert('Error', e.message || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const s = styles(colors);

  return (
    <ScreenWrapper isScrollable={false}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* HEADER */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>

          <Text style={s.headerTitle}>
            {showService ? 'Assign Service' : 'Add Client'}
          </Text>

          <View style={{ width: 38 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">

          {!showService ? (
            <>
              {/* STEP 1 */}
              <View style={s.stepRow}>
                <View style={[s.step, { backgroundColor: colors.primary }]}>
                  <Text style={s.stepTxt}>1</Text>
                </View>
                <View style={[s.stepLine, { backgroundColor: colors.border }]} />
                <View style={[s.step, { backgroundColor: colors.border }]}>
                  <Text style={[s.stepTxt, { color: colors.text3 }]}>2</Text>
                </View>
                <Text style={[s.stepLabel, { color: colors.text2 }]}>
                  Step 1 of 2 – Client Info
                </Text>
              </View>

              <Field label="COMPANY NAME" icon="business-outline" value={form.companyName} onChangeText={set('companyName')} />
              <Field label="CLIENT NAME *" icon="person-outline" value={form.clientName} onChangeText={set('clientName')} />
              <Field label="PHONE *" icon="call-outline" keyboardType="phone-pad" value={form.phone} onChangeText={set('phone')} />
              <Field label="ALT PHONE" icon="call-outline" keyboardType="phone-pad" value={form.altPhone} onChangeText={set('altPhone')} />
              <Field label="EMAIL" icon="mail-outline" keyboardType="email-address" autoCapitalize="none" value={form.email} onChangeText={set('email')} />
              <Field label="ONBOARDING DATE (YYYY-MM-DD)" icon="calendar-outline" value={form.onboardingDate} onChangeText={set('onboardingDate')} />
              <Field label="ADDRESS" icon="location-outline" value={form.address} onChangeText={set('address')} />
              <Field label="CITY" icon="business-outline" value={form.city} onChangeText={set('city')} />
              <Field label="STATE" icon="map-outline" value={form.state} onChangeText={set('state')} />
              <Field label="PINCODE" icon="location-outline" keyboardType="number-pad" value={form.pincode} onChangeText={set('pincode')} />

              {/* GST APPLICABLE */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text2, marginBottom: 8, letterSpacing: 0.5 }}>GST APPLICABLE</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
                  <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }} onPress={() => set('gstApplicable')(false)}>
                    <Ionicons name={!form.gstApplicable ? 'radio-button-on' : 'radio-button-off'} size={18} color={colors.primary} />
                    <Text style={{ color: colors.text, fontSize: 14 }}>No</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }} onPress={() => set('gstApplicable')(true)}>
                    <Ionicons name={form.gstApplicable ? 'radio-button-on' : 'radio-button-off'} size={18} color={colors.primary} />
                    <Text style={{ color: colors.text, fontSize: 14 }}>Yes</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {form.gstApplicable && (
                <Field label="GST NO" icon="document-text-outline" value={form.gstNo} onChangeText={set('gstNo')} />
              )}

              {/* TELECALLER / MARKETING PERSON (dropdowns include the team head) */}
              <PersonPicker label="TELECALLER" icon="call-outline" colors={colors}
                value={form.telecallerId} onValueChange={set('telecallerId')} options={telecallers} />
              <PersonPicker label="MARKETING PERSON" icon="briefcase-outline" colors={colors}
                value={form.marketingPersonId} onValueChange={set('marketingPersonId')} options={marketingPeople} />

              {/* SEND WELCOME MESSAGE */}
              <TouchableOpacity
                onPress={() => set('sendWelcome')(!form.sendWelcome)}
                style={[s.welcomeBox, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '40' }]}
              >
                <Ionicons name={form.sendWelcome ? 'checkbox' : 'square-outline'} size={20} color={colors.primary} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>Send Welcome Message</Text>
                  <Text style={{ color: colors.text3, fontSize: 11, marginTop: 2 }}>
                    Auto-generate portal password + send credentials via email + WhatsApp
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity onPress={handleCreate} disabled={loading}>
                <LinearGradient colors={[colors.gradStart, colors.gradEnd]} style={s.btn}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>Create Client →</Text>}
                </LinearGradient>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* STEP 2 — client created; add services from the Client Detail page (same as everywhere else) */}

              <View style={[s.successBanner, { backgroundColor: colors.green + '15', borderColor: colors.green }]}>
                <Ionicons name="checkmark-circle" size={20} color={colors.green} />
                <Text style={[s.successTxt, { color: colors.greenText }]}>
                  Client <Text style={{ fontWeight: '800' }}>{clientCreated?.name}</Text> created!
                </Text>
              </View>

              <TouchableOpacity onPress={() => navigation.replace('ClientDetail', { client: { id: clientCreated?.id } })}>
                <LinearGradient colors={[colors.gradStart, colors.gradEnd]} style={s.btn}>
                  <Text style={s.btnTxt}>Add Service →</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity style={s.skipBtn} onPress={() => navigation.navigate('Clients')}>
                <Text style={{ color: colors.text2 }}>Skip for now</Text>
              </TouchableOpacity>
            </>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenWrapper>
  );
}

/* ---------- STYLES ---------- */
const styles = (c) => StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 16 },
  backBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: c.bg2, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: c.text },

  stepRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24, gap: 8 },
  step: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  stepTxt: { color: '#fff', fontWeight: '800' },
  stepLine: { width: 32, height: 2 },
  stepLabel: { fontSize: 12 },

  btn: { padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 8 },
  btnTxt: { color: '#fff', fontWeight: '800' },

  successBanner: { flexDirection: 'row', padding: 12, borderWidth: 1.5, borderRadius: 12, marginBottom: 20 },
  successTxt: { marginLeft: 10 },

  welcomeBox: { flexDirection: 'row', alignItems: 'center', padding: 12, borderWidth: 1.5, borderRadius: 12, marginBottom: 16 },

  skipBtn: { alignItems: 'center', marginTop: 10 }
});