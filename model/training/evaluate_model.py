"""
Evaluate trained ProVigil anomaly-detection models against synthetic test data
with known ground-truth labels.

Produces:
  - Classification report (printed to stdout)
  - Confusion matrix plot  → ``model/exported/confusion_matrix.png``
  - ROC curve plot          → ``model/exported/roc_curve.png``

Usage::

    python model/training/evaluate_model.py
    python -m model.training.evaluate_model
"""

import json
import logging
import sys
from pathlib import Path
from typing import List

import joblib
import matplotlib
matplotlib.use("Agg")  # non-interactive backend – must be set before pyplot import
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    roc_auc_score,
    roc_curve,
)
from sklearn.preprocessing import StandardScaler

# ── Resolve project root ──────────────────────────────────────────────────────
_THIS_DIR = Path(__file__).resolve().parent
_PROJECT_ROOT = _THIS_DIR.parent.parent
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

from model.training.feature_engineering import (
    extract_features,
    get_feature_columns,
)
from model.training.generate_data import (
    generate_normal_fleet,
    generate_anomalous_fleet,
)

logger = logging.getLogger(__name__)

# ── Paths ─────────────────────────────────────────────────────────────────────
EXPORT_DIR = _PROJECT_ROOT / "model" / "exported"
MODEL_PATH = EXPORT_DIR / "anomaly_model.pkl"
LOF_PATH = EXPORT_DIR / "lof_model.pkl"
SCALER_PATH = EXPORT_DIR / "scaler.pkl"
FEATURES_PATH = EXPORT_DIR / "feature_columns.json"

CONFUSION_PNG = EXPORT_DIR / "confusion_matrix.png"
ROC_PNG = EXPORT_DIR / "roc_curve.png"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _load_artefacts():
    """Load the trained model, LOF, scaler, and feature column list."""
    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Trained model not found at {MODEL_PATH}. Run train_model.py first."
        )

    iso_forest = joblib.load(MODEL_PATH)
    lof = joblib.load(LOF_PATH) if LOF_PATH.exists() else None
    scaler: StandardScaler = joblib.load(SCALER_PATH)

    if FEATURES_PATH.exists():
        with open(FEATURES_PATH) as f:
            feature_cols = json.load(f)
    else:
        feature_cols = get_feature_columns()

    return iso_forest, lof, scaler, feature_cols


def _generate_test_data(seed: int = 9999) -> pd.DataFrame:
    """Create labelled test data (separate seed from training)."""
    logger.info("Generating test data (separate seed=%d)...", seed)

    normal = generate_normal_fleet(n_meters=15, n_hours=360, seed=seed)
    anomalous = generate_anomalous_fleet(n_meters=10, n_hours=360, seed=seed + 500)

    return pd.concat([normal, anomalous], ignore_index=True)


def _build_feature_matrix(test_df: pd.DataFrame, feature_cols: List[str]):
    """Extract features and align labels."""
    meter_ids = test_df["meter_id"].unique()
    all_features: List[pd.DataFrame] = []

    for mid in meter_ids:
        mdf = test_df[test_df["meter_id"] == mid].reset_index(drop=True)
        feats = extract_features(mdf, window_size=24)
        feats["is_anomaly"] = mdf["is_anomaly"].values
        feats["meter_id"] = mid
        all_features.append(feats)

    combined = pd.concat(all_features, ignore_index=True)
    mask = combined[feature_cols].notna().all(axis=1)
    clean = combined.loc[mask].reset_index(drop=True)

    X = clean[feature_cols].values.astype(np.float64)
    y = clean["is_anomaly"].values.astype(int)
    return X, y


# ── Plotting ──────────────────────────────────────────────────────────────────

def _plot_confusion_matrix(y_true: np.ndarray, y_pred: np.ndarray, title: str, path: Path) -> None:
    cm = confusion_matrix(y_true, y_pred)
    fig, ax = plt.subplots(figsize=(6, 5))
    sns.heatmap(
        cm, annot=True, fmt="d", cmap="Blues",
        xticklabels=["Normal", "Anomaly"],
        yticklabels=["Normal", "Anomaly"],
        ax=ax,
    )
    ax.set_xlabel("Predicted")
    ax.set_ylabel("Actual")
    ax.set_title(title)
    fig.tight_layout()
    fig.savefig(path, dpi=150)
    plt.close(fig)
    logger.info("Saved confusion matrix → %s", path)


def _plot_roc_curves(
    y_true: np.ndarray,
    iso_scores: np.ndarray,
    lof_scores: np.ndarray,
    ensemble_scores: np.ndarray,
    path: Path,
) -> None:
    fig, ax = plt.subplots(figsize=(7, 6))

    for name, scores in [
        ("IsolationForest", iso_scores),
        ("LOF", lof_scores),
        ("Ensemble (avg)", ensemble_scores),
    ]:
        if scores is None:
            continue
        fpr, tpr, _ = roc_curve(y_true, scores)
        auc = roc_auc_score(y_true, scores)
        ax.plot(fpr, tpr, label=f"{name} (AUC={auc:.3f})")

    ax.plot([0, 1], [0, 1], "k--", alpha=0.4, label="Random")
    ax.set_xlabel("False Positive Rate")
    ax.set_ylabel("True Positive Rate")
    ax.set_title("ROC Curves – ProVigil Anomaly Detection")
    ax.legend(loc="lower right")
    fig.tight_layout()
    fig.savefig(path, dpi=150)
    plt.close(fig)
    logger.info("Saved ROC curve → %s", path)


# ── Main evaluation ──────────────────────────────────────────────────────────

def evaluate() -> None:
    """Run the full evaluation pipeline."""
    iso_forest, lof, scaler, feature_cols = _load_artefacts()

    test_df = _generate_test_data()
    X_test, y_test = _build_feature_matrix(test_df, feature_cols)

    if X_test.shape[0] == 0:
        logger.error("No valid test samples. Aborting.")
        return

    logger.info("Test set: %d samples, %d anomalies (%.1f%%)",
                len(y_test), y_test.sum(), 100.0 * y_test.mean())

    X_scaled = scaler.transform(X_test)

    # ── IsolationForest ───────────────────────────────────────────────────
    iso_preds = (iso_forest.predict(X_scaled) == -1).astype(int)
    iso_raw = iso_forest.decision_function(X_scaled)
    iso_scores = np.clip(-iso_raw, 0, 1)

    print("\n" + "=" * 60)
    print("  IsolationForest – Classification Report")
    print("=" * 60)
    print(classification_report(
        y_test, iso_preds, target_names=["Normal", "Anomaly"], zero_division=0,
    ))

    # ── LOF ───────────────────────────────────────────────────────────────
    lof_scores = None
    lof_preds = None
    if lof is not None:
        lof_preds = (lof.predict(X_scaled) == -1).astype(int)
        lof_raw = lof.decision_function(X_scaled)
        lof_scores = np.clip(-lof_raw, 0, 1)

        print("=" * 60)
        print("  LOF – Classification Report")
        print("=" * 60)
        print(classification_report(
            y_test, lof_preds, target_names=["Normal", "Anomaly"], zero_division=0,
        ))

    # ── Ensemble ──────────────────────────────────────────────────────────
    ensemble_scores = iso_scores.copy()
    if lof_scores is not None:
        ensemble_scores = (iso_scores + lof_scores) / 2.0

    ensemble_preds = (ensemble_scores > 0.5).astype(int)

    print("=" * 60)
    print("  Ensemble (avg) – Classification Report")
    print("=" * 60)
    print(classification_report(
        y_test, ensemble_preds, target_names=["Normal", "Anomaly"], zero_division=0,
    ))

    # ── AUC scores ────────────────────────────────────────────────────────
    if y_test.sum() > 0 and y_test.sum() < len(y_test):
        iso_auc = roc_auc_score(y_test, iso_scores)
        print(f"  IsolationForest AUC : {iso_auc:.4f}")
        if lof_scores is not None:
            lof_auc = roc_auc_score(y_test, lof_scores)
            print(f"  LOF AUC             : {lof_auc:.4f}")
        ens_auc = roc_auc_score(y_test, ensemble_scores)
        print(f"  Ensemble AUC        : {ens_auc:.4f}")
    else:
        logger.warning("Cannot compute AUC: only one class present in test labels.")

    # ── Plots ─────────────────────────────────────────────────────────────
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)

    _plot_confusion_matrix(y_test, ensemble_preds, "Ensemble Confusion Matrix", CONFUSION_PNG)

    if y_test.sum() > 0 and y_test.sum() < len(y_test):
        _plot_roc_curves(y_test, iso_scores, lof_scores, ensemble_scores, ROC_PNG)
    else:
        logger.warning("Skipping ROC plot – only one class in test labels.")

    print("\n  Evaluation complete. Plots saved to:", EXPORT_DIR)
    print()


# ── Entry point ───────────────────────────────────────────────────────────────

def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    )
    evaluate()


if __name__ == "__main__":
    main()
