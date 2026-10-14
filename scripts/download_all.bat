@echo off
REM Windows Helper to run the master dependency pre-downloader
cd /d "%~dp0\.."
echo ======================================================================
echo   Cyber Audit Platform - Offline Dependency Pre-Downloader
echo ======================================================================
echo.
echo Choose an option:
echo   1. Check cached dependencies status
echo   2. Download HuggingFace ML models (backend/models_cache)
echo   3. Pull Core Docker base images
echo   4. Download Python pip wheels (backend/backend/wheels)
echo   5. Download VLM Qwen model (document-standardization/models)
echo   6. Download EVERYTHING (full offline prep)
echo   7. Exit
echo.
set /p choice="Enter choice [1-7]: "

if "%choice%"=="1" (
    python scripts/download_all_dependencies.py --status
) else if "%choice%"=="2" (
    python scripts/download_all_dependencies.py --hf-models
) else if "%choice%"=="3" (
    python scripts/download_all_dependencies.py --docker-images --skip-vllm-image
) else if "%choice%"=="4" (
    python scripts/download_all_dependencies.py --wheels
) else if "%choice%"=="5" (
    python scripts/download_all_dependencies.py --vlm-model qwen3-vl-4b-instruct-awq
) else if "%choice%"=="6" (
    python scripts/download_all_dependencies.py --all
) else (
    echo Exiting.
)
pause
