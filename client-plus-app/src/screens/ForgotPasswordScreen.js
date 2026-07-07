import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView,
  Image
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { AxiosInstance } from '../lib/Axios.instance';
import { StatusBar } from 'expo-status-bar';
import logo from '../../assets/hbs-logo.png';
import ScreenWrapper from '../components/ScreenWrapper';

export default function ForgotPasswordScreen({ navigation, route }) {
  const { colors, isDark } = useTheme();

  // Client vs employee reset hit different endpoints (Client vs User record).
  const role = route?.params?.role || 'client';
  const base = role === 'employee' ? '/mobile/auth/forgot-password' : '/client-portal/forgot-password';

  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);

  const [timer, setTimer] = useState(30);

  // Timer for resend OTP
  useEffect(() => {
    let interval;
    if (step === 2 && timer > 0) {
      interval = setInterval(() => {
        setTimer(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [step, timer]);

  //  Send OTP
  const handleSendOtp = async () => {
    if (!email) {
      Alert.alert('Error', 'Enter your email');
      return;
    }
    setLoading(true);
    try {
      const res = await AxiosInstance.post(`${base}/send-otp`, {
        email: email.trim().toLowerCase(),
      });
      setStep(2);
      setTimer(30);
      Alert.alert('OTP Sent', res.data?.message || 'If an account exists, a reset code has been sent.');
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (timer > 0) return;
    try {
      await AxiosInstance.post(`${base}/send-otp`, {
        email: email.trim().toLowerCase(),
      });
      setTimer(30);
      Alert.alert('OTP Resent', 'A new code has been sent to your email/phone.');
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not resend OTP.');
    }
  };

  // Reset Password
  const handleReset = async () => {
    if (!otp || !password || !confirmPassword) {
      Alert.alert('Error', 'Fill all fields');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      const res = await AxiosInstance.post(`${base}/reset`, {
        email: email.trim().toLowerCase(),
        otp: otp.trim(),
        newPassword: password,
      });
      Alert.alert('Success', res.data?.message || 'Password reset successful', [
        { text: 'OK', onPress: () => navigation.navigate('Login') },
      ]);
    } catch (e) {
      Alert.alert('Error', e.message || 'Reset failed. Check your code and try again.');
    } finally {
      setLoading(false);
    }
  };

  const s = styles(colors);

  return (
    <ScreenWrapper isScrollable={false}>
      <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

          {/* Logo */}
          <View style={s.logoWrap}>
            <Image source={logo} style={s.logoIcon} />
            <Text style={s.logoName}>Client<Text style={{ color: colors.primary }}>Plus</Text></Text>
            <Text style={s.logoSub}>Digital Marketing Dashboard</Text>
          </View>

          <Text style={s.title}>Forgot Password</Text>

          {step === 1 ? (
            <>
              <Text style={s.sub}>Enter your email/phone</Text>

              <Text style={s.label}>Email/Phone</Text>
              <TextInput
                style={s.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@company.com"
                placeholderTextColor={colors.text3}
              />

              <TouchableOpacity onPress={handleSendOtp} disabled={loading}>
                <LinearGradient colors={[colors.gradStart, colors.gradEnd]} style={s.btn}>
                  <Text style={s.btnText}>{loading ? 'Sending...' : 'Send OTP →'}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={s.sub}>Enter OTP & New Password</Text>

              {/* OTP */}
              <Text style={s.label}>OTP</Text>
              <TextInput
                style={s.input}
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
                placeholder="Enter OTP"
              />

              {/* Resend */}
              <TouchableOpacity onPress={handleResendOtp} disabled={timer > 0}>
                <Text style={{ color: timer > 0 ? colors.text3 : colors.primary, marginTop: 8 }}>
                  {timer > 0 ? `Resend OTP in ${timer}s` : 'Resend OTP'}
                </Text>
              </TouchableOpacity>

              {/* Password */}
              <Text style={s.label}>New Password</Text>
              <TextInput
                style={s.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />

              <Text style={s.label}>Confirm Password</Text>
              <TextInput
                style={s.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
              />

              <TouchableOpacity onPress={handleReset} disabled={loading}>
                <LinearGradient colors={[colors.gradStart, colors.gradEnd]} style={s.btn}>
                  <Text style={s.btnText}>{loading ? 'Resetting...' : 'Reset Password →'}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}

          {/* Back to login */}
          <Text style={s.noAccount}>
            Back to
            <Text
              style={{ color: colors.primary, fontWeight: '700' }}
              onPress={() => navigation.navigate('Login')}
            >
              {' '}Login
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
  label: { fontSize: 12, fontWeight: '700', color: c.text2, marginBottom: 8, letterSpacing: 0.5, marginTop: 8 },
  input: { backgroundColor: c.bg2, borderWidth: 1.5, borderColor: c.border, borderRadius: 12, padding: 14, fontSize: 15, color: c.text },
  forgot: { alignItems: 'flex-end', marginTop: 8 },
  btn: { padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 24 },
  btnText: { color: 'white', fontSize: 16, fontWeight: '800' },
  noAccount: { textAlign: 'center', marginTop: 20, fontSize: 13, color: c.text2 },
});