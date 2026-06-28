from datetime import datetime, timezone

from agent04_doc_generator.models import DocumentResult
from shared.s3_client import generate_presigned_url, get_s3_client, upload_bytes
from shared.config import S3_BUCKET


def upload_to_s3(pdf_bytes: bytes, case_id: str, doc_type: str, page_count: int) -> DocumentResult:
    """
    Upload a PDF to S3 and return a DocumentResult with download URL.

    Key pattern: outputs/{case_id}/{doc_type}.pdf
    Content-Type: application/pdf
    Presigned download URL is valid for 24 hours.

    Args:
        pdf_bytes: Raw PDF bytes to upload.
        case_id: Case identifier (used in the S3 key path).
        doc_type: Document type string (used in the S3 key path).
        page_count: Number of pages in the rendered PDF.

    Returns:
        DocumentResult with s3_url, download_url, generated_at (ISO 8601), page_count.
    """
    key = f"outputs/{case_id}/{doc_type}.pdf"
    s3_url = upload_bytes(pdf_bytes, key, content_type="application/pdf")
    download_url = generate_download_url(S3_BUCKET, key)
    generated_at = datetime.now(timezone.utc).isoformat()

    return DocumentResult(
        s3_url=s3_url,
        download_url=download_url,
        generated_at=generated_at,
        page_count=page_count,
    )


def generate_download_url(bucket: str, key: str) -> str:
    """
    Generate a presigned GET URL valid for 24 hours.

    Args:
        bucket: S3 bucket name.
        key: S3 object key.

    Returns:
        HTTPS presigned URL string.
    """
    client = get_s3_client()
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket, "Key": key},
        ExpiresIn=86400,
    )
