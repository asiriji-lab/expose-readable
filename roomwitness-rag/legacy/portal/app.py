# Flask portal for the RoomWitness rental deposit claim classifier

import os
import sys

# Make project root importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv
import chromadb

load_dotenv()

app = Flask(__name__)

CHROMA_PATH = os.getenv("CHROMA_PATH", "./chroma_db")
COLLECTION_NAME = "thai_rental_law"


def _corpus_loaded() -> bool:
    try:
        chroma = chromadb.PersistentClient(path=CHROMA_PATH)
        col = chroma.get_or_create_collection(COLLECTION_NAME)
        return col.count() > 0
    except Exception:
        return False


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/analyze", methods=["POST"])
def analyze():
    from rag_agent import classify_claim

    data = request.form

    claim = {
        "item": data.get("item", ""),
        "description": data.get("description", ""),
        "amount_thb": float(data.get("amount_thb") or 0),
    }

    likely_raw = data.get("likely_tenant_caused", "unclear")
    if likely_raw == "yes":
        likely = True
    elif likely_raw == "no":
        likely = False
    else:
        likely = None

    cv_evidence = {
        "item_matched": True,
        "move_in_condition": data.get("move_in_condition", ""),
        "move_out_condition": data.get("move_out_condition", ""),
        "change_detected": data.get("change_detected") == "on",
        "likely_tenant_caused": likely,
        "confidence": float(data.get("cv_confidence") or 0.5),
        "notes": data.get("cv_notes", ""),
    }

    contract_clause = data.get("contract_clause", "")

    try:
        result = classify_claim(claim, cv_evidence, contract_clause)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/health")
def health():
    return jsonify({
        "status": "ok",
        "corpus_loaded": _corpus_loaded(),
    })


if __name__ == "__main__":
    app.run(debug=True, port=5001)
