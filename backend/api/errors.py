"""
================================================================================
GA SCHEDULER FLASK API - Error Handlers
================================================================================

Custom error handlers for the API.
"""

from flask import jsonify


def register_error_handlers(app):
    """Register error handlers with the Flask app."""
    
    @app.errorhandler(400)
    def bad_request(error):
        return jsonify({
            "success": False,
            "error": "Bad Request",
            "message": str(error.description) if hasattr(error, 'description') else "Invalid request"
        }), 400
    
    @app.errorhandler(404)
    def not_found(error):
        return jsonify({
            "success": False,
            "error": "Not Found",
            "message": "The requested resource was not found"
        }), 404
    
    @app.errorhandler(405)
    def method_not_allowed(error):
        return jsonify({
            "success": False,
            "error": "Method Not Allowed",
            "message": "The method is not allowed for this endpoint"
        }), 405
    
    @app.errorhandler(413)
    def request_entity_too_large(error):
        return jsonify({
            "success": False,
            "error": "File Too Large",
            "message": "The uploaded file exceeds the maximum allowed size (16 MB)"
        }), 413
    
    @app.errorhandler(500)
    def internal_server_error(error):
        return jsonify({
            "success": False,
            "error": "Internal Server Error",
            "message": "An unexpected error occurred"
        }), 500


class APIError(Exception):
    """Custom API exception class."""
    
    def __init__(self, message, status_code=400, payload=None):
        super().__init__()
        self.message = message
        self.status_code = status_code
        self.payload = payload
    
    def to_dict(self):
        rv = dict(self.payload or {})
        rv['success'] = False
        rv['error'] = self.message
        return rv