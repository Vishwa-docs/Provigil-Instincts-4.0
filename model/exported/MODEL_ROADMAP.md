# Model Architecture & Roadmap

This directory is reserved for exported PyTorch model artifacts. The production upgrade path is documented below.

## Planned Model Architectures

| Model | Architecture | Input | Output | Purpose |
|-------|-------------|-------|--------|---------|
| LSTM Autoencoder | LSTM(128)→LSTM(64)→Dense(32)→Decode | 24h window × 9 channels | Reconstruction error | Per-meter anomaly detection |
| Temporal Fusion Transformer | TFT with quantile regression | 7-day window + covariates | 1–30 day health forecast | Predictive maintenance scheduling |
| Graph Neural Network | GCN on feeder topology | Meter nodes + edge features | Propagated anomaly scores | Cascading failure detection |
| Federated Learner | FedAvg over edge devices | Local meter data | Gradient updates | Privacy-preserving on-device learning |

## Current Production Engine

The system uses a **14-rule deterministic scoring engine** combined with Isolation Forest / Local Outlier Factor for anomaly scoring. This approach provides:
- Sub-millisecond inference latency
- Zero model artifacts to deploy
- Interpretable rule-by-rule explanations
- No dependency on training data availability

## Training Pipeline

Training code is located in `model/training/`:
- `generate_data.py` — Synthetic dataset generation (50 normal + 20 anomalous profiles × 720 hours)
- `feature_engineering.py` — Feature extraction, windowing, and z-score normalization
- `train_model.py` — Model training loop with early stopping
- `evaluate_model.py` — Evaluation metrics and visualization

## Feature Columns

See `feature_columns.json` for the current 19-feature set (14 raw + 5 engineered) used by the scoring engine.

## Upgrade Criteria

Transition from the threshold engine to PyTorch models when:
1. Real DISCOM training data (>10,000 meters, >6 months) is available
2. False positive rate exceeds acceptable threshold with rules alone
3. Forecast horizon needs to extend beyond 7-day linear extrapolation
4. Edge deployment requires compact models (<10 MB) for on-device inference
