import { useState } from 'react';
import {
  View, Text, Switch, TouchableOpacity,
  StyleSheet, Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import ScreenWrapper from '../../components/ScreenWrapper';
import { Ionicons } from '@expo/vector-icons';

export default function NotificationsSettingsScreen({ navigation }) {
  const { colors } = useTheme();

  const [emailNotif, setEmailNotif] = useState(true);
  const [pushNotif, setPushNotif] = useState(false);
  const [smsNotif, setSmsNotif] = useState(false);

  const handleSave = () => {
    Alert.alert('Success', 'Notification settings saved');

    console.log({
      emailNotif,
      pushNotif,
      smsNotif
    });

    navigation.goBack();
  };

  const s = styles(colors);

  return (
    <ScreenWrapper>

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.title}>Notifications</Text>
      </View>

      <View style={{ padding: 20 }}>
        <View style={s.card}>

          <View style={s.row}>
            <Text style={s.text}>Email Notifications</Text>
            <Switch value={emailNotif} onValueChange={setEmailNotif} />
          </View>

          <View style={s.row}>
            <Text style={s.text}>Push Notifications</Text>
            <Switch value={pushNotif} onValueChange={setPushNotif} />
          </View>

          <View style={s.row}>
            <Text style={s.text}>SMS Notifications</Text>
            <Switch value={smsNotif} onValueChange={setSmsNotif} />
          </View>

        </View>

        {/* Save Button */}
        <TouchableOpacity onPress={handleSave}>
          <LinearGradient colors={[colors.gradStart, colors.gradEnd]} style={s.btn}>
            <Text style={s.btnText}>Save Settings →</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

    </ScreenWrapper>
  );
}

const styles = (c) => StyleSheet.create({
  header:{flexDirection:'row',alignItems:'center',padding:20},
  backBtn:{width:36,height:36,backgroundColor:c.card2,borderWidth:1.5,borderColor:c.border,borderRadius:10,alignItems:'center',justifyContent:'center',marginRight:10},
  title:{fontSize:20,fontWeight:'800',color:c.text},
  card:{backgroundColor:c.card,borderWidth:1.5,borderColor:c.border,borderRadius:16,padding:16,marginBottom:20},
  row:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:14},
  text:{fontSize:14,color:c.text},
  btn:{padding:16,borderRadius:12,alignItems:'center'},
  btnText:{color:'#fff',fontWeight:'800'}
});