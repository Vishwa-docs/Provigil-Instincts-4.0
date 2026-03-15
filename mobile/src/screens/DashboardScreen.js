import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';

const C = {
  bg: '#0a0f1e',
  card: '#131b3a',
  border: '#1e2a4a',
  accent: '#3b82f6',
  cyan: '#06b6d4',
  red: '#ef4444',
  amber: '#f59e0b',
  green: '#10b981',
  text: '#e2e8f0',
  muted: '#64748b',
};

function StatCard({ label, value, color }) {
  return (
    <View style={[styles.stat, { borderColor: color + '30' }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function DashboardScreen({ navigation }) {
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, a] = await Promise.all([
        api.getDashboardStats(),
        api.getAlerts(),
      ]);
      setStats(s);
      // Show latest 5 critical/warning alerts
      setAlerts(
        a
          .filter((x) => x.severity === 'critical' || x.severity === 'warning')
          .slice(0, 5)
      );
    } catch (e) {
      console.warn('Dashboard load failed', e);
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

  if (!stats)
    return (
      <View style={styles.container}>
        <Text style={styles.loading}>Loading…</Text>
      </View>
    );

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
        <Text style={styles.title}>Pro-Vigil</Text>
        <Text style={styles.subtitle}>Predictive Maintenance</Text>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <StatCard label="Total" value={stats.total_meters} color={C.accent} />
        <StatCard label="Healthy" value={stats.healthy} color={C.green} />
        <StatCard label="Warning" value={stats.warning} color={C.amber} />
        <StatCard label="Critical" value={stats.critical} color={C.red} />
      </View>

      {/* Health Score */}
      <View style={styles.healthCard}>
        <Text style={styles.healthLabel}>Fleet Health Score</Text>
        <Text
          style={[
            styles.healthValue,
            {
              color:
                stats.avg_health_score > 0.8
                  ? C.green
                  : stats.avg_health_score > 0.6
                  ? C.amber
                  : C.red,
            },
          ]}
        >
          {(stats.avg_health_score * 100).toFixed(1)}%
        </Text>
        {/* Simple bar */}
        <View style={styles.barBg}>
          <View
            style={[
              styles.barFill,
              {
                width: `${Math.min(stats.avg_health_score * 100, 100)}%`,
                backgroundColor:
                  stats.avg_health_score > 0.8
                    ? C.green
                    : stats.avg_health_score > 0.6
                    ? C.amber
                    : C.red,
              },
            ]}
          />
        </View>
      </View>

      {/* Alerts 24 h */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Alerts (24h): {stats.total_alerts_24h}
        </Text>
      </View>

      {/* Recent Critical Alerts */}
      {alerts.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Alerts</Text>
          {alerts.map((a) => (
            <TouchableOpacity
              key={a.id}
              style={styles.alertRow}
              onPress={() =>
                navigation.navigate('Fleet', {
                  screen: 'MeterDetail',
                  params: { meterId: a.meter_id },
                })
              }
            >
              <View
                style={[
                  styles.severityDot,
                  {
                    backgroundColor:
                      a.severity === 'critical' ? C.red : C.amber,
                  },
                ]}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.alertType} numberOfLines={1}>
                  {a.alert_type}
                </Text>
                <Text style={styles.alertMeter} numberOfLines={1}>
                  {a.meter_id}
                </Text>
              </View>
              <Text
                style={[
                  styles.alertSeverity,
                  {
                    color:
                      a.severity === 'critical' ? C.red : C.amber,
                  },
                ]}
              >
                {a.severity}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  loading: { color: C.muted, textAlign: 'center', marginTop: 60, fontSize: 16 },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 26, fontWeight: '800', color: C.text },
  subtitle: { fontSize: 13, color: C.muted, marginTop: 2 },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    marginTop: 16,
    gap: 8,
  },
  stat: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
  statValue: { fontSize: 24, fontWeight: '700' },
  statLabel: { fontSize: 11, color: C.muted, marginTop: 4 },
  healthCard: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: C.border,
  },
  healthLabel: { fontSize: 14, color: C.muted },
  healthValue: { fontSize: 36, fontWeight: '800', marginTop: 4 },
  barBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: C.border,
    marginTop: 12,
    overflow: 'hidden',
  },
  barFill: { height: 6, borderRadius: 3 },
  section: { marginHorizontal: 16, marginTop: 20 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 10 },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    gap: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  severityDot: { width: 8, height: 8, borderRadius: 4 },
  alertType: { fontSize: 13, fontWeight: '600', color: C.text },
  alertMeter: { fontSize: 11, color: C.muted, marginTop: 2 },
  alertSeverity: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
});
