import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import ScreenWrapper from '../../components/ScreenWrapper';
import { Ionicons } from '@expo/vector-icons';
import { EmployeeAPI } from '../../services/employee.api';

export default function EmployeeChangePasswordScreen({ navigation }) {
  const { colors } = useTheme();
  const s = styles(colors);
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!oldPass || !newPass || !confirmPass) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }
    if (newPass.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }
    if (newPass !== confirmPass) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    try {
      setLoading(true);

      // /mobile/profile/change-password expects camelCase keys
      const res = await EmployeeAPI.changePassword({
        currentPassword: oldPass,
        newPassword: newPass,
      });

      Alert.alert('Success', res.data?.message || 'Password updated');
      navigation.goBack();
    } catch (e) {
      console.log('Password Error:', e);
      Alert.alert('Error', e?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenWrapper>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.title}>Change Password</Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ padding: 20 }}
      >
        <View style={s.card}>
          <Text style={s.label}>Current Password</Text>
          <TextInput style={s.input} secureTextEntry value={oldPass} onChangeText={setOldPass} />

          <Text style={s.label}>New Password</Text>
          <TextInput style={s.input} secureTextEntry value={newPass} onChangeText={setNewPass} />

          <Text style={s.label}>Confirm Password</Text>
          <TextInput style={s.input} secureTextEntry value={confirmPass} onChangeText={setConfirmPass} />
        </View>

        <TouchableOpacity onPress={handleSubmit} disabled={loading}>
          <LinearGradient colors={[colors.gradStart, colors.gradEnd]} style={s.btn}>
            <Text style={s.btnText}>
              {loading ? 'Updating...' : 'Update Password →'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </ScreenWrapper>
  );
}

const styles = (c) => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', padding: 20 },
  backBtn: { width: 36, height: 36, backgroundColor: c.card2, borderWidth: 1.5, borderColor: c.border, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  title: { fontSize: 20, fontWeight: '800', color: c.text },
  card: { backgroundColor: c.card, borderWidth: 1.5, borderColor: c.border, borderRadius: 16, padding: 16, marginBottom: 20 },
  label: { fontSize: 12, color: c.text2, marginBottom: 6, marginTop: 10 },
  input: { backgroundColor: c.bg2, borderWidth: 1.5, borderColor: c.border, borderRadius: 12, padding: 14, color: c.text },
  btn: { padding: 16, borderRadius: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '800' }
});
