FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY services/ia/requirements.txt .

# Miroir Tsinghua (Chine) — beaucoup plus rapide depuis Madagascar
# + cache pip persistant entre les rebuilds (BuildKit)
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --no-cache-dir \
    --index-url https://pypi.tuna.tsinghua.edu.cn/simple \
    --extra-index-url https://download.pytorch.org/whl/cpu \
    --trusted-host pypi.tuna.tsinghua.edu.cn \
    --timeout 120 \
    --retries 5 \
    -r requirements.txt

COPY services/ia/app ./app

ENV PYTHONUNBUFFERED=1
ENV HTTP_PORT=8090
ENV LLM_PROVIDER=mock

EXPOSE 8090

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8090"]
