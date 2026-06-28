# Flask portal for the RoomWitness rental deposit claim classifier

import os
import sys

# Make project root and sibling vlm directory importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "roomwitness-vlm"))

import json
import tempfile
import uuid

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
    evidence_text   = data.get("evidence_text", "")

    # Append extracted conversation evidence to the contract clause context
    if evidence_text.strip():
        contract_clause = contract_clause + "\n\n--- CONVERSATION EVIDENCE ---\n" + evidence_text

    try:
        result = classify_claim(claim, cv_evidence, contract_clause)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/assess-damage", methods=["POST"])
def assess_damage():
    from agent01_cv import run_cv_assessment

    move_in_file = request.files.get("move_in_image")
    move_out_file = request.files.get("move_out_image")

    if not move_in_file or not move_out_file:
        return jsonify({"error": "Both move_in_image and move_out_image are required."}), 400

    claims_raw = request.form.get("claims", "[]")
    try:
        claims = json.loads(claims_raw)
    except (ValueError, TypeError):
        return jsonify({"error": "claims must be valid JSON."}), 400

    tmp_dir = tempfile.mkdtemp()
    move_in_path = os.path.join(tmp_dir, f"move_in_{uuid.uuid4().hex}.jpg")
    move_out_path = os.path.join(tmp_dir, f"move_out_{uuid.uuid4().hex}.jpg")

    try:
        move_in_file.save(move_in_path)
        move_out_file.save(move_out_path)
        result = run_cv_assessment(
            move_in_paths=[move_in_path],
            move_out_paths=[move_out_path],
            landlord_claims=claims,
        )
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        for p in [move_in_path, move_out_path]:
            try:
                os.remove(p)
            except OSError:
                pass


@app.route("/extract-evidence", methods=["POST"])
def extract_evidence():
    """OCR + vision-extract conversation screenshots; merge with manual promise text."""
    from agent02_evidence import run_evidence_analysis

    screenshots = request.files.getlist("screenshots")
    manual_landlord = request.form.get("manual_landlord_promises", "")
    manual_tenant   = request.form.get("manual_tenant_promises", "")

    tmp_dir = tempfile.mkdtemp()
    saved_paths = []
    try:
        for f in screenshots:
            if not f or not f.filename:
                continue
            ext = os.path.splitext(f.filename)[1].lower() or ".jpg"
            path = os.path.join(tmp_dir, f"screenshot_{uuid.uuid4().hex}{ext}")
            f.save(path)
            saved_paths.append(path)

        result = run_evidence_analysis(
            screenshot_paths=saved_paths,
            manual_landlord_promises=manual_landlord,
            manual_tenant_promises=manual_tenant,
        )
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        for p in saved_paths:
            try:
                os.remove(p)
            except OSError:
                pass


@app.route("/extract-contract", methods=["POST"])
def extract_contract():
    """Extract text from an uploaded contract file (PDF or image) and return as plain text."""
    contract_file = request.files.get("contract_file")
    if not contract_file:
        return jsonify({"error": "No file uploaded."}), 400

    filename = contract_file.filename or ""
    ext = os.path.splitext(filename)[1].lower()

    tmp_dir = tempfile.mkdtemp()
    tmp_path = os.path.join(tmp_dir, f"contract_{uuid.uuid4().hex}{ext}")

    try:
        contract_file.save(tmp_path)

        if ext == ".pdf":
            import pdfplumber
            text_parts = []
            with pdfplumber.open(tmp_path) as pdf:
                for page in pdf.pages:
                    t = page.extract_text()
                    if t:
                        text_parts.append(t)
            text = "\n\n".join(text_parts).strip()
            if not text:
                return jsonify({"error": "Could not extract text from PDF. Try an image instead."}), 422
        elif ext in (".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff", ".tif"):
            import subprocess
            result = subprocess.run(
                ["tesseract", tmp_path, "stdout", "-l", "tha+eng", "--psm", "6"],
                capture_output=True, text=True,
            )
            text = result.stdout.strip()
            if not text:
                return jsonify({"error": "OCR returned no text. Check image quality."}), 422
        else:
            return jsonify({"error": f"Unsupported file type: {ext}"}), 400

        return jsonify({"text": text})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        try:
            os.remove(tmp_path)
        except OSError:
            pass


@app.route("/full-analysis", methods=["POST"])
def full_analysis():
    """
    One-shot pipeline: CV → evidence → RAG legal classification per claim.
    Accepts multipart form. Returns unified JSON.
    """
    from agent01_cv import run_cv_assessment
    from agent02_evidence import run_evidence_analysis
    from rag_agent import classify_claim

    move_in_file  = request.files.get("move_in_image")
    move_out_file = request.files.get("move_out_image")
    screenshots   = request.files.getlist("screenshots")

    claims_raw = request.form.get("claims", "[]")
    try:
        claims = json.loads(claims_raw)
    except (ValueError, TypeError):
        return jsonify({"error": "claims must be valid JSON."}), 400

    if not claims:
        return jsonify({"error": "At least one claim is required."}), 400

    contract_clause      = request.form.get("contract_clause", "")
    manual_landlord      = request.form.get("manual_landlord_promises", "")
    manual_tenant        = request.form.get("manual_tenant_promises", "")

    tmp_dir = tempfile.mkdtemp()
    saved = {}   # key → path

    try:
        def _save(file, key, default_ext=".jpg"):
            if not file or not file.filename:
                return None
            ext = os.path.splitext(file.filename)[1].lower() or default_ext
            path = os.path.join(tmp_dir, f"{key}_{uuid.uuid4().hex}{ext}")
            file.save(path)
            saved[key] = path
            return path

        move_in_path  = _save(move_in_file,  "move_in")
        move_out_path = _save(move_out_file, "move_out")

        screenshot_paths = []
        for i, f in enumerate(screenshots):
            p = _save(f, f"ss_{i}")
            if p:
                screenshot_paths.append(p)

        # ── Step 1: CV photo comparison ───────────────────────
        cv_result = None
        if move_in_path and move_out_path:
            cv_result = run_cv_assessment(
                move_in_paths=[move_in_path],
                move_out_paths=[move_out_path],
                landlord_claims=claims,
            )

        # ── Step 2: Conversation evidence extraction ──────────
        evidence_result = None
        if screenshot_paths or manual_landlord.strip() or manual_tenant.strip():
            evidence_result = run_evidence_analysis(
                screenshot_paths=screenshot_paths,
                manual_landlord_promises=manual_landlord,
                manual_tenant_promises=manual_tenant,
            )

        # Build enriched contract context
        context = contract_clause
        if evidence_result and evidence_result.get("evidence_text", "").strip() not in ("", "No evidence extracted."):
            context += "\n\n--- CONVERSATION EVIDENCE ---\n" + evidence_result["evidence_text"]

        # ── Step 3: RAG legal classification per claim ────────
        legal_results = []
        cv_assessments = (cv_result or {}).get("claim_assessments", [])

        for i, claim in enumerate(claims):
            # Pull matching CV assessment if available
            cv_a = cv_assessments[i] if i < len(cv_assessments) else {}
            cv_evidence = {
                "item_matched":        True,
                "move_in_condition":   cv_a.get("move_in_condition", ""),
                "move_out_condition":  cv_a.get("move_out_condition", ""),
                "change_detected":     cv_a.get("change_detected", False),
                "likely_tenant_caused": cv_a.get("likely_tenant_caused", None),
                "confidence":          cv_a.get("confidence", 0.5),
                "notes":               cv_a.get("notes", ""),
                "wear_and_tear":       cv_a.get("wear_and_tear", False),
                "wear_and_tear_reason": cv_a.get("wear_and_tear_reason", ""),
                "supports_landlord_claim": cv_a.get("supports_landlord_claim", "PARTIAL"),
            }

            rag = classify_claim(claim, cv_evidence, context)
            legal_results.append({
                "claim":       claim,
                "cv":          cv_a,
                "legal":       rag,
            })

        return jsonify({
            "claims":          legal_results,
            "cv_summary":      (cv_result or {}).get("summary"),
            "evidence_summary": {
                "landlord_promises": (evidence_result or {}).get("all_landlord_promises", []),
                "tenant_promises":   (evidence_result or {}).get("all_tenant_promises", []),
                "deposit_mentions":  (evidence_result or {}).get("all_deposit_mentions", []),
                "platforms":         (evidence_result or {}).get("platforms_detected", []),
            } if evidence_result else None,
            "images_used": {
                "move_in":  os.path.basename(move_in_path)  if move_in_path  else None,
                "move_out": os.path.basename(move_out_path) if move_out_path else None,
            },
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        for path in saved.values():
            try:
                os.remove(path)
            except OSError:
                pass


@app.route("/health")
def health():
    return jsonify({
        "status": "ok",
        "corpus_loaded": _corpus_loaded(),
    })


if __name__ == "__main__":
    app.run(debug=True, port=5001)
