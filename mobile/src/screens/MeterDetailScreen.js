import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
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

function ComponentRow({ name, status, healthScore }) {
  const color =
    status === 'critical' ? C.red : status === 'warning' ? C.amber : C.green;
  return (
    <View style={styles.compRow}>
      <View style={[styles.compDot, { backgroundColor: color }]} />
      <Text style={styles.compName}>{name}</Text>
      <Text style={[styles.compScore, { color }]}>
        {(healthScore * 100).toFixed(0)}%
      </Text>
    </View>
  );
}

export default function MeterDetailScreen({ route }) {
  const { meterId } = route.params;
  const [meter, setMeter] = useState(null);
  const [twin, setTwin] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [m, t] = await Promise.all([
        api.getMeter(meterId),
        api.getDigitalTwin(meterId),
      ]);
      setMeter(m);
      setTwin(t);
    } catch (e) {
      console.warn('Detail load failed', e);
    }
  }, [meterId]);

  useFocusEffect(
    useCallback(() => {
      load();
      setSummary(null);
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const requestSummary = async () => {
    setLoadingSummary(true);
    try {
      const res = await api.aiSummarize(meterId);
      setSummary(res.summary);
    } catch {
      setSummary('Unable to generate summary.');
    }
    setLoadingSummary(false);
  };

  if (!meter)
    return (
      <View style={styles.container}>
        <ActivityIndicator color={C.cyan} size="large" style={{ marginTop: 60 }} />
      </View>
    );

  const statusColor = STATUS_COLORS[meter.status] || C.muted;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 32 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.cyan} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.meterName}>{meter.name}</Text>
        <Text style={styles.meterId}>{meter.id}</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
          <View style={[styles.dot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusText, { color: statusColor }]}>{meter.status}</Text>
        </View>
      </View>

      {/* Health Score */}
      <View style={styles.healthCard}>
        <Text style={styles.label}>Health Score</Text>
        <Text style={[styles.healthValue, { color: statusColor }]}>
          {((meter.health_score ?? 1) * 100).toFixed(1)}%
        </Text>
        <View style={styles.barBg}>
          <View
            style={[
              styles.barFill,
              {
                width: `${Math.min((meter.health_score ?? 1) * 100, 100)}%`,
                backgroundColor: statusColor,
              },
            ]}
          />
        </View>
      </View>

      {/* Issue */}
      {meter.suspected_issue && meter.suspected_issue !== 'healthy' && (
        <View style={[styles.issueCard, { borderColor: C.amber + '40' }]}>
          <Text style={styles.issueTitle}>Suspected Issue</Text>
          <Text style={styles.issueValue}>
            {meter.suspected_issue.replace(/_/g, ' ')}
          </Text>
        </View>
      )}

      {/* Digital Twin Components */}
      {twin && twin.components && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Component Health</Text>
          <View style={styles.compCard}>
            {Object.values(twin.components).map((c) => (
              <ComponentRow
                key={c.name}
                name={c.name}
                status={c.status}
                healthScore={c.health_score}
              />
            ))}
          </View>
        </View>
      )}

      {/* AI Summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>AI Analysis</Text>
        {summary ? (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryText}>{summary}</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.aiButton}
            onPress={requestSummary}
            disabled={loadingSummary}
          >
            {loadingSummary ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.aiButtonText}>Generate AI Summary</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Location */}
      {meter.location_lat != null && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location</Text>
          <View style={styles.locCard}>
            <Text style={styles.locText}>
              {meter.location_lat.toFixed(4)}°N, {meter.location_lng.toFixed(4)}°E
            </Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { paddingHorizontal: 20, paddingTop: 16 },
  meterName: { fontSize: 22, fontWeight: '800', color: C.text },
  meterId: { fontSize: 13, color: C.muted, marginTop: 2 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginTop: 10,
    gap: 6,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 13, fontWeight: '600', textTransform: 'capitalize' },
  healthCard: {
    margin: 16,
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: C.border,
  },
  label: { fontSize: 13, color: C.muted },
  healthValue: { fontSize: 36, fontWeight: '800', marginTop: 2 },
  barBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: C.border,
    marginTop: 12,
    overflow: 'hidden',
  },
  barFill: { height: 6, borderRadius: 3 },
  issueCard: {
    marginHorizontal: 16,
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
  },
  issueTitle: { fontSize: 12, color: C.muted },
  issueValue: { fontSize: 15, fontWeight: '600', color: C.amber, marginTop: 4, textTransform: 'capitalize' },
  section: { marginHorizontal: 16, marginTop: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 10 },
  compCard: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  compRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 10,
  },
  compDot: { width: 8, height: 8, borderRadius: 4 },
  compName: { flex: 1, fontSize: 13, color: C.text },
  compScore: { fontSize: 14, fontWeight: '700', width: 42, textAlign: 'right' },
  aiButton: {
    backgroundColor: C.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  aiButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  summaryCard: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: C.accent + '40',
  },
  summaryText: { color: C.text, fontSize: 13, lineHeight: 20 },
  locCard: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  locText: { color: C.text, fontSize: 14 },
});
