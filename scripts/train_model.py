#!/usr/bin/env python3
"""
ML Training Script for Entertainment Guesser
Trains XGBoost model on historical data for double prediction.
"""

import os
import sys
import pandas as pd
import numpy as np
from sklearn.model_selection import TimeSeriesSplit, GridSearchCV
from sklearn.metrics import accuracy_score, precision_score, log_loss
from sklearn.preprocessing import StandardScaler
import xgboost as xgb
import joblib
import json
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

# MongoDB connection
from pymongo import MongoClient

def load_data_from_mongo():
    """Load AnalysisRecord data from MongoDB"""
    client = MongoClient('mongodb://localhost:27017')
    db = client['matka-platform']
    collection = db['analysisrecords']

    # Load all records, sort by date
    records = list(collection.find().sort('date', 1))
    if not records:
        raise ValueError("No analysis records found. Run featurizer first.")

    df = pd.DataFrame(records)
    df['date'] = pd.to_datetime(df['date'])
    df = df.sort_values('date')

    # Drop MongoDB _id
    df = df.drop('_id', axis=1)

    return df

def prepare_features(df):
    """Prepare features and labels"""
    # Features: all numeric columns except label and date
    feature_cols = [col for col in df.columns if col not in ['date', 'label', 'open3', 'close3', 'middle', 'double'] and df[col].dtype in ['int64', 'float64']]

    X = df[feature_cols].fillna(0)
    y = df['label']

    # Convert labels to numeric (00-99)
    y_numeric = y.astype(int)

    return X, y_numeric, feature_cols

def train_xgboost(X, y, feature_names):
    """Train XGBoost with time-series CV"""
    # Time series split
    tscv = TimeSeriesSplit(n_splits=5)

    # Parameter grid
    param_grid = {
        'max_depth': [3, 5, 7],
        'learning_rate': [0.01, 0.1, 0.2],
        'n_estimators': [100, 200, 300],
        'subsample': [0.8, 1.0],
        'colsample_bytree': [0.8, 1.0]
    }

    # XGBoost classifier for multi-class
    xgb_clf = xgb.XGBClassifier(
        objective='multi:softprob',
        num_class=100,  # 00-99
        eval_metric='mlogloss',
        use_label_encoder=False
    )

    # Grid search with time series CV
    grid_search = GridSearchCV(
        xgb_clf,
        param_grid,
        cv=tscv,
        scoring='neg_log_loss',
        n_jobs=-1,
        verbose=1
    )

    grid_search.fit(X, y)

    best_model = grid_search.best_estimator_

    # Evaluate on each fold
    fold_scores = []
    for train_idx, test_idx in tscv.split(X):
        X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
        y_train, y_test = y.iloc[train_idx], y.iloc[test_idx]

        best_model.fit(X_train, y_train)
        y_pred = best_model.predict(X_test)
        y_pred_proba = best_model.predict_proba(X_test)

        fold_scores.append({
            'accuracy': accuracy_score(y_test, y_pred),
            'log_loss': log_loss(y_test, y_pred_proba, labels=range(100)),
            'top1_acc': accuracy_score(y_test, y_pred),
            'top3_acc': np.mean([1 if true in pred[:3] else 0 for true, pred in zip(y_test, np.argsort(y_pred_proba, axis=1)[:, ::-1])]),
            'top5_acc': np.mean([1 if true in pred[:5] else 0 for true, pred in zip(y_test, np.argsort(y_pred_proba, axis=1)[:, ::-1])])
        })

    return best_model, grid_search.best_params_, fold_scores, feature_names

def save_model(model, feature_names, best_params, cv_scores):
    """Save model and metadata"""
    os.makedirs('models', exist_ok=True)

    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    model_path = f'models/xgb_model_{timestamp}.joblib'
    meta_path = f'models/model_metadata_{timestamp}.json'

    # Save model
    joblib.dump(model, model_path)

    # Save metadata
    metadata = {
        'timestamp': timestamp,
        'model_path': model_path,
        'best_params': best_params,
        'feature_names': feature_names,
        'cv_scores': cv_scores,
        'avg_top1_acc': np.mean([s['top1_acc'] for s in cv_scores]),
        'avg_top3_acc': np.mean([s['top3_acc'] for s in cv_scores]),
        'avg_top5_acc': np.mean([s['top5_acc'] for s in cv_scores]),
        'avg_log_loss': np.mean([s['log_loss'] for s in cv_scores])
    }

    with open(meta_path, 'w') as f:
        json.dump(metadata, f, indent=2, default=str)

    print(f"Model saved to {model_path}")
    print(f"Metadata saved to {meta_path}")

    return model_path, metadata

def main():
    print("Loading data from MongoDB...")
    df = load_data_from_mongo()
    print(f"Loaded {len(df)} records")

    print("Preparing features...")
    X, y, feature_names = prepare_features(df)
    print(f"Features: {len(feature_names)}")
    print(f"Labels: {len(y)} unique values")

    print("Training XGBoost model...")
    model, best_params, cv_scores, feature_names = train_xgboost(X, y, feature_names)

    print("Saving model...")
    model_path, metadata = save_model(model, feature_names, best_params, cv_scores)

    print("\nTraining completed!")
    print(f"Best params: {best_params}")
    print(".3f")
    print(".3f")
    print(".3f")
    print(".4f")

if __name__ == '__main__':
    main()
