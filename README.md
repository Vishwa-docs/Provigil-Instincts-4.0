# ProVigil — AI-Powered Predictive Maintenance for Smart Electricity Meters

ProVigil is an end-to-end platform that detects failing smart electricity meters *before* they cause outages. It combines edge intelligence (ESP32 TinyML), multi-model anomaly detection, a real-time scoring engine (FastAPI), a React operations dashboard, and a field mobile app with VLM-based visual validation — all aligned to India's DLMS/COSEM and IS 15959 smart-meter standards.

🔗 **Live Demo:** [https://provigilinstincts.click](https://provigilinstincts.click)

### Field Vision — VLM Loose Wire Inspector (Mobile App)

![docs/vlm_demo.mp4](https://github.com/Vishwa-docs/Provigil-Instincts-4.0/blob/main/docs/vlm_demo.mp4)

---

## Key Features

- **Multi-Model Anomaly Detection** — 17-rule deterministic scoring engine + IsolationForest/LOF ensemble across 19 engineered features
- **Component-Level Digital Twin** — Six-subsystem health decomposition (terminals, relay, battery, SMPS, display, comms)
- **Network Intelligence** — Peer mesh consensus isolates local faults from grid-wide events using transformer-feeder topology
- **Real-Time Scoring** — Background scoring cycle runs every 30 seconds with automatic alert and work order generation
- **DLMS/COSEM Compliant** — OBIS code mapping per IS 15959 / IEC 62056; 25 Indian smart-meter event codes
- **AI-Powered Insights** — GPT-4o root cause analysis, automated work order generation, and email alerting
- **React Operations Dashboard** — Fleet overview, per-meter diagnostics, network map, guided tour, and maintenance queue
- **Field Mobile App** — VLM-based installation quality validation via camera capture
- **ESP32 Edge Firmware** — CT clamp + DS18B20 + pulse counting with on-device anomaly detection
- **Docker Ready** — Compose file for production deployment

## Architecture

```
ESP32 Edge Device ──► MQTT/HTTP ──► FastAPI Backend ──► SQLite/PostgreSQL
                                        │                  │
                                   Scoring Engine     React Dashboard
                                   (ML + Rules)      (Vite + Tailwind)
                                        │
                                   Azure OpenAI ◄── LLM Summarization
```

## Quick Start

```bash
cp .env.example .env
make setup          # Install Python + Node dependencies
make train          # Generate data & train ML models
make run-backend    # Start backend on :8000
make run-dashboard  # Start dashboard on :3000
```

> See [docs/Setup_Steps.md](docs/Setup_Steps.md) for detailed instructions, API reference, and troubleshooting.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Edge | ESP32, Arduino, PlatformIO, CT clamp, DS18B20 |
| Backend | Python 3.11+, FastAPI, SQLAlchemy, APScheduler, Azure OpenAI |
| ML | scikit-learn (IsolationForest, LOF), pandas, numpy, PyTorch (planned) |
| Dashboard | React 18, Vite, Tailwind CSS, Recharts, Framer Motion, React-Joyride |
| Mobile | React Native, Expo 52, VLM camera integration |
| Messaging | Eclipse Mosquitto (MQTT), paho-mqtt |
| Database | SQLite (dev), PostgreSQL (production) |
| Infra | Docker Compose, Nginx, AWS EC2 |

## License

See [LICENSE](LICENSE).
