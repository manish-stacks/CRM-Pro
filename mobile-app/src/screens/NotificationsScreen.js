import { useEffect, useState } from 'react';
import { AxiosInstance } from '../lib/Axios.instance';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { NOTIFICATIONS } from '../constants/data';
import ScreenWrapper from '../components/ScreenWrapper';

const iconMap = {
  danger: { name: 'alert-circle', color: '#E50914', bg: 'rgba(229,9,20,0.1)' },
  success: { name: 'checkmark-circle', color: '#22C55E', bg: 'rgba(34,197,94,0.1)' },
  info: { name: 'document-text', color: '#3B82F6', bg: 'rgba(59,130,246,0.1)' },
  purple: { name: 'chatbubble', color: '#A855F7', bg: 'rgba(168,85,247,0.1)' },
  warning: { name: 'time', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
  report: { name: 'document-text', color: '#3B82F6', bg: 'rgba(59,130,246,0.1)' },
  invoice: { name: 'card', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
  ticket: { name: 'chatbubble', color: '#A855F7', bg: 'rgba(168,85,247,0.1)' },
};

function timeAgo(dt) {
  if (!dt) return '';
  const diff = Date.now() - new Date(dt).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(dt).toLocaleDateString('en-IN');
}

export default function NotificationsScreen({ navigation }) {
  const { colors } = useTheme();
  const s = styles(colors);
  const [notifications, setNotifications] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await AxiosInstance.get('/mobile/notifications');
      setNotifications(res?.data?.data?.items || []);
    } catch (e) {
      console.log('Notification Error:', e);
    } finally {
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };
  return (
    <ScreenWrapper isScrollable={false}>
      <View style={s.container}>
        <View style={s.headerBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="chevron-back" size={18} color={colors.text} />
          </TouchableOpacity>
          <Text style={s.title}>Notifications</Text>
          <TouchableOpacity
            style={{ marginLeft: 'auto' }}
            onPress={async () => {
              try {
                await Promise.resolve();
                fetchNotifications(); // refresh
              } catch (e) {
                console.log(e);
              }
            }}
          >
            <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 12 }}>
              Mark all read
            </Text>
          </TouchableOpacity>
        </View>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 20 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
        >
          {notifications.length === 0 ? (
            <Text style={{ fontSize: 14, color: colors.text }}>
              No notifications
            </Text>
          ) : (
            notifications.map((n, index) => {
              const ic = iconMap[n.type] || iconMap.info;
              const isLast = index === notifications.length - 1;

              return (
                <View
                  key={n.id}
                  style={[
                    s.notifItem,
                    isLast && { borderBottomWidth: 0 },
                  ]}
                >
                  <View
                    style={[
                      {
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        marginTop: 6,
                        flexShrink: 0,
                      },
                      {
                        backgroundColor: n.unread
                          ? colors.primary
                          : "transparent",
                      },
                    ]}
                  />

                  <View
                    style={[s.notifIcon, { backgroundColor: ic.bg }]}
                  >
                    <Ionicons
                      name={ic.name}
                      size={20}
                      color={ic.color}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontWeight: "600",
                        fontSize: 14,
                        color: colors.text,
                      }}
                    >
                      {n.title}
                    </Text>

                    <Text
                      style={{
                        fontSize: 12,
                        color: colors.text2,
                        marginTop: 2,
                        lineHeight: 17,
                      }}
                    >
                      {n.message}
                    </Text>

                    <Text
                      style={{
                        fontSize: 11,
                        color: colors.text3,
                        marginTop: 4,
                      }}
                    >
                      {timeAgo(n.createdAt)}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      </View>
    </ScreenWrapper>
  );
}

const styles = (c) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  headerBar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12 },
  backBtn: { width: 36, height: 36, backgroundColor: c.card2, borderWidth: 1.5, borderColor: c.border, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '800', color: c.text },
  notifItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.border },
  notifIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
});