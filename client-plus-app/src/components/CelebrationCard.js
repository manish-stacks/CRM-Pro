// src/components/CelebrationCard.js
// Birthday + Work-Anniversary wishing card for the employee mobile app.
// Mirrors the web CRM's CelebrationWidget: fetches the same
// GET /dashboard/celebrations endpoint, shows a one-time-per-day animated
// popup card the moment the employee opens their dashboard after login,
// plus a small persistent "Today's Celebrations" strip on the dashboard.
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, Animated, Easing,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { EmployeeAPI } from '../services/employee.api';

function getInitials(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase()).join('');
}

function Avatar({ name, tint, tintText }) {
  return (
    <View style={[avatarStyles.wrap, { backgroundColor: tint }]}>
      <Text style={[avatarStyles.text, { color: tintText }]}>{getInitials(name)}</Text>
    </View>
  );
}

const avatarStyles = StyleSheet.create({
  wrap: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 15, fontWeight: '800' },
});

export default function CelebrationCard() {
  const { colors } = useTheme();
  const [data, setData] = useState(null);
  const [visible, setVisible] = useState(false);
  const scale = useRef(new Animated.Value(0.7)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;
    EmployeeAPI.getCelebrations()
      .then(async (res) => {
        if (cancelled) return;
        const d = res.data?.data || res.data;
        console.log('[CelebrationCard] celebrations response:', JSON.stringify(d));
        setData(d);
        const todayCount = (d?.today?.birthdays?.length || 0) + (d?.today?.anniversaries?.length || 0);
        if (todayCount === 0) return;
        const seenKey = 'celebration_seen_' + new Date().toDateString();
        const seen = await AsyncStorage.getItem(seenKey);
        if (!seen) {
          setVisible(true);
          await AsyncStorage.setItem(seenKey, '1');
        }
      })
      .catch((e) => {
        // TEMP DIAGNOSTIC — remove once the mobile-vs-web mismatch is found.
        console.log('[CelebrationCard] fetch FAILED:', e?.status, e?.message);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (visible) {
      scale.setValue(0.7);
      opacity.setValue(0);
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 220, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const close = () => setVisible(false);

  if (!data) return null;

  const todayBirthdays = data.today?.birthdays || [];
  const todayAnniversaries = data.today?.anniversaries || [];
  const todayCount = todayBirthdays.length + todayAnniversaries.length;

  return (
    <>
      {/* Persistent strip on the dashboard, in case the popup was already dismissed today */}
      {todayCount > 0 && (
        <View style={[strip.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={strip.headerRow}>
            <Text style={strip.headerEmoji}>🎉</Text>
            <View style={{ flex: 1 }}>
              <Text style={[strip.title, { color: colors.text }]}>Today's Celebrations</Text>
              <Text style={[strip.subtitle, { color: colors.text2 }]}>Don't forget to wish!</Text>
            </View>
          </View>

          {todayBirthdays.map((b) => (
            <View key={'b' + b.id} style={[strip.row, { borderColor: 'rgba(236,72,153,0.25)', backgroundColor: 'rgba(236,72,153,0.06)' }]}>
              <Avatar name={b.name} tint="rgba(236,72,153,0.18)" tintText="#DB2777" />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[strip.name, { color: colors.text }]} numberOfLines={1}>{b.name}</Text>
                <Text style={strip.meta}>🎂 Happy Birthday{b.department ? ` • ${b.department}` : ''}</Text>
              </View>
            </View>
          ))}

          {todayAnniversaries.map((a) => (
            <View key={'a' + a.id} style={[strip.row, { borderColor: 'rgba(168,85,247,0.25)', backgroundColor: 'rgba(168,85,247,0.06)' }]}>
              <Avatar name={a.name} tint="rgba(168,85,247,0.18)" tintText="#7E22CE" />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[strip.name, { color: colors.text }]} numberOfLines={1}>{a.name}</Text>
                <Text style={strip.meta}>
                  {a.years === 0 ? '👋 Welcome to the team!' : `🎊 ${a.years} year${a.years > 1 ? 's' : ''} at company`}
                  {a.department ? ` • ${a.department}` : ''}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* One-per-day animated popup */}
      <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
        <View style={modal.backdrop}>
          <Animated.View style={[modal.card, { backgroundColor: colors.card, opacity, transform: [{ scale }] }]}>
            <TouchableOpacity style={modal.closeBtn} onPress={close}>
              <Text style={{ fontSize: 20, color: colors.text2 }}>×</Text>
            </TouchableOpacity>

            <Text style={modal.bigEmoji}>🎉</Text>
            <Text style={[modal.heading, { color: colors.text }]}>Celebrations Today!</Text>
            <Text style={[modal.sub, { color: colors.text2 }]}>Take a moment to send wishes</Text>

            <View style={{ width: '100%', marginTop: 18 }}>
              {todayBirthdays.map((b) => (
                <View key={'pb' + b.id} style={[modal.itemRow, { backgroundColor: 'rgba(236,72,153,0.08)' }]}>
                  <Avatar name={b.name} tint="rgba(236,72,153,0.2)" tintText="#DB2777" />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[modal.itemName, { color: colors.text }]} numberOfLines={1}>{b.name}</Text>
                    <Text style={modal.itemTag}>🎂 Birthday</Text>
                  </View>
                </View>
              ))}
              {todayAnniversaries.map((a) => (
                <View key={'pa' + a.id} style={[modal.itemRow, { backgroundColor: 'rgba(168,85,247,0.08)' }]}>
                  <Avatar name={a.name} tint="rgba(168,85,247,0.2)" tintText="#7E22CE" />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[modal.itemName, { color: colors.text }]} numberOfLines={1}>{a.name}</Text>
                    <Text style={modal.itemTag}>
                      {a.years === 0 ? '👋 Welcome to the team!' : `✨ ${a.years} year${a.years > 1 ? 's' : ''} anniversary`}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={[modal.doneBtn, { backgroundColor: colors.primary }]}
              onPress={close}
            >
              <Text style={modal.doneText}>Sent Wishes! 💌</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

const strip = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1.5, padding: 14, marginHorizontal: 20, marginBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  headerEmoji: { fontSize: 22 },
  title: { fontSize: 14, fontWeight: '800' },
  subtitle: { fontSize: 11, marginTop: 1 },
  row: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, padding: 10, marginTop: 8 },
  name: { fontSize: 13, fontWeight: '700' },
  meta: { fontSize: 11, color: '#8A8A8A', marginTop: 2 },
});

const modal = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 400, borderRadius: 20, padding: 22, alignItems: 'center' },
  closeBtn: { position: 'absolute', top: 10, right: 12, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  bigEmoji: { fontSize: 52, marginBottom: 6 },
  heading: { fontSize: 20, fontWeight: '800' },
  sub: { fontSize: 13, marginTop: 4 },
  itemRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 10, marginTop: 8, width: '100%' },
  itemName: { fontSize: 14, fontWeight: '700' },
  itemTag: { fontSize: 11, color: '#8A8A8A', marginTop: 2 },
  doneBtn: { marginTop: 20, width: '100%', paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
  doneText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});