#ifndef CONFIG_H
#define CONFIG_H

// ═══════════════════════════════════════════════════════════════════════════
// ProVigil Edge Firmware — Configuration
// ═══════════════════════════════════════════════════════════════════════════
// Edit these values before flashing to your ESP32.
// For production deployments, consider reading from NVS (non-volatile
// storage) instead of compile-time constants.
// ═══════════════════════════════════════════════════════════════════════════

// ── WiFi ─────────────────────────────────────────────────────────────────
#define WIFI_SSID          "YOUR_WIFI_SSID"
#define WIFI_PASSWORD      "YOUR_WIFI_PASSWORD"

// ── MQTT Broker ──────────────────────────────────────────────────────────
#define MQTT_BROKER        "YOUR_LAPTOP_IP"
#define MQTT_PORT          1883
#define MQTT_CLIENT_ID     "provigil-edge-001"
#define METER_ID           "MTR-EDGE-001"

// ── Sensor Pins ──────────────────────────────────────────────────────────
// CT clamp analog input (ACS712 or SCT-013 via burden resistor)
#define CT_SENSOR_PIN      34
// OneWire bus for DS18B20 temperature sensor
#define TEMP_SENSOR_PIN    4
// Pulse output from energy meter LED / optocoupler
#define PULSE_SENSOR_PIN   5
// On-board or external status LED
#define LED_PIN            2

// ── Calibration ──────────────────────────────────────────────────────────
// Transforms raw ADC counts → amperes.  Adjust for your CT ratio +
// burden resistor value.  For SCT-013-030 with 33 Ω burden: ~30.0.
#define CT_CALIBRATION_FACTOR   30.0

// Nominal mains voltage (India: 230 V single-phase)
#define VOLTAGE_NOMINAL         230.0

// Rated current of the monitored circuit (A)
#define RATED_CURRENT           30.0

// Assumed power factor when real PF measurement is unavailable
#define POWER_FACTOR_ASSUMED    0.95

// ── Timing ───────────────────────────────────────────────────────────────
// Interval between MQTT publishes (ms)
#define PUBLISH_INTERVAL_MS     10000

// Interval between sensor reads used for the moving average (ms)
#define SENSOR_READ_INTERVAL_MS 1000

// ── Anomaly Detection Thresholds ─────────────────────────────────────────
// Absolute temperature thresholds (°C)
#define TEMP_WARN_THRESHOLD     55.0
#define TEMP_CRITICAL_THRESHOLD 70.0

// If temperature exceeds moving-average + this offset → WARN
#define TEMP_DEVIATION_WARN     10.0

// Current overload: alert if I > RATED_CURRENT * factor
#define CURRENT_OVERLOAD_FACTOR 1.2

// ── Circular Buffer ──────────────────────────────────────────────────────
// Number of telemetry readings to buffer when MQTT is unavailable.
// Oldest readings are overwritten once the buffer is full.
#define BUFFER_SIZE             100

#endif  // CONFIG_H
