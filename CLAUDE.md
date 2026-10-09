# CLAUDE.md

MeitY / CERT-In audit-report platform. Two parts:

- `document-standardization/` — `report_to_json`, the pipeline that turns security audit reports
  (PDF/DOCX) into one JSON format (`report_to_json/schema/master_schema.json`):
  malware gate → PDF → images to deep storage → pass 1 (VLM transcription) → pass 2 (schema) → checks.
  Its README and `docs/pipeline_overview.md` describe each stage.
- `backend/` — the web platform (FastAPI + Postgres + React, docker-compose). `backend/ai_pipeline/main.py`
  wraps `report_to_json.process_report(..., save_to_disk=False)` and streams progress as SSE.
  The `vllm` service in `backend/docker-compose.yml` serves the model.

Reference upstream for the pipeline: https://github.com/meityaicyber/document-standardization.
The local copy had lost the security gate, DOCX conversion and GUI; they were restored from there.

## Project decisions (from the project owner)

- **Compute is not constrained** (8× H100 80GB). Prefer throughput and full limits over economy.
- **Fallback is failure.** The text-layer / rule-based fallback still runs when the model fails, but
  the run gets `status: failed`, raises `ModelPipelineFailed`, writes no `<name>.json`
  (the fallback output goes to `<name>.fallback.json` for diagnosis only). Never deliver fallback output.
- **The model is hosted locally; no calls to the internet.** The only backend is a local
  OpenAI-compatible server (default `http://127.0.0.1:8000/v1`, override `R2J_MODEL_ENDPOINT`).
  Endpoints must resolve to loopback/private addresses and proxy env vars are ignored
  (`report_to_json/backends.py`). There is no in-process model backend.
- One model for both passes: Nemotron 3 Nano Omni, served as
  `nvidia/Nemotron-3-Nano-Omni-30B-A3B-Reasoning-BF16` (weights in `document-standardization/models/nemotron`,
  an FP8 checkpoint). Reasoning is disabled via `chat_template_kwargs`.
- Model calls run concurrently (`MODEL_CONCURRENCY`, default 32; 64 in compose).

## Working here

- Tests: `cd document-standardization && pytest` (scripted fake model; no GPU needed). The system Python
  lacks the deps; make a venv with `requirements-dev.txt`. GUI tests skip without tkinter.
- Never commit client reports or anything derived from them (`reports/`, `outputs/`, `deep_storage/`,
  `*.pdf`, `*.docx`). Real sample reports live outside the repo in `~/report`.

## Open items

- After changing compose or pipeline code, recreate the containers:
  `docker compose up -d --force-recreate vllm ai-pipeline` (from `backend/`).
- On a synthetic PDF the live model filled `audit_type`/`report_type` with values the document doesn't
  state — check the no-invention rule on real reports.
- vLLM uses one GPU; `--data-parallel-size` could use the rest.
- DOCX uploads through `ai-pipeline` need LibreOffice in its Docker image (not installed yet).
