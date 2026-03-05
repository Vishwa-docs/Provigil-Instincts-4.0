"""
Train anomaly-detection models for the ProVigil predictive maintenance platform.

Pipeline
--------
1. Load training CSVs from ``data/sample/`` (generate them if missing).
2. Extract rolling / deviation / cyclical features via ``feature_engineering``.
3. Fit a StandardScaler → IsolationForest → LocalOutlierFactor (novelty mode).
4. Persist artefacts to ``model/exported/``.

Usage::

    python model/training/train_model.py
    python -m model.training.train_model
"""

import json
import logging
import os
import sys
import time
from pathlib import Path
from typing import List

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.neighbors import LocalOutlierFactor
from sklearn.preprocessing import StandardScaler

# ── Resolve project root ──────────────────────────────────────────────────────
_THIS_DIR = Path(__file__).resolve().parent
_PROJECT_ROOT = _THIS_DIR.parent.parent
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

from model.training.feature_engineering import (
    extract_features,
    get_feature_columns,
    prepare_training_data,
)
from model.training.generate_data import (
    generate_normal_fleet,
    generate_anomalous_fleet,
)

logger = logging.getLogger(__name__)

# ── Paths ─────────────────────────────────────────────────────────────────────
DATA_DIR = _PROJECT_ROOT / "data" / "sample"
EXPORT_DIR = _PROJECT_ROOT / "model" / "exported"

NORMAL_CSV = DATA_DIR / "normal_meters.csv"
ANOMALOUS_CSV = DATA_DIR / "anomalous_meters.csv"

MODEL_PATH = EXPORT_DIR / "anomaly_model.pkl"
LOF_PATH = EXPORT_DIR / "lof_model.pkl"
SCALER_PATH = EXPORT_DIR / "scaler.pkl"
FEATURES_PATH = EXPORT_DIR / "feature_columns.json"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _ensure_data() -> None:
    """Generate synthetic CSVs if they do not already exist."""
    if NORMAL_CSV.exists() and ANOMALOUS_CSV.exists():
        logger.info("Training CSVs already present – skipping generation.")
        return

    logger.info("Training CSVs not found – generating synthetic data...")
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    normal_df = generate_normal_fleet(n_meters=50, n_hours=720, seed=42)
    normal_df.to_csv(NORMAL_CSV, index=False)
    logger.info("  wrote %s (%d rows)", NORMAL_CSV.name, len(normal_df))

    anomalous_df = generate_anomalous_fleet(n_meters=20, n_hours=720, seed=1000)
    anomalous_df.to_csv(ANOMALOUS_CSV, index=False)
    logger.info("  wrote %s (%d rows)", ANOMALOUS_CSV.name, len(anomalous_df))


def _load_per_meter(csv_path: Path) -> List[pd.DataFrame]:
    """Load a CSV and split into per-meter DataFrames."""
    df = pd.read_csv(csv_path, parse_dates=["timestamp"])
    meter_ids = df["meter_id"].unique()
    return [df[df["meter_id"] == mid].reset_index(drop=True) for mid in meter_ids]


# ── Training ──────────────────────────────────────────────────────────────────

def train() -> None:
    """Run the full training pipeline."""
    t0 = time.time()

    # 1. Ensure data
    _ensure_data()

    # 2. Load per-meter DataFrames
    logger.info("Loading training data...")
    normal_meters = _load_per_meter(NORMAL_CSV)
    anomalous_meters = _load_per_meter(ANOMALOUS_CSV)
    all_meters = normal_meters + anomalous_meters

    logger.info(
        "  %d normal meters, %d anomalous meters → %d total",
        len(normal_meters), len(anomalous_meters), len(all_meters),
    )

    # 3. Feature extraction
    logger.info("Extracting features (window=24)...")
    X, meter_ids = prepare_training_data(all_meters, window_size=24)
    logger.info("  Feature matrix shape: %s", X.shape)

    if X.shape[0] == 0:
        logger.error("No valid training samples after feature extraction. Aborting.")
        return

    # 4. Scale
    logger.info("Fitting StandardScaler...")
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # 5. Train Isolation Forest
    logger.info("Training IsolationForest (n_estimators=200, contamination=0.1)...")
    iso_forest = IsolationForest(
        n_estimators=200,
        contamination=0.1,
        random_state=42,
        n_jobs=-1,
    )
    iso_forest.fit(X_scaled)

    iso_preds = iso_forest.predict(X_scaled)  # -1 = anomaly, 1 = normal
    iso_anomaly_pct = 100.0 * (iso_preds == -1).sum() / len(iso_preds)
    logger.info("  IsolationForest anomaly rate on train: %.1f%%", iso_anomaly_pct)

    # 6. Train LOF (novelty=True for later prediction on new data)
    logger.info("Training LocalOutlierFactor (n_neighbors=20, novelty=True)...")
    lof = LocalOutlierFactor(
        n_neighbors=20,
        contamination=0.1,
        novelty=True,
        n_jobs=-1,
    )
    lof.fit(X_scaled)

    lof_preds = lof.predict(X_scaled)
    lof_anomaly_pct = 100.0 * (lof_preds == -1).sum() / len(lof_preds)
    logger.info("  LOF anomaly rate on train: %.1f%%", lof_anomaly_pct)

    # 7. Hybrid ensemble quick check
    iso_scores = iso_forest.decision_function(X_scaled)
    lof_scores = lof.decision_function(X_scaled)
    # Normalise both to [0,1] where higher = more anomalous
    iso_norm = np.clip(-iso_scores, 0, 1)
    lof_norm = np.clip(-lof_scores, 0, 1)
    ensemble_scores = (iso_norm + lof_norm) / 2.0
    ensemble_anomaly_pct = 100.0 * (ensemble_scores > 0.5).sum() / len(ensemble_scores)
    logger.info("  Ensemble (avg) anomaly rate (threshold 0.5): %.1f%%", ensemble_anomaly_pct)

    # 8. Optional evaluation against labels
    _evaluate_with_labels(X_scaled, meter_ids, iso_forest, lof, all_meters)

    # 9. Save artefacts
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)

    joblib.dump(iso_forest, MODEL_PATH)
    logger.info("  Saved IsolationForest → %s", MODEL_PATH)

    joblib.dump(lof, LOF_PATH)
    logger.info("  Saved LOF            → %s", LOF_PATH)

    joblib.dump(scaler, SCALER_PATH)
    logger.info("  Saved scaler         → %s", SCALER_PATH)

    feature_cols = get_feature_columns()
    with open(FEATURES_PATH, "w") as f:
        json.dump(feature_cols, f, indent=2)
    logger.info("  Saved feature list   → %s", FEATURES_PATH)

    elapsed = time.time() - t0

    # 10. Summary
    print("\n" + "=" * 60)
    print("  ProVigil Model Training Summary")
    print("=" * 60)
    print(f"  Training samples      : {X.shape[0]:,}")
    print(f"  Feature dimensions    : {X.shape[1]}")
    print(f"  Normal meters         : {len(normal_meters)}")
    print(f"  Anomalous meters      : {len(anomalous_meters)}")
    print(f"  IsolationForest anomaly%: {iso_anomaly_pct:.1f}%")
    print(f"  LOF anomaly%          : {lof_anomaly_pct:.1f}%")
    print(f"  Ensemble anomaly%     : {ensemble_anomaly_pct:.1f}%")
    print(f"  Elapsed time          : {elapsed:.1f}s")
    print(f"  Artefacts saved to    : {EXPORT_DIR}")
    print("=" * 60 + "\n")


def _evaluate_with_labels(
    X_scaled: np.ndarray,
    meter_ids: np.ndarray,
    iso_forest: IsolationForest,
    lof: LocalOutlierFactor,
    all_meters: List[pd.DataFrame],
) -> None:
    """If the source data contains an ``is_anomaly`` column, print accuracy stats."""
    # Build a ground-truth label vector aligned with the feature matrix.
    # We need to reconstruct which rows survived feature extraction.
    try:
        from model.training.feature_engineering import extract_features, get_feature_columns

        feature_cols = get_feature_columns()
        labels: List[int] = []

        for df in all_meters:
            if df.empty or "is_anomaly" not in df.columns:
                continue
            feats = extract_features(df, window_size=24)
            feats["is_anomaly"] = df["is_anomaly"].values
            mask = feats[feature_cols].notna().all(axis=1)
            labels.extend(feats.loc[mask, "is_anomaly"].astype(int).tolist())

        if len(labels) != X_scaled.shape[0]:
            logger.warning(
                "Label count (%d) does not match sample count (%d); skipping label-based evaluation.",
                len(labels), X_scaled.shape[0],
            )
            return

        y_true = np.array(labels)
        if y_true.sum() == 0:
            logger.info("No positive labels in training data – skipping label-based evaluation.")
            return

        # IsolationForest: -1 = anomaly → map to 1
        iso_pred = (iso_forest.predict(X_scaled) == -1).astype(int)
        lof_pred = (lof.predict(X_scaled) == -1).astype(int)

        iso_acc = (iso_pred == y_true).mean()
        lof_acc = (lof_pred == y_true).mean()

        iso_recall = iso_pred[y_true == 1].mean() if y_true.sum() > 0 else 0.0
        lof_recall = lof_pred[y_true == 1].mean() if y_true.sum() > 0 else 0.0

        iso_precision = y_true[iso_pred == 1].mean() if iso_pred.sum() > 0 else 0.0
        lof_precision = y_true[lof_pred == 1].mean() if lof_pred.sum() > 0 else 0.0

        logger.info("Label-based evaluation (training set):")
        logger.info("  IsolationForest – accuracy=%.3f  precision=%.3f  recall=%.3f",
                     iso_acc, iso_precision, iso_recall)
        logger.info("  LOF             – accuracy=%.3f  precision=%.3f  recall=%.3f",
                     lof_acc, lof_precision, lof_recall)
    except Exception:
        logger.debug("Label-based evaluation failed.", exc_info=True)


# ── Entry point ───────────────────────────────────────────────────────────────

def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    )
    train()


if __name__ == "__main__":
    main()
