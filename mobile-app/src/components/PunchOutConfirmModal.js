// src/components/PunchOutConfirmModal.js
// "Are you sure you want to punch out?" sheet for the employee dashboard.
//
// The native Alert.alert() was easy to blow past — two small text buttons, no
// context about the shift you were ending. This shows punch-in time, how long
// you've worked so far, and what actually happens (day closes, tracking stops)
// with a clearly separated destructive action.
import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

const fmtTime = (d) => {
  if (!d) return '--:--';
  try {
    return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  } catch { return '--:--'; }
};

export default function PunchOutConfirmModal({
  visible,
  onCancel,
  onConfirm,
  loading = false,
  punchInAt = null,
}) {
  const { colors } = useTheme();
  const [now, setNow] = useState(Date.now());

  // Keep the "worked so far" figure ticking while the sheet is open.
  useEffect(() => {
    if (!visible) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, [visible]);

  let worked = null;
  if (punchInAt) {
    const mins = Math.max(0, Math.floor((now - new Date(punchInAt).getTime()) / 60000));
    worked = `${Math.floor(mins / 60)}h ${mins % 60}m`;
  }

  const s = styles(colors);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={s.overlay}>
        <View style={[s.sheet, { backgroundColor: colors.card }]}>
          <View style={s.iconWrap}>
            <Ionicons name="log-out-outline" size={28} color="#EF4444" />
          </View>

          <Text style={[s.title, { color: colors.text }]}>Punch Out?</Text>
          <Text style={[s.sub, { color: colors.text2 }]}>
            This ends your working day. You will not be able to punch in again
            today, and location sharing will stop.
          </Text>

          <View style={[s.infoBox, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
            <View style={s.infoRow}>
              <View style={s.infoLabel}>
                <Ionicons name="time-outline" size={14} color={colors.text3} />
                <Text style={[s.infoLabelTxt, { color: colors.text2 }]}>Punched in at</Text>
              </View>
              <Text style={[s.infoVal, { color: colors.text }]}>{fmtTime(punchInAt)}</Text>
            </View>
            {worked && (
              <View style={[s.infoRow, { marginTop: 8 }]}>
                <View style={s.infoLabel}>
                  <Ionicons name="hourglass-outline" size={14} color={colors.text3} />
                  <Text style={[s.infoLabelTxt, { color: colors.text2 }]}>Worked so far</Text>
                </View>
                <Text style={[s.infoVal, { color: colors.text }]}>{worked}</Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={[s.btn, { backgroundColor: '#EF4444' }]}
            onPress={onConfirm}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : (
                <>
                  <Ionicons name="log-out-outline" size={17} color="#fff" />
                  <Text style={s.btnTxt}>Yes, Punch Out</Text>
                </>
              )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.btn, s.btnGhost, { borderColor: colors.border }]}
            onPress={onCancel}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Text style={[s.btnTxt, { color: colors.text2 }]}>No, keep working</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = (colors) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  sheet: { borderRadius: 22, padding: 22, alignItems: 'center' },
  iconWrap: {
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: 'rgba(239,68,68,0.12)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  title: { fontSize: 19, fontWeight: '800', marginBottom: 6 },
  sub: { fontSize: 13, lineHeight: 19, textAlign: 'center', marginBottom: 16 },
  infoBox: { width: '100%', borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 18 },
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  infoLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoLabelTxt: { fontSize: 12.5 },
  infoVal: { fontSize: 14, fontWeight: '700' },
  btn: {
    width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 14,
  },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1, marginTop: 8 },
  btnTxt: { color: '#fff', fontSize: 14.5, fontWeight: '700' },
});
