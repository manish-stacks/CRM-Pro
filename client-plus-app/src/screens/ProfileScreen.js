import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Switch, Alert, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import ScreenWrapper from '../components/ScreenWrapper';
import { AxiosInstance } from '../lib/Axios.instance';

const ITEMS = [
  {
    icon: 'person-outline',
    label: 'Edit Profile',
    sub: 'Update your info',
    color: '#3B82F6',
    bg: 'rgba(59,130,246,0.1)',
    screen: 'EditProfile'
  },
  {
    icon: 'lock-closed-outline',
    label: 'Change Password',
    sub: 'Last changed 3 months ago',
    color: '#A855F7',
    bg: 'rgba(168,85,247,0.1)',
    screen: 'ChangePassword'
  },
  {
    icon: 'notifications-outline',
    label: 'Notifications',
    sub: 'Manage alerts',
    color: '#F59E0B',
    bg: 'rgba(245,158,11,0.1)',
    screen: 'NotificationsSettings'
  },
];

export default function ProfileScreen({ navigation }) {
  const { colors, isDark, toggleTheme } = useTheme();
  const { logout, userData } = useAuth();
  const s = styles(colors);
  const [user, setUser] = useState(null);
  useEffect(() => {
    // const loadUser = async () => {
    //   const data = await userData();
    //   setUser(data);
    // };

    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await AxiosInstance.get('/client-portal/profile');
      setUser(res.data?.data || null);
    } catch (e) {
      console.log('Profile Error:', e);
    }
  };


  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', onPress: () => logout() }
    ]);
  };
  return (
    <ScreenWrapper>
      <View style={s.container}>
        {/* Hero */}
        <LinearGradient colors={[colors.gradStart, colors.gradEnd]} style={s.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <View style={s.avatarWrap}>
            <View style={s.avatar}>
              {user?.image ? (
                <Image source={{ uri: user?.image }} style={s.avatarImg} />
              ) : (
                <Text style={s.avatarText}>
                  {user?.clientName ? user.clientName.split(' ').map(n => n[0]).join('') : 'RS'}
                </Text>
              )}
            </View>
            {/* <View style={s.editBadge}><Ionicons name="pencil" size={12} color={colors.primary} /></View> */}
          </View>
          <Text style={{ fontSize: 22, fontWeight: '800', color: 'white' }}>{user?.clientName || 'Guest'}</Text>
          <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 4 }}>{user?.email || 'Your email'}</Text>
        </LinearGradient>

        <View style={{ padding: 20 }}>
          <View style={s.card}>
            {ITEMS.map((item, i) => (
              <TouchableOpacity key={i} onPress={() => navigation.navigate(item.screen)} style={[s.profileItem, i === ITEMS.length - 1 && { borderBottomWidth: 0, paddingBottom: 0 }]}>
                <View style={[s.pIcon, { backgroundColor: item.bg }]}><Ionicons name={item.icon} size={18} color={item.color} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{item.label}</Text>
                  <Text style={{ fontSize: 12, color: colors.text2, marginTop: 1 }}>{item.sub}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.text3} />
              </TouchableOpacity>
            ))}

          </View>
          {/* Dark mode toggle */}
          <View style={s.card}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={[s.pIcon, { backgroundColor: 'rgba(100,100,100,0.1)' }]}>
                <Ionicons name={isDark ? 'sunny-outline' : 'moon-outline'} size={18} color={colors.text2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{isDark ? 'Light Mode' : 'Dark Mode'}</Text>
                <Text style={{ fontSize: 12, color: colors.text2, marginTop: 1 }}>Toggle theme</Text>
              </View>
              <Switch value={isDark} onValueChange={toggleTheme} />
            </View>
          </View>

          <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
            <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 14 }}>← Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScreenWrapper>
  );
}

const styles = (c) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  hero: { paddingTop: 54, paddingBottom: 80, alignItems: 'center' },
  avatarWrap: { position: 'relative', marginBottom: 14 },
  avatar: { width: 80, height: 80, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'rgba(255,255,255,0.3)' },
  editBadge: { position: 'absolute', bottom: -6, right: -6, width: 26, height: 26, backgroundColor: 'white', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: c.card, borderWidth: 1.5, borderColor: c.border, borderRadius: 20, padding: 20, marginBottom: 16 },
  profileItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border },
  pIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  logoutBtn: { padding: 14, backgroundColor: 'rgba(229,9,20,0.08)', borderWidth: 1.5, borderColor: 'rgba(229,9,20,0.2)', borderRadius: 12, alignItems: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  avatarImg: {
    width: 80, height: 80, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'rgba(255,255,255,0.3)'
  },
  avatarText: {
    color: 'rgb(255, 255, 255)', justifyContent: 'center', alignItems: 'center', fontSize: 28, fontWeight: '800'
  }
});