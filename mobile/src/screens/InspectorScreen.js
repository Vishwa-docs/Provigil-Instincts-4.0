import React, { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  Animated,
  Platform,
} from 'react-native';
import * as Speech from 'expo-speech';

let CameraView = null;
let useCameraPermissions = null;
try {
  const cam = require('expo-camera');
  CameraView = cam.CameraView;
  useCameraPermissions = cam.useCameraPermissions;
} catch (e) {
  // Camera module not available (web or missing native module)
}

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
  overlay: 'rgba(5, 10, 25, 0.82)',
};

const DEMO_RESULT = {
  title: 'Loose wire detected',
  reason: 'Detected by Cosmos Reason 2',
  summary:
    'Video evidence suggests an unstable connection near the observed electrical point. Immediate field inspection and terminal tightening recommended.',
  severity: 'warning',
};

const PROCESSING_STEPS = [
  'Uploading inspection clip…',
  'Running Cosmos visual reasoning…',
  'Verifying connection stability…',
];

const MAX_RECORDING_SECONDS = 20;
const PROCESSING_DELAY_MS = 3200;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Wrapper so the hook is only called when expo-camera is available
function useCameraPermissionsSafe() {
  if (useCameraPermissions) {
    return useCameraPermissions();
  }
  return [null, () => Promise.resolve({ granted: false })];
}

export default function InspectorScreen() {
  const [permission, requestPermission] = useCameraPermissionsSafe();
  const cameraRef = useRef(null);
  const [result, setResult] = useState(null);
  const [stage, setStage] = useState('idle'); // idle | recording | processing | result
  const [cameraReady, setCameraReady] = useState(false);
  const [useMockCamera, setUseMockCamera] = useState(!CameraView);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [processingStep, setProcessingStep] = useState(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef(null);

  // Pulse animation during processing
  useEffect(() => {
    if (stage !== 'processing') return undefined;

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
    ).start();

    const interval = setInterval(() => {
      setProcessingStep((s) => (s + 1) % PROCESSING_STEPS.length);
    }, 900);

    return () => {
      clearInterval(interval);
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    };
  }, [stage]);

  // Cleanup on unmount
  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
      Speech.stop();
    },
    [],
  );

  const beginTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setRecordingSeconds(0);
    timerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const speakFinding = () => {
    Speech.stop();
    Speech.speak(
      `${DEMO_RESULT.title}. ${DEMO_RESULT.reason}. ${DEMO_RESULT.summary}`,
      { language: 'en-US', pitch: 0.92, rate: 0.82 },
    );
  };

  const runDemoAnalysis = async () => {
    setStage('processing');
    setProcessingStep(0);
    await wait(PROCESSING_DELAY_MS);
    setResult(DEMO_RESULT);
    setStage('result');
    speakFinding();
  };

  const handleStartRecording = async () => {
    if (stage === 'recording' || stage === 'processing') return;

    Speech.stop();
    setResult(null);
    setStage('recording');
    beginTimer();

    if (useMockCamera) return; // manual stop triggers analysis

    try {
      if (cameraRef.current && cameraReady) {
        const video = await cameraRef.current.recordAsync({ maxDuration: MAX_RECORDING_SECONDS });
        // When recording ends (via stop or max duration), proceed to analysis
        stopTimer();
        await runDemoAnalysis();
      }
    } catch {
      stopTimer();
      await runDemoAnalysis();
    }
  };

  const handleStopRecording = () => {
    if (stage !== 'recording') return;
    stopTimer();

    if (useMockCamera || !cameraRef.current) {
      runDemoAnalysis();
      return;
    }

    try {
      cameraRef.current.stopRecording();
    } catch {
      runDemoAnalysis();
    }
  };

  const handleReset = () => {
    setResult(null);
    setStage('idle');
    setProcessingStep(0);
    setRecordingSeconds(0);
    stopTimer();
    Speech.stop();
  };

  /* ---------- HEADER ---------- */
  const Header = () => (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>ProVigil Field Vision</Text>
      <Text style={styles.headerSub}>Loose Wire Inspector</Text>
    </View>
  );

  /* ---------- PERMISSION / LOADING ---------- */
  if (!CameraView && !useMockCamera) {
    // Camera module unavailable (e.g. web) — auto fallback to mock
    return (
      <View style={styles.container}>
        <Header />
        <View style={styles.centered}>
          <Text style={styles.promptTitle}>Camera Not Available</Text>
          <Text style={styles.promptSub}>
            Camera hardware is not accessible on this device. You can still run the demo.
          </Text>
          <Pressable style={styles.primaryBtn} onPress={() => setUseMockCamera(true)}>
            <Text style={styles.primaryBtnText}>Run Demo Without Camera</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (CameraView && !permission) {
    return (
      <View style={styles.container}>
        <Header />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={C.accent} />
        </View>
      </View>
    );
  }

  if (CameraView && !permission?.granted && !useMockCamera) {
    return (
      <View style={styles.container}>
        <Header />
        <View style={styles.centered}>
          <Text style={styles.promptTitle}>Camera Access Required</Text>
          <Text style={styles.promptSub}>
            Point your camera at a loose wire or connection point to run the field inspection.
          </Text>
          <Pressable style={styles.primaryBtn} onPress={requestPermission}>
            <Text style={styles.primaryBtnText}>Enable Camera</Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={() => setUseMockCamera(true)}>
            <Text style={styles.secondaryBtnText}>Run Demo Without Camera</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const isRecording = stage === 'recording';
  const isProcessing = stage === 'processing';
  const canRecord = useMockCamera || cameraReady;

  /* ---------- RESULT SCREEN ---------- */
  if (stage === 'result' && result) {
    return (
      <View style={styles.container}>
        <Header />
        <View style={styles.resultScreen}>
          <View style={styles.resultBadge}>
            <View style={styles.sevDot} />
            <Text style={styles.resultBadgeText}>Inspection Complete</Text>
          </View>

          <Text style={styles.resultTitle}>{result.title}</Text>
          <Text style={styles.resultReason}>{result.reason}</Text>
          <Text style={styles.resultSummary}>{result.summary}</Text>

          <View style={styles.resultActions}>
            <Pressable style={styles.primaryBtn} onPress={speakFinding}>
              <Text style={styles.primaryBtnText}>Play Voice Output</Text>
            </Pressable>
            <Pressable style={styles.secondaryBtn} onPress={handleReset}>
              <Text style={styles.secondaryBtnText}>Record Again</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  /* ---------- CAMERA / RECORDING SCREEN ---------- */
  return (
    <View style={styles.container}>
      <Header />

      <View style={styles.cameraWrap}>
        {useMockCamera ? (
          <View style={[styles.camera, styles.mockCamera]}>
            <View style={styles.overlay}>
              <View style={[styles.corner, styles.tl]} />
              <View style={[styles.corner, styles.tr]} />
              <View style={[styles.corner, styles.bl]} />
              <View style={[styles.corner, styles.br]} />
            </View>

            <View style={styles.mockContent}>
              <Text style={styles.mockIcon}>&#128247;</Text>
              <Text style={styles.mockTitle}>Preview Mode</Text>
              <Text style={styles.mockSub}>
                Camera feed simulated. Tap record to start the inspection demo.
              </Text>
            </View>

            {isRecording && (
              <View style={styles.recordingHud}>
                <View style={styles.recordingPill}>
                  <View style={styles.recordingDot} />
                  <Text style={styles.recordingText}>
                    REC {String(recordingSeconds).padStart(2, '0')}s
                  </Text>
                </View>
                <Text style={styles.recordingHint}>Recording inspection clip…</Text>
              </View>
            )}

            {isProcessing && (
              <View style={styles.processingOverlay}>
                <Animated.View style={[styles.processingCircle, { transform: [{ scale: pulseAnim }] }]}>
                  <ActivityIndicator size="large" color={C.cyan} />
                </Animated.View>
                <Text style={styles.processingTitle}>Analyzing…</Text>
                <Text style={styles.processingText}>{PROCESSING_STEPS[processingStep]}</Text>
              </View>
            )}
          </View>
        ) : (
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing="back"
            mode="video"
            mute
            onCameraReady={() => setCameraReady(true)}
          >
            <View style={styles.overlay}>
              <View style={[styles.corner, styles.tl]} />
              <View style={[styles.corner, styles.tr]} />
              <View style={[styles.corner, styles.bl]} />
              <View style={[styles.corner, styles.br]} />
            </View>

            <View style={styles.topBanner}>
              <Text style={styles.topBannerText}>Point at the wire / connection area</Text>
            </View>

            {isRecording && (
              <View style={styles.recordingHud}>
                <View style={styles.recordingPill}>
                  <View style={styles.recordingDot} />
                  <Text style={styles.recordingText}>
                    REC {String(recordingSeconds).padStart(2, '0')}s
                  </Text>
                </View>
                <Text style={styles.recordingHint}>Capture the loose wire clearly</Text>
              </View>
            )}

            {isProcessing && (
              <View style={styles.processingOverlay}>
                <Animated.View style={[styles.processingCircle, { transform: [{ scale: pulseAnim }] }]}>
                  <ActivityIndicator size="large" color={C.cyan} />
                </Animated.View>
                <Text style={styles.processingTitle}>Analyzing…</Text>
                <Text style={styles.processingText}>{PROCESSING_STEPS[processingStep]}</Text>
              </View>
            )}
          </CameraView>
        )}
      </View>

      {/* Info card */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Loose Wire Detection</Text>
        <Text style={styles.infoBody}>
          Record a short clip of the wire/terminal area. The app uses Cosmos VLM to analyze and speaks the finding aloud.
        </Text>
      </View>

      {/* Record / Stop button */}
      <View style={styles.actionBar}>
        {isRecording ? (
          <Pressable style={styles.stopBtn} onPress={handleStopRecording}>
            <View style={styles.stopInner} />
          </Pressable>
        ) : (
          <Pressable
            style={[styles.recordBtn, (!canRecord || isProcessing) && styles.disabledBtn]}
            onPress={handleStartRecording}
            disabled={!canRecord || isProcessing}
          >
            <View style={styles.recordInner} />
          </Pressable>
        )}
        <Text style={styles.actionLabel}>
          {isRecording ? 'Tap to stop & analyze' : isProcessing ? 'Analyzing…' : 'Tap to record'}
        </Text>
      </View>
    </View>
  );
}

const CORNER = { width: 28, height: 28, borderColor: C.cyan, position: 'absolute' };

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 12 : 8,
    paddingBottom: 8,
    backgroundColor: C.card,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: C.text },
  headerSub: { fontSize: 12, color: C.muted, marginTop: 2 },

  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  promptTitle: { fontSize: 20, fontWeight: '700', color: C.text, marginBottom: 8, textAlign: 'center' },
  promptSub: { fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 20, marginBottom: 28 },

  primaryBtn: {
    backgroundColor: C.accent,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondaryBtn: {
    backgroundColor: C.card,
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
    marginTop: 10,
  },
  secondaryBtnText: { color: C.text, fontSize: 16, fontWeight: '600' },

  cameraWrap: {
    flex: 1,
    margin: 12,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
  },
  camera: { flex: 1 },
  mockCamera: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0f1e' },
  mockContent: { position: 'absolute', alignItems: 'center', paddingHorizontal: 32 },
  mockIcon: { fontSize: 48 },
  mockTitle: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 12, textAlign: 'center' },
  mockSub: { color: C.muted, fontSize: 14, lineHeight: 20, marginTop: 8, textAlign: 'center' },

  overlay: { ...StyleSheet.absoluteFillObject },
  topBanner: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  topBannerText: { color: '#fff', fontSize: 14, fontWeight: '600', textAlign: 'center' },

  recordingHud: { position: 'absolute', bottom: 20, left: 16, right: 16, alignItems: 'center' },
  recordingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(10,15,30,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.35)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  recordingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.red },
  recordingText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  recordingHint: {
    color: '#ccc',
    fontSize: 12,
    marginTop: 8,
    backgroundColor: 'rgba(10,15,30,0.72)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },

  corner: CORNER,
  tl: { top: 36, left: 36, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 8 },
  tr: { top: 36, right: 36, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 8 },
  bl: { bottom: 36, left: 36, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 8 },
  br: { bottom: 36, right: 36, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 8 },

  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: C.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  processingCircle: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: 'rgba(6,182,212,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: C.cyan,
  },
  processingTitle: { color: '#fff', fontSize: 26, fontWeight: '800', marginTop: 16 },
  processingText: { color: C.cyan, fontSize: 15, fontWeight: '600', marginTop: 10, textAlign: 'center' },

  infoCard: {
    marginHorizontal: 12,
    marginTop: 4,
    padding: 12,
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  infoTitle: { color: C.text, fontSize: 15, fontWeight: '700' },
  infoBody: { color: C.muted, fontSize: 13, lineHeight: 19, marginTop: 4 },

  resultScreen: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  resultBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: C.amber + '40',
    backgroundColor: C.amber + '15',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    marginBottom: 22,
  },
  resultBadgeText: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', color: C.amber },
  resultTitle: { fontSize: 28, lineHeight: 36, fontWeight: '800', color: C.text },
  resultReason: { fontSize: 18, lineHeight: 24, fontWeight: '700', color: C.cyan, marginTop: 12 },
  resultSummary: { fontSize: 14, lineHeight: 22, color: C.muted, marginTop: 14 },
  resultActions: { marginTop: 28 },
  sevDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.amber },

  actionBar: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16, alignItems: 'center' },
  actionLabel: { color: C.muted, fontSize: 13, marginTop: 10 },
  recordBtn: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    borderColor: C.red,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: C.red },
  stopBtn: {
    width: 78,
    height: 78,
    borderRadius: 39,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: C.red,
    borderWidth: 4,
    borderColor: '#fecaca',
  },
  stopInner: { width: 28, height: 28, borderRadius: 6, backgroundColor: '#fff' },
  disabledBtn: { opacity: 0.35 },
});
