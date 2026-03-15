import React, { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Speech from 'expo-speech';

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
  overlay: 'rgba(5, 10, 25, 0.82)',
};

const DEMO_RESULT = {
  title: 'There seem to be a loose connection',
  reason: 'Detected by Cosmos Reason 2',
  summary: 'Video evidence suggests an unstable connection near the observed electrical point.',
  severity: 'warning',
};

const PROCESSING_STEPS = [
  'Uploading inspection clip',
  'Running Cosmos visual reasoning',
  'Verifying connection stability',
];

const MAX_RECORDING_SECONDS = 20;
const PROCESSING_DELAY_MS = 2800;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function InspectorScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);
  const [result, setResult] = useState(null);
  const [stage, setStage] = useState('idle');
  const [cameraReady, setCameraReady] = useState(false);
  const [useMockCamera, setUseMockCamera] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [processingStep, setProcessingStep] = useState(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef(null);
  const recordPromiseRef = useRef(null);

  const startPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const stopPulse = () => {
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);
  };

  useEffect(() => {
    if (stage !== 'processing') return undefined;

    startPulse();
    const interval = setInterval(() => {
      setProcessingStep((current) => (current + 1) % PROCESSING_STEPS.length);
    }, 850);

    return () => {
      clearInterval(interval);
      stopPulse();
    };
  }, [stage, pulseAnim]);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    Speech.stop();
  }, []);

  const beginTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setRecordingSeconds(0);
    timerRef.current = setInterval(() => {
      setRecordingSeconds((current) => current + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const speakFinding = () => {
    Speech.stop();
    Speech.speak(`${DEMO_RESULT.title}. ${DEMO_RESULT.reason}.`, {
      language: 'en-US',
      pitch: 0.92,
      rate: 0.84,
    });
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
    const usingLiveCamera = !useMockCamera && cameraRef.current && cameraReady;

    if ((!usingLiveCamera && !useMockCamera) || stage === 'recording' || stage === 'processing') {
      return;
    }

    Speech.stop();
    setResult(null);
    setStage('recording');
    beginTimer();

    if (useMockCamera) {
      return;
    }

    try {
      recordPromiseRef.current = cameraRef.current.recordAsync({
        maxDuration: MAX_RECORDING_SECONDS,
      });

      await recordPromiseRef.current;
      stopTimer();
      await runDemoAnalysis();
    } catch (error) {
      console.warn('Recording flow fallback', error);
      stopTimer();
      await runDemoAnalysis();
    } finally {
      recordPromiseRef.current = null;
    }
  };

  const handleStopRecording = () => {
    if (stage !== 'recording') return;
    stopTimer();

    if (useMockCamera || !cameraRef.current) {
      runDemoAnalysis();
      return;
    }

    setStage('processing');
    cameraRef.current.stopRecording();
  };

  const handleReset = () => {
    setResult(null);
    setStage('idle');
    setProcessingStep(0);
    setRecordingSeconds(0);
    stopTimer();
    Speech.stop();
  };

  // Permission not yet determined
  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={C.accent} style={{ marginTop: 60 }} />
      </View>
    );
  }

  // Permission denied — prompt
  if (!permission.granted && !useMockCamera) {
    return (
      <View style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.promptTitle}>Camera Access Required</Text>
          <Text style={styles.promptSub}>
            Point your camera at a loose wire or connection point to run the field inspection demo.
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

  if (stage === 'result' && result) {
    return (
      <View style={styles.container}>
        <View style={styles.resultScreen}>
          <View style={[styles.resultBadge, { borderColor: C.amber + '40', backgroundColor: C.amber + '15' }]}>
            <View style={[styles.sevDot, { backgroundColor: C.amber }]} />
            <Text style={[styles.resultBadgeText, { color: C.amber }]}>Inspection Complete</Text>
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

  return (
    <View style={styles.container}>
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
              <Text style={styles.mockEyebrow}>Desktop Demo Mode</Text>
              <Text style={styles.mockTitle}>Simulated field capture</Text>
              <Text style={styles.mockSub}>
                Use this on the laptop or emulator when a live camera feed is not available.
              </Text>
            </View>

            <View style={styles.topBanner}>
              <Text style={styles.topBannerEyebrow}>Cosmos Field Vision</Text>
              <Text style={styles.topBannerTitle}>Record a short inspection video</Text>
              <Text style={styles.topBannerSub}>
                Point the camera at the connection area, record, then stop for analysis.
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
                <Text style={styles.recordingHint}>Simulating a loose wire inspection clip</Text>
              </View>
            )}

            {isProcessing && (
              <View style={styles.processingOverlay}>
                <Animated.View
                  style={[styles.processingCircle, { transform: [{ scale: pulseAnim }] }]}
                >
                  <ActivityIndicator size="large" color={C.cyan} />
                </Animated.View>
                <Text style={styles.processingTitle}>Processing</Text>
                <Text style={styles.processingText}>{PROCESSING_STEPS[processingStep]}</Text>
                <Text style={styles.processingSub}>Cosmos Reason 2 is reviewing connection stability</Text>
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
              <Text style={styles.topBannerEyebrow}>Cosmos Field Vision</Text>
              <Text style={styles.topBannerTitle}>Record a short inspection video</Text>
              <Text style={styles.topBannerSub}>
                Point the camera at the connection area, record, then stop for analysis.
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
                <Text style={styles.recordingHint}>Capture the hanging or loose wire clearly</Text>
              </View>
            )}

            {isProcessing && (
              <View style={styles.processingOverlay}>
                <Animated.View
                  style={[styles.processingCircle, { transform: [{ scale: pulseAnim }] }]}
                >
                  <ActivityIndicator size="large" color={C.cyan} />
                </Animated.View>
                <Text style={styles.processingTitle}>Processing</Text>
                <Text style={styles.processingText}>{PROCESSING_STEPS[processingStep]}</Text>
                <Text style={styles.processingSub}>Cosmos Reason 2 is reviewing connection stability</Text>
              </View>
            )}
          </CameraView>
        )}
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoEyebrow}>Demo Flow</Text>
        <Text style={styles.infoTitle}>Loose connection inspection</Text>
        <Text style={styles.infoBody}>
          Record a short clip of the exposed wire or terminal area. When you stop recording, the app simulates VLM analysis and reports the finding.
        </Text>
        {!useMockCamera && (
          <Pressable style={styles.secondaryBtn} onPress={() => setUseMockCamera(true)}>
            <Text style={styles.secondaryBtnText}>Switch to Desktop Demo Mode</Text>
          </Pressable>
        )}
      </View>

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
          {isRecording ? 'Tap to stop and analyze' : 'Tap to start recording'}
        </Text>
      </View>
    </View>
  );
}

const CORNER = {
  width: 28,
  height: 28,
  borderColor: '#06b6d4',
  position: 'absolute',
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  promptTitle: { fontSize: 20, fontWeight: '700', color: C.text, marginBottom: 8 },
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
    margin: 16,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
  },
  camera: { flex: 1 },
  mockCamera: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#030712',
  },
  mockContent: {
    position: 'absolute',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  mockEyebrow: {
    color: C.cyan,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  mockTitle: {
    color: C.text,
    fontSize: 28,
    fontWeight: '800',
    marginTop: 8,
    textAlign: 'center',
  },
  mockSub: {
    color: C.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
    textAlign: 'center',
  },
  overlay: { ...StyleSheet.absoluteFillObject },
  topBanner: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(7, 15, 35, 0.74)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.25)',
  },
  topBannerEyebrow: {
    color: C.cyan,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  topBannerTitle: {
    color: C.text,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 6,
  },
  topBannerSub: {
    color: '#cbd5e1',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },
  recordingHud: {
    position: 'absolute',
    bottom: 26,
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  recordingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(10, 15, 30, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.35)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: C.red,
  },
  recordingText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  recordingHint: {
    color: '#cbd5e1',
    fontSize: 12,
    marginTop: 10,
    backgroundColor: 'rgba(10, 15, 30, 0.72)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
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
  processingTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    marginTop: 18,
  },
  processingText: {
    color: C.cyan,
    fontSize: 16,
    fontWeight: '600',
    marginTop: 10,
  },
  processingSub: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 10,
  },

  infoCard: {
    marginHorizontal: 16,
    marginTop: 2,
    padding: 14,
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  infoEyebrow: {
    color: C.cyan,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  infoTitle: {
    color: C.text,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
  },
  infoBody: {
    color: C.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },

  resultScreen: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  resultBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    marginBottom: 22,
  },
  resultBadgeText: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  resultTitle: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '800',
    color: '#fff',
  },
  resultReason: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    color: C.cyan,
    marginTop: 14,
  },
  resultSummary: {
    fontSize: 15,
    lineHeight: 23,
    color: '#cbd5e1',
    marginTop: 18,
  },
  resultActions: {
    marginTop: 28,
  },
  sevDot: { width: 10, height: 10, borderRadius: 5 },

  actionBar: { paddingHorizontal: 16, paddingVertical: 18, alignItems: 'center' },
  actionLabel: {
    color: C.muted,
    fontSize: 13,
    marginTop: 12,
  },
  recordBtn: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 4,
    borderColor: C.text,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  recordInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: C.text,
  },
  stopBtn: {
    width: 84,
    height: 84,
    borderRadius: 42,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: C.red,
    borderWidth: 4,
    borderColor: '#fecaca',
  },
  stopInner: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#fff',
  },
  disabledBtn: {
    opacity: 0.35,
  },
});
