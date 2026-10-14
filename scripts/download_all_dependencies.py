#!/usr/bin/env python3
"""
Master Offline Dependency Pre-Downloader for Cyber Audit Platform.

This script manually pre-fetches all heavy components so that Docker builds
and container startups are instantaneous, lightweight, and completely offline-ready.

Components managed:
1. HuggingFace Models for ML Analytics & Forecasting:
   - facebook/bart-large-mnli (~1.63 GB)
   - sentence-transformers/all-mpnet-base-v2 (~438 MB)
   - google/timesfm-3.0-pytorch (~500 MB - 1 GB)
   Target location: backend/models_cache (mounted to /root/.cache/huggingface)

2. Large Vision-Language Models (VLM/LLM):
   - Qwen/Qwen3-VL-4B-Instruct-AWQ (4.14 GB) or
   - nvidia/Nemotron-3-Nano-Omni-30B-A3B-Reasoning-BF16 (~60 GB)
   Target location: document-standardization/models

3. Python Pip Wheels:
   - torch, transformers, prophet, timesfm, scikit-learn, etc.
   Target location: backend/backend/wheels

4. Core Docker Images:
   - postgres:16, seaweedfs, clamav, adminer, python, node, nginx, vllm

Usage:
    python scripts/download_all_dependencies.py --help
    python scripts/download_all_dependencies.py --all
    python scripts/download_all_dependencies.py --hf-models
    python scripts/download_all_dependencies.py --docker-images
    python scripts/download_all_dependencies.py --wheels
"""

import os
import sys
import argparse
import subprocess
import shutil
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = REPO_ROOT / "backend"
MODELS_CACHE_DIR = BACKEND_DIR / "models_cache"
DOC_STANDARDIZATION_DIR = REPO_ROOT / "document-standardization"
MODELS_DIR = DOC_STANDARDIZATION_DIR / "models"
WHEELS_DIR = BACKEND_DIR / "backend" / "wheels"

DOCKER_IMAGES = [
    "postgres:16",
    "chrislusf/seaweedfs:latest",
    "adminer:latest",
    "clamav/clamav:latest",
    "python:3.12-slim",
    "python:3.11-slim",
    "node:20-alpine",
    "nginx:alpine",
]

VLLM_IMAGE = "vllm/vllm-openai:latest"  # Note: ~15-20 GB

HF_MODELS = [
    ("facebook/bart-large-mnli", "Zero-shot severity classification"),
    ("sentence-transformers/all-mpnet-base-v2", "Semantic embedding & clustering"),
    ("google/timesfm-3.0-pytorch", "Multivariate foundation forecasting"),
]


def log_header(title: str):
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70)


def ensure_pip_pkg(pkg_name: str, import_name: str = None):
    import_name = import_name or pkg_name
    try:
        __import__(import_name)
    except ImportError:
        print(f"Installing required host helper: {pkg_name}...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", pkg_name])


def download_docker_images(include_vllm: bool = True):
    log_header("STEP 1: Pulling Core Docker Base Images")
    images = list(DOCKER_IMAGES)
    if include_vllm:
        images.append(VLLM_IMAGE)
    else:
        print("[Notice] Skipping vLLM large image (~15GB). Pull separately if running vLLM service.")

    for img in images:
        print(f"\n--> Pulling {img}...")
        try:
            subprocess.run(["docker", "pull", img], check=True)
            print(f" [OK] Pulled {img}")
        except subprocess.CalledProcessError as e:
            print(f" [ERROR] Failed to pull {img}: {e}")
        except FileNotFoundError:
            print(" [ERROR] Docker command not found. Ensure Docker is installed and in PATH.")
            break


def download_hf_models():
    log_header("STEP 2: Pre-fetching Hugging Face Models to backend/models_cache")
    MODELS_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    os.environ["HF_HOME"] = str(MODELS_CACHE_DIR)
    print(f"HF_HOME set to local directory: {MODELS_CACHE_DIR}")

    ensure_pip_pkg("huggingface_hub")
    from huggingface_hub import snapshot_download

    for repo_id, desc in HF_MODELS:
        print(f"\n--> Downloading '{repo_id}' ({desc})...")
        try:
            snapshot_download(
                repo_id=repo_id,
                cache_dir=str(MODELS_CACHE_DIR),
                local_files_only=False,
                resume_download=True,
            )
            print(f" [OK] Successfully cached: {repo_id}")
        except Exception as ex:
            print(f" [WARNING] Could not download {repo_id}: {ex}")
            print(" Note: If this model is private or requires authentication, set HF_TOKEN environment variable.")


def download_vlm_model(model_key: str = "qwen3-vl-4b-instruct-awq"):
    log_header(f"STEP 3: Downloading VLM Model ({model_key}) to document-standardization/models")
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    download_script = DOC_STANDARDIZATION_DIR / "report_to_json" / "download.py"
    if not download_script.exists():
        print(f"Download script not found at {download_script}")
        return

    ensure_pip_pkg("huggingface_hub")
    cmd = [sys.executable, "-m", "report_to_json.download", "--model", model_key, "--dest", str(MODELS_DIR)]
    print(f"Executing: {' '.join(cmd)}")
    try:
        subprocess.run(cmd, cwd=str(DOC_STANDARDIZATION_DIR), check=True)
        print(f" [OK] VLM model {model_key} downloaded and verified.")
    except subprocess.CalledProcessError as e:
        print(f" [ERROR] VLM download failed: {e}")


def download_pip_wheels():
    log_header("STEP 4: Pre-downloading Python Wheels to backend/backend/wheels")
    req_file = BACKEND_DIR / "backend" / "requirements.txt"
    if not req_file.exists():
        print(f"Requirements file not found at {req_file}")
        return

    WHEELS_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Target wheels folder: {WHEELS_DIR}")
    print("Downloading binary wheels for backend requirements...")
    cmd = [
        sys.executable,
        "-m",
        "pip",
        "download",
        "-r",
        str(req_file),
        "-d",
        str(WHEELS_DIR),
        "--prefer-binary",
        "--only-binary=:all:",
    ]
    try:
        subprocess.run(cmd, check=True)
        print(" [OK] Wheels downloaded successfully.")
    except subprocess.CalledProcessError:
        print(" [Notice] Pure binary download had minor fallback; retrying with standard download...")
        cmd_fallback = [
            sys.executable,
            "-m",
            "pip",
            "download",
            "-r",
            str(req_file),
            "-d",
            str(WHEELS_DIR),
            "--prefer-binary",
        ]
        subprocess.run(cmd_fallback, check=False)


def get_dir_size_gb(directory: Path) -> float:
    total = 0
    if not directory.exists():
        return 0.0
    for root, _, files in os.walk(directory):
        for name in files:
            p = os.path.join(root, name)
            try:
                # Use os.lstat to avoid broken symlink errors on Windows
                total += os.lstat(p).st_size
            except (OSError, PermissionError):
                continue
    return total / (1024**3)


def main():
    parser = argparse.ArgumentParser(
        description="Master Offline Dependency Pre-Downloader for Cyber Audit Platform",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--all", action="store_true", help="Download all components (HF models, Docker images, wheels)")
    parser.add_argument("--hf-models", action="store_true", help="Download Hugging Face models into backend/models_cache")
    parser.add_argument("--docker-images", action="store_true", help="Pull all Docker base images")
    parser.add_argument("--skip-vllm-image", action="store_true", help="Skip pulling 15-20GB vLLM image")
    parser.add_argument("--vlm-model", choices=["qwen3-vl-4b-instruct-awq", "nemotron-3-nano-omni"], help="Download VLM pipeline model")
    parser.add_argument("--wheels", action="store_true", help="Download Python pip wheels for backend")
    parser.add_argument("--status", action="store_true", help="Check local cached sizes and staged components")

    args = parser.parse_args()

    if args.status:
        log_header("Current Cached Dependencies Status")
        print(f"backend/models_cache:            {get_dir_size_gb(MODELS_CACHE_DIR):.2f} GB")
        print(f"document-standardization/models: {get_dir_size_gb(MODELS_DIR):.2f} GB")
        if WHEELS_DIR.exists():
            count = len(list(WHEELS_DIR.glob("*.whl")))
            print(f"backend/backend/wheels:          {count} wheels ({get_dir_size_gb(WHEELS_DIR)*1024:.1f} MB)")
        else:
            print("backend/backend/wheels:          Not created yet")
        return

    run_any = False
    if args.all or args.hf_models:
        run_any = True
        download_hf_models()

    if args.all or args.docker_images:
        run_any = True
        download_docker_images(include_vllm=not args.skip_vllm_image)

    if args.vlm_model:
        run_any = True
        download_vlm_model(args.vlm_model)

    if args.wheels:
        run_any = True
        download_pip_wheels()

    if not run_any:
        parser.print_help()


if __name__ == "__main__":
    main()
