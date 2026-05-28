MODEL_CONFIG = {
    "xgboost": {
        "n_estimators": 200,
        "max_depth": 6,
        "learning_rate": 0.05,
        "subsample": 0.8,
        "colsample_bytree": 0.8,
        "min_child_weight": 3,
        "gamma": 0.1,
        "reg_alpha": 0.1,
        "reg_lambda": 1.0,
        "scale_pos_weight": 10,
        "random_state": 42,
        "eval_metric": "auc",
    },
    "calibration": {
        "method": "isotonic",
        "cv_folds": 5,
    },
    "thresholds": {
        "evacuate": 0.78,
        "warning": 0.58,
        "watch": 0.32,
    },
}

FEATURES = [
    "slope_angle_deg",
    "soil_moisture_pct",
    "rainfall_7d_mm",
    "rainfall_today_mm",
    "seismic_activity_mg",
    "vegetation_cover_pct",
    "elevation_m",
    "distance_to_road_km",
    "distance_to_river_km",
    "curvature",
    "aspect_deg",
    "ndvi",
    "lithology_code",
    "land_use_code",
]

TARGET = "landslide_occurrence"

NEPAL_REGION = {
    "lat_range": (26.3, 30.5),
    "lon_range": (80.0, 88.2),
    "elevation_range": (60, 8848),
    "slope_range": (0, 70),
    "rainfall_annual_range": (500, 5000),
}
