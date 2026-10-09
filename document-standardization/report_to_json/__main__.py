"""``python -m report_to_json`` launches the desktop GUI.

``python -m report_to_json REPORT [--output-dir DIR]`` processes one report
without the GUI (for headless servers).
"""

import argparse
import logging
import sys
from pathlib import Path


def cli(argv) -> int:
    from .api import process_report
    from .pipeline import PipelineError

    parser = argparse.ArgumentParser(prog="python -m report_to_json",
                                     description="Convert a security audit report (PDF or DOCX) into master-schema JSON.")
    parser.add_argument("report", type=Path, help="the report to process")
    parser.add_argument("--output-dir", type=Path, default=None, help="where to write the outputs (default: outputs/)")
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s: %(message)s", datefmt="%H:%M:%S")

    try:
        result = process_report(args.report, args.output_dir)
    except PipelineError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1
    print(f"{result.status}: {result.json_path}", file=sys.stderr)
    return 0


if len(sys.argv) > 1:
    sys.exit(cli(sys.argv[1:]))

from .gui import main

main()
