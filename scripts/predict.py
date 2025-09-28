import sys
import json
import joblib
import os
import numpy as np
from sklearn.preprocessing import LabelEncoder
from xgboost import XGBClassifier
import warnings
warnings.filterwarnings('ignore')

# Load model and preprocessors
MODEL_DIR = 'models'
model_path = os.path.join(MODEL_DIR, 'xgboost_model.pkl')
le_path = os.path.join(MODEL_DIR, 'label_encoder.pkl')

if not os.path.exists(model_path):
    print(json.dumps({"error": "Model not found"}), flush=True)
    sys.exit(1)

model = joblib.load(model_path)
label_encoder = joblib.load(le_path)

# Feature columns (must match training)
FEATURE_COLS = [
    'open_sum', 'close_sum', 'digit_root_open', 'digit_root_close',
    'open_tens', 'open_units', 'close_tens', 'close_units',
    'double_tens', 'double_units', 'day_of_week', 'is_weekend',
    'week_of_month', 'recency_index', 'sum_product', 'sum_diff', 'double_sum',
    'open_sum_ma7', 'open_sum_ma14', 'open_sum_ma30',
    'close_sum_ma7', 'close_sum_ma14', 'close_sum_ma30',
    'double_tens_ma7', 'double_tens_ma14', 'double_tens_ma30',
    'double_units_ma7', 'double_units_ma14', 'double_units_ma30',
    # Frequency arrays flattened
    'tens_freq_0', 'tens_freq_1', 'tens_freq_2', 'tens_freq_3', 'tens_freq_4',
    'tens_freq_5', 'tens_freq_6', 'tens_freq_7', 'tens_freq_8', 'tens_freq_9',
    'units_freq_0', 'units_freq_1', 'units_freq_2', 'units_freq_3', 'units_freq_4',
    'units_freq_5', 'units_freq_6', 'units_freq_7', 'units_freq_8', 'units_freq_9',
    # Enhanced features
    'month_sin', 'month_cos', 'day_sin', 'day_cos',
    'avg_transition_to_current', 'transition_entropy',
    'is_swap', 'tens_diff', 'units_diff', 'sum_diff_pair'
]

def flatten_features(features):
    """Flatten nested features for model input"""
    flat = {}
    
    # Basic features
    for key in ['open_sum', 'close_sum', 'digit_root_open', 'digit_root_close',
                'open_tens', 'open_units', 'close_tens', 'close_units',
                'double_tens', 'double_units', 'day_of_week', 'is_weekend',
                'week_of_month', 'recency_index', 'sum_product', 'sum_diff', 'double_sum']:
        flat[key] = features.get(key, 0)
    
    # Moving averages
    for ma in ['open_sum_ma7', 'open_sum_ma14', 'open_sum_ma30',
               'close_sum_ma7', 'close_sum_ma14', 'close_sum_ma30',
               'double_tens_ma7', 'double_tens_ma14', 'double_tens_ma30',
               'double_units_ma7', 'double_units_ma14', 'double_units_ma30']:
        flat[ma] = features.get(ma, 0)
    
    # Frequencies
    tens_freq = features.get('tens_frequency', [0]*10)
    units_freq = features.get('units_frequency', [0]*10)
    for i in range(10):
        flat[f'tens_freq_{i}'] = tens_freq[i]
        flat[f'units_freq_{i}'] = units_freq[i]
    
    # Enhanced
    enhanced = features.get('transition_matrix_features', {})
    flat['avg_transition_to_current'] = enhanced.get('avg_transition_to_current', 0)
    flat['transition_entropy'] = enhanced.get('transition_entropy', 0)
    
    pair = features.get('pair_features', {})
    flat['is_swap'] = 1 if pair.get('is_swap', False) else 0
    flat['tens_diff'] = pair.get('tens_diff', 0)
    flat['units_diff'] = pair.get('units_diff', 0)
    flat['sum_diff_pair'] = pair.get('sum_diff', 0)
    
    # Seasonality
    flat['month_sin'] = features.get('month_sin', 0)
    flat['month_cos'] = features.get('month_cos', 0)
    flat['day_sin'] = features.get('day_sin', 0)
    flat['day_cos'] = features.get('day_cos', 0)
    
    return flat

def main():
    input_data = json.loads(sys.argv[1])
    features = input_data.get('features', {})
    
    flat_features = flatten_features(features)
    
    # Prepare input vector
    X = np.array([[flat_features[col] for col in FEATURE_COLS]])
    
    # Predict probabilities
    probs = model.predict_proba(X)[0]
    
    # Decode labels
    classes = label_encoder.classes_
    scores = {classes[i]: float(probs[i]) for i in range(len(classes))}
    
    output = {
        "scores": scores,
        "top_prediction": classes[np.argmax(probs)],
        "confidence": float(np.max(probs))
    }
    
    print(json.dumps(output), flush=True)

if __name__ == "__main__":
    main()
