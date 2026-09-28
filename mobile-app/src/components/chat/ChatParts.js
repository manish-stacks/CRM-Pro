import React, { useState, useMemo } from 'react';
import { View, Text, Image, TextInput, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { isOnline, presenceLabel, initialsOf } from '../../services/chat.api';

// Round avatar: photo → initials (people) / group icon, plus optional green "online" dot.
export function ChatAvatar({ name, avatar, isGroup, online, size = 44, colors }) {
  return (
    <View style={{ width: size, height: size }}>
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primary + '20', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {avatar ? (
          <Image source={{ uri: avatar }} style={{ width: size, height: size }} />
        ) : isGroup ? (
          <Ionicons name="people" size={size * 0.46} color={colors.primary} />
        ) : (
          <Text style={{ color: colors.primary, fontWeight: '800', fontSize: size * 0.34 }}>{initialsOf(name)}</Text>
        )}
      </View>
      {online ? (
        <View style={{ position: 'absolute', right: 0, bottom: 0, width: size * 0.28, height: size * 0.28, borderRadius: size * 0.14, backgroundColor: '#22C55E', borderWidth: 2, borderColor: colors.bg }} />
      ) : null}
    </View>
  );
}

// Searchable list of people. Search matches name OR role; "Active now" chip
// filters to online users; online users are always sorted first.
export function PersonPicker({ users, selectedIds, multi, onToggle, colors, excludeIds = [], maxHeight = 380 }) {
  const [q, setQ] = useState('');
  const [onlyActive, setOnlyActive] = useState(false);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return users
      .filter(u => !excludeIds.includes(u.id))
      .filter(u => !onlyActive || isOnline(u.lastActiveAt))
      .filter(u => !term || (u.name || '').toLowerCase().includes(term) || (u.role || '').replace(/_/g, ' ').toLowerCase().includes(term))
      .sort((a, b) => (isOnline(b.lastActiveAt) ? 1 : 0) - (isOnline(a.lastActiveAt) ? 1 : 0) || (a.name || '').localeCompare(b.name || ''));
  }, [users, q, onlyActive, excludeIds]);

  const activeCount = users.filter(u => !excludeIds.includes(u.id) && isOnline(u.lastActiveAt)).length;

  return (
    <View>
      <View style={[p.searchWrap, { backgroundColor: colors.bg2, borderColor: colors.border }]}>
        <Ionicons name="search-outline" size={18} color={colors.text3} />
        <TextInput
          style={{ flex: 1, fontSize: 14, color: colors.text }}
          value={q}
          onChangeText={setQ}
          placeholder="Search by name or role..."
          placeholderTextColor={colors.text3}
          autoCorrect={false}
        />
        {q ? <TouchableOpacity onPress={() => setQ('')}><Ionicons name="close-circle" size={18} color={colors.text3} /></TouchableOpacity> : null}
      </View>

      <View style={{ flexDirection: 'row', marginBottom: 8 }}>
        <TouchableOpacity
          onPress={() => setOnlyActive(v => !v)}
          style={[p.chip, { backgroundColor: onlyActive ? '#22C55E' : colors.bg2, borderColor: onlyActive ? '#22C55E' : colors.border }]}
        >
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: onlyActive ? '#fff' : '#22C55E' }} />
          <Text style={{ fontSize: 12, fontWeight: '700', color: onlyActive ? '#fff' : colors.text2 }}>Active now ({activeCount})</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={list}
        keyExtractor={(u) => u.id}
        style={{ maxHeight }}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          const sel = selectedIds.includes(item.id);
          const online = isOnline(item.lastActiveAt);
          return (
            <TouchableOpacity onPress={() => onToggle(item)} style={[p.row, { borderColor: colors.border, backgroundColor: sel ? colors.primary + '12' : 'transparent' }]}>
              <ChatAvatar name={item.name} avatar={item.avatar} online={online} size={40} colors={colors} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14 }} numberOfLines={1}>{item.name}</Text>
                <Text style={{ color: online ? '#16A34A' : colors.text3, fontSize: 12 }} numberOfLines={1}>
                  {(item.role || '').replace(/_/g, ' ')}{presenceLabel(item.lastActiveAt) ? ` · ${presenceLabel(item.lastActiveAt)}` : ''}
                </Text>
              </View>
              <Ionicons
                name={multi ? (sel ? 'checkbox' : 'square-outline') : (sel ? 'radio-button-on' : 'radio-button-off')}
                size={22}
                color={sel ? colors.primary : colors.text3}
              />
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={<Text style={{ color: colors.text3, textAlign: 'center', paddingVertical: 24 }}>No one found</Text>}
      />
    </View>
  );
}

const p = StyleSheet.create({
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 10 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, paddingHorizontal: 6, borderBottomWidth: 1, borderRadius: 10 },
});
