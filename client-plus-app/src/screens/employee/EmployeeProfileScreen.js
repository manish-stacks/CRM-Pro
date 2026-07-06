import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Switch, Alert, Image, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import ScreenWrapper from '../../components/ScreenWrapper';
import { EmployeeAPI } from '../../services/employee.api';

const ITEMS = [
  { icon: 'person-outline', label: 'Edit Profile', sub: 'Update your info', color: '#3B82F6', bg: 'rgba(59,130,246,0.1)', action: 'edit' },
  { icon: 'lock-closed-outline', label: 'Change Password', sub: 'Update your password', color: '#A855F7', bg: 'rgba(168,85,247,0.1)', action: 'password' },
  { icon: 'people-outline', label: 'My Clients', sub: 'View assigned clients', color: '#22C55E', bg: 'rgba(34,197,94,0.1)', action: 'clients' },
  { icon: 'map-outline', label: 'My Visits', sub: 'View visit history', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', action: 'visits' },
];

export default function EmployeeProfileScreen({ navigation }) {
  const { colors, isDark, toggleTheme } = useTheme();
  const { logout, user: authUser } = useAuth();
  const [profile, setProfile] = useState(authUser || null);
  const [loading, setLoading] = useState(!authUser);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await EmployeeAPI.getProfile();
      setProfile(res.data?.data || res.data);
    } catch (e) {
      // fallback to auth user data silently
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  const handleAction = (action) => {
    if (action === 'clients') navigation.navigate('Clients');
    else if (action === 'visits') navigation.navigate('Visits');
    else Alert.alert('Coming Soon', 'This feature will be available soon.');
  };

  const s = styles(colors);
  const initials = profile?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'EM';

  return (
    <ScreenWrapper>
      <View style={s.container}>
        {/* Hero */}
        <LinearGradient colors={[colors.gradStart, colors.gradEnd]} style={s.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <View style={s.avatarWrap}>
            {profile?.image ? (
              <Image source={{ uri: profile.image }} style={s.avatarImg} />
            ) : (
              <View style={s.avatar}>
                <Text style={s.avatarText}>{loading ? '...' : initials}</Text>
              </View>
            )}
          </View>
          {loading ? (
            <ActivityIndicator color="rgba(255,255,255,0.8)" />
          ) : (
            <>
              <Text style={s.name}>{profile?.name || 'Employee'}</Text>
              <Text style={s.email}>{profile?.email || 'employee@company.com'}</Text>
              {profile?.designation || profile?.role ? (
                <View style={s.roleBadge}>
                  <Ionicons name="briefcase-outline" size={12} color="rgba(255,255,255,0.9)" />
                  <Text style={s.roleText}>{profile.designation || profile.role}</Text>
                </View>
              ) : null}
            </>
          )}
        </LinearGradient>

        <View style={{ padding: 20 }}>
          <View style={s.card}>
            {ITEMS.map((item, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => handleAction(item.action)}
                style={[s.profileItem, i === ITEMS.length - 1 && { borderBottomWidth: 0, paddingBottom: 0 }]}
              >
                <View style={[s.pIcon, { backgroundColor: item.bg }]}>
                  <Ionicons name={item.icon} size={18} color={item.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{item.label}</Text>
                  <Text style={{ fontSize: 12, color: colors.text2, marginTop: 1 }}>{item.sub}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.text3} />
              </TouchableOpacity>
            ))}
          </View>

          {/* Dark mode */}
          <View style={s.card}>
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
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
            <Ionicons name="log-out-outline" size={18} color={colors.primary} />
            <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 14 }}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScreenWrapper>
  );
}

const styles = (c) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  hero: { paddingTop: 54, paddingBottom: 32, alignItems: 'center' },
  avatarWrap: { marginBottom: 14 },
  avatar: { width: 80, height: 80, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'rgba(255,255,255,0.3)' },
  avatarImg: { width: 80, height: 80, borderRadius: 24 },
  avatarText: { color: '#fff', fontSize: 28, fontWeight: '800' },
  name: { fontSize: 22, fontWeight: '800', color: '#fff' },
  email: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, marginTop: 8 },
  roleText: { fontSize: 12, color: 'rgba(255,255,255,0.9)', fontWeight: '600' },
  card: { backgroundColor: c.card, borderWidth: 1.5, borderColor: c.border, borderRadius: 20, padding: 20, marginBottom: 16 },
  profileItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border },
  pIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, backgroundColor: 'rgba(229,9,20,0.08)', borderWidth: 1.5, borderColor: 'rgba(229,9,20,0.2)', borderRadius: 12 },
});
