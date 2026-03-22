import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  RefreshControl,
  TouchableOpacity,
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

const SEV_COLORS = { critical: C.red, warning: C.amber, info: C.accent };

export default function AlertsScreen() {
  const [alerts, setAlerts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');

  const load = useCallback(async () => {
    try {
      const data = await api.getAlerts();
      setAlerts(data);
    } catch (e) {
      console.warn('Alerts load failed', e);
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

  const filtered =
    filter === 'all'
      ? alerts
      : alerts.filter((a) => a.severity === filter);

  const renderItem = ({ item: a }) => {
    const color = SEV_COLORS[a.severity] || C.muted;
    return (
      <View style={[styles.alertCard, { borderLeftColor: color }]}>
        <View style={styles.alertHeader}>
          <Text style={[styles.severity, { color }]}>
            {a.severity?.toUpperCase()}
          </Text>
          <Text style={styles.meterId}>{a.meter_id}</Text>
        </View>
        <Text style={styles.alertType}>
          {a.alert_type?.replace(/_/g, ' ')}
        </Text>
        <Text style={styles.alertMessage} numberOfLines={2}>
          {a.message}
        </Text>
        <Text style={styles.timestamp}>
          {a.created_at
            ? new Date(a.created_at).toLocaleString()
            : ''}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Filter pills */}
      <View style={styles.filterRow}>
        {['all', 'critical', 'warning', 'info'].map((f) => (
          <TouchableOpacity
            key={f}
            style={[
              styles.pill,
              filter === f && styles.pillActive,
            ]}
            onPress={() => setFilter(f)}
          >
            <Text
              style={[
                styles.pillText,
                filter === f && styles.pillTextActive,
              ]}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(a) => String(a.id)}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.cyan} />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>No alerts.</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  pillActive: {
    backgroundColor: C.accent + '25',
    borderColor: C.accent,
  },
  pillText: { fontSize: 12, color: C.muted, fontWeight: '600' },
  pillTextActive: { color: C.accent },
  alertCard: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.border,
    borderLeftWidth: 4,
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  severity: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  meterId: { fontSize: 11, color: C.muted },
  alertType: {
    fontSize: 14,
    fontWeight: '600',
    color: C.text,
    marginTop: 6,
    textTransform: 'capitalize',
  },
  alertMessage: {
    fontSize: 12,
    color: C.muted,
    marginTop: 4,
    lineHeight: 18,
  },
  timestamp: { fontSize: 10, color: C.muted, marginTop: 8 },
  empty: { color: C.muted, textAlign: 'center', marginTop: 40, fontSize: 14 },
});
