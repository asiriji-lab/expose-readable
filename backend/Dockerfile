# syntax=docker/dockerfile:1

FROM python:3.13-slim

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /backend

# Install dependencies first (layer cached until pyproject.toml / uv.lock change)
# Run `uv lock` locally and commit uv.lock for fully reproducible builds.
COPY pyproject.toml ./
COPY uv.lock* ./
RUN uv sync --no-dev --no-install-project

# Copy application code
COPY . .

EXPOSE 5000/tcp
CMD ["uv", "run", "gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "app:create_app()"]
