# Temporal Worker Dockerfile
FROM python:3.12-slim AS base

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_SYSTEM_PYTHON=1

# Development stage
FROM base AS development

COPY pyproject.toml uv.lock* ./
RUN uv pip install --system -e ".[dev]" 2>/dev/null || echo "No pyproject.toml yet"

COPY . .

WORKDIR /app/apps/worker

CMD ["python", "-m", "worker"]

# Production stage
FROM base AS production

COPY pyproject.toml uv.lock* ./
RUN uv pip install --system -e "." 2>/dev/null || echo "No pyproject.toml yet"

COPY . .

WORKDIR /app/apps/worker

RUN adduser --disabled-password --gecos "" appuser && chown -R appuser:appuser /app
USER appuser

CMD ["python", "-m", "worker"]
