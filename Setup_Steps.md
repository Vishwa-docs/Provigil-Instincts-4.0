# Pro-Vigil — Setup & Run Guide

Complete step-by-step instructions to set up, train, and run the Pro-Vigil predictive maintenance platform.

---

## Prerequisites

| Tool        | Version  | Check command          |
|-------------|----------|------------------------|
| Python      | ≥ 3.10   | `python3 --version`    |
| Node.js     | ≥ 18     | `node --version`       |
| npm         | ≥ 9      | `npm --version`        |
| Git         | any      | `git --version`        |
| Docker *(optional)* | ≥ 20 | `docker --version` |

> **Note:** Docker is only required if you want to run the MQTT broker (Mosquitto) or use the Docker Compose setup. The platform works fully without MQTT using HTTP-only mode.

---

## Quick Start (5 minutes)

```bash
# 1. Clone and enter the repo
git clone <repo-url> ProVigil-Instincts
cd ProVigil-Instincts

# 2. Copy environment config
cp .env.example .env

# 3. Set up everything (backend + dashboard + model extras)
make setup

# 4. Train the ML model
make train

# 5. Start the backend (Terminal Tab 1)
make run-backend

# 6. Run the simulator to populate data (Terminal Tab 2)
make run-scenario

# 7. Open the dashboard
#    → http://localhost:8000  (production build served by backend)
#    → http://localhost:3000  (dev mode with hot-reload - run `make run-dashboard` in Tab 3)
```

---

## Detailed Setup

### Step 1 — Environment File

```bash
cp .env.example .env
```

The `.env` file contains all configurable values. Key settings:

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `sqlite:///./data/provigil.db` | Database connection string |
| `MQTT_BROKER_HOST` | `localhost` | MQTT broker address |
| `MQTT_BROKER_PORT` | `1883` | MQTT broker port |
| `MODEL_PATH` | `../model/exported/anomaly_model.pkl` | Trained model location |
| `SCALER_PATH` | `../model/exported/scaler.pkl` | Feature scaler location |
| `ANOMALY_THRESHOLD_WARNING` | `0.15` | Score ≥ this → warning alert |
| `ANOMALY_THRESHOLD_CRITICAL` | `0.35` | Score ≥ this → critical alert |
| `SCORING_INTERVAL_SECONDS` | `30` | How often the scoring cycle runs |

> The `.env` file is already in `.gitignore`. Never commit secrets to the repo.

---

### Step 2 — Backend Setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate      # macOS / Linux
# venv\Scripts\activate       # Windows

pip install -r requirements.txt
```

This installs FastAPI, SQLAlchemy, scikit-learn, pandas, paho-mqtt, APScheduler, and all other Python dependencies.

---

### Step 3 — Train the ML Model

The platform uses an **Isolation Forest** + **Local Outlier Factor** ensemble for anomaly detection, trained on 19 engineered features.

```bash
# From the project root, with backend venv activated:
cd /path/to/ProVigil-Instincts

# Generate synthetic training data (50 normal + 20 anomalous meters × 720 hours each)
python3 model/training/generate_data.py

# Train models and export artefacts
python3 model/training/train_model.py
```

**Or use the Makefile shortcut:**
```bash
make train
```

Output files appear in `model/exported/`:
- `anomaly_model.pkl` — Isolation Forest model
- `lof_model.pkl` — Local Outlier Factor model
- `scaler.pkl` — StandardScaler for feature normalisation
- `feature_columns.json` — List of 19 engineered feature names
- `confusion_matrix.png` — Evaluation visualisation
- `roc_curve.png` — ROC curve plot

---

### Step 4 — Start the Backend

```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Or:**
```bash
make run-backend
```

The backend:
- Creates the SQLite database on first run (`data/provigil.db`)
- Registers 10 demo meters automatically
- Loads the trained ML model
- Starts a scoring cycle every 30 seconds
- Tries to connect to MQTT (non-blocking; works fine without it)
- Serves the dashboard build at `http://localhost:8000/`

**API docs:** `http://localhost:8000/docs` (Swagger UI)

---

### Step 5 — Install & Build the Dashboard

```bash
cd dashboard
npm install
npm run build       # production build → dashboard/build/
```

The built dashboard is automatically served by the FastAPI backend at `/`.

**For development with hot-reload:**
```bash
npm run dev         # starts Vite dev server on http://localhost:3000
```

The Vite dev server proxies `/api/*` requests to `http://localhost:8000`.

---

### Step 6 — Run the Simulator

The simulator generates realistic smart meter telemetry and sends it to the backend via HTTP.

```bash
# From the project root, with backend venv activated:

# Option A: Full demo scenario (7 healthy + 3 faulty meters, 2-hour window at 500× speed)
python3 -m simulator.scenario_runner --scenario full_demo --speed 500

# Option B: Continuous real-time simulation
python3 -m simulator.run_simulator --mode api --meters demo --speed 60

# Option C: Specific fault scenario
python3 -m simulator.scenario_runner --scenario loose_terminal
```

**Makefile shortcuts:**
```bash
make run-scenario       # full demo scenario
make run-simulator      # continuous simulation at 60× speed
```

**Available scenarios:**
| Scenario | Description |
|----------|-------------|
| `full_demo` | 10 meters (7 healthy, 3 faulty), 2 hours simulated |
| `loose_terminal` | Demonstrates thermal stress / loose terminal detection |
| `dead_meter` | Simulates communication loss (all-zero readings) |
| `consumption_anomaly` | Generates unusual power consumption patterns |

After the simulator finishes, wait ~30 seconds for the scoring cycle to run, then check:
```bash
curl http://localhost:8000/api/dashboard/stats
curl http://localhost:8000/api/alerts/
```

---

## Optional: MQTT Broker (Mosquitto)

If you want MQTT-based telemetry (instead of HTTP-only):

### Using Docker:
```bash
docker-compose up -d mosquitto
```

### Manual install (macOS):
```bash
brew install mosquitto
mosquitto -c config/mosquitto/mosquitto.conf
```

Then run the simulator in MQTT mode:
```bash
python3 -m simulator.run_simulator --mode mqtt --meters demo --speed 60
```

---

## Optional: Docker Compose (Full Stack)

Run the entire stack (Mosquitto + Backend + Dashboard) in containers:

```bash
# Build and start
docker-compose up -d

# Check logs
docker-compose logs -f

# Stop
docker-compose down
```

> **Note:** You still need to train the ML model locally first (`make train`) before running Docker, as the model files are mounted from `model/exported/`.

---

## Optional: ESP32 Edge Device

The `edge/firmware/` directory contains Arduino/PlatformIO firmware for ESP32.

### Setup:
1. Install [PlatformIO](https://platformio.org/install)
2. Edit `edge/firmware/config.h`:
   - Set your WiFi SSID and password
   - Set the MQTT broker IP (your laptop's IP on the same network)
3. Connect sensors:
   - CT clamp (SCT-013) → GPIO 34 (ADC)
   - DS18B20 temperature sensor → GPIO 4 (OneWire)
   - LED pulse sensor → GPIO 35 (for energy metering)
4. Build and flash:
   ```bash
   cd edge
   pio run --target upload
   pio device monitor    # serial monitor
   ```

---

## Project Structure

```
ProVigil-Instincts/
├── .env                        # Environment config (gitignored)
├── .env.example                # Template with documented defaults
├── Makefile                    # Convenience commands
├── docker-compose.yml          # Full-stack Docker setup
├── Setup_Steps.md              # This file
│
├── backend/                    # FastAPI backend
│   ├── app/
│   │   ├── main.py             # Application entry point
│   │   ├── config.py           # Pydantic settings loader
│   │   ├── database.py         # SQLAlchemy engine & session
│   │   ├── models/
│   │   │   ├── schemas.py      # ORM models (Meter, Reading, Anomaly, Alert, WorkOrder)
│   │   │   └── pydantic_models.py  # Request/response schemas
│   │   ├── routers/
│   │   │   ├── meters.py       # /api/meters/* endpoints
│   │   │   ├── alerts.py       # /api/alerts/* endpoints
│   │   │   ├── workorders.py   # /api/workorders/* endpoints
│   │   │   ├── dashboard.py    # /api/dashboard/* (stats, charts)
│   │   │   └── ingest.py       # /api/ingest/* (telemetry ingestion)
│   │   ├── services/
│   │   │   ├── scoring_service.py  # ML + rule-based anomaly scoring
│   │   │   ├── mqtt_service.py     # MQTT subscriber
│   │   │   └── scheduler.py       # APScheduler for periodic scoring
│   │   └── utils/
│   │       └── dlms_mapper.py     # DLMS/COSEM OBIS code translation
│   ├── requirements.txt
│   └── Dockerfile
│
├── dashboard/                  # React dashboard (Vite + Tailwind)
│   ├── src/
│   │   ├── App.jsx             # Main app with sidebar & routes
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx   # Overview with health stats & charts
│   │   │   ├── MeterFleet.jsx  # All meters list with filters
│   │   │   ├── MeterDetail.jsx # Single meter detail + readings chart
│   │   │   ├── MapView.jsx     # Geographic meter map (Leaflet)
│   │   │   ├── Alerts.jsx      # Alert list with acknowledge action
│   │   │   └── WorkOrders.jsx  # Work order management
│   │   └── services/
│   │       └── api.js          # Axios API client
│   ├── package.json
│   └── Dockerfile
│
├── model/                      # ML pipeline
│   ├── training/
│   │   ├── feature_engineering.py  # 19-feature extraction pipeline
│   │   ├── generate_data.py        # Synthetic data generator
│   │   ├── train_model.py          # IsolationForest + LOF training
│   │   └── evaluate_model.py       # Evaluation & visualisation
│   └── exported/               # Trained model artefacts (.pkl, .json)
│
├── simulator/                  # Smart meter data simulator
│   ├── meter_profiles.py       # Meter fleet generation (50 / 10 demo)
│   ├── signal_generators.py    # Normal + 5 fault signal injectors
│   ├── api_publisher.py        # HTTP telemetry sender
│   ├── mqtt_publisher.py       # MQTT telemetry sender
│   ├── dlms_adapter.py         # DLMS/COSEM IS 15959 simulator
│   ├── dlms_event_codes.py     # Indian smart meter event codes
│   ├── run_simulator.py        # CLI entry point
│   └── scenario_runner.py      # Pre-built demo scenarios
│
├── edge/                       # ESP32 edge firmware
│   ├── firmware/
│   │   ├── main.cpp            # Arduino firmware (CT + DS18B20 + MQTT)
│   │   └── config.h            # Hardware/WiFi/MQTT configuration
│   └── platformio.ini
│
├── config/
│   └── mosquitto/
│       └── mosquitto.conf      # Mosquitto MQTT config
│
├── data/
│   └── sample/                 # Generated training CSV files
│
└── Planning/                   # Hackathon planning docs
    ├── Full_Project.md
    ├── Innovations.md
    ├── Questions for Judges.md
    └── Research_ToDo.md
```

---

## API Endpoints Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/stats` | Summary stats (counts, avg health) |
| GET | `/api/dashboard/health-distribution` | Health score histogram |
| GET | `/api/dashboard/anomaly-trend` | 30-day anomaly trend |
| GET | `/api/dashboard/recent-alerts` | Latest 10 alerts |
| GET | `/api/meters/` | List all meters (filter by `?status=`) |
| GET | `/api/meters/{id}` | Single meter details |
| GET | `/api/meters/{id}/readings` | Meter readings (paginated) |
| GET | `/api/meters/{id}/anomalies` | Anomaly history for a meter |
| GET | `/api/meters/{id}/health` | Health trend for a meter |
| POST | `/api/ingest/telemetry` | Ingest single telemetry reading |
| POST | `/api/ingest/batch` | Ingest multiple readings |
| GET | `/api/alerts/` | List all alerts |
| PATCH | `/api/alerts/{id}/acknowledge` | Acknowledge an alert |
| GET | `/api/workorders/` | List work orders |
| POST | `/api/workorders/` | Create a work order |
| PATCH | `/api/workorders/{id}` | Update work order status |

**Swagger UI:** `http://localhost:8000/docs`

---

## Troubleshooting

### Backend won't start
- Make sure the virtual environment is activated: `source backend/venv/bin/activate`
- Check Python version: `python3 --version` (need ≥ 3.10)
- Reinstall dependencies: `pip install -r backend/requirements.txt`

### No anomalies detected
- Ensure ML models are trained: check `model/exported/anomaly_model.pkl` exists
- Run the simulator first, then wait ≥ 30 seconds for the scoring cycle
- Check the backend logs for "Scoring cycle started" messages

### Dashboard shows blank page
- Rebuild: `cd dashboard && npm run build`
- For dev mode, make sure both backend (port 8000) and Vite dev server (port 3000) are running

### MQTT connection refused
- This is normal if Mosquitto isn't running — the backend works fine with HTTP-only mode
- To start Mosquitto: `docker-compose up -d mosquitto` or `brew install mosquitto && mosquitto -c config/mosquitto/mosquitto.conf`

### Port already in use
```bash
# Find and kill the process on port 8000
lsof -ti:8000 | xargs kill -9
```

---

## Demo Walkthrough

1. **Start the backend** → `make run-backend`
2. **Run the full demo scenario** → `make run-scenario` (in a second terminal, with venv activated)
3. **Wait 30–60 seconds** for the scoring cycle to analyse the data
4. **Open the dashboard** → `http://localhost:8000`
5. **Observe**:
   - MTR-D08 flagged as **warning** with `thermal_stress_loose_terminal`
   - Health score drops to ~0.72–0.76 (vs ~0.93 for healthy meters)
   - Alerts appear in the Alerts page
   - Health distribution chart shows the outlier
   - Anomaly trend chart shows detections for today
