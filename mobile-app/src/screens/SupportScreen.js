import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { AxiosInstance } from '../lib/Axios.instance';
import { ClientAPI } from '../services/client.api';
import { shapeTicket } from '../lib/shape';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, LayoutAnimation, Alert,
  RefreshControl, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { Modal, TextInput } from 'react-native';
import ScreenWrapper from '../components/ScreenWrapper';
import TicketCard from '../components/TicketCard';
import { useAuth } from '../context/AuthContext';

const FAQ = [
  { q: 'How often are SEO reports sent?', a: 'SEO reports are sent monthly on the 1st of each month via email. You can also access them anytime from the Service Detail screen.' },
  { q: 'How do I renew a service?', a: 'Go to the Services screen, click on the expiring service, and tap the Renew button. Our team will activate the renewal within 24 hours.' },
  { q: 'Who is my account manager?', a: "Your assigned account manager's info is available inside each service detail card. You can reach them directly via WhatsApp or email." },
  { q: 'Can I upgrade my current plan?', a: 'Yes! Visit the Proposals section or raise a support ticket. Our team will send you a custom upgrade proposal within 1 business day.' },
];

const LATEST_COUNT = 3;
const POLL_INTERVAL_MS = 12000; // 12s — ticket status/reply "live update" while screen is open

export default function SupportScreen({ navigation }) {
  const { colors } = useTheme();
  const s = styles(colors);
  const [openFaq, setOpenFaq] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tickets, setTickets] = useState([]);
  const [user, setUser] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const { userData } = useAuth();

  useEffect(() => {
    fetchTickets();
    loadUser();
  }, []);

  // Poll for updates only while this screen is focused (stops when the user
  // navigates away, so it doesn't drain battery/data in the background).
  useFocusEffect(
    useCallback(() => {
      const id = setInterval(() => fetchTickets({ silent: true }), POLL_INTERVAL_MS);
      return () => clearInterval(id);
    }, [])
  );

  const loadUser = async () => {
    const data = await userData();
    setUser(data);
  };

  const fetchTickets = async ({ silent = false } = {}) => {
    try {
      const res = await AxiosInstance.get('/client-portal/tickets');
      // API already returns newest-first (orderBy createdAt desc)
      setTickets((res?.data?.data || []).map(shapeTicket));
    } catch (e) {
      if (!silent) console.log('Ticket Error:', e);
    } finally {
      if (!silent) setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchTickets();
  };

  const handleReply = async (ticketId, body) => {
    await ClientAPI.replyTicket(ticketId, body);
    await fetchTickets();
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
        subject: title,
        description,
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

  const latestTickets = tickets.slice(0, LATEST_COUNT);

  return (
    <ScreenWrapper isScrollable={false}>
      <View style={s.container}>
        <View style={s.header}><Text style={s.title}>Support</Text><Text style={s.sub}>We're here to help</Text></View>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 20, paddingBottom: 20 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
        >
          {/* New Ticket button */}
          <TouchableOpacity onPress={() => setModalVisible(true)}>
            <LinearGradient colors={[colors.gradStart, colors.gradEnd]} style={s.newTicketBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Text style={{ color: 'white', fontWeight: '800', fontSize: 16 }}>+ Raise New Ticket</Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, marginBottom: 12 }}>
            <Text style={s.sectionTitle}>My Tickets</Text>
            {tickets.length > LATEST_COUNT && (
              <TouchableOpacity onPress={() => navigation.navigate('AllTickets')} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '700' }}>View all ({tickets.length})</Text>
                <Ionicons name="chevron-forward" size={14} color={colors.primary} />
              </TouchableOpacity>
            )}
          </View>

          {latestTickets.length > 0 ? (
            latestTickets.map(t => <TicketCard key={t.id} ticket={t} onReply={handleReply} />)
          ) : (
            <Text style={{ color: colors.text2, fontStyle: 'italic', marginBottom: 8 }}>No tickets raised yet.</Text>
          )}

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
        onRequestClose={() => setModalVisible(false)}
      >
        {/* KeyboardAvoidingView + scrollable body — without this, the keyboard opens right on top of the input and inner scrolling also breaks. */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.5)',
              justifyContent: 'center',
              padding: 12,
            }}>
              <View style={{
                backgroundColor: colors.card,
                borderRadius: 20,
                maxHeight: '85%',
                overflow: 'hidden',
              }}>
                <ScrollView
                  contentContainerStyle={{ padding: 20 }}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  bounces={false}
                >
                  <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>
                    Raise Ticket
                  </Text>

                  {/* Title */}
                  <TextInput
                    placeholder="Enter title"
                    placeholderTextColor={colors.text2}
                    value={title}
                    onChangeText={setTitle}
                    returnKeyType="next"
                    style={{
                      borderWidth: 1.5,
                      borderColor: colors.border,
                      borderRadius: 10,
                      padding: 12,
                      marginTop: 15,
                      color: colors.text,
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
                      color: colors.text,
                    }}
                  />

                  {/* Buttons — ab ScrollView ke andar hain, keyboard ke saath
                      scroll ho jaate hain */}
                  <View style={{ flexDirection: 'row', marginTop: 20 }}>
                    <TouchableOpacity
                      onPress={() => { Keyboard.dismiss(); setModalVisible(false); }}
                      style={{
                        flex: 1,
                        padding: 14,
                        borderRadius: 10,
                        backgroundColor: colors.bg2,
                        marginRight: 8,
                      }}
                    >
                      <Text style={{ textAlign: 'center', color: colors.text }}>
                        Cancel
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => { Keyboard.dismiss(); handleTicketSubmit(); }}
                      style={{
                        flex: 1,
                        padding: 14,
                        borderRadius: 10,
                        backgroundColor: colors.primary,
                        marginLeft: 8,
                      }}
                    >
                      <Text style={{ textAlign: 'center', color: '#fff', fontWeight: '700' }}>
                        Submit
                      </Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
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