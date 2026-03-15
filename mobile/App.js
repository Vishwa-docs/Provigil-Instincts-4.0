import React from 'react';
import { StatusBar, Text as RNText } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import DashboardScreen from './src/screens/DashboardScreen';
import FleetScreen from './src/screens/FleetScreen';
import MeterDetailScreen from './src/screens/MeterDetailScreen';
import AlertsScreen from './src/screens/AlertsScreen';
import InspectorScreen from './src/screens/InspectorScreen';

const C = {
  bg: '#0a0f1e',
  card: '#131b3a',
  border: '#1e2a4a',
  accent: '#3b82f6',
  cyan: '#06b6d4',
  text: '#e2e8f0',
  muted: '#64748b',
};

const Tab = createBottomTabNavigator();
const FleetStack = createNativeStackNavigator();

const stackScreenOpts = {
  headerStyle: { backgroundColor: C.card },
  headerTintColor: C.text,
  headerTitleStyle: { fontWeight: '700' },
};

function FleetStackScreen() {
  return (
    <FleetStack.Navigator screenOptions={stackScreenOpts}>
      <FleetStack.Screen
        name="FleetList"
        component={FleetScreen}
        options={{ title: 'Meter Fleet' }}
      />
      <FleetStack.Screen
        name="MeterDetail"
        component={MeterDetailScreen}
        options={{ title: 'Meter Detail' }}
      />
    </FleetStack.Navigator>
  );
}

// Simple Unicode tab icons (avoids adding vector-icons dependency)
const TAB_ICONS = {
  Dashboard: { focused: '\u25C9', unfocused: '\u25CB' },   // ◉ / ○
  Fleet:     { focused: '\u2630', unfocused: '\u2630' },     // ☰
  Alerts:    { focused: '\u26A0', unfocused: '\u26A0' },     // ⚠
  Inspector: { focused: '\u25CE', unfocused: '\u25CE' },     // ◎
};

export default function App() {
  return (
    <NavigationContainer
      theme={{
        dark: true,
        colors: {
          primary: C.accent,
          background: C.bg,
          card: C.card,
          text: C.text,
          border: C.border,
          notification: C.cyan,
        },
        fonts: {
          regular: { fontFamily: 'System', fontWeight: '400' },
          medium: { fontFamily: 'System', fontWeight: '500' },
          bold: { fontFamily: 'System', fontWeight: '700' },
          heavy: { fontFamily: 'System', fontWeight: '900' },
        },
      }}
    >
      <StatusBar barStyle="light-content" />
      <Tab.Navigator
        initialRouteName="Inspector"
        screenOptions={({ route }) => ({
          headerStyle: { backgroundColor: C.card },
          headerTintColor: C.text,
          headerTitleStyle: { fontWeight: '700' },
          lazy: true,
          tabBarStyle: {
            backgroundColor: C.card,
            borderTopColor: C.border,
            paddingBottom: 4,
            height: 56,
          },
          tabBarActiveTintColor: C.cyan,
          tabBarInactiveTintColor: C.muted,
          tabBarIcon: ({ focused, color }) => {
            const icons = TAB_ICONS[route.name] || TAB_ICONS.Dashboard;
            const icon = focused ? icons.focused : icons.unfocused;
            return <RNText style={{ color, fontSize: 20 }}>{icon}</RNText>;
          },
        })}
      >
        <Tab.Screen name="Dashboard" component={DashboardScreen} />
        <Tab.Screen
          name="Fleet"
          component={FleetStackScreen}
          options={{ headerShown: false }}
        />
        <Tab.Screen name="Alerts" component={AlertsScreen} />
        <Tab.Screen
          name="Inspector"
          component={InspectorScreen}
          options={{ title: 'Field Vision' }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
