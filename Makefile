.PHONY: help setup setup-backend setup-dashboard setup-model train demo demo-quick run-backend run-dashboard run-simulator clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ── Setup ──────────────────────────────────────────────
setup: setup-backend setup-dashboard setup-model ## Full setup (backend + dashboard + model)
	@echo "\n✅ Setup complete! Run 'make demo' to start everything."

setup-backend: ## Install backend dependencies
	cd backend && python3 -m venv venv && . venv/bin/activate && pip install -r requirements.txt

setup-dashboard: ## Install dashboard dependencies
	cd dashboard && npm install

setup-model: ## Install model training dependencies
	cd backend && . venv/bin/activate && pip install matplotlib seaborn jupyter

# ── Training ───────────────────────────────────────────
train: ## Generate synthetic data and train ML models
	cd backend && . venv/bin/activate && cd .. && python3 model/training/generate_data.py && python3 model/training/train_model.py

# ── Run Services ───────────────────────────────────────
run-backend: ## Start FastAPI backend (port 8000)
	cd backend && . venv/bin/activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

run-dashboard: ## Start React dashboard (port 3000)
	cd dashboard && npm run dev

run-simulator: ## Run simulator (API mode, 10 demo meters, 60x speed)
	cd backend && . venv/bin/activate && cd .. && python3 -m simulator.run_simulator --mode api --meters demo --speed 60

run-scenario: ## Run full demo scenario
	cd backend && . venv/bin/activate && cd .. && python3 -m simulator.scenario_runner --scenario full_demo

run-dlms: ## Run DLMS/COSEM HES simulator
	cd backend && . venv/bin/activate && cd .. && python3 -m simulator.dlms_adapter --meters 10 --interval 30

# ── Docker ─────────────────────────────────────────────
docker-up: ## Start all services with Docker Compose
	docker-compose up -d

docker-down: ## Stop all Docker services
	docker-compose down

docker-logs: ## Tail Docker logs
	docker-compose logs -f

# ── Demo ───────────────────────────────────────────────
demo: ## Run full demo (backend + dashboard + simulator)
	@echo "Starting Pro-Vigil Demo..."
	@echo "1. Starting backend on http://localhost:8000"
	@echo "2. Starting dashboard on http://localhost:3000"
	@echo "3. Starting simulator"
	@echo ""
	@echo "Open 3 terminal tabs and run:"
	@echo "  Tab 1: make run-backend"
	@echo "  Tab 2: make run-dashboard"
	@echo "  Tab 3: make run-simulator"

demo-quick: ## Quick demo with API backend only (no MQTT needed)
	@echo "Starting quick demo..."
	cd backend && . venv/bin/activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
	@sleep 3
	cd backend && . venv/bin/activate && cd .. && python3 -m simulator.scenario_runner --scenario full_demo

# ── Utilities ──────────────────────────────────────────
clean: ## Clean generated files
	rm -rf data/provigil.db data/sample/*.csv
	rm -rf model/exported/*.pkl model/exported/*.json model/exported/*.png
	rm -rf backend/__pycache__ backend/app/__pycache__
	rm -rf dashboard/build dashboard/node_modules/.cache

lint: ## Lint Python code
	cd backend && . venv/bin/activate && python3 -m py_compile app/main.py && echo "✅ No syntax errors"
