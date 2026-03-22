# ProVigil Edge — ESP32 Firmware

Real-time meter monitoring firmware for the ESP32 micro-controller. Reads current, temperature, and energy pulses, runs on-device anomaly detection, and publishes JSON telemetry over MQTT.

---

## Hardware Required

| Component | Specification | Approx. Cost (INR) |
|---|---|---|
| ESP32 DevKit v1 | Dual-core 240 MHz, WiFi + BLE | ₹450 |
| CT Clamp | SCT-013-030 (30 A / 1 V output) | ₹350 |
| Temperature Sensor | DS18B20 (waterproof probe) | ₹120 |
| Burden Resistor | 33 Ω ¼ W (for SCT-013) | ₹5 |
| Pull-up Resistor | 4.7 kΩ (for DS18B20 OneWire bus) | ₹2 |
| Bypass Capacitors | 100 nF ceramic (optional, noise) | ₹5 |
| Breadboard + Jumpers | Standard prototyping kit | ₹150 |
| USB Cable | Micro-USB for programming + power | ₹80 |
| **Optional:** Optocoupler | For energy-meter pulse LED input | ₹30 |
| **Optional:** RGB LED | Status indicator (green/yellow/red) | ₹15 |

---

## Pin Connections

```
                    ┌─────────────────────┐
                    │     ESP32 DevKit     │
                    │                     │
  CT Clamp ────────▶│ GPIO 34 (ADC1_CH6)  │
  (via burden       │                     │
   + bias circuit)  │                     │
                    │                     │
  DS18B20 ─────────▶│ GPIO 4              │◀── 4.7 kΩ to 3.3V
  (data wire)       │                     │
                    │                     │
  Pulse LED ───────▶│ GPIO 5              │    (optocoupler output)
  (energy meter)    │                     │
                    │                     │
  Status LED ◀──────│ GPIO 2 (built-in)   │
                    │                     │
                    │ 3V3 ────────────────│──▶ DS18B20 VCC
                    │ GND ────────────────│──▶ Common ground
                    └─────────────────────┘


  CT Clamp Bias Circuit (required for ESP32 ADC):
  ┌──────────────────────────────────────────────────┐
  │                                                  │
  │   3.3V ──┬── [10kΩ] ──┬── [10kΩ] ──┬── GND     │
  │          │            │            │             │
  │          │       DC Bias = 1.65V   │             │
  │          │            │            │             │
  │          │   CT Out ──┤            │             │
  │          │            │            │             │
  │          │     [33Ω burden]        │             │
  │          │            │            │             │
  │          │            ├── [100nF] ─┤             │
  │          │            │            │             │
  │          │            └──▶ GPIO 34               │
  │                                                  │
  └──────────────────────────────────────────────────┘

  DS18B20 Wiring:
  ┌──────────────────────────────────────────────────┐
  │                                                  │
  │  DS18B20 Pin 1 (GND)  ──▶ ESP32 GND             │
  │  DS18B20 Pin 2 (DATA) ──▶ ESP32 GPIO 4          │
  │                           └── [4.7kΩ] ── 3.3V   │
  │  DS18B20 Pin 3 (VCC)  ──▶ ESP32 3.3V            │
  │                                                  │
  └──────────────────────────────────────────────────┘
```

---

## Software Setup

### Prerequisites

1. Install [PlatformIO](https://platformio.org/install):
   ```bash
   # Via pip (recommended)
   pip install platformio

   # Or via VS Code extension
   # Search "PlatformIO IDE" in Extensions marketplace
   ```

2. Plug in your ESP32 via USB and note the serial port:
   ```bash
   # macOS
   ls /dev/cu.usb*

   # Linux
   ls /dev/ttyUSB*

   # Windows
   # Check Device Manager → Ports (COM & LPT)
   ```

### Configure

1. Edit `edge/firmware/config.h`:
   ```c
   #define WIFI_SSID      "YourNetworkName"
   #define WIFI_PASSWORD  "YourPassword"
   #define MQTT_BROKER    "192.168.1.100"   // Your laptop's IP
   #define METER_ID       "MTR-EDGE-001"
   ```

2. Make sure the MQTT broker (Mosquitto) is running on your laptop:
   ```bash
   # Install
   brew install mosquitto          # macOS
   sudo apt install mosquitto      # Ubuntu

   # Start
   mosquitto -v
   ```

### Build & Flash

From the project root:

```bash
cd edge

# Build
pio run

# Upload to ESP32
pio run -t upload

# Monitor serial output
pio device monitor

# All in one
pio run -t upload && pio device monitor
```

If the upload fails, hold the **BOOT** button on the ESP32 while it's trying to connect.

---

## MQTT Topics

| Topic | Direction | Description |
|---|---|---|
| `pro-vigil/meter/{METER_ID}/telemetry` | ESP32 → Broker | JSON telemetry every 10 s |
| `pro-vigil/meter/{METER_ID}/command` | Broker → ESP32 | Commands (future: OTA, config) |

### Sample Telemetry Payload

```json
{
  "meter_id": "MTR-EDGE-001",
  "timestamp": 12345,
  "msg_seq": 42,
  "voltage": 230.00,
  "current": 4.52,
  "power": 987.4,
  "temperature": 38.5,
  "temp_avg": 36.2,
  "energy_pulses": 1587,
  "local_alert": false,
  "device_state": "OK",
  "wifi_rssi": -45,
  "uptime_s": 12345,
  "power_factor": 0.95,
  "frequency": 50.0
}
```

---

## On-Device Anomaly Detection

The firmware implements a simple three-state machine:

```
┌──────┐          ┌──────┐          ┌──────────┐
│  OK  │ ───────▶ │ WARN │ ───────▶ │ CRITICAL │
└──────┘          └──────┘          └──────────┘
    ▲                                     │
    └─────────────────────────────────────┘
              (auto-clear when normal)
```

**Transition conditions:**

| Condition | Trigger | State |
|---|---|---|
| Temperature > 55 °C | Absolute threshold | WARN |
| Temperature > 70 °C | Absolute threshold | CRITICAL |
| Temperature > avg + 10 °C | Deviation from 60-sample moving average | WARN |
| Current > 36 A | 1.2× rated current (30 A) | WARN |
| Current > 45 A | 1.5× rated current | CRITICAL |

When `local_alert` is `true`, the payload includes an `alert_reason` string.

---

## Status LED Patterns

| State | Built-in LED (GPIO 2) | RGB LED (if installed) |
|---|---|---|
| OK | Solid ON | Green |
| WARN | Slow blink (500 ms) | Yellow |
| CRITICAL | Fast blink (100 ms) | Red |

---

## Troubleshooting

| Problem | Solution |
|---|---|
| Upload fails | Hold BOOT button during upload; check USB cable (data, not charge-only) |
| No WiFi connection | Verify SSID/password; check 2.4 GHz (ESP32 doesn't support 5 GHz) |
| MQTT not connecting | Verify broker IP; check firewall; run `mosquitto -v` for logs |
| Temperature reads -127 °C | Check DS18B20 wiring; ensure 4.7 kΩ pull-up is present |
| Current reads 0 | Verify CT clamp orientation (arrow toward load); check bias circuit |
| Erratic ADC readings | Add 100 nF capacitor; try averaging more samples |
| `pio` not found | Run `pip install platformio` or use VS Code PlatformIO extension |

---

## Demo Setup Suggestions

For a compelling live walkthrough:

1. **Clamp the CT sensor** around a lamp cord or extension cable with a variable load (desk lamp with dimmer, or plug in / unplug a heater).

2. **Place the DS18B20** on the cable insulation near a junction box or on the surface of a breaker panel.

3. **Monitor the MQTT stream** in real time:
   ```bash
   mosquitto_sub -h localhost -t "pro-vigil/meter/+/telemetry" -v
   ```

4. **Trigger anomalies** for the demo:
   - Blow a hair dryer at the DS18B20 to spike temperature.
   - Plug in a high-draw appliance (kettle, heater) to spike current.
   - Observe the state machine transition OK → WARN → CRITICAL on the dashboard.

5. **Photo / video ideas:**
   - Close-up of CT clamp on a wire with ESP32 and breadboard visible.
   - Split-screen: serial monitor on one side, Pro-Vigil dashboard on the other.
   - LED blinking patterns during each state.

---

## Architecture Diagram

```
┌──────────────┐     ┌──────────┐     ┌──────────────┐     ┌───────────┐
│  CT Clamp    │────▶│          │     │              │     │           │
│  DS18B20     │────▶│  ESP32   │────▶│ MQTT Broker  │────▶│ ProVigil  │
│  Pulse LED   │────▶│ (edge)   │     │ (Mosquitto)  │     │ Backend   │
└──────────────┘     └──────────┘     └──────────────┘     └───────────┘
   Sensors           Firmware          Message Bus          FastAPI +
                     + Anomaly                              ML Scoring
                     Detection
```
