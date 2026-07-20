// src/components/LocationDisclosureModal.js
// Google Play "Prominent Disclosure" for background location.
// Must be shown IN-APP, separately from the OS permission dialog, BEFORE
// requesting ACCESS_BACKGROUND_LOCATION. Requires an explicit user action.
import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

export default function LocationDisclosureModal({ visible, onAllow, onDeny }) {
  const { colors } = useTheme();
  const s = styles(colors);

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent onRequestClose={onDeny}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <View style={s.iconWrap}>
            <Ionicons name="location" size={28} color={colors.primary} />
          </View>

          <Text style={s.title}>HBS collects your location</Text>

          <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false}>
            <Text style={s.body}>
              HBS collects your device's precise location{' '}
              <Text style={s.bold}>in the background, even when the app is closed or not in use</Text>,
              while you are checked in / on duty. This lets your manager see your field route,
              verify client visits, and record accurate check-in / check-out points for attendance.
            </Text>

            <Text style={[s.body, { marginTop: 12 }]}>
              What we collect: GPS coordinates, accuracy, speed and movement timestamps.{'\n'}
              When: only between "Check In" and "Check Out" (office hours).{'\n'}
              Why: field-staff route tracking, attendance and visit verification for your employer.{'\n'}
              Sharing: location is shared only with your organization's administrators/managers.
            </Text>

            <Text style={[s.body, { marginTop: 12 }]}>
              You can stop background location sharing at any time by tapping "Check Out", or by
              turning off location permission for HBS in your device Settings. See our{' '}
              <Text style={s.link}>Privacy Policy</Text> for full details.
            </Text>
          </ScrollView>

          <TouchableOpacity style={[s.btn, s.btnPrimary]} onPress={onAllow}>
            <Text style={s.btnPrimaryText}>Allow location access</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.btn, s.btnGhost]} onPress={onDeny}>
            <Text style={s.btnGhostText}>Not now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = (c) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  sheet: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: c.card,
    borderRadius: 20,
    padding: 22,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(229,9,20,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: c.text,
    marginBottom: 10,
  },
  body: {
    fontSize: 13.5,
    lineHeight: 20,
    color: c.text2,
  },
  bold: {
    fontWeight: '700',
    color: c.text,
  },
  link: {
    color: c.primary,
    fontWeight: '700',
  },
  btn: {
    marginTop: 16,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {
    backgroundColor: c.primary,
  },
  btnPrimaryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  btnGhost: {
    marginTop: 8,
    backgroundColor: 'transparent',
  },
  btnGhostText: {
    color: c.text2,
    fontSize: 13,
    fontWeight: '600',
  },
});
