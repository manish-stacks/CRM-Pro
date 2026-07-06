import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator, TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { EmployeeAPI } from '../../services/employee.api';
import ScreenWrapper from '../../components/ScreenWrapper';
import { Picker } from '@react-native-picker/picker';

export default function ClientDetailScreen({ route, navigation }) {
  const { colors } = useTheme();
  const { client } = route.params;
  const [showAssign, setShowAssign] = useState(false);
  const [service, setService] = useState({ service_name: '', price: '', duration: '' });
  const [assigning, setAssigning] = useState(false);
  const [packages, setPackages] = useState([]);
  const [selectedPackage, setSelectedPackage] = useState(null);

  const services = client.services || client.assigned_services || [];
  const initials = client.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??';

  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    try {
      const res = await EmployeeAPI.getPackages();
      setPackages(res.data?.data || []);
    } catch (e) {
      console.log(e);
    }
  };

  const handleAssignService = async () => {
    if (!service.service_name.trim()) { Alert.alert('Error', 'Service name is required'); return; }
    if (!service.price.trim()) { Alert.alert('Error', 'Price is required'); return; }
    setAssigning(true);
    try {
      await EmployeeAPI.assignService({
        client_id: client.id,
        package_id: selectedPackage,
        price: parseFloat(service.price),
        duration: service.duration,
      });
      Alert.alert('Success', 'Service assigned!');
      setShowAssign(false);
      setService({ service_name: '', price: '', duration: '' });
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to assign service');
    } finally {
      setAssigning(false);
    }
  };
  const assignedPackageIds = services.map(s => s.name || s.id);
  const totalAmount = services.reduce((sum, s) => {
    return sum + (parseFloat(s.price) || 0);
  }, 0);

  const s = styles(colors);

  const handleGenerateInvoice = async () => {

    if (services.length === 0) {
      return Alert.alert('Error', 'No services to generate invoice');
    }

    Alert.alert(
      'Invoice',
      'Invoices are generated from the CRM by the office team. The assigned services are already saved for this client.'
    );
  };
  return (
    <ScreenWrapper isScrollable={false}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <LinearGradient colors={[colors.gradStart, colors.gradEnd]} style={s.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color="rgba(255,255,255,0.9)" />
          </TouchableOpacity>
          <View style={s.avatarWrap}>
            <View style={s.avatar}>
              <Text style={s.avatarTxt}>{initials}</Text>
            </View>
          </View>
          <Text style={s.name}>{client.name}</Text>
          {client.company ? <Text style={s.company}>{client.company}</Text> : null}
        </LinearGradient>

        <View style={{ padding: 20 }}>
          {/* Info Card */}
          <View style={[s.card, { borderColor: colors.border }]}>
            <Text style={[s.cardTitle, { color: colors.text }]}>Contact Info</Text>
            {[
              { icon: 'call-outline', label: 'Phone', val: client.phone },
              { icon: 'mail-outline', label: 'Email', val: client.email },
              { icon: 'location-outline', label: 'Address', val: client.address },
            ].filter(i => i.val).map((item, i) => (
              <View key={i} style={[s.infoRow, i === 0 && { marginTop: 12 }]}>
                <View style={[s.infoIcon, { backgroundColor: colors.bg2 }]}>
                  <Ionicons name={item.icon} size={16} color={colors.text2} />
                </View>
                <View>
                  <Text style={[s.infoLabel, { color: colors.text3 }]}>{item.label}</Text>
                  <Text style={[s.infoVal, { color: colors.text }]}>{item.val}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Services */}
          <View style={[s.card, { borderColor: colors.border }]}>
            <View style={s.cardHeader}>
              <Text style={[s.cardTitle, { color: colors.text }]}>Services ({services.length})</Text>
              <TouchableOpacity onPress={() => setShowAssign(v => !v)}>
                <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>+ Assign</Text>
              </TouchableOpacity>
            </View>

            {showAssign && (
              <View style={[s.assignBox, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
                <View style={{ marginBottom: 10 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.text2, marginBottom: 6 }}>
                    PACKAGE *
                  </Text>

                  <View style={[s.fieldWrap, {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    paddingVertical: 0
                  }]}>
                    <Ionicons name="layers-outline" size={16} color={colors.text3} />

                    <Picker
                      selectedValue={selectedPackage}
                      style={{ flex: 1, color: colors.text }}
                      onValueChange={(value) => {

                        setSelectedPackage(value);

                        const pkg = packages.find(p => p.id === value);

                        if (pkg) {
                          setService(prev => ({
                            ...prev,
                            price: pkg.price?.toString() || ''
                          }));
                        }
                      }}
                    >
                      <Picker.Item label="Select Package" value={null} />

                      {packages.map(p => {
                        const isAssigned = assignedPackageIds.includes(p.package_name || p.id);
                        return (
                          <Picker.Item
                            key={p.id}
                            label={isAssigned ? `${p.package_name} (Already Added)` : p.package_name}
                            value={p.id}
                            enabled={!isAssigned}
                            color={isAssigned ? 'gray' : undefined}
                          />
                        );
                      })}
                    </Picker>
                  </View>
                </View>

                {[
                  { key: 'price', label: 'Price (₹)', placeholder: '5000', icon: 'cash-outline', keyboardType: 'decimal-pad' },
                  { key: 'duration', label: 'Duration', placeholder: '6 months', icon: 'calendar-outline' },
                ].map((f, i) => (
                  <View key={i} style={{ marginBottom: 10 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.text2, marginBottom: 6 }}>{f.label.toUpperCase()}</Text>
                    <View style={[s.fieldWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <Ionicons name={f.icon} size={16} color={colors.text3} />
                      <TextInput
                        style={{ flex: 1, fontSize: 14, color: colors.text, paddingVertical: 8 }}
                        placeholder={f.placeholder}
                        placeholderTextColor={colors.text3}
                        value={service[f.key]}
                        onChangeText={(v) => setService(prev => ({ ...prev, [f.key]: v }))}
                        keyboardType={f.keyboardType}
                      />
                    </View>
                  </View>
                ))}
                <TouchableOpacity onPress={handleAssignService} disabled={assigning}>
                  <LinearGradient colors={[colors.gradStart, colors.gradEnd]} style={s.assignBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                    {assigning ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Assign Service</Text>}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}

            {services.length === 0 ? (
              <Text style={{ color: colors.text3, fontSize: 13, textAlign: 'center', paddingVertical: 16 }}>No services assigned yet</Text>
            ) : (
              services.map((sv, i) => (
                <View key={i} style={[s.serviceItem, { borderColor: colors.border }]}>
                  <View style={[s.serviceIcon, { backgroundColor: colors.primary + '15' }]}>
                    <Ionicons name="layers-outline" size={16} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '700', fontSize: 13, color: colors.text }}>{sv.name || sv.service_name}</Text>
                    {sv.price ? <Text style={{ fontSize: 12, color: colors.green, fontWeight: '600', marginTop: 2 }}>₹{sv.price}</Text> : null}
                    {sv.duration ? <Text style={{ fontSize: 11, color: colors.text3, marginTop: 1 }}>Renews: {sv.duration}</Text> : null}
                  </View>
                </View>
              ))
            )}
          </View>
          <View style={[s.card, { borderColor: colors.border }]}>

            <Text style={[s.cardTitle, { color: colors.text }]}>
              Invoice Summary
            </Text>

            {/* TOTAL SERVICES */}
            <View style={s.invoiceRow}>
              <Text style={[s.invoiceLabel, { color: colors.text2 }]}>
                Total Services
              </Text>
              <Text style={[s.invoiceValue, { color: colors.text }]}>
                {services.length}
              </Text>
            </View>

            {/* TOTAL AMOUNT */}
            <View style={s.invoiceRow}>
              <Text style={[s.invoiceLabel, { color: colors.text2 }]}>
                Total Amount
              </Text>
              <Text style={[s.invoiceValue, { color: colors.greenText }]}>
                ₹{totalAmount}
              </Text>
            </View>

            {/* GENERATE BUTTON */}
            <TouchableOpacity
              style={[s.invoiceBtn, { backgroundColor: colors.primary }]}
              onPress={handleGenerateInvoice}
            >
              <Ionicons name="document-text-outline" size={18} color="#fff" />
              <Text style={s.invoiceBtnText}>Generate Invoice</Text>
            </TouchableOpacity>

          </View>
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = (c) => StyleSheet.create({
  hero: { paddingTop: 54, paddingBottom: 36, alignItems: 'center' },
  backBtn: { position: 'absolute', top: 16, left: 16, padding: 8, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12 },
  avatarWrap: { marginBottom: 12 },
  avatar: { width: 72, height: 72, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'rgba(255,255,255,0.4)' },
  avatarTxt: { fontSize: 26, fontWeight: '800', color: '#fff' },
  name: { fontSize: 22, fontWeight: '800', color: '#fff' },
  company: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  card: { backgroundColor: c.card, borderRadius: 16, padding: 16, borderWidth: 1.5, marginBottom: 14 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '800' },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: c.border },
  infoIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  infoLabel: { fontSize: 11, marginBottom: 2 },
  infoVal: { fontSize: 13, fontWeight: '600' },
  assignBox: { borderWidth: 1.5, borderRadius: 12, padding: 14, marginTop: 12, marginBottom: 8 },
  fieldWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12 },
  assignBtn: { padding: 12, borderRadius: 10, alignItems: 'center', marginTop: 4 },
  serviceItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: 1, marginTop: 8 },
  serviceIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  invoiceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12
  },

  invoiceLabel: {
    fontSize: 13,
  },

  invoiceValue: {
    fontSize: 14,
    fontWeight: '700'
  },

  invoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 16
  },

  invoiceBtnText: {
    color: '#fff',
    fontWeight: '700'
  },
});
