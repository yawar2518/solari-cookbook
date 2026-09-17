# Portable image for the fyt backend (Hugging Face Spaces, Fly, Cloud Run, any Docker host).
# Solari runs the browser in the cloud, so no local Chromium is installed here.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=7860

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Hugging Face Spaces runs as a non-root user and expects port 7860.
RUN useradd -m appuser && chown -R appuser /app
USER appuser

EXPOSE 7860

HEALTHCHECK --interval=60s --timeout=10s --start-period=20s \
  CMD curl -fsS http://localhost:${PORT}/health || exit 1

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT} --workers 1"]
