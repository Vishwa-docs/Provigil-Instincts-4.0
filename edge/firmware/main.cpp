/*
 * ═══════════════════════════════════════════════════════════════════════════
 * ProVigil Edge Firmware — ESP32 Smart-Meter Monitor
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Reads current (CT clamp), temperature (DS18B20), and energy pulses,
 * performs on-device anomaly detection, and publishes JSON telemetry to
 * an MQTT broker for the ProVigil predictive-maintenance platform.
 *
 * Hardware:
 *   - ESP32 DevKit v1
 *   - SCT-013-030 CT clamp on analog pin 34
 *   - DS18B20 temperature sensor on GPIO 4 (with 4.7 kΩ pull-up)
 *   - Energy-meter pulse LED via optocoupler on GPIO 5
 *   - Status LED on GPIO 2 (built-in on most devkits)
 *
 * Build with PlatformIO:
 *   pio run -t upload && pio device monitor
 *
 * License: MIT
 * ═══════════════════════════════════════════════════════════════════════════
 */

#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <ArduinoJson.h>
#include "config.h"

// ── Forward declarations ─────────────────────────────────────────────────
void setupWiFi();
void reconnectWiFi();
void setupMQTT();
void reconnectMQTT();
void mqttCallback(char *topic, byte *payload, unsigned int length);
float readCurrent();
float readTemperature();
void countPulseISR();
void updateAnomalyState();
void publishTelemetry();
void addToBuffer(const char *json);
bool publishFromBuffer();
void blinkStatus();
const char *stateToString(int state);

// ── State machine ────────────────────────────────────────────────────────
enum DeviceState {
    STATE_OK       = 0,
    STATE_WARN     = 1,
    STATE_CRITICAL = 2,
};

// ── Globals ──────────────────────────────────────────────────────────────

// WiFi & MQTT
WiFiClient   wifiClient;
PubSubClient mqttClient(wifiClient);
char mqttTopic[80];

// Sensors
OneWire           oneWire(TEMP_SENSOR_PIN);
DallasTemperature tempSensors(&oneWire);

// Pulse counter (ISR-safe)
volatile unsigned long pulseCount = 0;

// Moving-average buffer for temperature anomaly detection
#define TEMP_AVG_WINDOW 60
float  tempHistory[TEMP_AVG_WINDOW];
int    tempHistoryIdx  = 0;
int    tempHistoryLen  = 0;   // how many valid entries so far
float  tempMovingAvg   = 0.0;

// Circular telemetry buffer for MQTT retry
struct TelemetryEntry {
    char   json[512];
    bool   occupied;
};
TelemetryEntry buffer[BUFFER_SIZE];
int bufHead = 0;  // next write position
int bufTail = 0;  // next read position
int bufCount = 0;

// Current sensor readings
float currentAmps  = 0.0;
float temperature  = 0.0;
float voltageEst   = VOLTAGE_NOMINAL;
float powerEst     = 0.0;
unsigned long totalPulses = 0;

// Device state
DeviceState deviceState      = STATE_OK;
bool        localAlert       = false;
String      alertReason      = "";

// Timing
unsigned long lastPublishMs  = 0;
unsigned long lastSensorMs   = 0;
unsigned long lastBlinkMs    = 0;
bool          ledOn           = false;

// Uptime & message counter
unsigned long messageCount   = 0;

// ═════════════════════════════════════════════════════════════════════════
// SETUP
// ═════════════════════════════════════════════════════════════════════════

void setup() {
    Serial.begin(115200);
    delay(500);
    Serial.println();
    Serial.println("═══════════════════════════════════════════");
    Serial.println(" ProVigil Edge Firmware v1.0");
    Serial.println(" Meter ID: " METER_ID);
    Serial.println("═══════════════════════════════════════════");

    // LED
    pinMode(LED_PIN, OUTPUT);
    digitalWrite(LED_PIN, LOW);

    // CT sensor analog input
    pinMode(CT_SENSOR_PIN, INPUT);
    analogSetAttenuation(ADC_11db);  // 0–3.3 V range

    // Pulse counter input with interrupt
    pinMode(PULSE_SENSOR_PIN, INPUT_PULLUP);
    attachInterrupt(digitalPinToInterrupt(PULSE_SENSOR_PIN), countPulseISR, FALLING);

    // Temperature sensor
    tempSensors.begin();
    Serial.printf("[INIT] Found %d DS18B20 sensor(s)\n", tempSensors.getDeviceCount());

    // Initialise temperature history
    for (int i = 0; i < TEMP_AVG_WINDOW; i++) {
        tempHistory[i] = 0.0;
    }

    // WiFi
    setupWiFi();

    // MQTT
    snprintf(mqttTopic, sizeof(mqttTopic), "pro-vigil/meter/%s/telemetry", METER_ID);
    setupMQTT();

    Serial.println("[INIT] Setup complete. Entering main loop.");
    Serial.println();
}

// ═════════════════════════════════════════════════════════════════════════
// MAIN LOOP
// ═════════════════════════════════════════════════════════════════════════

void loop() {
    unsigned long now = millis();

    // Maintain connections
    if (WiFi.status() != WL_CONNECTED) {
        reconnectWiFi();
    }
    if (!mqttClient.connected()) {
        reconnectMQTT();
    }
    mqttClient.loop();

    // ── Sensor reads (every SENSOR_READ_INTERVAL_MS) ────────────────
    if (now - lastSensorMs >= SENSOR_READ_INTERVAL_MS) {
        lastSensorMs = now;

        currentAmps = readCurrent();
        temperature = readTemperature();

        // Update temperature moving average
        tempHistory[tempHistoryIdx] = temperature;
        tempHistoryIdx = (tempHistoryIdx + 1) % TEMP_AVG_WINDOW;
        if (tempHistoryLen < TEMP_AVG_WINDOW) {
            tempHistoryLen++;
        }

        // Compute moving average
        float sum = 0.0;
        for (int i = 0; i < tempHistoryLen; i++) {
            sum += tempHistory[i];
        }
        tempMovingAvg = (tempHistoryLen > 0) ? (sum / tempHistoryLen) : temperature;

        // Calculate estimated voltage and power
        voltageEst = VOLTAGE_NOMINAL;  // No voltage sensor — use nominal
        powerEst   = voltageEst * currentAmps * POWER_FACTOR_ASSUMED;

        // Snapshot pulse counter (ISR-safe read)
        noInterrupts();
        totalPulses = pulseCount;
        interrupts();

        // Run anomaly detection
        updateAnomalyState();

        // Serial debug
        Serial.printf("[SENSOR] I=%.2fA  T=%.1f°C  Tavg=%.1f°C  P=%.0fW  "
                      "pulses=%lu  state=%s\n",
                      currentAmps, temperature, tempMovingAvg, powerEst,
                      totalPulses, stateToString(deviceState));
    }

    // ── Publish telemetry (every PUBLISH_INTERVAL_MS) ────────────────
    if (now - lastPublishMs >= PUBLISH_INTERVAL_MS) {
        lastPublishMs = now;
        publishTelemetry();

        // Also try to drain buffered messages
        if (mqttClient.connected() && bufCount > 0) {
            int drained = 0;
            while (bufCount > 0 && drained < 5) {
                if (publishFromBuffer()) {
                    drained++;
                } else {
                    break;
                }
            }
            if (drained > 0) {
                Serial.printf("[BUFFER] Drained %d buffered messages (%d remaining)\n",
                              drained, bufCount);
            }
        }
    }

    // ── Status LED blinking ──────────────────────────────────────────
    blinkStatus();
}

// ═════════════════════════════════════════════════════════════════════════
// WiFi
// ═════════════════════════════════════════════════════════════════════════

void setupWiFi() {
    Serial.printf("[WIFI] Connecting to %s", WIFI_SSID);
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 40) {
        delay(500);
        Serial.print(".");
        attempts++;
    }

    if (WiFi.status() == WL_CONNECTED) {
        Serial.println(" OK");
        Serial.printf("[WIFI] IP: %s  RSSI: %d dBm\n",
                      WiFi.localIP().toString().c_str(), WiFi.RSSI());
    } else {
        Serial.println(" FAILED (will retry in loop)");
    }
}

void reconnectWiFi() {
    static unsigned long lastAttempt = 0;
    unsigned long now = millis();
    if (now - lastAttempt < 5000) return;  // throttle to every 5 s
    lastAttempt = now;

    Serial.println("[WIFI] Reconnecting...");
    WiFi.disconnect();
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    int wait = 0;
    while (WiFi.status() != WL_CONNECTED && wait < 20) {
        delay(250);
        wait++;
    }

    if (WiFi.status() == WL_CONNECTED) {
        Serial.printf("[WIFI] Reconnected. IP: %s\n",
                      WiFi.localIP().toString().c_str());
    }
}

// ═════════════════════════════════════════════════════════════════════════
// MQTT
// ═════════════════════════════════════════════════════════════════════════

void setupMQTT() {
    mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
    mqttClient.setCallback(mqttCallback);
    mqttClient.setBufferSize(1024);  // allow larger JSON payloads
    reconnectMQTT();
}

void reconnectMQTT() {
    if (WiFi.status() != WL_CONNECTED) return;

    static unsigned long lastAttempt = 0;
    unsigned long now = millis();
    if (now - lastAttempt < 5000) return;
    lastAttempt = now;

    Serial.printf("[MQTT] Connecting to %s:%d as %s ... ",
                  MQTT_BROKER, MQTT_PORT, MQTT_CLIENT_ID);

    if (mqttClient.connect(MQTT_CLIENT_ID)) {
        Serial.println("OK");
        // Subscribe to command topic for OTA / config updates
        char cmdTopic[80];
        snprintf(cmdTopic, sizeof(cmdTopic), "pro-vigil/meter/%s/command", METER_ID);
        mqttClient.subscribe(cmdTopic);
        Serial.printf("[MQTT] Subscribed to %s\n", cmdTopic);
    } else {
        Serial.printf("FAILED (rc=%d)\n", mqttClient.state());
    }
}

void mqttCallback(char *topic, byte *payload, unsigned int length) {
    Serial.printf("[MQTT] Message on %s (%u bytes)\n", topic, length);

    // Simple command handling — could be extended for OTA, config, etc.
    char msg[256];
    unsigned int copyLen = (length < sizeof(msg) - 1) ? length : sizeof(msg) - 1;
    memcpy(msg, payload, copyLen);
    msg[copyLen] = '\0';
    Serial.printf("[MQTT] Payload: %s\n", msg);
}

// ═════════════════════════════════════════════════════════════════════════
// Sensors
// ═════════════════════════════════════════════════════════════════════════

float readCurrent() {
    /*
     * Read the CT clamp via the ESP32 ADC.
     *
     * The SCT-013-030 outputs 0-1 V AC proportional to 0-30 A.
     * With a DC bias circuit (voltage divider at VCC/2 = 1.65 V), the
     * ADC reads a sine wave centred around ~1.65 V.
     *
     * We sample over one full mains cycle (20 ms at 50 Hz) and compute
     * the RMS value.
     */
    const int    samples     = 200;
    const float  adcMax      = 4095.0;
    const float  vRef        = 3.3;
    const float  vOffset     = vRef / 2.0;  // DC bias midpoint

    float sumSq = 0.0;

    unsigned long startMicros = micros();
    for (int i = 0; i < samples; i++) {
        int raw = analogRead(CT_SENSOR_PIN);
        float voltage = (raw / adcMax) * vRef;
        float centred = voltage - vOffset;
        sumSq += centred * centred;

        // ~50 µs between samples  → 200 * 50 µs = 10 ms ≈ half cycle
        // We'll do two rounds for a full cycle worth of data
        delayMicroseconds(50);
    }

    float rmsVoltage = sqrt(sumSq / samples);
    float rmsCurrent = rmsVoltage * CT_CALIBRATION_FACTOR;

    // Clamp noise floor — readings below 0.05 A are noise
    if (rmsCurrent < 0.05) {
        rmsCurrent = 0.0;
    }

    return rmsCurrent;
}

float readTemperature() {
    /*
     * Read the DS18B20 digital temperature sensor.
     * Returns degrees Celsius, or -127.0 on read failure.
     */
    tempSensors.requestTemperatures();
    float t = tempSensors.getTempCByIndex(0);

    if (t == DEVICE_DISCONNECTED_C) {
        Serial.println("[TEMP] DS18B20 read error — sensor disconnected?");
        return -127.0;
    }
    return t;
}

// ── Pulse counter ISR ────────────────────────────────────────────────────

void IRAM_ATTR countPulseISR() {
    pulseCount++;
}

// ═════════════════════════════════════════════════════════════════════════
// Anomaly Detection
// ═════════════════════════════════════════════════════════════════════════

void updateAnomalyState() {
    /*
     * Simple on-device state machine:
     *
     *   OK  ──▶  WARN  ──▶  CRITICAL
     *    ◀──────────────────────┘  (auto-clear when conditions normalise)
     *
     * Conditions:
     *   WARN     — temperature > moving_avg + TEMP_DEVIATION_WARN
     *            — current > RATED_CURRENT * CURRENT_OVERLOAD_FACTOR
     *            — temperature > TEMP_WARN_THRESHOLD
     *   CRITICAL — temperature > TEMP_CRITICAL_THRESHOLD
     *            — current > RATED_CURRENT * 1.5
     */
    localAlert  = false;
    alertReason = "";

    DeviceState newState = STATE_OK;

    // ── Temperature checks ───────────────────────────────────────────
    if (temperature > 0 && temperature != -127.0) {
        // Absolute critical threshold
        if (temperature > TEMP_CRITICAL_THRESHOLD) {
            newState    = STATE_CRITICAL;
            localAlert  = true;
            alertReason = "Temperature CRITICAL (>" +
                          String(TEMP_CRITICAL_THRESHOLD, 0) + "°C)";
        }
        // Absolute warn threshold
        else if (temperature > TEMP_WARN_THRESHOLD) {
            if (newState < STATE_WARN) newState = STATE_WARN;
            localAlert  = true;
            alertReason = "Temperature WARN (>" +
                          String(TEMP_WARN_THRESHOLD, 0) + "°C)";
        }
        // Deviation from moving average
        else if (tempHistoryLen >= 10 &&
                 temperature > tempMovingAvg + TEMP_DEVIATION_WARN) {
            if (newState < STATE_WARN) newState = STATE_WARN;
            localAlert  = true;
            alertReason = "Temperature deviation (+" +
                          String(temperature - tempMovingAvg, 1) +
                          "°C above avg)";
        }
    }

    // ── Current checks ───────────────────────────────────────────────
    if (currentAmps > RATED_CURRENT * 1.5) {
        newState    = STATE_CRITICAL;
        localAlert  = true;
        alertReason = "Current CRITICAL (" + String(currentAmps, 1) +
                      "A > " + String(RATED_CURRENT * 1.5, 0) + "A)";
    } else if (currentAmps > RATED_CURRENT * CURRENT_OVERLOAD_FACTOR) {
        if (newState < STATE_WARN) newState = STATE_WARN;
        localAlert  = true;
        alertReason = "Current overload (" + String(currentAmps, 1) +
                      "A > " + String(RATED_CURRENT * CURRENT_OVERLOAD_FACTOR, 0) + "A)";
    }

    deviceState = newState;
}

// ═════════════════════════════════════════════════════════════════════════
// Telemetry Publishing
// ═════════════════════════════════════════════════════════════════════════

void publishTelemetry() {
    messageCount++;

    // Build JSON document
    JsonDocument doc;

    doc["meter_id"]       = METER_ID;
    doc["timestamp"]      = millis() / 1000;  // seconds since boot
    doc["msg_seq"]        = messageCount;
    doc["voltage"]        = round(voltageEst * 100) / 100.0;
    doc["current"]        = round(currentAmps * 100) / 100.0;
    doc["power"]          = round(powerEst * 10) / 10.0;
    doc["temperature"]    = round(temperature * 10) / 10.0;
    doc["temp_avg"]       = round(tempMovingAvg * 10) / 10.0;
    doc["energy_pulses"]  = totalPulses;
    doc["local_alert"]    = localAlert;
    doc["device_state"]   = stateToString(deviceState);
    doc["wifi_rssi"]      = WiFi.RSSI();
    doc["uptime_s"]       = millis() / 1000;
    doc["power_factor"]   = POWER_FACTOR_ASSUMED;
    doc["frequency"]      = 50.0;   // No frequency sensor — fixed nominal

    if (localAlert) {
        doc["alert_reason"] = alertReason;
    }

    char jsonBuf[512];
    size_t jsonLen = serializeJson(doc, jsonBuf, sizeof(jsonBuf));

    // Attempt MQTT publish
    if (mqttClient.connected()) {
        bool ok = mqttClient.publish(mqttTopic, jsonBuf, false);
        if (ok) {
            Serial.printf("[MQTT] Published %u bytes to %s\n",
                          (unsigned)jsonLen, mqttTopic);
        } else {
            Serial.println("[MQTT] Publish failed — buffering.");
            addToBuffer(jsonBuf);
        }
    } else {
        Serial.println("[MQTT] Not connected — buffering.");
        addToBuffer(jsonBuf);
    }
}

// ═════════════════════════════════════════════════════════════════════════
// Circular Buffer
// ═════════════════════════════════════════════════════════════════════════

void addToBuffer(const char *json) {
    strncpy(buffer[bufHead].json, json, sizeof(buffer[bufHead].json) - 1);
    buffer[bufHead].json[sizeof(buffer[bufHead].json) - 1] = '\0';
    buffer[bufHead].occupied = true;

    bufHead = (bufHead + 1) % BUFFER_SIZE;

    if (bufCount < BUFFER_SIZE) {
        bufCount++;
    } else {
        // Overwrite oldest — advance tail
        bufTail = (bufTail + 1) % BUFFER_SIZE;
        Serial.println("[BUFFER] Overflow — oldest reading dropped.");
    }

    Serial.printf("[BUFFER] Buffered message (%d/%d)\n", bufCount, BUFFER_SIZE);
}

bool publishFromBuffer() {
    if (bufCount == 0) return false;

    bool ok = mqttClient.publish(mqttTopic, buffer[bufTail].json, false);
    if (ok) {
        buffer[bufTail].occupied = false;
        bufTail = (bufTail + 1) % BUFFER_SIZE;
        bufCount--;
        return true;
    }
    return false;
}

// ═════════════════════════════════════════════════════════════════════════
// Status LED
// ═════════════════════════════════════════════════════════════════════════

void blinkStatus() {
    /*
     * Blink patterns on the built-in LED:
     *   OK       — steady ON (solid)
     *   WARN     — slow blink (500 ms)
     *   CRITICAL — fast blink (100 ms)
     *
     * If an RGB LED is available on separate pins, you could use
     * green/yellow/red instead.
     */
    unsigned long now = millis();
    unsigned long interval;

    switch (deviceState) {
        case STATE_OK:
            // Solid ON
            digitalWrite(LED_PIN, HIGH);
            return;
        case STATE_WARN:
            interval = 500;
            break;
        case STATE_CRITICAL:
            interval = 100;
            break;
        default:
            interval = 1000;
            break;
    }

    if (now - lastBlinkMs >= interval) {
        lastBlinkMs = now;
        ledOn = !ledOn;
        digitalWrite(LED_PIN, ledOn ? HIGH : LOW);
    }
}

// ═════════════════════════════════════════════════════════════════════════
// Utilities
// ═════════════════════════════════════════════════════════════════════════

const char *stateToString(int state) {
    switch (state) {
        case STATE_OK:       return "OK";
        case STATE_WARN:     return "WARN";
        case STATE_CRITICAL: return "CRITICAL";
        default:             return "UNKNOWN";
    }
}
