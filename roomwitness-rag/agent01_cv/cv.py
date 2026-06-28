"""
Computer Vision agent — compares move-in vs move-out photos using Groq Llama-4-Scout.
Photo pairs are downloaded from S3 (or local paths in demo mode) before assessment.
"""

import base64
import json
import re
from io import BytesIO

from groq import Groq
from PIL import Image

# TODO: Ensure GROQ_API_KEY is set in .env
# TODO: Verify model availability — check https://console.groq.com for latest Scout model ID
MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"


def _get_groq_client(api_key: str) -> Groq:
    """Return a Groq client. api_key comes from shared/config.py at startup."""
    return Groq(api_key=api_key)


def prepare_image(image_path: str) -> str:
    """
    Load an image, resize to max 1024px on the longest side, encode as base64 JPEG.

    Args:
        image_path: Local file path (download from S3 first if needed).

    Returns:
        Base64-encoded JPEG string.
    """
    img = Image.open(image_path).convert("RGB")
    w, h = img.size
    if max(w, h) > 1024:
        scale = 1024 / max(w, h)
        img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
    buf = BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return base64.b64encode(buf.getvalue()).decode("utf-8")


def assess_claim(
    move_in_b64: str,
    move_out_b64: str,
    claim_item: str,
    claim_description: str,
    claim_amount: float,
    client: Groq,
) -> dict:
    """
    Send both images and one claim to Groq Llama-4-Scout for visual assessment.

    Args:
        move_in_b64: Base64 JPEG of move-in photo.
        move_out_b64: Base64 JPEG of move-out photo.
        claim_item: Item name from landlord claim.
        claim_description: Landlord's damage description.
        claim_amount: Claimed amount in THB.
        client: Groq client instance.

    Returns:
        Raw assessment dict from Groq, or a failure stub on parse error.
    """
    system_prompt = (
        "You are a professional property damage assessor. "
        "You compare move-in and move-out photos to evaluate specific landlord damage claims. "
        "You are fair and objective — you identify real damage but also recognise normal wear and tear. "
        "Respond only in valid JSON. No prose. No explanation."
    )

    user_text = f"""Evaluate this landlord damage claim by comparing the two room photos.

Image 1 = move-in condition (tenant's photo)
Image 2 = move-out condition (landlord's photo)

CLAIM ITEM: {claim_item}
LANDLORD SAYS: {claim_description}
AMOUNT CLAIMED: {claim_amount} THB

Return this exact JSON:
{{
  "item": "the claim item name",
  "move_in_condition": "describe what you see for this item in image 1",
  "move_out_condition": "describe what you see for this item in image 2",
  "change_detected": true or false,
  "change_description": "what specifically changed, or 'no change detected'",
  "wear_and_tear": true or false,
  "wear_and_tear_reason": "why you classified it as wear and tear or not",
  "likely_tenant_caused": true or false or null,
  "supports_landlord_claim": "YES" or "NO" or "PARTIAL",
  "confidence": a float from 0.0 to 1.0,
  "confidence_reason": "brief reason for this confidence level",
  "low_visibility": true or false,
  "notes": "lighting issues, angle differences, or unclear areas"
}}

Rules:
- wear_and_tear is true if the change looks like normal aging from regular use, not negligence
- likely_tenant_caused is null only if you genuinely cannot determine from the photos
- low_visibility is true if lighting, angle, or photo quality makes assessment difficult
- If the claimed item is not visible in either photo, set confidence below 0.3 and explain in notes
- Do not invent damage that is not visible"""

    content = [
        {"type": "text", "text": user_text},
        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{move_in_b64}"}},
        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{move_out_b64}"}},
    ]

    raw = ""
    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": content},
            ],
            temperature=0.1,
            max_tokens=800,
        )
        raw = response.choices[0].message.content.strip()
        return json.loads(raw)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]+\}", raw)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                pass
    except Exception:
        pass

    return {
        "item": claim_item,
        "move_in_condition": "assessment failed",
        "move_out_condition": "assessment failed",
        "change_detected": None,
        "change_description": "could not assess",
        "wear_and_tear": None,
        "wear_and_tear_reason": "",
        "likely_tenant_caused": None,
        "supports_landlord_claim": "PARTIAL",
        "confidence": 0.0,
        "confidence_reason": "model returned unparseable response",
        "low_visibility": True,
        "notes": "assessment failed — manual review required",
    }
