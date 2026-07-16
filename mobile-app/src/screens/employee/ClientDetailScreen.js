import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator, TextInput, Modal, Switch, Share } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useTheme } from '../../context/ThemeContext';
import { EmployeeAPI } from '../../services/employee.api';
import ScreenWrapper from '../../components/ScreenWrapper';
import { Picker } from '@react-native-picker/picker';

const PROPOSAL_STATUS_COLOR = {
  DRAFT: '#94A3B8', SENT: '#3B82F6', VIEWED: '#A855F7',
  ACCEPTED: '#22C55E', REJECTED: '#EF4444', EXPIRED: '#64748B',
};
const INVOICE_STATUS_COLOR = {
  PENDING: '#F59E0B', PARTIAL: '#3B82F6', PAID: '#22C55E', OVERDUE: '#EF4444',
};

export default function ClientDetailScreen({ route, navigation }) {
  const { colors } = useTheme();
  const { client: clientParam } = route.params;
  const [client, setClient] = useState(clientParam);
  const [showAssign, setShowAssign] = useState(false);
  const [service, setService] = useState({ service_name: '', price: '', duration: '' });
  const [assigning, setAssigning] = useState(false);
  const [packages, setPackages] = useState([]);
  const [selectedPackage, setSelectedPackage] = useState(null);

  const [proposals, setProposals] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [openingLinkId, setOpeningLinkId] = useState(null);

  const services = client.services || client.assigned_services || [];
  const initials = client.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??';

  useEffect(() => {
    fetchPackages();
    fetchDetail();
    fetchProposals();
    fetchInvoices();
    fetchPayments();
  }, []);

  // The Clients list only passes basic fields — pull the full record
  // (services, address, visits) from the detail endpoint.
  const fetchDetail = async () => {
    try {
      const res = await EmployeeAPI.getClientById(clientParam.id);
      const full = res.data?.data;
      if (full) setClient(prev => ({ ...prev, ...full }));
    } catch (e) {
      console.log('Client detail error:', e);
    }
  };

  const fetchPackages = async () => {
    try {
      const res = await EmployeeAPI.getPackages();
      setPackages(res.data?.data || []);
    } catch (e) {
      console.log(e);
    }
  };

  const fetchProposals = async () => {
    try {
      const res = await EmployeeAPI.getProposals(clientParam.id);
      setProposals(res.data?.data || []);
    } catch (e) { console.log(e); }
  };

  const fetchInvoices = async () => {
    try {
      const res = await EmployeeAPI.getInvoices(clientParam.id);
      setInvoices(res.data?.data || []);
    } catch (e) { console.log(e); }
  };

  // Open the proposal in the browser — public, no-login link
  // (Proposal.shareToken), same pattern as invoice/receipt below.
  const openProposalLink = async (proposal) => {
    setOpeningLinkId(`prop-${proposal.id}`);
    try {
      const res = await EmployeeAPI.getProposalShareLink(proposal.id);
      const url = res.data?.data?.url;
      if (url) await Linking.openURL(url);
      else Alert.alert('Error', 'Could not get proposal link');
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not open proposal link');
    } finally {
      setOpeningLinkId(null);
    }
  };

  // Open the invoice in the browser — a public, no-login link (Invoice.shareToken),
  // generated on first request.
  const openInvoiceLink = async (inv) => {
    setOpeningLinkId(`inv-${inv.id}`);
    try {
      const res = await EmployeeAPI.getInvoiceShareLink(inv.id);
      const url = res.data?.data?.url;
      if (url) await Linking.openURL(url);
      else Alert.alert('Error', 'Could not get invoice link');
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not open invoice link');
    } finally {
      setOpeningLinkId(null);
    }
  };

  // Open a payment's receipt in the browser — public, no-login link
  // (Payment.receiptToken), same pattern as the invoice link above.
  const openReceiptLink = async (payment) => {
    // mobile/payments now sends a receipt_url with every payment — in that
    // open it directly, otherwise fall back to requesting the link the old way.
    if (payment?.receipt_url) {
      Linking.openURL(payment.receipt_url).catch(() => Alert.alert('Error', 'Could not open receipt'));
      return;
    }
    setOpeningLinkId(`pay-${payment.id}`);
    try {
      const res = await EmployeeAPI.getPaymentReceiptLink(payment.id);
      const url = res.data?.data?.url;
      if (url) await Linking.openURL(url);
      else Alert.alert('Error', 'Could not get receipt link');
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not open receipt link');
    } finally {
      setOpeningLinkId(null);
    }
  };

  const fetchPayments = async () => {
    try {
      const res = await EmployeeAPI.getPayments(clientParam.id);
      setPayments(res.data?.data || []);
    } catch (e) { console.log(e); }
  };

  const handleAssignService = async () => {
    if (!selectedPackage) { Alert.alert('Error', 'Please select a package'); return; }
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
      setSelectedPackage(null);
      fetchDetail();
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to assign service');
    } finally {
      setAssigning(false);
    }
  };
  const assignedPackageIds = services.map(s => s.serviceName || s.name || s.id);
  const totalAmount = services.reduce((sum, s) => {
    return sum + (Number(s.amount ?? s.price) || 0);
  }, 0);

  const s = styles(colors);

  // ── Shared "pick items from services" state used by both Proposal & Invoice builders ──
  const buildDefaultItems = () => services.map(sv => ({
    checked: false,
    service_name: sv.serviceName || sv.name || sv.service_name || 'Service',
    quantity: '1',
    unit_price: String(sv.amount ?? sv.price ?? 0),
  }));

  // Proposal builder
  const [showProposal, setShowProposal] = useState(false);
  const [propTitle, setPropTitle] = useState('');
  const [propItems, setPropItems] = useState([]);
  const [propDiscount, setPropDiscount] = useState('0');
  const [propGst, setPropGst] = useState(false);
  const [propValidUntil, setPropValidUntil] = useState('');
  const [savingProposal, setSavingProposal] = useState(false);

  const openProposalModal = () => {
    setPropTitle(`Proposal for ${client.name}`);
    setPropItems(buildDefaultItems());
    setPropDiscount('0');
    setPropGst(false);
    setPropValidUntil('');
    setShowProposal(true);
  };

  const toggleItem = (list, setList, idx) => {
    setList(list.map((it, i) => i === idx ? { ...it, checked: !it.checked } : it));
  };
  const updateItemField = (list, setList, idx, field, val) => {
    setList(list.map((it, i) => i === idx ? { ...it, [field]: val } : it));
  };
  const selectedItemsOf = (list) => list.filter(it => it.checked);
  const itemsTotalOf = (list) => selectedItemsOf(list).reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0);

  const submitProposal = async () => {
    const chosen = selectedItemsOf(propItems);
    if (!propTitle.trim()) { Alert.alert('Error', 'Title is required'); return; }
    if (chosen.length === 0) { Alert.alert('Error', 'Select at least one service'); return; }
    setSavingProposal(true);
    try {
      const res = await EmployeeAPI.createProposal({
        clientId: client.id,
        title: propTitle,
        discount: parseFloat(propDiscount) || 0,
        discountType: 'FIXED',
        gstApplicable: propGst,
        gstRate: 18,
        validUntil: propValidUntil || undefined,
        items: chosen.map(it => ({
          serviceName: it.service_name,
          description: it.service_name,
          quantity: Number(it.quantity) || 1,
          unitPrice: Number(it.unit_price) || 0,
        })),
      });
      setShowProposal(false);
      Alert.alert('Proposal Created', `${res.data?.data?.proposal_number || ''} saved successfully.`);
      fetchProposals();
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to create proposal');
    } finally { setSavingProposal(false); }
  };

  // Invoice builder
  const [showInvoice, setShowInvoice] = useState(false);
  const [invItems, setInvItems] = useState([]);
  const [invDiscount, setInvDiscount] = useState('0');
  const [invGst, setInvGst] = useState(false);
  const [invDueDate, setInvDueDate] = useState('');
  const [savingInvoice, setSavingInvoice] = useState(false);

  const openInvoiceModal = () => {
    if (services.length === 0) { Alert.alert('No services', 'Assign a service to this client first.'); return; }
    setInvItems(buildDefaultItems());
    setInvDiscount('0');
    setInvGst(false);
    setInvDueDate('');
    setShowInvoice(true);
  };

  const submitInvoice = async () => {
    const chosen = selectedItemsOf(invItems);
    if (chosen.length === 0) { Alert.alert('Error', 'Select at least one service'); return; }
    setSavingInvoice(true);
    try {
      const res = await EmployeeAPI.createInvoice({
        clientId: client.id,
        discount: parseFloat(invDiscount) || 0,
        discountType: 'FIXED',
        gstApplicable: invGst,
        gstRate: 18,
        dueDate: invDueDate || undefined,
        items: chosen.map(it => ({
          serviceName: it.service_name,
          description: it.service_name,
          quantity: Number(it.quantity) || 1,
          unitPrice: Number(it.unit_price) || 0,
        })),
      });
      setShowInvoice(false);
      Alert.alert('Invoice Generated', `${res.data?.data?.invoice_number || ''} — ₹${res.data?.data?.total_amount || ''}`);
      fetchInvoices();
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to generate invoice');
    } finally { setSavingInvoice(false); }
  };

  const PAYMENT_METHODS = ['UPI', 'CASH', 'BANK_TRANSFER', 'CHEQUE', 'CARD', 'ONLINE_GATEWAY'];
  const dueInvoices = invoices.filter(inv => (inv.due_amount || 0) > 0);

  // Collect Payment builder
  const [showPayment, setShowPayment] = useState(false);
  const [payInvoiceId, setPayInvoiceId] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('UPI');
  const [payReference, setPayReference] = useState('');
  const [payDate, setPayDate] = useState('');
  const [payNextDueDate, setPayNextDueDate] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);

  const openPaymentModal = () => {
    if (dueInvoices.length === 0) { Alert.alert('No due invoice', 'This client has no pending invoice to collect against.'); return; }
    const first = dueInvoices[0];
    setPayInvoiceId(first.id);
    setPayAmount(String(first.due_amount || ''));
    setPayMethod('UPI');
    setPayReference('');
    setPayDate(new Date().toISOString().slice(0, 10));
    setPayNextDueDate('');
    setPayNotes('');
    setShowPayment(true);
  };

  const submitPayment = async () => {
    if (!payInvoiceId) { Alert.alert('Error', 'Select an invoice'); return; }
    if (!payAmount || Number(payAmount) <= 0) { Alert.alert('Error', 'Enter a valid amount'); return; }
    setSavingPayment(true);
    try {
      const res = await EmployeeAPI.collectPayment({
        invoiceId: payInvoiceId,
        amount: parseFloat(payAmount),
        method: payMethod,
        reference: payReference || undefined,
        paidAt: payDate || undefined,
        nextDueDate: payNextDueDate || undefined,
        notes: payNotes || undefined,
      });
      setShowPayment(false);
      const d = res.data?.data || {};
      const partial = d.invoice_status === 'PARTIAL';
      fetchPayments();
      fetchInvoices();

      // Receipt is instant — even for a PARTIAL payment. This same link is visible
      // to the client in their app/portal, and to admin in Daily Collection.
      Alert.alert(
        'Payment Collected',
        `₹${d.amount || payAmount} recorded.` +
          (partial ? `\nBalance due: ₹${d.invoice_due ?? 0}` : '\nInvoice fully paid.'),
        d.receipt_url
          ? [
              { text: 'Done', style: 'cancel' },
              { text: 'View Receipt', onPress: () => Linking.openURL(d.receipt_url).catch(() => {}) },
              { text: 'Share', onPress: () => Share.share({ message: `Payment receipt: ${d.receipt_url}` }).catch(() => {}) },
            ]
          : [{ text: 'OK' }]
      );
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to collect payment');
    } finally { setSavingPayment(false); }
  };

  const renderItemPicker = (list, setList) => (
    <View style={{ marginBottom: 12 }}>
      <Text style={s.fieldLabel}>SELECT SERVICES *</Text>
      {list.length === 0 ? (
        <Text style={{ fontSize: 12, color: colors.text3, paddingVertical: 8 }}>No services assigned to this client yet.</Text>
      ) : list.map((it, idx) => (
        <View key={idx} style={[s.itemRow, { borderColor: it.checked ? colors.primary : colors.border, backgroundColor: it.checked ? colors.primary + '10' : colors.bg2 }]}>
          <TouchableOpacity onPress={() => toggleItem(list, setList, idx)} style={s.checkbox}>
            <Ionicons name={it.checked ? 'checkbox' : 'square-outline'} size={20} color={it.checked ? colors.primary : colors.text3} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>{it.service_name}</Text>
            {it.checked && (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                <TextInput
                  style={[s.miniInput, { color: colors.text, borderColor: colors.border }]}
                  value={it.quantity}
                  onChangeText={(v) => updateItemField(list, setList, idx, 'quantity', v)}
                  keyboardType="numeric"
                  placeholder="Qty"
                />
                <TextInput
                  style={[s.miniInput, { flex: 1, color: colors.text, borderColor: colors.border }]}
                  value={it.unit_price}
                  onChangeText={(v) => updateItemField(list, setList, idx, 'unit_price', v)}
                  keyboardType="decimal-pad"
                  placeholder="Price ₹"
                />
              </View>
            )}
          </View>
        </View>
      ))}
    </View>
  );

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
              services.map((sv, i) => {
                const expiryDate = sv.expiryDate ? new Date(sv.expiryDate) : null;
                const now = new Date();
                const isExpired = expiryDate && expiryDate < now;
                const daysLeft = expiryDate ? Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24)) : null;
                const isExpiringSoon = !isExpired && daysLeft !== null && daysLeft <= 30;
                const expiryColor = isExpired ? '#EF4444' : isExpiringSoon ? '#F59E0B' : colors.text3;
                const expiryLabel = expiryDate
                  ? isExpired
                    ? `Expired ${Math.abs(daysLeft)}d ago`
                    : isExpiringSoon
                      ? `Expires: ${expiryDate.toLocaleDateString('en-IN')} (${daysLeft}d left)`
                      : `Expires: ${expiryDate.toLocaleDateString('en-IN')}`
                  : null;
                return (
                  <View key={i} style={[s.serviceItem, { borderColor: colors.border }, (isExpired || isExpiringSoon) && { backgroundColor: expiryColor + '10', borderRadius: 10, paddingHorizontal: 8 }]}>
                    <View style={[s.serviceIcon, { backgroundColor: colors.primary + '15' }]}>
                      <Ionicons name="layers-outline" size={16} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '700', fontSize: 13, color: colors.text }}>{sv.serviceName || sv.name || sv.service_name}</Text>
                      {(sv.amount ?? sv.price) != null ? <Text style={{ fontSize: 12, color: colors.green, fontWeight: '600', marginTop: 2 }}>₹{sv.amount ?? sv.price}</Text> : null}
                      {expiryLabel ? <Text style={{ fontSize: 11, color: expiryColor, fontWeight: (isExpired || isExpiringSoon) ? '700' : '400', marginTop: 1 }}>{expiryLabel}</Text> : null}
                    </View>
                  </View>
                );
              })
            )}
          </View>

          {/* Proposals */}
          <View style={[s.card, { borderColor: colors.border }]}>
            <View style={s.cardHeader}>
              <Text style={[s.cardTitle, { color: colors.text }]}>Proposals ({proposals.length})</Text>
              <TouchableOpacity onPress={openProposalModal}>
                <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>+ Create</Text>
              </TouchableOpacity>
            </View>
            {proposals.length === 0 ? (
              <Text style={{ color: colors.text3, fontSize: 13, textAlign: 'center', paddingVertical: 16 }}>No proposals yet</Text>
            ) : proposals.map((p) => (
              <View key={p.id} style={[s.docRow, { borderColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', fontSize: 13, color: colors.text }}>{p.title}</Text>
                  <Text style={{ fontSize: 11, color: colors.text3, marginTop: 2 }}>{p.proposal_number}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>₹{p.final_amount}</Text>
                  <View style={[s.statusPill, { backgroundColor: (PROPOSAL_STATUS_COLOR[p.status] || '#94A3B8') + '20' }]}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: PROPOSAL_STATUS_COLOR[p.status] || '#94A3B8' }}>{p.status}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[s.dlIconBtn, { borderColor: colors.border }]}
                  disabled={openingLinkId === `prop-${p.id}`}
                  onPress={() => openProposalLink(p)}
                >
                  {openingLinkId === `prop-${p.id}` ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Ionicons name="open-outline" size={16} color={colors.primary} />
                  )}
                </TouchableOpacity>
              </View>
            ))}
          </View>

          {/* Invoices */}
          <View style={[s.card, { borderColor: colors.border }]}>
            <View style={s.cardHeader}>
              <Text style={[s.cardTitle, { color: colors.text }]}>Invoices ({invoices.length})</Text>
              <TouchableOpacity onPress={openInvoiceModal}>
                <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>+ Generate</Text>
              </TouchableOpacity>
            </View>
            {invoices.length === 0 ? (
              <Text style={{ color: colors.text3, fontSize: 13, textAlign: 'center', paddingVertical: 16 }}>No invoices yet</Text>
            ) : invoices.map((inv) => (
              <View key={inv.id} style={[s.docRow, { borderColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', fontSize: 13, color: colors.text }}>{inv.invoice_number}</Text>
                  {inv.due_amount > 0 ? (
                    <Text style={{ fontSize: 11, color: colors.text3, marginTop: 2 }}>Due: ₹{inv.due_amount}</Text>
                  ) : (
                    <Text style={{ fontSize: 11, color: colors.greenText, marginTop: 2 }}>Fully paid</Text>
                  )}
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>₹{inv.total_amount}</Text>
                  <View style={[s.statusPill, { backgroundColor: (INVOICE_STATUS_COLOR[inv.status] || '#94A3B8') + '20' }]}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: INVOICE_STATUS_COLOR[inv.status] || '#94A3B8' }}>{inv.status}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[s.dlIconBtn, { borderColor: colors.border }]}
                  disabled={openingLinkId === `inv-${inv.id}`}
                  onPress={() => openInvoiceLink(inv)}
                >
                  {openingLinkId === `inv-${inv.id}` ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Ionicons name="open-outline" size={16} color={colors.primary} />
                  )}
                </TouchableOpacity>
              </View>
            ))}
          </View>

          {/* Payments Received */}
          <View style={[s.card, { borderColor: colors.border }]}>
            <View style={s.cardHeader}>
              <Text style={[s.cardTitle, { color: colors.text }]}>Payments ({payments.length})</Text>
              <TouchableOpacity onPress={openPaymentModal} disabled={dueInvoices.length === 0}>
                <Text style={{ color: dueInvoices.length === 0 ? colors.text3 : colors.primary, fontWeight: '700', fontSize: 13 }}>+ Collect</Text>
              </TouchableOpacity>
            </View>
            {dueInvoices.length === 0 && payments.length === 0 ? (
              <Text style={{ fontSize: 11, color: colors.text3, marginTop: 4 }}>No pending invoice — generate one first to collect payment.</Text>
            ) : null}
            {payments.length === 0 ? (
              <Text style={{ color: colors.text3, fontSize: 13, textAlign: 'center', paddingVertical: 16 }}>No payments yet</Text>
            ) : payments.map((p) => (
              <View key={p.id} style={[s.docRow, { borderColor: colors.border }]}>
                <View style={[s.serviceIcon, { backgroundColor: '#22C55E15' }]}>
                  <Ionicons name="cash-outline" size={16} color="#22C55E" />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={{ fontWeight: '700', fontSize: 13, color: colors.text }}>
                    ₹{p.amount} <Text style={{ fontWeight: '400', color: colors.text2 }}>· {p.method?.replace('_', ' ')}</Text>
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.text3, marginTop: 2 }}>
                    Invoice {p.invoice_number} · {p.paid_at ? new Date(p.paid_at).toLocaleDateString('en-IN') : ''}
                    {p.reference ? ` · Ref: ${p.reference}` : ''}
                  </Text>
                </View>
                {p.source === 'CLIENT_PORTAL' ? (
                  <View style={[s.statusPill, { backgroundColor: '#3B82F620', marginRight: 6 }]}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#3B82F6' }}>Client Portal</Text>
                  </View>
                ) : null}
                <TouchableOpacity
                  style={[s.dlIconBtn, { borderColor: colors.border }]}
                  disabled={openingLinkId === `pay-${p.id}`}
                  onPress={() => openReceiptLink(p)}
                >
                  {openingLinkId === `pay-${p.id}` ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Ionicons name="receipt-outline" size={16} color={colors.primary} />
                  )}
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Create Proposal Modal */}
      <Modal visible={showProposal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowProposal(false)}>
        <View style={[s.modal, { backgroundColor: colors.bg, paddingTop: 40 }]}>
          <View style={s.modalHeader}>
            <Text style={[s.modalTitle, { color: colors.text }]}>Create Proposal</Text>
            <TouchableOpacity onPress={() => setShowProposal(false)}>
              <Ionicons name="close" size={24} color={colors.text2} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            <Text style={s.fieldLabel}>TITLE *</Text>
            <View style={[s.fieldWrap, { backgroundColor: colors.bg2, borderColor: colors.border, marginBottom: 16 }]}>
              <TextInput style={{ flex: 1, fontSize: 14, paddingVertical: 12, color: colors.text }} value={propTitle} onChangeText={setPropTitle} placeholderTextColor={colors.text3} />
            </View>

            {renderItemPicker(propItems, setPropItems)}

            <Text style={s.fieldLabel}>DISCOUNT (₹)</Text>
            <View style={[s.fieldWrap, { backgroundColor: colors.bg2, borderColor: colors.border, marginBottom: 16 }]}>
              <TextInput style={{ flex: 1, fontSize: 14, paddingVertical: 12, color: colors.text }} value={propDiscount} onChangeText={setPropDiscount} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.text3} />
            </View>

            <View style={s.switchRow}>
              <Text style={[s.fieldLabel, { marginBottom: 0 }]}>APPLY GST (18%)</Text>
              <Switch value={propGst} onValueChange={setPropGst} trackColor={{ true: colors.primary }} />
            </View>

            <Text style={[s.fieldLabel, { marginTop: 16 }]}>VALID UNTIL (YYYY-MM-DD)</Text>
            <View style={[s.fieldWrap, { backgroundColor: colors.bg2, borderColor: colors.border, marginBottom: 16 }]}>
              <TextInput style={{ flex: 1, fontSize: 14, paddingVertical: 12, color: colors.text }} value={propValidUntil} onChangeText={setPropValidUntil} placeholder="Optional" placeholderTextColor={colors.text3} />
            </View>

            <View style={[s.totalBox, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
              <Text style={{ fontSize: 12, color: colors.text2 }}>Estimated total</Text>
              <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>
                ₹{(Math.max(0, itemsTotalOf(propItems) - (parseFloat(propDiscount) || 0)) * (propGst ? 1.18 : 1)).toFixed(2)}
              </Text>
            </View>

            <TouchableOpacity onPress={submitProposal} disabled={savingProposal} style={{ marginTop: 20 }}>
              <LinearGradient colors={[colors.gradStart, colors.gradEnd]} style={s.submitBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                {savingProposal ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>Save Proposal</Text>}
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Generate Invoice Modal */}
      <Modal visible={showInvoice} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowInvoice(false)}>
        <View style={[s.modal, { backgroundColor: colors.bg, paddingTop: 40 }]}>
          <View style={s.modalHeader}>
            <Text style={[s.modalTitle, { color: colors.text }]}>Generate Invoice</Text>
            <TouchableOpacity onPress={() => setShowInvoice(false)}>
              <Ionicons name="close" size={24} color={colors.text2} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            {renderItemPicker(invItems, setInvItems)}

            <Text style={s.fieldLabel}>DISCOUNT (₹)</Text>
            <View style={[s.fieldWrap, { backgroundColor: colors.bg2, borderColor: colors.border, marginBottom: 16 }]}>
              <TextInput style={{ flex: 1, fontSize: 14, paddingVertical: 12, color: colors.text }} value={invDiscount} onChangeText={setInvDiscount} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.text3} />
            </View>

            <View style={s.switchRow}>
              <Text style={[s.fieldLabel, { marginBottom: 0 }]}>APPLY GST (18%)</Text>
              <Switch value={invGst} onValueChange={setInvGst} trackColor={{ true: colors.primary }} />
            </View>

            <Text style={[s.fieldLabel, { marginTop: 16 }]}>DUE DATE (YYYY-MM-DD)</Text>
            <View style={[s.fieldWrap, { backgroundColor: colors.bg2, borderColor: colors.border, marginBottom: 16 }]}>
              <TextInput style={{ flex: 1, fontSize: 14, paddingVertical: 12, color: colors.text }} value={invDueDate} onChangeText={setInvDueDate} placeholder="Optional" placeholderTextColor={colors.text3} />
            </View>

            <View style={[s.totalBox, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
              <Text style={{ fontSize: 12, color: colors.text2 }}>Estimated total</Text>
              <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>
                ₹{(Math.max(0, itemsTotalOf(invItems) - (parseFloat(invDiscount) || 0)) * (invGst ? 1.18 : 1)).toFixed(2)}
              </Text>
            </View>

            <TouchableOpacity onPress={submitInvoice} disabled={savingInvoice} style={{ marginTop: 20, backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}>
              {savingInvoice ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>Generate Invoice</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Collect Payment Modal */}
      <Modal visible={showPayment} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowPayment(false)}>
        <View style={[s.modal, { backgroundColor: colors.bg, paddingTop: 40 }]}>
          <View style={s.modalHeader}>
            <Text style={[s.modalTitle, { color: colors.text }]}>Collect Payment</Text>
            <TouchableOpacity onPress={() => setShowPayment(false)}>
              <Ionicons name="close" size={24} color={colors.text2} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            <Text style={s.fieldLabel}>INVOICE *</Text>
            <View style={[s.fieldWrap, { backgroundColor: colors.bg2, borderColor: colors.border, marginBottom: 16, paddingHorizontal: 0 }]}>
              <Picker
                selectedValue={payInvoiceId}
                onValueChange={(val) => {
                  setPayInvoiceId(val);
                  const inv = dueInvoices.find(i => i.id === val);
                  if (inv) setPayAmount(String(inv.due_amount || ''));
                }}
                style={{ flex: 1, color: colors.text }}
              >
                {dueInvoices.map(inv => (
                  <Picker.Item key={inv.id} label={`${inv.invoice_number} (Due: ₹${inv.due_amount})`} value={inv.id} />
                ))}
              </Picker>
            </View>

            <Text style={s.fieldLabel}>AMOUNT *</Text>
            <View style={[s.fieldWrap, { backgroundColor: colors.bg2, borderColor: colors.border, marginBottom: 16 }]}>
              <TextInput style={{ flex: 1, fontSize: 14, paddingVertical: 12, color: colors.text }} value={payAmount} onChangeText={setPayAmount} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.text3} />
            </View>

            <Text style={s.fieldLabel}>METHOD</Text>
            <View style={[s.fieldWrap, { backgroundColor: colors.bg2, borderColor: colors.border, marginBottom: 16, paddingHorizontal: 0 }]}>
              <Picker selectedValue={payMethod} onValueChange={setPayMethod} style={{ flex: 1, color: colors.text }}>
                {PAYMENT_METHODS.map(m => (
                  <Picker.Item key={m} label={m.replace('_', ' ')} value={m} />
                ))}
              </Picker>
            </View>

            <Text style={s.fieldLabel}>REFERENCE (UPI/txn ref)</Text>
            <View style={[s.fieldWrap, { backgroundColor: colors.bg2, borderColor: colors.border, marginBottom: 16 }]}>
              <TextInput style={{ flex: 1, fontSize: 14, paddingVertical: 12, color: colors.text }} value={payReference} onChangeText={setPayReference} placeholder="Optional" placeholderTextColor={colors.text3} />
            </View>

            <Text style={s.fieldLabel}>DATE (YYYY-MM-DD)</Text>
            <View style={[s.fieldWrap, { backgroundColor: colors.bg2, borderColor: colors.border, marginBottom: 16 }]}>
              <TextInput style={{ flex: 1, fontSize: 14, paddingVertical: 12, color: colors.text }} value={payDate} onChangeText={setPayDate} placeholderTextColor={colors.text3} />
            </View>

            <Text style={s.fieldLabel}>BALANCE DUE DATE (part payment, optional)</Text>
            <View style={[s.fieldWrap, { backgroundColor: colors.bg2, borderColor: colors.border, marginBottom: 16 }]}>
              <TextInput style={{ flex: 1, fontSize: 14, paddingVertical: 12, color: colors.text }} value={payNextDueDate} onChangeText={setPayNextDueDate} placeholder="Optional" placeholderTextColor={colors.text3} />
            </View>

            <Text style={s.fieldLabel}>NOTES</Text>
            <View style={[s.fieldWrap, { backgroundColor: colors.bg2, borderColor: colors.border, marginBottom: 16 }]}>
              <TextInput style={{ flex: 1, fontSize: 14, paddingVertical: 12, color: colors.text }} value={payNotes} onChangeText={setPayNotes} placeholder="Optional" placeholderTextColor={colors.text3} />
            </View>

            <TouchableOpacity onPress={submitPayment} disabled={savingPayment} style={{ marginTop: 4, backgroundColor: '#22C55E', borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}>
              {savingPayment ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>Collect Payment</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
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
  docRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 10, borderTopWidth: 1, marginTop: 8 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginTop: 4 },
  dlIconBtn: { width: 32, height: 32, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  modal: { flex: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: '#888', marginBottom: 6 },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderWidth: 1.5, borderRadius: 10, padding: 10, marginBottom: 8 },
  checkbox: { paddingTop: 2 },
  miniInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, fontSize: 13, width: 70 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  totalBox: { borderWidth: 1.5, borderRadius: 12, padding: 14, marginTop: 4 },
  submitBtn: { padding: 14, borderRadius: 12, alignItems: 'center' },
});