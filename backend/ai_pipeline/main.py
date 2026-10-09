"""
AI Pipeline Service
-------------------
Standalone FastAPI microservice that receives a report file,
runs the report_to_json standardisation pipeline, and streams its progress and JSON result.
"""

import asyncio
import logging

# Configure logging so we can see the ML pipeline progress in Docker logs
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    force=True
)

from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="AI Pipeline Service",
    description="Report standardisation pipeline for cyber-audit reports",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/run")
async def run_pipeline(
    report_id: str = Form(...),
    file: UploadFile = File(...),
):
    """
    Run the AI analysis pipeline on the uploaded report file.
    Streams logs as Server-Sent Events, ending with the final JSON result.
    """
    file_bytes = await file.read()
    filename = file.filename or "unknown"
    
    import tempfile
    import os
    import sys
    import threading
    import queue
    import json
    from pathlib import Path
    from fastapi.responses import StreamingResponse
    
    # Add the document-standardization folder to the path dynamically
    doc_standardization_path = Path(__file__).resolve().parent.parent.parent / "document-standardization"
    if str(doc_standardization_path) not in sys.path:
        sys.path.append(str(doc_standardization_path))
        
    from report_to_json.api import process_report

    # Keep the upload's type: the pipeline accepts PDF and DOCX and rejects anything else.
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=Path(filename).suffix.lower())
    tmp.write(file_bytes)
    tmp.close()
    tmp_path = tmp.name

    log_queue = queue.Queue()
    
    # Use threading.local to store the report_id for the current thread
    thread_local = threading.local()
    
    class ReportFilter(logging.Filter):
        def filter(self, record):
            record.report_id = getattr(thread_local, 'report_id', None)
            return True

    class QueueHandler(logging.Handler):
        def __init__(self, target_report_id, *args, **kwargs):
            super().__init__(*args, **kwargs)
            self.target_report_id = target_report_id

        def emit(self, record):
            if getattr(record, 'report_id', None) == self.target_report_id:
                log_queue.put({"type": "log", "message": self.format(record)})

    handler = QueueHandler(target_report_id=report_id)
    handler.setFormatter(logging.Formatter("%(message)s"))
    logger = logging.getLogger('report_to_json')
    
    # Ensure the filter is attached to the HANDLER so it applies to propagated records
    report_filter = ReportFilter()
    handler.addFilter(report_filter)
    logger.addHandler(handler)

    def worker():
        # Set the report_id for this specific worker thread
        thread_local.report_id = report_id
        try:
            result = process_report(tmp_path, save_to_disk=False)
            log_queue.put({"type": "result", "data": result.data})
        except Exception as e:
            log_queue.put({"type": "error", "message": str(e)})
        finally:
            log_queue.put(None)  # Sentinel to end the stream
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
            logger.removeHandler(handler)

    thread = threading.Thread(target=worker)
    thread.start()

    async def event_generator():
        try:
            while True:
                # Use asyncio.to_thread to wait for the queue without blocking the event loop
                item = await asyncio.to_thread(log_queue.get)
                if item is None:
                    break
                yield f"data: {json.dumps(item)}\n\n"
        finally:
            logger.removeHandler(handler)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "ai-pipeline"}
