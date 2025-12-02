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
    
    # File storage paths
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    UPLOAD_FOLDER = os.path.join(BASE_DIR, 'data', 'uploads')
    OUTPUT_FOLDER = os.path.join(BASE_DIR, 'data', 'outputs')
    JOBS_FOLDER = os.path.join(BASE_DIR, 'data', 'jobs')
    
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