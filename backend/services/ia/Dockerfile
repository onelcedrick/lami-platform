FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY services/ia/requirements.txt .

# Miroir + timeout + retries
RUN pip install --no-cache-dir \
    --index-url https://pypi.org/simple \
    --timeout 120 \
    --retries 10 \
    -r requirements.txt

COPY services/ia/app ./app

ENV PYTHONUNBUFFERED=1
ENV HTTP_PORT=8090
ENV LLM_PROVIDER=mock

EXPOSE 8090

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8090"]
