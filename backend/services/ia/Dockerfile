# # ============================================================
# # IA Service — L'AMI Platform
# # Build avec pré-téléchargement complet des dépendances
# # ============================================================
# FROM python:3.11-slim

# # Dépendances système
# RUN apt-get update && apt-get install -y --no-install-recommends \
#     gcc \
#     g++ \
#     curl \
#     git \
#     && rm -rf /var/lib/apt/lists/*

# WORKDIR /app

# # ------------------------------------------------------------
# # 1. Installer les dépendances Python
# # ------------------------------------------------------------
# COPY services/ia/requirements.txt /app/requirements.txt

# RUN pip install --no-cache-dir --upgrade pip && \
#     pip install --no-cache-dir -r /app/requirements.txt

# # ------------------------------------------------------------
# # 2. Pré-télécharger le modèle d'embeddings
# #    (une fois pour toutes — pas de download au runtime)
# # ------------------------------------------------------------
# ENV HF_HOME=/app/.cache/huggingface
# ENV SENTENCE_TRANSFORMERS_HOME=/app/.cache/sentence_transformers
# ENV TRANSFORMERS_CACHE=/app/.cache/huggingface/transformers

# RUN mkdir -p /app/.cache/huggingface /app/.cache/sentence_transformers && \
#     python -c "from sentence_transformers import SentenceTransformer; \
#                SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')" \
#     && echo " Modèle embeddings téléchargé et mis en cache"

# # ------------------------------------------------------------
# # 3. Copier le code de l'application
# # ------------------------------------------------------------
# COPY services/ia/app /app/app

# # ------------------------------------------------------------
# # 4. Exposition + démarrage
# # ------------------------------------------------------------
# EXPOSE 8090

# CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8090"]




# ============================================================
# IA Service — L'AMI Platform
# Build avec pré-téléchargement complet des dépendances
# ============================================================
FROM python:3.11-slim

# Dépendances système
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ------------------------------------------------------------
# 1. Installer les dépendances Python
# ------------------------------------------------------------
COPY services/ia/requirements.txt /app/requirements.txt

RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r /app/requirements.txt

# ------------------------------------------------------------
# 2. Pré-télécharger le modèle d'embeddings
#    (une fois pour toutes — pas de download au runtime)
# ------------------------------------------------------------
ENV HF_HOME=/app/.cache/huggingface
ENV SENTENCE_TRANSFORMERS_HOME=/app/.cache/sentence_transformers
ENV TRANSFORMERS_CACHE=/app/.cache/huggingface/transformers

RUN mkdir -p /app/.cache/huggingface /app/.cache/sentence_transformers && \
    python -c "from sentence_transformers import SentenceTransformer; \
               SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')" \
    && echo "✅ Modèle embeddings téléchargé et mis en cache"

# ------------------------------------------------------------
# 3. Copier le code de l'application
# ------------------------------------------------------------
COPY services/ia/app /app/app

# ✅ AJOUT — Copier les tests (pour l'évaluation RAG)
COPY services/ia/tests /app/tests

# ✅ AJOUT — Permettre à Python de trouver `app` et `tests`
ENV PYTHONPATH=/app

# ------------------------------------------------------------
# 4. Exposition + démarrage
# ------------------------------------------------------------
EXPOSE 8090

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8090"]