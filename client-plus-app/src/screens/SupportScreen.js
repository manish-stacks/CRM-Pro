import { useEffect, useState } from 'react';
import { AxiosInstance } from '../lib/Axios.instance';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, LayoutAnimation, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { TICKETS } from '../constants/data';
import { StatusChip } from './HomeScreen';
import { Modal, TextInput } from 'react-native';
import ScreenWrapper from '../components/ScreenWrapper';
import { useAuth } from '../context/AuthContext';

const FAQ = [
  { q: 'How often are SEO reports sent?', a: 'SEO reports are sent monthly on the 1st of each month via email. You can also access them anytime from the Service Detail screen.' },
  { q: 'How do I renew a service?', a: 'Go to the Services screen, click on the expiring service, and tap the Renew button. Our team will activate the renewal within 24 hours.' },
  { q: 'Who is my account manager?', a: "Your assigned account manager's info is available inside each service detail card. You can reach them directly via WhatsApp or email." },
  { q: 'Can I upgrade my current plan?', a: 'Yes! Visit the Proposals section or raise a support ticket. Our team will send you a custom upgrade proposal within 1 business day.' },
];

const ticketStatusMap = {
  inprogress: 'expiring',
  resolved: 'active',
  open: 'critical',
};

export default function SupportScreen() {
  const { colors } = useTheme();
  const s = styles(colors);
  const [openFaq, setOpenFaq] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tickets, setTickets] = useState([]);
  const [user, setUser] = useState(null);
  const { userData } = useAuth();

  useEffect(() => {
    fetchTickets();
    loadUser();
  }, []);

  const loadUser = async () => {
    const data = await userData();
    setUser(data);
  };

  const fetchTickets = async () => {
    try {
      const res = await AxiosInstance.get('/client-portal/tickets');
      setTickets(res?.data?.tickets || []);
    } catch (e) {
      console.log('Ticket Error:', e);
    }
  };

  const toggleFaq = (i) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenFaq(openFaq === i ? null : i);
  };

  const handleTicketSubmit = async () => {
    if (!title || !description) {
      Alert.alert('Please fill all fields');
      return;
    }

    try {
      await AxiosInstance.post('/client-portal/tickets', {
        userId: user.id,
        title,
        description
      });

      setModalVisible(false);
      setTitle('');
      setDescription('');

      fetchTickets();

      Alert.alert('Ticket submitted 🚀');
    } catch (e) {
      console.log(e);
      Alert.alert('Something went wrong');
    }
  };

  return (
    <ScreenWrapper>
      <View style={s.container}>
        <View style={s.header}><Text style={s.title}>Support</Text><Text style={s.sub}>We're here to help</Text></View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 20 }}>
          {/* New Ticket button */}
          <TouchableOpacity onPress={() => setModalVisible(true)}>
            <LinearGradient colors={[colors.gradStart, colors.gradEnd]} style={s.newTicketBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Text style={{ color: 'white', fontWeight: '800', fontSize: 16 }}>+ Raise New Ticket</Text>
            </LinearGradient>
          </TouchableOpacity>

          <Text style={[s.sectionTitle, { marginTop: 4 }]}>My Tickets</Text>
          {
            tickets.length > 0 ? tickets.map(t => (
              <View key={t.id} style={s.ticketCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ fontWeight: '700', fontSize: 14, color: colors.text, flex: 1, marginRight: 8 }}>{t.title}</Text>
                  <StatusChip status={ticketStatusMap[t.status]} />
                </View>
                <Text style={{ fontSize: 12, color: colors.text2 }}>#{t.id} • Opened {t.date} • {t.replies} replies</Text>
              </View>
            )) : (
              <Text style={{ color: colors.text2, fontStyle: 'italic', marginBottom: 8 }}>No tickets raised yet.</Text>
            )

          }
          <Text style={[s.sectionTitle, { marginTop: 8 }]}>FAQ</Text>
          {FAQ.map((f, i) => (
            <TouchableOpacity key={i} style={s.faqItem} onPress={() => toggleFaq(i)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 }}>
                <Text style={{ fontWeight: '600', fontSize: 14, color: colors.text, flex: 1, marginRight: 8 }}>{f.q}</Text>
                <Ionicons name={openFaq === i ? 'chevron-up' : 'chevron-down'} size={18} color={colors.text2} />
              </View>
              {openFaq === i && (
                <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
                  <Text style={{ fontSize: 13, color: colors.text2, lineHeight: 20 }}>{f.a}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          padding: 10
        }}>

          <View style={{
            backgroundColor: colors.card,
            borderRadius: 20,
            padding: 20
          }}>

            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>
              Raise Ticket
            </Text>

            {/* Title */}
            <TextInput
              placeholder="Enter title"
              placeholderTextColor={colors.text2}
              value={title}
              onChangeText={setTitle}
              style={{
                borderWidth: 1.5,
                borderColor: colors.border,
                borderRadius: 10,
                padding: 12,
                marginTop: 15,
                color: colors.text
              }}
            />

            {/* Description */}
            <TextInput
              placeholder="Enter description"
              placeholderTextColor={colors.text2}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              style={{
                borderWidth: 1.5,
                borderColor: colors.border,
                borderRadius: 10,
                padding: 12,
                marginTop: 12,
                height: 100,
                textAlignVertical: 'top',
                color: colors.text
              }}
            />

            {/* Buttons */}
            <View style={{ flexDirection: 'row', marginTop: 20 }}>

              {/* Cancel */}
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={{
                  flex: 1,
                  padding: 14,
                  borderRadius: 10,
                  backgroundColor: colors.bg2,
                  marginRight: 8
                }}
              >
                <Text style={{ textAlign: 'center', color: colors.text }}>
                  Cancel
                </Text>
              </TouchableOpacity>

              {/* Submit */}
              <TouchableOpacity
                onPress={handleTicketSubmit}
                style={{
                  flex: 1,
                  padding: 14,
                  borderRadius: 10,
                  backgroundColor: colors.primary,
                  marginLeft: 8
                }}
              >
                <Text style={{ textAlign: 'center', color: '#fff', fontWeight: '700' }}>
                  Submit
                </Text>
              </TouchableOpacity>

            </View>

          </View>
        </View>
      </Modal>
    </ScreenWrapper>
  );
}

const styles = (c) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  header: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12 },
  title: { fontSize: 22, fontWeight: '800', color: c.text },
  sub: { fontSize: 13, color: c.text2, marginTop: 2 },
  newTicketBtn: { padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: c.text, marginBottom: 12 },
  ticketCard: { backgroundColor: c.card, borderWidth: 1.5, borderColor: c.border, borderRadius: 12, padding: 14, marginBottom: 8 },
  faqItem: { backgroundColor: c.card, borderWidth: 1.5, borderColor: c.border, borderRadius: 12, marginBottom: 8, overflow: 'hidden' },
});