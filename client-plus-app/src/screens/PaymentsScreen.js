import { useEffect, useState } from 'react';
import { AxiosInstance } from '../lib/Axios.instance';
import { ClientAPI } from '../services/client.api';
import { shapeInvoice, fmtMoney } from '../lib/shape';
import * as Linking from 'expo-linking';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import ScreenWrapper from '../components/ScreenWrapper';
import RazorpayCheckout from 'react-native-razorpay';

// Matches web's statusPill() in client-portal/page.tsx
const INVOICE_STATUS = {
  paid: { bg: 'rgba(34,197,94,0.1)', color: '#16A34A', label: 'Paid' },
  partial: { bg: 'rgba(245,158,11,0.1)', color: '#D97706', label: 'Partial' },
  pending: { bg: 'rgba(245,158,11,0.1)', color: '#D97706', label: 'Pending' },
  overdue: { bg: 'rgba(239,68,68,0.1)', color: '#DC2626', label: 'Overdue' },
};
function InvoiceStatusBadge({ status }) {
  const m = INVOICE_STATUS[status] || INVOICE_STATUS.pending;
  return (
    <View style={{ backgroundColor: m.bg, borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: m.color }} />
      <Text style={{ color: m.color, fontSize: 11, fontWeight: '700' }}>{m.label}</Text>
    </View>
  );
}

export default function PaymentsScreen() {
  const { colors } = useTheme();
  const s = styles(colors);
  const [invoices, setInvoices] = useState([]);
  const [summary, setSummary] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      const res = await AxiosInstance.get('/client-portal/invoices');
      const raw = res?.data?.data || [];

      setInvoices(raw.map(shapeInvoice));
      setSummary({
        totalPaid: fmtMoney(raw.reduce((s, i) => s + (i.paidAmount || 0), 0)),
        pending: fmtMoney(raw.reduce((s, i) => s + (i.dueAmount || 0), 0)),
        count: raw.length,
      });

    } catch (e) {
      console.log('Invoice Error:', e);
    } finally {
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchInvoices();
  };

  // console.log("summary: ", summary);
  // console.log("invoices: ", invoices);

  const handlePayment = async (inv) => {
    try {
      // 1. create order
      const res = await AxiosInstance.post('/client-portal/create-order', {
        invoice_id: inv.id
      });

      const order = res.data;

      // 2. open razorpay
      const options = {
        key: order.key_id,
        amount: order.amount,
        currency: order.currency || 'INR',
        name: 'HBS',
        description: inv.invoiceNumber || inv.service || 'Invoice payment',
        order_id: order.order_id,
        prefill: {
          email: '',
          contact: ''
        },
        theme: { color: '#E50914' }
      };

      RazorpayCheckout.open(options)
        .then(async (data) => {
          // 3. verify
          await AxiosInstance.post('/client-portal/verify-payment', {
            razorpay_order_id: data.razorpay_order_id,
            razorpay_payment_id: data.razorpay_payment_id,
            razorpay_signature: data.razorpay_signature,
            invoice_id: inv.id
          });

          Alert.alert('Success', 'Payment successful');

          fetchInvoices(); // refresh
        })
        .catch((error) => {
          console.log(error);
          Alert.alert('Payment Failed');
        });

    } catch (e) {
      console.log(e);
    }
  };

  // Web downloads a PDF generated client-side from full invoice + company info
  // (see src/lib/invoicePdf.ts). There's no server-side invoice file, so we
  // build an equivalent receipt here and let the user save/share it.
  const downloadReceipt = async (inv) => {
    setDownloadingId(inv.id);
    try {
      const [invRes, companyRes] = await Promise.all([
        ClientAPI.getInvoiceById(inv.id),
        ClientAPI.getCompanyInfo().catch(() => null),
      ]);
      const full = invRes?.data?.data;
      const company = companyRes?.data?.data || {};
      if (!full) { Alert.alert('Error', 'Could not load invoice details'); return; }

      const itemsRows = (full.items || []).map(it => `
        <tr>
          <td>${it.description || it.name || ''}</td>
          <td style="text-align:right">${it.quantity ?? 1}</td>
          <td style="text-align:right">${fmtMoney(it.rate ?? it.amount ?? 0)}</td>
          <td style="text-align:right">${fmtMoney(it.amount ?? 0)}</td>
        </tr>`).join('');

      const html = `
        <html><head><meta charset="utf-8" />
        <style>
          body { font-family: -apple-system, Helvetica, Arial, sans-serif; padding: 24px; color: #1f2937; }
          h1 { font-size: 20px; margin-bottom: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th, td { padding: 8px; border-bottom: 1px solid #e5e7eb; font-size: 13px; text-align: left; }
          .totals td { border: none; }
          .muted { color: #6b7280; font-size: 12px; }
        </style></head>
        <body>
          <h1>${company.companyName || 'Invoice Receipt'}</h1>
          <p class="muted">${company.address || ''}</p>
          <hr />
          <p><b>Invoice:</b> ${full.invoiceNumber} &nbsp; <b>Status:</b> ${full.status}</p>
          <p><b>Bill To:</b> ${full.client?.companyName || full.client?.clientName || ''}</p>
          <table>
            <thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
            <tbody>${itemsRows}</tbody>
          </table>
          <table class="totals">
            <tr><td><b>Total</b></td><td style="text-align:right">${fmtMoney(full.totalAmount)}</td></tr>
            <tr><td><b>Paid</b></td><td style="text-align:right">${fmtMoney(full.paidAmount)}</td></tr>
            <tr><td><b>Due</b></td><td style="text-align:right">${fmtMoney(full.dueAmount)}</td></tr>
          </table>
        </body></html>`;

      const fileUri = `${FileSystem.documentDirectory}receipt-${full.invoiceNumber}.html`;
      await FileSystem.writeAsStringAsync(fileUri, html, { encoding: FileSystem.EncodingType.UTF8 });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: 'text/html', dialogTitle: `Receipt ${full.invoiceNumber}` });
      } else {
        Alert.alert('Saved', `Receipt saved to ${fileUri}`);
      }
    } catch (e) {
      console.log('Receipt download error:', e);
      Alert.alert('Error', 'Could not generate receipt');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <ScreenWrapper isScrollable={false}>
      <View style={s.container}>
        <View style={s.header}>
          <Text style={s.title}>Payments</Text>
          <Text style={s.sub}>Transaction history</Text>
        </View>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 20, paddingBottom: 20 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
        >
          {/* Summary */}
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
            {[
              { val: summary?.totalPaid || '₹0', label: 'Total Paid', color: colors.green },
              { val: summary?.pending || '₹0', label: 'Pending', color: colors.yellow },
              { val: summary?.count || 0, label: 'Invoices', color: colors.text },
            ].map((item, i) => (
              <View key={i} style={s.payStat}>
                <Text style={[s.payVal, { color: item.color }]}>{item.val}</Text>
                <Text style={s.payLabel}>{item.label}</Text>
              </View>
            ))}
          </View>

          <Text style={s.sectionTitle}>Recent Invoices</Text>
          {invoices.map(inv => {
            const isPaidUp = inv.dueAmount <= 0; // PAID, or nothing left to pay
            return (
              <View key={inv.id} style={s.invoiceCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={[s.invoiceIcon, { backgroundColor: isPaidUp ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)' }]}>
                    <Ionicons name="document-text-outline" size={20} color={isPaidUp ? '#16A34A' : '#D97706'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '700', fontSize: 14, color: colors.text }}>{inv.service}</Text>
                    <Text style={{ fontSize: 11, color: colors.text2, marginTop: 2 }}>{inv.date}{inv.dueDate ? ` · Due date ${inv.dueDate}` : ''}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontWeight: '800', fontSize: 16, color: colors.text }}>{inv.amount}</Text>
                    {inv.paidAmount > 0 && <Text style={{ fontSize: 11, color: '#16A34A', marginTop: 2 }}>Paid {inv.paidAmountFmt}</Text>}
                  </View>
                </View>

                {/* Due amount row — mirrors web's "Due ₹X" line */}
                {inv.dueAmount > 0 && (
                  <Text style={{ fontSize: 12, color: '#DC2626', fontWeight: '600', marginTop: 8 }}>Due {inv.dueAmountFmt}</Text>
                )}

                <View style={[s.invoiceFooter]}>
                  <InvoiceStatusBadge status={inv.status} />
                  <TouchableOpacity
                    disabled={downloadingId === inv.id}
                    style={[
                      s.dlBtn,
                      { backgroundColor: isPaidUp ? 'rgba(34,197,94,0.08)' : 'rgba(245,158,11,0.1)' }
                    ]}
                    onPress={() => {
                      if (isPaidUp) {
                        downloadReceipt(inv);
                      } else {
                        handlePayment(inv);
                      }
                    }}
                  >
                    <Text
                      style={{
                        color: isPaidUp ? '#16A34A' : '#D97706',
                        fontWeight: '700',
                        fontSize: 12
                      }}
                    >
                      {isPaidUp ? (downloadingId === inv.id ? 'Preparing...' : '⬇ Receipt') : `Pay ${inv.dueAmountFmt}`}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>
      </View>
    </ScreenWrapper>
  );
}

const styles = (c) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  header: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12 },
  title: { fontSize: 22, fontWeight: '800', color: c.text },
  sub: { fontSize: 13, color: c.text2, marginTop: 2 },
  payStat: { flex: 1, backgroundColor: c.card2, borderWidth: 1.5, borderColor: c.border, borderRadius: 12, padding: 14, alignItems: 'center' },
  payVal: { fontSize: 20, fontWeight: '800' },
  payLabel: { fontSize: 11, color: c.text2, marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: c.text, marginBottom: 12 },
  invoiceCard: { backgroundColor: c.card, borderWidth: 1.5, borderColor: c.border, borderRadius: 12, padding: 16, marginBottom: 10 },
  invoiceIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  invoiceFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1,borderTopColor: c.border },
  dlBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
});