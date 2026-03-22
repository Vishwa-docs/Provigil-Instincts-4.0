import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';

const C = {
  bg: '#F5F5F7',
  card: '#FFFFFF',
  border: '#E5E5EA',
  accent: '#0071E3',
  cyan: '#5AC8FA',
  red: '#FF3B30',
  amber: '#FF9500',
  green: '#34C759',
  text: '#1D1D1F',
  muted: '#AEAEB2',
};

const STATUS_COLORS = { healthy: C.green, warning: C.amber, critical: C.red };

function HealthBar({ score }) {
  const pct = Math.min(score * 100, 100);
  const color = pct > 80 ? C.green : pct > 50 ? C.amber : C.red;
  return (
    <View style={styles.barBg}>
      <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
    </View>
  );
}

export default function FleetScreen({ navigation }) {
  const [meters, setMeters] = useState([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.getMeters();
      setMeters(data.meters || data);
    } catch (e) {
      console.warn('Fleet load failed', e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const filtered = meters.filter(
    (m) =>
      m.name?.toLowerCase().includes(search.toLowerCase()) ||
      m.id?.toLowerCase().includes(search.toLowerCase())
  );

  const renderItem = ({ item: m }) => (
    <TouchableOpacity
      style={styles.meterCard}
      onPress={() => navigation.navigate('MeterDetail', { meterId: m.id })}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.meterName} numberOfLines={1}>
            {m.name}
          </Text>
          <Text style={styles.meterId}>{m.id}</Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: (STATUS_COLORS[m.status] || C.muted) + '20' },
          ]}
        >
          <View
            style={[
              styles.statusDot,
              { backgroundColor: STATUS_COLORS[m.status] || C.muted },
            ]}
          />
          <Text
            style={[
              styles.statusText,
              { color: STATUS_COLORS[m.status] || C.muted },
            ]}
          >
            {m.status}
          </Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={{ flex: 1 }}>
          <Text style={styles.healthLabel}>Health</Text>
          <HealthBar score={m.health_score ?? 1} />
        </View>
        <Text style={styles.healthPct}>
          {((m.health_score ?? 1) * 100).toFixed(0)}%
        </Text>
      </View>

      {m.suspected_issue && m.suspected_issue !== 'healthy' && (
        <Text style={styles.issueText}>
          ⚠ {m.suspected_issue.replace(/_/g, ' ')}
        </Text>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Search */}
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search meters…"
          placeholderTextColor={C.muted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(m) => m.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.cyan} />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>No meters found.</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  searchWrap: { paddingHorizontal: 16, paddingVertical: 10 },
  searchInput: {
    backgroundColor: C.card,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: C.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  meterCard: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meterName: { fontSize: 15, fontWeight: '700', color: C.text },
  meterId: { fontSize: 11, color: C.muted, marginTop: 2 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 5,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  cardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 10,
  },
  healthLabel: { fontSize: 11, color: C.muted, marginBottom: 4 },
  healthPct: { fontSize: 18, fontWeight: '700', color: C.text, width: 48, textAlign: 'right' },
  barBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: C.border,
    overflow: 'hidden',
  },
  barFill: { height: 6, borderRadius: 3 },
  issueText: {
    fontSize: 12,
    color: C.amber,
    marginTop: 8,
    textTransform: 'capitalize',
  },
  empty: { color: C.muted, textAlign: 'center', marginTop: 40, fontSize: 14 },
});
