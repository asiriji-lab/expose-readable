"""
================================================================================
GA SCHEDULER FLASK API - Configuration
================================================================================

Configuration settings for the Flask application.
"""

import os
from datetime import timedelta


class Config:
    """Base configuration class."""

    # Flask settings
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')
    DEBUG = os.getenv('DEBUG', 'True').lower() == 'true'

    # JWT settings (Flask-JWT-Extended)
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', SECRET_KEY)
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=int(os.getenv('JWT_EXPIRY_HOURS', 24)))

    # File storage paths
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    UPLOAD_FOLDER = os.path.join(BASE_DIR, 'data', 'uploads')
    OUTPUT_FOLDER = os.path.join(BASE_DIR, 'data', 'outputs')
    JOBS_FOLDER = os.path.join(BASE_DIR, 'data', 'jobs')

    # Logging
    LOGS_DIR = os.path.join(BASE_DIR, 'logs')

    # File upload settings
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16 MB max file size
    ALLOWED_EXTENSIONS = {'csv'}

    # GA Default Parameters
    GA_POPULATION_SIZE = int(os.getenv('GA_POPULATION_SIZE', 150))
    GA_MAX_GENERATIONS = int(os.getenv('GA_MAX_GENERATIONS', 500))
    GA_MUTATION_RATE = float(os.getenv('GA_MUTATION_RATE', 0.20))
    GA_CROSSOVER_RATE = float(os.getenv('GA_CROSSOVER_RATE', 0.80))
    GA_ELITE_SIZE = int(os.getenv('GA_ELITE_SIZE', 10))
    GA_TOURNAMENT_SIZE = int(os.getenv('GA_TOURNAMENT_SIZE', 7))

    # Job settings
    JOB_TIMEOUT = int(os.getenv('JOB_TIMEOUT', 600))  # 10 minutes
    JOB_CLEANUP_DAYS = int(os.getenv('JOB_CLEANUP_DAYS', 7))

    # PostgreSQL — consumed by Flask-SQLAlchemy
    DATABASE_URL = (
        "postgresql://"
        + os.getenv('POSTGRES_USER', '') + ":"
        + os.getenv('POSTGRES_PASSWORD', '') + "@"
        + os.getenv('POSTGRES_HOST', '') + "/"
        + os.getenv('POSTGRES_DB', '')
    )
    SQLALCHEMY_DATABASE_URI = DATABASE_URL
    SQLALCHEMY_TRACK_MODIFICATIONS = False


class DevelopmentConfig(Config):
    """Development configuration."""
    DEBUG = True


class ProductionConfig(Config):
    """Production configuration."""
    DEBUG = False
    SECRET_KEY = os.getenv('SECRET_KEY')  # Must be set in production


class TestingConfig(Config):
    """Testing configuration."""
    TESTING = True
    DEBUG = True


# Configuration dictionary
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}