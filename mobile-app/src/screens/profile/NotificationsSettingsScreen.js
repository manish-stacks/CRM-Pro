import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, Switch, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import ScreenWrapper from '../../components/ScreenWrapper';
import { Ionicons } from '@expo/vector-icons';
import { getPushDiagnostics, registerForPush, sendTestPush } from '../../services/push';

export default function NotificationsSettingsScreen({ navigation }) {
  const { colors } = useTheme();

  const [emailNotif, setEmailNotif] = useState(true);
  const [pushNotif, setPushNotif] = useState(false);
  const [smsNotif, setSmsNotif] = useState(false);

  // Push diagnostics
  const [diag, setDiag] = useState(null);
  const [checking, setChecking] = useState(true);
  const [testing, setTesting] = useState(false);

  const STORAGE_KEY = 'notifPrefs';

  // Load saved preferences (persist on-device across sessions)
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(v => {
      if (v) {
        const p = JSON.parse(v);
        setEmailNotif(p.emailNotif ?? true);
        setPushNotif(p.pushNotif ?? false);
        setSmsNotif(p.smsNotif ?? false);
      }
    }).catch(() => {});
  }, []);

  const refreshDiag = useCallback(async () => {
    setChecking(true);
    try {
      const d = await getPushDiagnostics();
      setDiag(d);
      // Keep the toggle honest: it reflects the real registration state.
      setPushNotif(!!d.serverRegistered);
    } catch {
      setDiag(null);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => { refreshDiag(); }, [refreshDiag]);

  const handlePushToggle = async (value) => {
    setPushNotif(value);
    if (value) {
      const res = await registerForPush(true);
      if (!res) {
        setPushNotif(false);
        Alert.alert(
          'Permission needed',
          'Enable notifications for this app in your phone settings, then try again.'
        );
        return;
      }
      refreshDiag();
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await sendTestPush();
      Alert.alert(
        res?.success ? 'Test sent' : 'Test failed',
        res?.message || (res?.success ? 'Check your notification tray.' : 'Could not send the test.')
      );
    } catch (e) {
      Alert.alert('Test failed', e?.message || 'Could not reach the server.');
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ emailNotif, pushNotif, smsNotif }));
    } catch {}
    Alert.alert('Success', 'Notification settings saved');
    navigation.goBack();
  };

  const s = styles(colors);

  const statusColor = diag?.serverRegistered ? '#16a34a' : '#dc2626';
  const statusText = checking
    ? 'Checking…'
    : diag?.serverRegistered
      ? 'Active'
      : diag?.permission !== 'granted'
        ? 'Permission not granted'
        : 'Not registered';

  return (
    <ScreenWrapper>

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.title}>Notifications</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <View style={s.card}>

          <View style={s.row}>
            <Text style={s.text}>Email Notifications</Text>
            <Switch value={emailNotif} onValueChange={setEmailNotif} />
          </View>

          <View style={s.row}>
            <Text style={s.text}>Push Notifications</Text>
            <Switch value={pushNotif} onValueChange={handlePushToggle} />
          </View>

          <View style={s.row}>
            <Text style={s.text}>SMS Notifications</Text>
            <Switch value={smsNotif} onValueChange={setSmsNotif} />
          </View>

        </View>

        {/* Push delivery status */}
        <View style={s.card}>
          <View style={s.rowTop}>
            <Text style={s.cardTitle}>Push Delivery</Text>
            <TouchableOpacity onPress={refreshDiag} disabled={checking}>
              <Ionicons name="refresh" size={18} color={colors.muted || colors.text} />
            </TouchableOpacity>
          </View>

          <View style={s.row}>
            <Text style={s.label}>Status</Text>
            {checking
              ? <ActivityIndicator size="small" />
              : <View style={s.badgeWrap}>
                  <View style={[s.dot, { backgroundColor: statusColor }]} />
                  <Text style={[s.value, { color: statusColor }]}>{statusText}</Text>
                </View>}
          </View>

          <View style={s.row}>
            <Text style={s.label}>Delivery service</Text>
            <Text style={s.value}>
              {diag?.serverProvider === 'fcm'
                ? 'Firebase (FCM)'
                : diag?.serverProvider === 'expo'
                  ? 'Expo'
                  : '—'}
            </Text>
          </View>

          <View style={s.row}>
            <Text style={s.label}>Permission</Text>
            <Text style={s.value}>{diag?.permission || '—'}</Text>
          </View>

          <View style={[s.row, { marginBottom: 4 }]}>
            <Text style={s.label}>Device ID</Text>
            <Text style={s.value} numberOfLines={1}>
              {diag?.token ? `…${String(diag.token).slice(-12)}` : '—'}
            </Text>
          </View>

          <TouchableOpacity
            style={[s.outlineBtn, testing && { opacity: 0.6 }]}
            onPress={handleTest}
            disabled={testing || !diag?.serverRegistered}
          >
            {testing
              ? <ActivityIndicator size="small" color={colors.text} />
              : <Text style={s.outlineBtnText}>Send Test Notification</Text>}
          </TouchableOpacity>

          {!diag?.serverRegistered && !checking && (
            <Text style={s.hint}>
              Turn on Push Notifications above to register this device.
            </Text>
          )}
        </View>

        {/* Save Button */}
        <TouchableOpacity onPress={handleSave}>
          <LinearGradient colors={[colors.gradStart, colors.gradEnd]} style={s.btn}>
            <Text style={s.btnText}>Save Settings →</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>

    </ScreenWrapper>
  );
}

const styles = (c) => StyleSheet.create({
  header:{flexDirection:'row',alignItems:'center',padding:20},
  backBtn:{width:36,height:36,backgroundColor:c.card2,borderWidth:1.5,borderColor:c.border,borderRadius:10,alignItems:'center',justifyContent:'center',marginRight:10},
  title:{fontSize:20,fontWeight:'800',color:c.text},
  card:{backgroundColor:c.card,borderWidth:1.5,borderColor:c.border,borderRadius:16,padding:16,marginBottom:20},
  cardTitle:{fontSize:15,fontWeight:'800',color:c.text},
  rowTop:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:14},
  row:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:14},
  text:{fontSize:14,color:c.text},
  label:{fontSize:13,color:c.muted || c.text,opacity:0.8},
  value:{fontSize:13,fontWeight:'700',color:c.text,maxWidth:'55%',textAlign:'right'},
  badgeWrap:{flexDirection:'row',alignItems:'center'},
  dot:{width:8,height:8,borderRadius:4,marginRight:6},
  outlineBtn:{marginTop:6,paddingVertical:12,borderRadius:12,borderWidth:1.5,borderColor:c.border,alignItems:'center'},
  outlineBtnText:{fontSize:13,fontWeight:'800',color:c.text},
  hint:{marginTop:10,fontSize:12,color:c.muted || c.text,opacity:0.7,textAlign:'center'},
  btn:{padding:16,borderRadius:12,alignItems:'center'},
  btnText:{color:'#fff',fontWeight:'800'}
});
