# Pro-Vigil — AI-Powered Predictive Maintenance for Smart Electricity Meters

**INSTINCT 4.0 Hackathon (H2S)**

Pro-Vigil is an end-to-end platform that detects failing smart electricity meters *before* they cause outages. It combines edge sensing (ESP32), a telemetry simulator, ML-based anomaly detection (Isolation Forest + LOF), a FastAPI backend, and a React dashboard — all aligned to India's DLMS/COSEM and IS 15959 smart-meter standards.

---

## Key Features

- **Predictive Anomaly Detection** — 19-feature ML pipeline (Isolation Forest + LOF) trained on synthetic DLMS-style telemetry
- **Rule-Based Fault Classification** — Deterministic checks for loose terminals, comm loss, sensor faults, and RTC errors
- **Real-Time Scoring** — Background scoring cycle runs every 30 seconds with combined ML + rule scores
- **DLMS/COSEM Compliant** — OBIS code mapping per IS 15959 / IEC 62056; 25 Indian smart-meter event codes
- **Smart Meter Simulator** — 5 fault injectors (thermal stress, comm loss, sensor fault, battery fault, consumption anomaly)
- **React Dashboard** — Fleet overview, per-meter drill-down, geographic map, alerting, and work-order management
- **ESP32 Edge Firmware** — CT clamp + DS18B20 + pulse counting with on-device anomaly detection
- **Docker Ready** — Compose file for Mosquitto MQTT + Backend + Dashboard

## Architecture

```
ESP32 Edge Device ──► MQTT/HTTP ──► FastAPI Backend ──► SQLite
                                        │                  │
                                   Scoring Service    React Dashboard
                                   (ML + Rules)      (Vite + Tailwind)
```

## Quick Start

```bash
cp .env.example .env
make setup          # Install Python + Node dependencies
make train          # Generate data & train ML models
make run-backend    # Start backend on :8000
make run-scenario   # Populate data with simulator
# Open http://localhost:8000
```

> See [Setup_Steps.md](Setup_Steps.md) for detailed instructions, API reference, and troubleshooting.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Edge | ESP32, Arduino, PlatformIO, CT clamp, DS18B20 |
| Backend | Python 3.10+, FastAPI, SQLAlchemy, APScheduler |
| ML | scikit-learn (IsolationForest, LOF), pandas, numpy |
| Dashboard | React 18, Vite, Tailwind CSS, Recharts, React Leaflet |
| Messaging | Eclipse Mosquitto (MQTT), paho-mqtt |
| Database | SQLite (dev), upgradeable to PostgreSQL |
| Infra | Docker Compose, Makefile |

## License

See [LICENSE](LICENSE).
