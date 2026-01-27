# Temporal Worker Dockerfile
FROM python:3.12-slim AS base

WORKDIR /app

# Install curl and Playwright system dependencies
# See: https://playwright.dev/python/docs/browsers#install-system-dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    # Playwright Chromium dependencies
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_SYSTEM_PYTHON=1 \
    PYTHONPATH=/app/apps/api:/app/apps/worker

# Development stage
FROM base AS development

COPY pyproject.toml uv.lock* ./
RUN uv pip install --system -e ".[dev]" 2>/dev/null || echo "No pyproject.toml yet"

# Install Playwright and Chromium browser for fast-flights local mode
RUN pip install playwright && playwright install chromium

COPY . .

WORKDIR /app/apps/worker

CMD ["python", "-m", "worker"]

# Production stage
FROM base AS production

COPY pyproject.toml uv.lock* ./
RUN uv pip install --system -e "." 2>/dev/null || echo "No pyproject.toml yet"

# Install Playwright and Chromium browser for fast-flights local mode
RUN pip install playwright && playwright install chromium

COPY . .

WORKDIR /app/apps/worker

RUN adduser --disabled-password --gecos "" appuser && chown -R appuser:appuser /app
USER appuser

CMD ["python", "-m", "worker"]
