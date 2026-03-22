import { registerRootComponent } from 'expo';
import React from 'react';
import { View, StyleSheet } from 'react-native';
import InspectorScreen from './src/screens/InspectorScreen';

function App() {
  return (
    <View style={styles.root}>
      <InspectorScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    minHeight: '100%',
    backgroundColor: '#F5F5F7',
  },
});

registerRootComponent(App);
