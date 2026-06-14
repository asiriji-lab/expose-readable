# syntax=docker/dockerfile:1

FROM python:3.13-slim

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /backend

# Install dependencies first (layer cached until pyproject.toml changes)
COPY pyproject.toml .
RUN uv sync --no-dev

# Copy application code
COPY . .

EXPOSE 5000/tcp
CMD ["uv", "run", "python", "app.py"]
