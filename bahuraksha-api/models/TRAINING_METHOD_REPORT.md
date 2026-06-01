# Model Training Report

Generated from real CSV data (10 years NASA POWER rainfall 2016–2026, estimated discharge, Sentinel SAR).

## 1. How event prediction is made

For each sample, the classifier outputs a probability:

- `p = P(y=1 | x)`

Decision rule:
- predict event (`1`) if `p >= t`
- predict non-event (`0`) if `p < t`

Where `t` is the task-specific threshold chosen on the validation split via F1 optimization.

## 2. Current model thresholds

### Flood model (XGBoost, `train_flood_model.py`)
- **Threshold**: 0.610
- **Data**: 3,650 daily samples, temporal split (train ≤2022, val 2023-2024, test ≥2025)
- **Labels**: Synthetic (rainfall percentile + discharge rules + 5% noise)

| Metric | Validation | Test |
|---|---|---|
| ROC-AUC | 0.847 | 0.836 |
| PR-AUC | 0.733 | 0.758 |
| F1 | 0.803 | 0.800 |
| Precision | — | 0.909 |
| Recall | — | 0.714 |
| CV ROC-AUC | — | 0.885 |
| CV PR-AUC | — | 0.817 |

Confusion matrix (test, threshold=0.610): TN 440, FP 5, FN 20, TP 50

### Landslide model (XGBoost, `train_landslide_model.py`)
- **Threshold**: 0.470
- **Data**: 21,900 zone-days (6 zones × 3,650 days)
- **Labels**: Synthetic (rainfall + slope rules + vegetation modulation + 3% noise)

| Metric | Validation | Test |
|---|---|---|
| ROC-AUC | 0.933 | 0.905 |
| PR-AUC | 0.869 | 0.861 |
| F1 | 0.910 | 0.886 |
| Precision | — | 0.970 |
| Recall | — | 0.815 |
| CV ROC-AUC | — | 0.919 |
| CV PR-AUC | — | 0.862 |

Confusion matrix (test, threshold=0.470): TN 2636, FP 11, FN 82, TP 361

### ml-pipeline Landslide (XGBoost + isotonic, `ml-pipeline/train.py`)
- **Thresholds**: evacuate ≥0.78, warning ≥0.58, watch ≥0.32
- **Data**: 50 real ICIMOD positives + 5,500 synthetic (augment-real)
- **Features**: 14 raw + 6 engineered = 20 total

| Metric | Value |
|---|---|
| CV ROC-AUC | 0.875 |
| CV Avg Precision | 0.561 |
| CV F1 | 0.532 |
| CV Precision | 0.477 |
| CV Recall | 0.603 |
| Train ROC-AUC | 0.998 |

## 3. Threshold selection formula

`t* = argmax_t F1(t)` on validation data.

Definitions at threshold `t`:
- `Precision(t) = TP / (TP + FP)`
- `Recall(t) = TP / (TP + FN)`
- `F1(t) = 2 · Precision(t) · Recall(t) / (Precision(t) + Recall(t))`

Candidate thresholds from `sklearn.metrics.precision_recall_curve`. The threshold maximizing validation F1 is selected.

## 4. Feature columns

### Flood model
rf_1day, rf_3day, rf_7day, rf_30day, discharge_proxy, soil_moisture_index, sar_vv_db, sar_vh_db, sar_vv_vh_ratio_db, elevation_m, slope_deg, aspect_deg, curvature, month, day_of_year, lat, lon

### Landslide models
slope_angle_deg, soil_moisture_pct, rainfall_7d_mm, rainfall_today_mm, seismic_activity_mg, vegetation_cover_pct, elevation_m, distance_to_road_km, distance_to_river_km, curvature, aspect_deg, ndvi, lithology_code, land_use_code (+6 engineered interactions)

## 5. Practical notes

- Models trained on synthetic labels (physical threshold rules) — real event data would improve calibration.
- The ml-pipeline isotonic calibration is conservative; heuristic risk scores are preferred during dry season.
- Monsoon season (June–September) will push feature values into ranges where ML models differentiate risk.
- Thresholds should be re-tuned when data distribution, class balance, or policy priorities change.
