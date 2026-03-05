"""
Feature engineering for the ProVigil anomaly-detection pipeline.

Transforms raw meter telemetry into a rich feature set suitable for
IsolationForest / LOF training and inference.
"""

import logging
from typing import List, Tuple

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# ── Nominal reference values ──────────────────────────────────────────────────
NOMINAL_VOLTAGE = 230.0
NOMINAL_FREQUENCY = 50.0
NOMINAL_POWER_FACTOR = 1.0

# Columns expected in raw telemetry DataFrames
RAW_COLUMNS = [
    "timestamp", "voltage", "current", "power",
    "temperature", "frequency", "power_factor",
]

# Business-hour range when non-zero load is expected (inclusive)
LOAD_EXPECTED_HOURS = range(7, 23)

# Physical value ranges – anything outside is a violation
VALUE_RANGES = {
    "voltage":      (180.0, 270.0),
    "current":      (0.0, 500.0),
    "power":        (-50.0, 500.0),
    "temperature":  (0.0, 100.0),
    "frequency":    (47.0, 53.0),
    "power_factor": (-1.0, 1.0),
}


# ── Public API ────────────────────────────────────────────────────────────────

def extract_features(
    df: pd.DataFrame,
    window_size: int = 24,
) -> pd.DataFrame:
    """Extract engineered features from a single-meter telemetry DataFrame.

    Parameters
    ----------
    df : pd.DataFrame
        Must contain columns listed in ``RAW_COLUMNS``.  ``timestamp`` must
        be parse-able as a datetime.
    window_size : int
        Number of rows for rolling-window statistics (default 24, roughly
        24 intervals ≈ 12 minutes at 30-s cadence, or 24 hours at hourly cadence).

    Returns
    -------
    pd.DataFrame
        One row per input row with the original index preserved.  The first
        ``window_size - 1`` rows will contain NaNs for rolling features.
    """
    df = df.copy()

    # ── Ensure datetime ───────────────────────────────────────────────────
    if "timestamp" in df.columns:
        df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
    else:
        raise ValueError("DataFrame must contain a 'timestamp' column.")

    df.sort_values("timestamp", inplace=True)
    df.reset_index(drop=True, inplace=True)

    features = pd.DataFrame(index=df.index)

    # ── Rolling statistics ────────────────────────────────────────────────
    for col in ("voltage", "current", "power", "temperature"):
        series = df[col].astype(float)
        rolling = series.rolling(window=window_size, min_periods=1)
        features[f"rolling_mean_{col}"] = rolling.mean()
        features[f"rolling_std_{col}"] = rolling.std().fillna(0.0)

    # ── Temperature rate of change ────────────────────────────────────────
    features["temperature_rate_of_change"] = df["temperature"].astype(float).diff().fillna(0.0)

    # ── Deviation features ────────────────────────────────────────────────
    features["voltage_deviation"] = (df["voltage"].astype(float) - NOMINAL_VOLTAGE).abs()
    features["power_factor_deviation"] = (df["power_factor"].astype(float) - NOMINAL_POWER_FACTOR).abs()
    features["frequency_deviation"] = (df["frequency"].astype(float) - NOMINAL_FREQUENCY).abs()

    # ── Cyclical time encoding ────────────────────────────────────────────
    hour = df["timestamp"].dt.hour + df["timestamp"].dt.minute / 60.0
    day_of_week = df["timestamp"].dt.dayofweek.astype(float)

    features["hour_sin"] = np.sin(2 * np.pi * hour / 24.0)
    features["hour_cos"] = np.cos(2 * np.pi * hour / 24.0)
    features["dow_sin"] = np.sin(2 * np.pi * day_of_week / 7.0)
    features["dow_cos"] = np.cos(2 * np.pi * day_of_week / 7.0)

    # ── Gap count: missing intervals within the rolling window ────────────
    # Compute expected interval (median diff) then count gaps > 2× that.
    ts_diff = df["timestamp"].diff().dt.total_seconds()
    median_interval = ts_diff.median()
    if pd.isna(median_interval) or median_interval <= 0:
        median_interval = 3600.0  # fallback: 1 hour

    is_gap = (ts_diff > 2 * median_interval).astype(float)
    features["readings_gap_count"] = (
        is_gap.rolling(window=window_size, min_periods=1).sum()
    )

    # ── Zero-reading count (power == 0 during expected-load hours) ────────
    power_zero = (df["power"].astype(float) == 0).astype(float)
    in_load_hours = df["timestamp"].dt.hour.isin(LOAD_EXPECTED_HOURS).astype(float)
    unexpected_zero = power_zero * in_load_hours
    features["zero_reading_count"] = (
        unexpected_zero.rolling(window=window_size, min_periods=1).sum()
    )

    # ── Value-range violations ────────────────────────────────────────────
    violation = pd.Series(0.0, index=df.index)
    for col, (lo, hi) in VALUE_RANGES.items():
        if col in df.columns:
            vals = df[col].astype(float)
            violation += ((vals < lo) | (vals > hi)).astype(float)
    features["value_range_violations"] = (
        violation.rolling(window=window_size, min_periods=1).sum()
    )

    return features


def get_feature_columns() -> List[str]:
    """Return the ordered list of feature column names produced by ``extract_features``."""
    return [
        "rolling_mean_voltage", "rolling_std_voltage",
        "rolling_mean_current", "rolling_std_current",
        "rolling_mean_power", "rolling_std_power",
        "rolling_mean_temperature", "rolling_std_temperature",
        "temperature_rate_of_change",
        "voltage_deviation", "power_factor_deviation", "frequency_deviation",
        "hour_sin", "hour_cos", "dow_sin", "dow_cos",
        "readings_gap_count", "zero_reading_count", "value_range_violations",
    ]


def prepare_training_data(
    readings_list: List[pd.DataFrame],
    window_size: int = 24,
) -> Tuple[np.ndarray, np.ndarray]:
    """Prepare training matrices from a list of per-meter DataFrames.

    Parameters
    ----------
    readings_list : list[pd.DataFrame]
        Each DataFrame represents one meter's readings with the standard
        raw columns **plus** a ``meter_id`` column.
    window_size : int
        Passed through to ``extract_features``.

    Returns
    -------
    X : np.ndarray, shape (n_samples, n_features)
        Feature matrix with NaN rows dropped.
    meter_ids : np.ndarray, shape (n_samples,)
        Corresponding meter ID for each sample row.
    """
    feature_cols = get_feature_columns()
    all_features: List[pd.DataFrame] = []
    all_ids: List[pd.Series] = []

    for df in readings_list:
        if df.empty:
            continue

        meter_id_val = df["meter_id"].iloc[0] if "meter_id" in df.columns else "unknown"
        feats = extract_features(df, window_size=window_size)
        feats["meter_id"] = meter_id_val

        all_features.append(feats)

    if not all_features:
        return np.empty((0, len(feature_cols))), np.empty(0)

    combined = pd.concat(all_features, ignore_index=True)

    # Drop rows with any NaN in the feature columns
    mask = combined[feature_cols].notna().all(axis=1)
    clean = combined.loc[mask].reset_index(drop=True)

    X = clean[feature_cols].values.astype(np.float64)
    meter_ids = clean["meter_id"].values

    logger.info(
        "Prepared training data: %d samples, %d features from %d meters.",
        X.shape[0], X.shape[1], len(readings_list),
    )

    return X, meter_ids
