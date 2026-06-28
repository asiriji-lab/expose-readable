import os
import tempfile
import boto3
from shared.config import AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, S3_BUCKET


def get_s3_client():
    """Return a configured boto3 S3 client."""
    return boto3.client(
        "s3",
        region_name=AWS_REGION,
        aws_access_key_id=AWS_ACCESS_KEY_ID,
        aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
    )


def parse_s3_url(s3_url: str) -> tuple[str, str]:
    """
    Parse an S3 URL into (bucket, key).

    Args:
        s3_url: URL in the form s3://bucket/path/to/key

    Returns:
        Tuple of (bucket, key).
    """
    assert s3_url.startswith("s3://"), f"Not an S3 URL: {s3_url}"
    without_scheme = s3_url[5:]
    bucket, _, key = without_scheme.partition("/")
    return bucket, key


def download_to_temp(s3_url: str) -> str:
    """
    Download an S3 object to a local temp file.

    Demo mode: if s3_url does not start with 's3://', treats it as a local path
    and returns it as-is (no download).

    Args:
        s3_url: s3://bucket/key or a local file path for demo mode.

    Returns:
        Absolute path to the local file.
    """
    if not s3_url.startswith("s3://"):
        # Demo mode — local path passed directly
        return s3_url

    bucket, key = parse_s3_url(s3_url)
    suffix = os.path.splitext(key)[1] or ".bin"
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    tmp.close()

    client = get_s3_client()
    client.download_file(bucket, key, tmp.name)
    return tmp.name


def upload_bytes(data: bytes, key: str, content_type: str = "application/pdf") -> str:
    """
    Upload raw bytes to S3_BUCKET under the given key.

    Args:
        data: Raw bytes to upload.
        key: S3 object key (e.g. 'outputs/case_001/demand_letter.pdf').
        content_type: MIME type for the object.

    Returns:
        S3 URL in the form s3://bucket/key.
    """
    client = get_s3_client()
    client.put_object(
        Bucket=S3_BUCKET,
        Key=key,
        Body=data,
        ContentType=content_type,
    )
    return f"s3://{S3_BUCKET}/{key}"


def generate_presigned_url(key: str, expires_in: int = 86400) -> str:
    """
    Generate a presigned GET URL for a private S3 object.

    Args:
        key: S3 object key within S3_BUCKET.
        expires_in: Expiry duration in seconds. Default is 24 hours.

    Returns:
        HTTPS presigned URL string.
    """
    client = get_s3_client()
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": S3_BUCKET, "Key": key},
        ExpiresIn=expires_in,
    )
