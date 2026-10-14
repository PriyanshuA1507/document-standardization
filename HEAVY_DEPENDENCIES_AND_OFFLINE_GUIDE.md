# Heavy Dependencies Inventory & Offline Docker Guide

## 1. System Overview: What Is Going On?

The MeitY / CERT-In Cyber Audit Report Management System consists of **7 core containerized services**:

| Service | Technology | Role |
| :--- | :--- | :--- |
| **`vllm`** | vLLM / PyTorch / CUDA | Local OpenAI-compatible high-throughput Vision-Language Model server |
| **`ai-pipeline`** | FastAPI / Python 3.11 / PyMuPDF | 2-pass document parser (`report_to_json`) turning audit PDFs/DOCX into schema JSON |
| **`backend`** | FastAPI / Python 3.12 / SQLAlchemy | Core platform API, authentication, RBAC, analytics & ML forecasting |
| **`frontend`** | React 18 / Vite / MUI / Nginx | Web interface for auditors, CISOs, and admin users |
| **`seaweedfs`** | SeaweedFS Master, Volume, Filer | High-speed distributed encrypted report and attachment storage |
| **`postgres`** | PostgreSQL 16 | Relational database storing audits, findings, users, metrics |
| **`clamav`** | ClamAV Daemon | Antivirus pre-gate scanning all uploaded audit files |

---

### Why Docker Builds and Setups Took So Long (The Bottlenecks)

1. **Docker Build Context Bloat (~6 GB transferred per build)**:
   - There was **no `.dockerignore` at the repository root** or in `backend/`.
   - When building `ai-pipeline` (which uses `context: ..`), Docker attempted to upload the **entire repository** to the Docker daemon, including `document-standardization/models` (4.14 GB) and `backend/models_cache` (1.64 GB).
   - This caused several gigabytes of unnecessary data transfer before compilation even began.

2. **Massive Python Wheels in `backend` (~3.5 GB to 4 GB)**:
   - PyPI default `torch>=2.0.0` downloads the full CUDA wheel (~2.5 GB to 2.8 GB).
   - `transformers`, `sentence-transformers`, `timesfm` (Google foundation model), `prophet`, and scientific libraries (`scikit-learn`, `scipy`, `pandas`) add another ~1 GB of wheels.

3. **Runtime Hugging Face Model Downloads (~3.5 GB)**:
   - Zero-shot classification (`facebook/bart-large-mnli`: ~1.63 GB).
   - Semantic clustering (`sentence-transformers/all-mpnet-base-v2`: ~438 MB).
   - Time-series forecasting (`google/timesfm-3.0-pytorch`: ~500 MB - 1 GB).
   - If not cached in `backend/models_cache`, containers download them on startup or first request.

4. **Vision-Language Model Weights (4.14 GB to 60+ GB)**:
   - `Qwen3-VL-4B-Instruct-AWQ` (4.14 GB, already present locally).
   - `Nemotron-3-Nano-Omni-30B-A3B-Reasoning-BF16` (~60 GB for 8× H100 production nodes).
   - vLLM requires these staged on disk before booting.

5. **ClamAV Virus Definitions (~300 MB)**:
   - Without a persistent volume, ClamAV ran `freshclam` on every container start, redownloading ~300 MB of virus signatures.

6. **Heavy Docker Base Images (~16 GB to 22 GB)**:
   - `vllm/vllm-openai:latest`: ~15 GB - 20 GB.
   - `clamav/clamav:latest`: ~500 MB.
   - `postgres:16`: ~450 MB.
   - `python:3.12-slim` & `python:3.11-slim`: ~300 MB combined.

---

## 2. Complete Inventory of Heavy Dependencies

| Dependency / Component | Category | Size | Used By | Staged Local Path |
| :--- | :--- | :--- | :--- | :--- |
| **`vllm/vllm-openai:latest`** | Docker Image | ~15-20 GB | `cyber-audit-vllm` | Docker daemon cache |
| **`Nemotron-3-Nano-Omni`** | Model Weights | ~60 GB | `cyber-audit-vllm` | `document-standardization/models/Nemotron...` |
| **`Qwen3-VL-4B-Instruct-AWQ`** | Model Weights | 4.14 GB | `cyber-audit-vllm` | `document-standardization/models/Qwen3-VL-4B-Instruct-AWQ-4bit` |
| **`facebook/bart-large-mnli`** | Hugging Face Model | ~1.63 GB | `cyber-audit-backend` (ML Router) | `backend/models_cache` |
| **`timesfm-3.0-pytorch`** | Hugging Face Model | ~500 MB - 1 GB | `cyber-audit-backend` (Forecasting) | `backend/models_cache` |
| **`all-mpnet-base-v2`** | Hugging Face Model | ~438 MB | `cyber-audit-backend` (Clustering) | `backend/models_cache` |
| **`torch` (PyPI CUDA Wheel)** | Python Wheel | ~2.5 - 2.8 GB | `backend`, `ai-pipeline` | `backend/backend/wheels/` or pip cache |
| **`transformers`, `timesfm`, `prophet`** | Python Wheels | ~800 MB | `cyber-audit-backend` | `backend/backend/wheels/` or pip cache |
| **`libreoffice-writer-nogui`** | APT Package | ~500 MB | `cyber-audit-backend` | Cached in Docker layer |
| **`clamav/clamav:latest`** | Docker Image | ~500 MB | `cyber-audit-clamav` | Docker daemon cache |
| **ClamAV Signatures (main/daily.cvd)** | Virus DB | ~300 MB | `cyber-audit-clamav` | `clamav_data` volume |
| **`postgres:16`** | Docker Image | ~450 MB | `cyber-audit-db` | Docker daemon cache |
| **`node:20-alpine`** | Docker Image | ~180 MB | `cyber-audit-frontend` (Build stage) | Docker daemon cache |
| **Frontend NPM Packages** | Node Modules | ~350 MB | `cyber-audit-frontend` (Build stage) | BuildKit npm cache |

---

## 3. Running Sequence: How to Download Everything Manually

We provided an automated script: [scripts/download_all_dependencies.py](file:///e:/Cert%20Project/document-standardization/scripts/download_all_dependencies.py) and a Windows helper [scripts/download_all.bat](file:///e:/Cert%20Project/document-standardization/scripts/download_all.bat).

You can also run the exact commands below on any internet-connected machine:

### Phase 1: Pull Docker Base Images
Run these once to cache all base images locally:
```bash
# Core platform images
docker pull postgres:16
docker pull chrislusf/seaweedfs:latest
docker pull adminer:latest
docker pull clamav/clamav:latest
docker pull python:3.12-slim
docker pull python:3.11-slim
docker pull node:20-alpine
docker pull nginx:alpine

# Optional: LLM inference server (Heavy: ~15 GB)
docker pull vllm/vllm-openai:latest
```

---

### Phase 2: Pre-fetch Hugging Face Models to `backend/models_cache`
Using our helper script (works directly on host without modifying the project):
```bash
python scripts/download_all_dependencies.py --hf-models
```
*Or manually via Python with `huggingface_hub`:*
```bash
pip install huggingface_hub
python -c "
import os
from huggingface_hub import snapshot_download
cache = 'backend/models_cache'
os.environ['HF_HOME'] = cache
for repo in ['facebook/bart-large-mnli', 'sentence-transformers/all-mpnet-base-v2', 'google/timesfm-3.0-pytorch']:
    print(f'Caching {repo}...')
    snapshot_download(repo_id=repo, cache_dir=cache)
"
```

---

### Phase 3: Pre-download Python Pip Wheels to `backend/backend/wheels`
This ensures Docker does not download multi-gigabyte wheels during `docker build`:
```bash
# On an internet-connected machine:
pip download -r backend/backend/requirements.txt -d backend/backend/wheels --prefer-binary
```
When Docker builds, the Dockerfile automatically checks `backend/backend/wheels` first (`--find-links=/app/wheels`). If wheels are present, build installs them instantly with 0 downloads!

---

### Phase 4: Stage VLM / LLM Model Weights for the Parser
```bash
# Option A: Download lightweight Qwen3-VL-4B Instruct AWQ (4.14 GB)
python -m report_to_json.download --model qwen3-vl-4b-instruct-awq --dest document-standardization/models

# Option B: Download full NVIDIA Nemotron 3 Nano Omni (60 GB) - for production GPU server:
python -m report_to_json.download --model nemotron-3-nano-omni --dest document-standardization/models
```
Verify the model integrity:
```bash
python -m report_to_json.download --verify qwen3-vl-4b-instruct-awq
```

---

## 4. How Docker Was Made "Lite" & Fast

We implemented the following architectural optimizations:

1. **Added Root `.dockerignore` and `backend/.dockerignore`**:
   - Explicitly excludes `**/models/`, `**/models_cache/`, `**/.git/`, `storage/`, `deep_storage/`, `node_modules/`, and test caches.
   - **Result**: Docker build context reduced from **~6.0 GB down to < 2 MB**!

2. **Decoupled Model Weights from Docker Images**:
   - Model weights and caches are **never copied into Docker layers**.
   - Instead, `docker-compose.yml` mounts them as external volumes:
     - `- ./models_cache:/root/.cache/huggingface`
     - `- ../document-standardization:/document-standardization`
   - **Result**: Docker container images remain clean, lightweight, and build in seconds.

3. **Persistent ClamAV Signature Volume (`clamav_data`)**:
   - Added `clamav_data:/var/lib/clamav` to `backend/docker-compose.yml`.
   - **Result**: Virus database definitions (~300 MB) are persisted; ClamAV no longer re-downloads them on every reboot.

4. **Offline Hugging Face Environment Toggles**:
   - Added `HF_HUB_OFFLINE: ${HF_HUB_OFFLINE:-0}` and `TRANSFORMERS_OFFLINE: ${TRANSFORMERS_OFFLINE:-0}` to `docker-compose.yml`.
   - When set to `1` in `.env`, libraries immediately use the mounted `models_cache` without attempting network validation.

5. **Wheelhouse & BuildKit Pip Caching**:
   - Updated [backend/backend/Dockerfile](file:///e:/Cert%20Project/document-standardization/backend/backend/Dockerfile) with `--find-links=/app/wheels` and `--mount=type=cache,target=/root/.cache/pip`.
   - Updated [backend/ai_pipeline/Dockerfile](file:///e:/Cert%20Project/document-standardization/backend/ai_pipeline/Dockerfile) with `--find-links=/wheels` and clean apt cache layers.
   - **Result**: Zero repeated downloads across builds.

---

## 5. Quick Check & Build Commands

### Check Current Cache Status:
```bash
python scripts/download_all_dependencies.py --status
```
Expected output:
```text
======================================================================
  Current Cached Dependencies Status
======================================================================
backend/models_cache:            1.64 GB
document-standardization/models: 4.14 GB
backend/backend/wheels:          Not created yet (or XX wheels)
```

### Build & Run the System:
```bash
cd backend

# Build using cached dependencies and lightweight contexts
docker compose build

# Start services in the background
docker compose up -d
```
All models and caches will be mounted directly into the containers with zero runtime download delays!
