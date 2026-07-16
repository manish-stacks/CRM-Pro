// src/components/DatePickerField.js
// Zero-dependency calendar picker (no @react-native-community/datetimepicker
// needed — nothing new to install / rebuild).
// Usage:
//   <DatePickerField label="VISIT DATE *" value={date} onChange={setDate} minToday />
// `value` / `onChange` use the "YYYY-MM-DD" string format the API expects.
import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export const toISO = (d) => {
  const dt = d instanceof Date ? d : new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const prettyDate = (iso) => {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export function DatePickerField({ label, value, onChange, placeholder = 'Select date', minToday = false, icon = 'calendar-outline' }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const s = styles(colors);

  return (
    <View style={{ marginBottom: 16 }}>
      {label ? <Text style={s.fieldLabel}>{label}</Text> : null}
      <TouchableOpacity
        activeOpacity={0.75}
        style={[s.fieldWrap, { backgroundColor: colors.bg2, borderColor: colors.border }]}
        onPress={() => setOpen(true)}
      >
        <Ionicons name={icon} size={17} color={colors.text3} />
        <Text style={{ flex: 1, fontSize: 15, paddingVertical: 12, color: value ? colors.text : colors.text3 }}>
          {value ? prettyDate(value) : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.text3} />
      </TouchableOpacity>

      <CalendarModal
        visible={open}
        value={value}
        minToday={minToday}
        onClose={() => setOpen(false)}
        onPick={(iso) => { onChange(iso); setOpen(false); }}
      />
    </View>
  );
}

export function CalendarModal({ visible, value, onPick, onClose, minToday = false, title = 'Select Date' }) {
  const { colors } = useTheme();
  const s = styles(colors);
  const initial = value ? new Date(`${value}T00:00:00`) : new Date();
  const [cursor, setCursor] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1));

  const todayISO = toISO(new Date());

  const cells = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1).getDay();
    const days = new Date(year, month + 1, 0).getDate();
    const out = [];
    for (let i = 0; i < first; i++) out.push(null);
    for (let d = 1; d <= days; d++) out.push(toISO(new Date(year, month, d)));
    return out;
  }, [cursor]);

  const shift = (n) => setCursor(c => new Date(c.getFullYear(), c.getMonth() + n, 1));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={[s.sheet, { backgroundColor: colors.card }]}>
          <View style={s.calHeader}>
            <Text style={[s.calTitle, { color: colors.text }]}>{title}</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color={colors.text2} /></TouchableOpacity>
          </View>

          <View style={s.monthRow}>
            <TouchableOpacity onPress={() => shift(-1)} style={s.navBtn}>
              <Ionicons name="chevron-back" size={18} color={colors.text} />
            </TouchableOpacity>
            <Text style={[s.monthTxt, { color: colors.text }]}>
              {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
            </Text>
            <TouchableOpacity onPress={() => shift(1)} style={s.navBtn}>
              <Ionicons name="chevron-forward" size={18} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={s.dowRow}>
            {DOW.map((d, i) => (
              <Text key={i} style={[s.dowTxt, { color: colors.text3 }]}>{d}</Text>
            ))}
          </View>

          <View style={s.grid}>
            {cells.map((iso, i) => {
              if (!iso) return <View key={i} style={s.cell} />;
              const selected = iso === value;
              const isToday = iso === todayISO;
              const disabled = minToday && iso < todayISO;
              return (
                <TouchableOpacity
                  key={i}
                  disabled={disabled}
                  style={s.cell}
                  onPress={() => onPick(iso)}
                >
                  <View style={[
                    s.dayBubble,
                    selected && { backgroundColor: colors.primary },
                    !selected && isToday && { borderWidth: 1.5, borderColor: colors.primary },
                  ]}>
                    <Text style={{
                      fontSize: 14,
                      fontWeight: selected || isToday ? '800' : '500',
                      color: selected ? '#fff' : disabled ? colors.text3 : colors.text,
                      opacity: disabled ? 0.4 : 1,
                    }}>
                      {Number(iso.slice(8, 10))}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={s.quickRow}>
            <TouchableOpacity style={[s.quickBtn, { borderColor: colors.border }]} onPress={() => onPick(todayISO)}>
              <Text style={{ color: colors.text2, fontWeight: '700', fontSize: 12 }}>Today</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.quickBtn, { borderColor: colors.border }]}
              onPress={() => { const d = new Date(); d.setDate(d.getDate() + 1); onPick(toISO(d)); }}
            >
              <Text style={{ color: colors.text2, fontWeight: '700', fontSize: 12 }}>Tomorrow</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.quickBtn, { borderColor: colors.border }]}
              onPress={() => { const d = new Date(); d.setDate(d.getDate() + 7); onPick(toISO(d)); }}
            >
              <Text style={{ color: colors.text2, fontWeight: '700', fontSize: 12 }}>+1 Week</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// Simple time picker (30-min slots) — same zero-dependency approach
export function TimePickerField({ label, value, onChange, placeholder = 'Select time' }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const s = styles(colors);

  const slots = useMemo(() => {
    const out = [];
    for (let h = 7; h <= 21; h++) {
      for (const m of ['00', '30']) out.push(`${String(h).padStart(2, '0')}:${m}`);
    }
    return out;
  }, []);

  const label12 = (t) => {
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hh = h % 12 === 0 ? 12 : h % 12;
    return `${hh}:${String(m).padStart(2, '0')} ${ampm}`;
  };

  return (
    <View style={{ marginBottom: 16 }}>
      {label ? <Text style={s.fieldLabel}>{label}</Text> : null}
      <TouchableOpacity
        activeOpacity={0.75}
        style={[s.fieldWrap, { backgroundColor: colors.bg2, borderColor: colors.border }]}
        onPress={() => setOpen(true)}
      >
        <Ionicons name="time-outline" size={17} color={colors.text3} />
        <Text style={{ flex: 1, fontSize: 15, paddingVertical: 12, color: value ? colors.text : colors.text3 }}>
          {value ? label12(value) : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.text3} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={() => setOpen(false)}>
          <TouchableOpacity activeOpacity={1} style={[s.sheet, { backgroundColor: colors.card, maxHeight: 420 }]}>
            <View style={s.calHeader}>
              <Text style={[s.calTitle, { color: colors.text }]}>Select Time</Text>
              <TouchableOpacity onPress={() => setOpen(false)}><Ionicons name="close" size={22} color={colors.text2} /></TouchableOpacity>
            </View>
            <View style={s.slotWrap}>
              {slots.map(t => (
                <TouchableOpacity
                  key={t}
                  style={[
                    s.slot,
                    { borderColor: colors.border },
                    value === t && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                  onPress={() => { onChange(t); setOpen(false); }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: value === t ? '#fff' : colors.text2 }}>{label12(t)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = (c) => StyleSheet.create({
  fieldLabel: { fontSize: 12, fontWeight: '700', color: c.text2, marginBottom: 8, letterSpacing: 0.5 },
  fieldWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 22 },
  sheet: { borderRadius: 22, padding: 18 },
  calHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  calTitle: { fontSize: 17, fontWeight: '800' },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  navBtn: { padding: 8 },
  monthTxt: { fontSize: 15, fontWeight: '800' },
  dowRow: { flexDirection: 'row', marginBottom: 4 },
  dowTxt: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dayBubble: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  quickRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  quickBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, borderWidth: 1.5, alignItems: 'center' },
  slotWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slot: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5 },
});

export default DatePickerField;
