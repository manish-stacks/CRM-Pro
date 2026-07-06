import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';

import { useTheme } from '../../context/ThemeContext';
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

/* ---------- MAIN ---------- */
export default function AddClientScreen({ navigation }) {

  const { colors } = useTheme();

  /* CLIENT */
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    company: '',
    address: ''
  });

  const [loading, setLoading] = useState(false);
  const [clientCreated, setClientCreated] = useState(null);

  /* PACKAGE */
  const [packages, setPackages] = useState([]);
  const [selectedPackage, setSelectedPackage] = useState(null);

  /* SERVICE */
  const [showService, setShowService] = useState(false);
  const [service, setService] = useState({
    price: '',
    duration: ''
  });

  const [assigning, setAssigning] = useState(false);

  /* ---------- FETCH PACKAGES ---------- */
  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    try {
      const res = await EmployeeAPI.getPackages();
      setPackages(res.data?.data || []);
    } catch (e) {
      console.log('Package error:', e);
    }
  };

  /* ---------- HELPERS ---------- */
  const set = (key) => (val) => setForm(f => ({ ...f, [key]: val }));
  const setS = (key) => (val) => setService(s => ({ ...s, [key]: val }));

  const validateForm = () => {
    if (!form.name.trim()) return Alert.alert('Error', 'Name required');
    if (!form.phone.trim()) return Alert.alert('Error', 'Phone required');
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

  /* ---------- ASSIGN PACKAGE ---------- */
  const handleAssignService = async () => {

    if (!selectedPackage)
      return Alert.alert('Error', 'Select package');

    if (!service.price)
      return Alert.alert('Error', 'Enter price');

    setAssigning(true);

    try {

      await EmployeeAPI.assignService({
        client_id: clientCreated?.id,
        package_id: selectedPackage,
        price: parseFloat(service.price),
        duration: service.duration,
      });

      Alert.alert('Success', 'Service assigned!', [
        { text: 'View Clients', onPress: () => navigation.navigate('Clients') },
        {
          text: 'Add Another',
          onPress: () => {
            setShowService(false);
            setClientCreated(null);
            setForm({ name: '', phone: '', email: '', company: '', address: '' });
          }
        }
      ]);

    } catch (e) {
      Alert.alert('Error', e.message || 'Failed');
    } finally {
      setAssigning(false);
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

              <Field label="FULL NAME *" icon="person-outline" value={form.name} onChangeText={set('name')} />
              <Field label="PHONE *" icon="call-outline" value={form.phone} onChangeText={set('phone')} />
              <Field label="EMAIL" icon="mail-outline" value={form.email} onChangeText={set('email')} />
              <Field label="COMPANY" icon="business-outline" value={form.company} onChangeText={set('company')} />
              <Field label="ADDRESS" icon="location-outline" value={form.address} onChangeText={set('address')} />

              <TouchableOpacity onPress={handleCreate} disabled={loading}>
                <LinearGradient colors={[colors.gradStart, colors.gradEnd]} style={s.btn}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>Create Client →</Text>}
                </LinearGradient>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* STEP 2 */}

              <View style={[s.successBanner, { backgroundColor: colors.green + '15', borderColor: colors.green }]}>
                <Ionicons name="checkmark-circle" size={20} color={colors.green} />
                <Text style={[s.successTxt, { color: colors.greenText }]}>
                  Client <Text style={{ fontWeight: '800' }}>{clientCreated?.name}</Text> created!
                </Text>
              </View>

              <View style={s.stepRow}>
                <View style={[s.step, { backgroundColor: colors.green }]}>
                  <Ionicons name="checkmark" size={14} color="#fff" />
                </View>
                <View style={[s.stepLine, { backgroundColor: colors.primary }]} />
                <View style={[s.step, { backgroundColor: colors.primary }]}>
                  <Text style={s.stepTxt}>2</Text>
                </View>
                <Text style={[s.stepLabel, { color: colors.text2 }]}>
                  Step 2 – Assign Package
                </Text>
              </View>

              {/* PACKAGE DROPDOWN */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text2, marginBottom: 8 }}>
                  PACKAGE *
                </Text>

                <View style={[fStyles.wrap, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
                  <Ionicons name="layers-outline" size={18} color={colors.text3} />

                  <Picker
                    selectedValue={selectedPackage}
                    style={{ flex: 1, color: colors.text }}
                    onValueChange={(val) => {
                      setSelectedPackage(val);

                      const pkg = packages.find(p => p.id === val);
                      if (pkg) {
                        setService(s => ({
                          ...s,
                          price: pkg.price?.toString() || ''
                        }));
                      }
                    }}
                  >
                    <Picker.Item label="Select Package" value={null} />
                    {packages.map(p => (
                      <Picker.Item key={p.id} label={p.package_name} value={p.id} />
                    ))}
                  </Picker>
                </View>
              </View>

              <Field label="PRICE" icon="cash-outline" value={service.price} onChangeText={setS('price')} />
              <Field label="DURATION" icon="calendar-outline" value={service.duration} onChangeText={setS('duration')} />

              <TouchableOpacity onPress={handleAssignService} disabled={assigning}>
                <LinearGradient colors={[colors.gradStart, colors.gradEnd]} style={s.btn}>
                  {assigning ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>Assign Package →</Text>}
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

  skipBtn: { alignItems: 'center', marginTop: 10 }
});