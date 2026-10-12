"""
Integration entry points.

    from report_to_json import standardize_report

    response = standardize_report("path/to/report.pdf")   # JSON text: the standardised report

``standardize_report`` takes a report and returns the JSON that the pipeline
produced for it. That JSON is the output: exactly the structure of
``master_schema.json``, identical to the ``<name>.json`` file written alongside.

If the model pipeline fails, there is no result: ``ModelPipelineFailed`` is raised
(the rule-based fallback's output is kept on disk for diagnosis only). Use
``process_report`` when the caller needs the run status and report next to the JSON.

The pipeline (and with it the model) is created once per process and reused.
Calls are serialised: one document is processed at a time.
"""

from __future__ import annotations

import json
import os
import threading
from pathlib import Path
from typing import Optional, Union

from . import config
from .pipeline import DocumentPipeline, ModelPipelineFailed, PipelineResult  # noqa: F401  (re-exported)

PathLike = Union[str, "os.PathLike[str]"]

_lock = threading.Lock()
_pipeline: Optional[DocumentPipeline] = None


def process_report(report_path: PathLike, output_dir: Optional[PathLike] = None, *,
                   enable_security_gate: bool = True, save_to_disk: bool = True) -> PipelineResult:
    """Run the full pipeline on one report and return the complete result.

    ``result.data`` is the master-schema JSON as a dict, ``result.status`` is "ok"
    or "needs_review", ``result.meta`` is the run report, and
    ``result.json_path`` / ``result.meta_path`` are the files written. With
    ``save_to_disk=False`` no output files are written and those paths are ``None``.

    Raises ``DocumentBlocked`` if the malware pre-gate blocks the file,
    ``ModelPipelineFailed`` if the model pipeline failed, and ``PipelineError`` for
    anything else that prevents processing.
    """
    out_dir = None
    if save_to_disk:
        out_dir = Path(output_dir) if output_dir is not None else config.DEFAULT_OUTPUT_DIR
    
    pipeline = DocumentPipeline(enable_security_gate=enable_security_gate)
    return pipeline.process_file(Path(report_path), out_dir)


def standardize_report(report_path: PathLike, output_dir: Optional[PathLike] = None, *,
                       enable_security_gate: bool = True) -> str:
    """Convert one audit report (PDF or DOCX) and return the standardised JSON.

    Parameters
    ----------
    report_path : path to the report.
    output_dir : where ``<name>.json``, ``<name>.meta.json`` and the transcript are
        also written. Defaults to the project's ``outputs/`` folder.
    enable_security_gate : run the malware pre-gate (leave on for untrusted files).

    Returns
    -------
    The JSON document as text, with exactly the structure of ``master_schema.json``.
    Fields the report does not state are ``null``.

    Raises
    ------
    DocumentBlocked : the malware pre-gate blocked the file.
    ModelPipelineFailed : the model pipeline failed (``exc.result`` has the run report).
    PipelineError : the file is missing, of an unsupported type, or could not be
        processed. In these cases no JSON exists to return.
    """
    result = process_report(report_path, output_dir, enable_security_gate=enable_security_gate)
    return json.dumps(result.data, indent=2, ensure_ascii=False)


def close() -> None:
    """Release the model held by this process (the next call sets it up again)."""
    global _pipeline
    with _lock:
        if _pipeline is not None:
            _pipeline.close()
            _pipeline = None
