import os
import sys
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson.objectid import ObjectId
import re

# Add the 'ml' directory to the python path to import model.py
current_dir = os.path.dirname(os.path.abspath(__file__))
ml_dir = os.path.abspath(os.path.join(current_dir, '..', 'ml'))
if ml_dir not in sys.path:
    sys.path.append(ml_dir)

from model import predict_emotion
from db import db
#from cognitive import detect_cognitive_distortions

predict_bp = Blueprint('predict', __name__)

@predict_bp.route('/predict', methods=['POST'])
@jwt_required(optional=True)
def predict():
    data = request.get_json()
    if not data or 'text' not in data:
        return jsonify({'error': 'Text field is required'}), 400

    text = data['text']
    user_id_str = get_jwt_identity()

    try:
        top_label, confidence, top_3, highlight_words = predict_emotion(text)
        distortions = []
    except Exception as e:
        return jsonify({'error': f'Model prediction failed: {str(e)}'}), 500

    prediction_record = {
        'text': text,
        'predicted_emotion': top_label,
        'confidence': confidence,
        'top_3': top_3,
        'cognitive_distortions': distortions,
        'highlight_words': highlight_words,
        'timestamp': datetime.now(timezone.utc),
        'user_id': ObjectId(user_id_str) if user_id_str else None
    }

    result = db.predictions.insert_one(prediction_record)

    response_data = {
        '_id': str(result.inserted_id),
        'text': text,
        'predicted_emotion': top_label,
        'confidence': confidence,
        'top_3': top_3,
        'cognitive_distortions': distortions,
        'highlight_words': highlight_words,
        'timestamp': prediction_record['timestamp'].isoformat(),
        'user_id': user_id_str if user_id_str else None
    }

    return jsonify(response_data), 200

@predict_bp.route('/history', methods=['GET'])
@jwt_required()
def get_history():
    user_id = get_jwt_identity()

    predictions = list(db.predictions.find(
        {'user_id': ObjectId(user_id)}
    ).sort('timestamp', -1))

    for p in predictions:
        p['_id'] = str(p['_id'])
        p['user_id'] = str(p['user_id'])
        p['timestamp'] = p['timestamp'].isoformat()

    return jsonify(predictions), 200

@predict_bp.route('/history/search', methods=['GET'])
@jwt_required()
def search_history():
    user_id = get_jwt_identity()
    query = request.args.get('q', '')

    if not query:
        return jsonify({'error': 'Search keyword "q" is required'}), 400

    regex = re.compile(f".*{re.escape(query)}.*", re.IGNORECASE)

    predictions = list(db.predictions.find({
        'user_id': ObjectId(user_id),
        'text': regex
    }).sort('timestamp', -1))

    for p in predictions:
        p['_id'] = str(p['_id'])
        p['user_id'] = str(p['user_id'])
        p['timestamp'] = p['timestamp'].isoformat()

    return jsonify(predictions), 200

@predict_bp.route('/history/filter', methods=['GET'])
@jwt_required()
def filter_history():
    user_id = get_jwt_identity()
    emotion = request.args.get('emotion', '')

    if not emotion:
        return jsonify({'error': 'Filter parameter "emotion" is required'}), 400

    predictions = list(db.predictions.find({
        'user_id': ObjectId(user_id),
        'predicted_emotion': emotion
    }).sort('timestamp', -1))

    for p in predictions:
        p['_id'] = str(p['_id'])
        p['user_id'] = str(p['user_id'])
        p['timestamp'] = p['timestamp'].isoformat()

    return jsonify(predictions), 200