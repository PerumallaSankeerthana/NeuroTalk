import os
from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from dotenv import load_dotenv

from db import db
from auth import auth_bp
from predict import predict_bp
from admin import admin_bp
from chat import chat_bp

# Load environment variables
load_dotenv()

def create_app():
    app = Flask(__name__)
    app.config['CORS_HEADERS'] = 'Content-Type'
    # Configure CORS strictly for React frontend
    CORS(
    app,
    resources={r"/api/*": {"origins": ["http://localhost:5173"]}},
    supports_credentials=True,
    allow_headers=["Content-Type", "Authorization"],
    methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"]
)
    
    # Configure JWT
    app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "your_jwt_secret_key_here")
    app.config["JWT_ACCESS_TOKEN_EXPIRES"] = 86400  # 24 hours
    jwt = JWTManager(app)
    
    # Register blueprints
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(predict_bp, url_prefix="/api/predict")
    app.register_blueprint(admin_bp, url_prefix="/api/admin")
    app.register_blueprint(chat_bp, url_prefix="/api")
    
    @app.route("/health", methods=["GET"])
    def health_check():
        return {"status": "healthy"}, 200
        
    return app

if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", debug=False, port=5001)
