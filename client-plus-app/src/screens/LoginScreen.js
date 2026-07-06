import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView,
  Image, Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import logo from '../../assets/hbs-logo.png';
import ScreenWrapper from '../components/ScreenWrapper';

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const { colors, isDark } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [activeRole, setActiveRole] = useState('client'); 

  const handleLogin = async () => {
    if (!email.trim()) { Alert.alert('Error', 'Please enter your email'); return; }
    if (!password) { Alert.alert('Error', 'Please enter your password'); return; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const mobileRegex = /^\d{10}$/;
    if (!emailRegex.test(email.trim()) && !mobileRegex.test(email.trim())) { Alert.alert('Error', 'Please enter a valid email or mobile number'); return; }

    setLoading(true);
    const success = await login(email.trim().toLowerCase(), password, activeRole);
    setLoading(false);
  };

  const s = styles(colors);
  return (
    <ScreenWrapper isScrollable={false}>
      <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* Logo */}
          <View style={s.logoWrap}>
            <Image source={logo} style={s.logoIcon} />
            <Text style={s.logoName}>Client<Text style={{ color: colors.primary }}>Plus</Text></Text>
            <Text style={s.logoSub}>Digital Marketing Dashboard</Text>
          </View>

          <Text style={s.title}>Welcome back 👋</Text>
          <Text style={s.sub}>Sign in to continue</Text>

          {/* Role Toggle */}
          <View style={s.roleToggle}>
            <TouchableOpacity
              style={[s.roleBtn, activeRole === 'client' && s.roleBtnActive]}
              onPress={() => setActiveRole('client')}
            >
              <Ionicons name="person-outline" size={16} color={activeRole === 'client' ? '#fff' : colors.text2} />
              <Text style={[s.roleTxt, activeRole === 'client' && s.roleTxtActive]}>Client</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.roleBtn, activeRole === 'employee' && s.roleBtnActive]}
              onPress={() => setActiveRole('employee')}
            >
              <Ionicons name="briefcase-outline" size={16} color={activeRole === 'employee' ? '#fff' : colors.text2} />
              <Text style={[s.roleTxt, activeRole === 'employee' && s.roleTxtActive]}>Employee</Text>
            </TouchableOpacity>
          </View>

          {/* Email */}
          <Text style={s.label}>EMAIL/MOBILE</Text>
          <TextInput
            style={s.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@company.com"
            placeholderTextColor={colors.text3}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          {/* Password */}
          <Text style={[s.label, { marginTop: 16 }]}>PASSWORD</Text>
          <View style={s.passWrap}>
            <TextInput
              style={[s.input, { flex: 1, borderWidth: 0 }]}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.text3}
              secureTextEntry={!showPass}
            />
            <TouchableOpacity onPress={() => setShowPass(v => !v)} style={s.eyeBtn}>
              <Ionicons name={showPass ? 'eye-outline' : 'eye-off-outline'} size={20} color={colors.text3} />
            </TouchableOpacity>
          </View>

          {activeRole === 'client' && (
            <TouchableOpacity style={s.forgot} onPress={() => navigation.navigate('ForgotPassword')}>
              <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>Forgot Password?</Text>
            </TouchableOpacity>
          )}

          {/* Button */}
          <TouchableOpacity onPress={handleLogin} disabled={loading} style={{ marginTop: 24 }}>
            <LinearGradient colors={[colors.gradStart, colors.gradEnd]} style={s.btn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Text style={s.btnText}>{loading ? 'Signing in...' : `Sign in as ${activeRole === 'client' ? 'Client' : 'Employee'} →`}</Text>
            </LinearGradient>
          </TouchableOpacity>

          <Text style={s.noAccount}>
            Don't have an account?
            <Text style={{ color: colors.primary, fontWeight: '700' }}
              onPress={() => Linking.openURL('https://hoverbusinessservices.com/contact-us.php')}>
              {' '}Contact us
            </Text>
          </Text>
          <Text style={{ textAlign: 'center', marginTop: 12, fontSize: 11, color: colors.text3 }}>
            Need help?{' '}
            <Text style={{ color: colors.primary }} onPress={() => Linking.openURL('https://hoverbusinessservices.com/support.php')}>
              Visit our support center
            </Text>
          </Text>

        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenWrapper>
  );
}

const styles = (c) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24, paddingBottom: 48 },
  logoWrap: { alignItems: 'center', marginBottom: 36 },
  logoIcon: { width: 85, height: 45, marginBottom: 12 },
  logoName: { fontSize: 26, fontWeight: '800', color: c.text },
  logoSub: { fontSize: 13, color: c.text2, marginTop: 4 },
  title: { fontSize: 24, fontWeight: '800', color: c.text },
  sub: { fontSize: 14, color: c.text2, marginBottom: 24, marginTop: 4 },
  roleToggle: {
    flexDirection: 'row', backgroundColor: c.bg2, borderRadius: 14,
    padding: 4, borderWidth: 1.5, borderColor: c.border, marginBottom: 24, gap: 4,
  },
  roleBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 11,
  },
  roleBtnActive: { backgroundColor: c.primary },
  roleTxt: { fontSize: 13, fontWeight: '600', color: c.text2 },
  roleTxtActive: { color: '#fff' },
  label: { fontSize: 12, fontWeight: '700', color: c.text2, marginBottom: 8, letterSpacing: 0.5 },
  input: { backgroundColor: c.bg2, borderWidth: 1.5, borderColor: c.border, borderRadius: 12, padding: 14, fontSize: 15, color: c.text },
  passWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.bg2, borderWidth: 1.5, borderColor: c.border, borderRadius: 12, paddingRight: 14 },
  eyeBtn: { padding: 4 },
  forgot: { alignItems: 'flex-end', marginTop: 8 },
  btn: { padding: 16, borderRadius: 12, alignItems: 'center' },
  btnText: { color: 'white', fontSize: 16, fontWeight: '800' },
  noAccount: { textAlign: 'center', marginTop: 20, fontSize: 13, color: c.text2 },
});

/*
import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView,
  Image,
  Linking
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { StatusBar } from 'expo-status-bar';
import logo from '../../assets/hbs-logo.png';
import ScreenWrapper from '../components/ScreenWrapper';

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const { colors, isDark } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) { Alert.alert('Error', 'Please fill all fields'); return; }
    setLoading(true);
    const success = await login(email, password);
    setLoading(false);
    if (!success) Alert.alert('Error', 'Invalid credentials');
  };

  const s = styles(colors);
  return (
    <ScreenWrapper isScrollable={false}>
      <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

          
          <View style={s.logoWrap}>
            <Image source={logo} style={s.logoIcon} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
            <Text style={s.logoName}>Client<Text style={{ color: colors.primary }}>Plus</Text></Text>
            <Text style={s.logoSub}>Digital Marketing Dashboard</Text>
          </View>

          <Text style={s.title}>Welcome back 👋</Text>
          <Text style={s.sub}>Sign in to manage your services</Text>

       
          <Text style={s.label}>EMAIL ADDRESS</Text>
          <TextInput
            style={s.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@company.com"
            placeholderTextColor={colors.text3}
            keyboardType="email-address"
            autoCapitalize="none"
          />

      
          <Text style={[s.label, { marginTop: 16 }]}>PASSWORD</Text>
          <TextInput
            style={s.input}
            value={password}
            onChangeText={setPassword}
            placeholder="*********"
            placeholderTextColor={colors.text3}
            secureTextEntry
          />
          <TouchableOpacity style={s.forgot} onPress={() => navigation.navigate('ForgotPassword')}><Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>Forgot Password?</Text></TouchableOpacity>

      
          <TouchableOpacity onPress={handleLogin} disabled={loading}>
            <LinearGradient colors={[colors.gradStart, colors.gradEnd]} style={s.btn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Text style={s.btnText}>{loading ? 'Signing in...' : 'Sign In →'}</Text>
            </LinearGradient>
          </TouchableOpacity>

          <Text style={s.noAccount}>
            Don't have an account?
            <Text style={{ color: colors.primary, fontWeight: '700' }}
              onPress={() => Linking.openURL('https://hoverbusinessservices.com/contact-us.php')}>
              {' '}Contact us
            </Text>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenWrapper>
  );
}

const styles = (c) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24, paddingBottom: 48 },
  logoWrap: { alignItems: 'center', marginBottom: 40 },
  logoIcon: { width: 85, height: 45, marginBottom: 12 },
  logoName: { fontSize: 26, fontWeight: '800', color: c.text },
  logoSub: { fontSize: 13, color: c.text2, marginTop: 4 },
  title: { fontSize: 24, fontWeight: '800', color: c.text },
  sub: { fontSize: 14, color: c.text2, marginBottom: 28, marginTop: 4 },
  label: { fontSize: 12, fontWeight: '700', color: c.text2, marginBottom: 8, letterSpacing: 0.5 },
  input: { backgroundColor: c.bg2, borderWidth: 1.5, borderColor: c.border, borderRadius: 12, padding: 14, fontSize: 15, color: c.text },
  forgot: { alignItems: 'flex-end', marginTop: 8 },
  btn: { padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 24 },
  btnText: { color: 'white', fontSize: 16, fontWeight: '800' },
  noAccount: { textAlign: 'center', marginTop: 20, fontSize: 13, color: c.text2 },
});
*/