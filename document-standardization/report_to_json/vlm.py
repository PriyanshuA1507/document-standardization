"""
The decoupled two-pass model pipeline. One model (Nemotron 3 Nano Omni) runs both passes.

Pass 1 (vision)  Each page is rendered with its images replaced by labelled
                 placeholder boxes and transcribed verbatim. The transcript is
                 checked against the PDF text layer; pages that dropped text are
                 re-transcribed, telling the model which words it missed.

Pass 2 (text)    The transcript is restructured into the master schema, one
                 section at a time so each call stays focused: front matter,
                 scope/team/tools, executive summary, appendices, a findings index,
                 then one call per finding. Each response is constrained to the
                 section's JSON Schema, validated and repaired. Prompts start with the
                 transcript so a prefix-caching server encodes it once.

Calls run concurrently (``MODEL_CONCURRENCY``): all pages of pass 1, then the
pass-2 sections together with the findings index, then all findings.

Anything the model cannot do falls back to the text layer (pass 1) or the
rule-based parser (pass 2), and every fallback is recorded. A fallback means the
model pipeline failed: the run is reported as failed and its output is never
delivered as the standardised JSON.
"""

from __future__ import annotations

import json
import logging
import re
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, Iterable, List, Optional, Tuple, TypeVar

import fitz
import pdfplumber

from . import config, coverage, grounding, schema
from .schema import manual
from .backends import BackendError, ModelBackend
from .images import reconcile_tags, render_masked_page
from .storage import StoredImage
from .structurer import RuleBasedStructurer
from .transcribe import layout_page, page_block

log = logging.getLogger(__name__)

DetailFn = Callable[[str], None]
CancelFn = Callable[[], bool]


class Cancelled(Exception):
    pass


T = TypeVar("T")
R = TypeVar("R")


def run_concurrently(fn: Callable[[T], R], items: Iterable[T], workers: int,
                     on_done: Optional[Callable[[int, int], None]] = None) -> List[R]:
    """``[fn(item) for item in items]`` with up to ``workers`` calls in flight, in input order.

    The first exception (including ``Cancelled`` from ``fn`` or ``on_done``) stops the
    rest: queued calls are dropped, calls in flight finish, and the exception is raised.
    """
    items = list(items)
    results: List[Any] = [None] * len(items)
    if not items:
        return results
    pool = ThreadPoolExecutor(max_workers=min(workers, len(items)), thread_name_prefix="r2j-model")
    try:
        futures = {pool.submit(fn, item): i for i, item in enumerate(items)}
        for done, future in enumerate(as_completed(futures), 1):
            results[futures[future]] = future.result()
            if on_done:
                on_done(done, len(items))
    finally:
        pool.shutdown(wait=True, cancel_futures=True)
    return results


# --------------------------------------------------------------------------- pass 1

TRANSCRIBE_PROMPT = """TASK: transcribe page {page} of {pages}
You are transcribing one page of a cybersecurity audit report. Reproduce ALL text on the page exactly as written, in reading order, as GitHub-flavoured Markdown.

Rules:
1. Copy every word, number, URL, IP address, e-mail, CVE/CWE identifier, date and table cell verbatim. Do not summarise, paraphrase, correct, translate or skip anything - including headers, footers, page numbers, captions, footnotes and fine print.
2. Tables: Markdown tables with one row per table row and empty cells kept. Never merge, split or drop rows.
3. White boxes labelled with a tag of the form [IMAGE_PAGE_<page>_FIG_<n>] mark images that were removed. Write each label exactly as shown, on its own line, at the position of its box. Do not describe the box or guess what the image showed.
4. Use Markdown headings for headings and lists for lists.
5. Output only the transcription, with no commentary and no code fences.{retry}"""

RETRY_NOTE = """

Your previous transcription of this page was incomplete. These words appear on the page but were missing: {words}
Transcribe the entire page again, completely."""


@dataclass
class PageReport:
    page: int
    source: str                     # "model" | "text_layer_fallback"
    recall: Optional[float]         # None: no text layer to check against (scanned page)
    attempts: int
    issues: List[str] = field(default_factory=list)


def _strip_fences(text: str) -> str:
    return re.sub(r"^\s*```(?:markdown|md)?\s*\n|\n?```\s*$", "", text.strip(), flags=re.IGNORECASE)


class Pass1Transcriber:
    def __init__(self, backend: ModelBackend):
        self.backend = backend
        self.threshold = config.page_recall_threshold()
        self.retries = config.pass1_retries()
        self.dpi = config.render_dpi()
        self.concurrency = config.model_concurrency()

    def transcribe(self, pdf_path: str, images: Dict[int, List[StoredImage]],
                   detail: Optional[DetailFn] = None, cancel: Optional[CancelFn] = None
                   ) -> Tuple[str, List[PageReport]]:
        doc_lock = threading.Lock()  # PyMuPDF and pdfplumber documents are not thread-safe
        with fitz.open(pdf_path) as doc, pdfplumber.open(pdf_path) as plumb:
            pages = len(doc)

            def one(index: int) -> Tuple[str, PageReport]:
                if cancel and cancel():
                    raise Cancelled()
                no = index + 1
                body, report = self._page(doc, plumb, index, pages, images.get(no, []), doc_lock)
                return page_block(no, body), report

            def progress(done: int, total: int) -> None:
                if detail:
                    detail(f"{done} of {total} pages")

            results = run_concurrently(one, range(pages), self.concurrency, progress)
        return "\n\n".join(block for block, _ in results), [report for _, report in results]

    def _page(self, doc: fitz.Document, plumb, index: int, pages: int, page_images: List[StoredImage],
              doc_lock: threading.Lock):
        no = index + 1
        with doc_lock:
            page = doc[index]
            reference = coverage.reference_words(page, [i.bbox for i in page_images if i.bbox])
            image = render_masked_page(page, page_images, self.dpi)

        best: Optional[Tuple[str, Optional[float], List[str]]] = None  # (text, recall, words it missed)
        missing: List[str] = []  # from the latest attempt; drives the retry prompt
        issues: List[str] = []
        attempts = 0
        for attempt in range(1 + self.retries):
            attempts = attempt + 1
            retry = RETRY_NOTE.format(words=", ".join(missing[:40])) if missing else ""
            try:
                gen = self.backend.generate(TRANSCRIBE_PROMPT.format(page=no, pages=pages, retry=retry),
                                            image=image, max_tokens=8192)
            except BackendError as exc:
                issues.append(f"attempt {attempts}: {exc}")
                continue
            text = _strip_fences(gen.text)
            if gen.truncated:
                issues.append(f"attempt {attempts}: output hit the token limit")
            recall, missing = coverage.page_recall(reference, text)
            if best is None or (recall or 0) > (best[1] or 0):
                best = (text, recall, missing)
            if recall is None or recall >= self.threshold:
                break

        if best is None:  # every attempt failed: use the text layer, and say so
            issues.append("vision model failed on this page; text layer used")
            with doc_lock:
                layout = layout_page(doc[index], plumb.pages[index], page_images)
            body, _ = reconcile_tags(layout, page_images)
            return body, PageReport(no, "text_layer_fallback", None, attempts, issues)

        text, recall, best_missing = best
        if recall is None:
            issues.append("no text layer: completeness could not be verified")
        elif recall < self.threshold:
            issues.append(f"recall {recall:.3f} below {self.threshold} after {attempts} attempt(s); "
                          f"missing words include {best_missing[:15]}")
        text, tag_issues = reconcile_tags(text, page_images)
        return text, PageReport(no, "model", recall, attempts, issues + tag_issues)


# --------------------------------------------------------------------------- pass 2

SECTIONS: List[Tuple[str, List[str], str]] = [
    ("front matter", ["report_meta", "document_control", "audit_timeline", "methodology"],
     "Report identification, document control (sign-offs, change history, distribution list), "
     "assessment dates and the standards/methodology referred to."),
    ("scope, team and tools", ["engagement_scope", "auditing_team", "tools_used"],
     "Every in-scope asset, exclusions, testing credentials/roles, every auditing team member and every tool."),
    ("executive summary", ["executive_summary"],
     "The report's own executive summary: totals, severity counts, the full narrative text and every row "
     "of its findings summary table."),
    ("appendices", ["appendices"],
     "The risk-rating criteria/matrix and any retest or closure records."),
]

INDEX_SCHEMA = {
    "type": "object",
    "properties": {"findings": {"type": "array", "items": {
        "type": "object",
        "properties": {"finding_id": {"type": ["string", "null"]}, "title": {"type": "string"},
                       "start_page": {"type": "integer"}, "end_page": {"type": "integer"}},
        "required": ["finding_id", "title", "start_page", "end_page"],
        "additionalProperties": False}}},
    "required": ["findings"],
    "additionalProperties": False,
}

# The transcript comes first so a prefix-caching server encodes it once per document;
# everything after it (task, structure, field guide, guardrails) varies per call.
STRUCTURE_PROMPT = """Below is the complete, verbatim transcript of a cybersecurity audit report. Pages are delimited by <!-- PAGE_START: n --> markers. Tags of the form [IMAGE_PAGE_<page>_FIG_<n>] are pointers to images held in storage.

<transcript>
{transcript}
</transcript>

TASK: {task}
{instruction}

Return one JSON object with exactly this structure (template notation: "string", "number", "boolean"; "YYYY-MM-DD" is an ISO date; "A | B" means one of the listed values):
{template}

FIELD GUIDE - where each field's content comes from:
{guide}

GUARDRAILS - these override everything else:
{guardrails}

Output only the JSON object.{repair}"""

FINDING_INSTRUCTION = """Extract finding {number} of {count}, titled "{title}" (identifier: {finding_id}), whose detailed description is on pages {start}-{end}. Only this finding: text from any neighbouring finding on the same pages is excluded."""

INDEX_INSTRUCTION = """List the report's findings with their identifiers, titles and page ranges."""

SUMMARY_SCALARS_NOTE = """
The findings summary table is read separately: return summary_table as an empty list."""

SUMMARY_ROWS_INSTRUCTION = """Extract the rows of the report's findings summary table that appear on these pages, in order. These pages are part of a longer report: if no row of that table is on them, return an empty list. Only rows of that table; findings described in detail elsewhere are not rows."""

DETAILED_START_INSTRUCTION = """This is the outline of a long audit report: each heading and the page where it first appears. Give the page on which the section holding the findings' detailed descriptions begins (usually called detailed observations or detailed findings). It is not the executive summary or any other summary section. If the report has no separate section of that kind, give null."""

INDEX_WINDOW_NOTE = """
This is only part of a longer report: pages {first}-{last} of {total}. List the findings whose detailed description is on these pages, with the page range as far as it shows here. A finding that began on an earlier page or continues on a later one is still listed. Tables that belong to a summary section listed in the outline below are not findings, even when their rows look like findings.

Outline of the whole report (heading, page where it first appears):
{outline}"""


def parse_json_object(text: str) -> Optional[Dict[str, Any]]:
    """The first JSON object in model output, tolerating code fences and stray prose."""
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip(), flags=re.IGNORECASE)
    for candidate in (cleaned, cleaned[cleaned.find("{"): cleaned.rfind("}") + 1]):
        try:
            value = json.loads(candidate)
        except (ValueError, TypeError):
            continue
        if isinstance(value, dict):
            return value
    return None


# --------------------------------------------------------------------------- fitting long reports
# A long report's transcript does not fit one call. The model still does all the reading; the code
# only decides which pages a call is shown. Short reports are untouched: nothing here applies unless
# the transcript is over the budget.
CHARS_PER_TOKEN = 3.2           # a cautious first guess for dense report text; corrected from the server
PROMPT_OVERHEAD_TOKENS = 10_000  # task, template, field guide, guardrails and repair note around the transcript
CONTEXT_MARGIN_TOKENS = 4_096
SECTION_PROMPT_TOKENS = 120_000  # a front or back section needs the start or end of the report, not all of it
INDEX_WINDOW_TOKENS = 100_000    # one findings-index call reads about this much of the report
INDEX_WINDOW_OVERLAP_PAGES = 2   # a finding that straddles two windows is seen whole in one of them
SECTION_MAX_TOKENS = 32768
SUMMARY_ROWS_WINDOW_TOKENS = 20_000  # a long summary table is read this much at a time
MIN_TRANSCRIPT_CHARS = 20_000    # never shrink a call below this, whatever the context arithmetic says
# Share of a condensed transcript taken from the start; the rest comes from the end. The report
# format puts front matter, scope and the summary up front and the appendices last.
SECTION_FOCUS = {"front matter": 0.9, "scope, team and tools": 0.8, "executive summary": 0.8, "appendices": 0.15}
_INPUT_TOKENS_RE = re.compile(r"prompt contains at least (\d+) input tokens")


def condense(transcript: str, max_chars: int, head_share: float = 0.6) -> Tuple[str, Optional[str]]:
    """``transcript`` cut to ``max_chars`` by dropping whole pages from the middle; (text, note).

    Keeps the first pages (``head_share`` of the budget) and the last pages, and marks the gap so the
    model knows pages are missing. Returns the transcript unchanged, with no note, if it already fits.
    """
    if len(transcript) <= max_chars:
        return transcript, None
    blocks = [(int(m.group(1)), m.group(0)) for m in _PAGE_BLOCK_RE.finditer(transcript)]
    head_chars = int(max_chars * head_share)
    tail_chars = max_chars - head_chars
    if len(blocks) < 2:  # no page structure to cut along
        cut = "\n\n<!-- TEXT OMITTED: too long for one call -->\n\n"
        return transcript[:head_chars] + cut + transcript[len(transcript) - tail_chars:], "transcript cut to fit"
    head: List[Tuple[int, str]] = []
    used = 0
    for number, block in blocks:
        if head and used + len(block) > head_chars:
            break
        head.append((number, block[:max(head_chars, 2000)]))
        used += len(head[-1][1])
    tail: List[Tuple[int, str]] = []
    used = 0
    for number, block in reversed(blocks[len(head):]):
        if tail and used + len(block) > tail_chars:
            break
        tail.append((number, block[:max(tail_chars, 2000)]))
        used += len(tail[-1][1])
    tail.reverse()
    first_omitted = head[-1][0] + 1
    last_omitted = (tail[0][0] if tail else blocks[-1][0] + 1) - 1
    marker = (f"<!-- PAGES {first_omitted}-{last_omitted} OMITTED: the report is too long for one call -->"
              if last_omitted >= first_omitted else "")
    text = "\n\n".join([b for _, b in head] + ([marker] if marker else []) + [b for _, b in tail])
    note = (f"transcript condensed to pages 1-{head[-1][0]}"
            + (f" and {tail[0][0]}-{blocks[-1][0]}" if tail else "") + f" of {blocks[-1][0]}")
    return text, note


def page_windows(transcript: str, window_chars: int, overlap_pages: int = INDEX_WINDOW_OVERLAP_PAGES
                 ) -> List[str]:
    """The transcript as consecutive runs of whole pages of at most ``window_chars``, overlapping slightly."""
    blocks = [m.group(0) for m in _PAGE_BLOCK_RE.finditer(transcript)]
    if not blocks:
        return [transcript]
    windows: List[str] = []
    start = 0
    while start < len(blocks):
        end, size = start, 0
        while end < len(blocks) and (end == start or size + len(blocks[end]) <= window_chars):
            size += len(blocks[end])
            end += 1
        windows.append("\n\n".join(blocks[start:end]))
        if end >= len(blocks):
            break
        start = max(end - overlap_pages, start + 1)
    return windows


def outline(transcript: str, limit: int = 150) -> str:
    """The report's headings with the page each first appears on: a map of the whole report for a call
    that only sees some of its pages. A heading repeated on later pages is listed once."""
    first: Dict[str, List[Any]] = {}
    for block in _PAGE_BLOCK_RE.finditer(transcript):
        for line in block.group(0).splitlines():
            if not line.startswith("#") or line.startswith("## Page "):
                continue
            text = line.lstrip("#").strip()
            key = _norm_text(text)
            if not key:
                continue
            if key in first:
                first[key][2] += 1
            else:
                first[key] = [int(block.group(1)), text, 1]
    rows = [f"p{page}: {text}" + (f" (and on {more - 1} later pages)" if more > 1 else "")
            for page, text, more in first.values()]
    return "\n".join(rows[:limit])


def correct_page_ranges(entries: List[Dict[str, Any]], transcript: str) -> Tuple[List[Dict[str, Any]], int]:
    """Entries whose page range does not hold their own title, moved to where the title is printed.

    The model reads a long transcript and states page numbers from memory, and they drift by a few
    pages. Each finding is then extracted from the wrong pages. Whether a title is on the pages claimed
    for it is a fact about the text, so it is checked; a range that does hold its title is never touched.
    A title printed on several pages (one finding per host) is matched to occurrences in order, each
    occurrence used once. Returns (entries, how many were moved).
    """
    texts = {int(m.group(1)): _norm_text(m.group(0)) for m in _PAGE_BLOCK_RE.finditer(transcript)}
    used: Dict[Tuple[str, int], int] = {}
    moved = 0

    def free(title: str, page: int) -> bool:
        return page in texts and texts[page].count(title) > used.get((title, page), 0)

    for entry in entries:
        title = " ".join(_norm_text(str(entry["title"])).split()[:10])
        if len(title) < 12:
            continue
        start, end = entry["start_page"], entry["end_page"]
        here = next((p for p in range(start, end + 2) if free(title, p)), None)
        if here is None:
            nearby = [p for p in texts if free(title, p)]
            if not nearby:
                continue  # the title is printed nowhere (the model reworded it): nothing to check against
            here = min(nearby, key=lambda p: (abs(p - start), p))
            entry["start_page"], entry["end_page"] = here, here + (end - start)
            moved += 1
        used[(title, here)] = used.get((title, here), 0) + 1
    return entries, moved


def _norm_text(text: str) -> str:
    return " ".join(re.sub(r"[\W_]+", " ", text.lower()).split())


def _same_finding(a: Dict[str, Any], b: Dict[str, Any]) -> bool:
    ta, tb = re.sub(r"\W+", " ", a["title"]).strip().lower(), re.sub(r"\W+", " ", b["title"]).strip().lower()
    if not (ta == tb or (min(len(ta), len(tb)) >= 15 and (ta.startswith(tb) or tb.startswith(ta)))):
        return False
    if a["finding_id"] and b["finding_id"] and str(a["finding_id"]).strip() != str(b["finding_id"]).strip():
        return False
    return b["start_page"] <= a["end_page"] + 1 and a["start_page"] <= b["end_page"] + 1


def merge_index(parts: Iterable[List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
    """One findings list from per-window lists: a finding seen in two windows becomes one with the union range."""
    merged: List[Dict[str, Any]] = []
    for part in parts:
        for entry in part:
            entry = dict(entry)
            entry["start_page"], entry["end_page"] = sorted((entry["start_page"], entry["end_page"]))
            twin = next((m for m in reversed(merged[-60:]) if _same_finding(m, entry)), None)
            if twin is None:
                merged.append(entry)
                continue
            twin["start_page"] = min(twin["start_page"], entry["start_page"])
            twin["end_page"] = max(twin["end_page"], entry["end_page"])
            twin["finding_id"] = twin["finding_id"] or entry["finding_id"]
    return merged


@dataclass
class SectionReport:
    name: str
    source: str  # "model" | "rule_based" | "empty"
    attempts: int
    issues: List[str] = field(default_factory=list)


_PAGE_BLOCK_RE = re.compile(r"<!-- PAGE_START: (\d+) -->.*?<!-- PAGE_END: \1 -->", re.DOTALL)


def _page_slice(transcript: str, start: int, end: int) -> str:
    """Pages ``start``..``end`` of the transcript (the whole transcript if none match)."""
    chosen = [m.group(0) for m in _PAGE_BLOCK_RE.finditer(transcript) if start <= int(m.group(1)) <= end]
    return "\n\n".join(chosen) or transcript


class Pass2Structurer:
    def __init__(self, backend: ModelBackend):
        self.backend = backend
        self.retries = config.pass2_retries()
        self.concurrency = config.model_concurrency()
        self._rule_based: Optional[Dict[str, Any]] = None
        self._rule_based_lock = threading.Lock()
        self.grounding_drops: List[Dict[str, Any]] = []  # values nulled by the grounding check
        self.context_tokens = getattr(backend, "context_tokens", None) or 262_144
        self._chars_per_token = CHARS_PER_TOKEN
        self._summary_too_long = False
        self._detailed_start: Optional[int] = None

    def _fallback(self, transcript: str) -> Dict[str, Any]:
        with self._rule_based_lock:
            if self._rule_based is None:
                self._rule_based = schema.conform(RuleBasedStructurer().structure(transcript))
            return self._rule_based

    def _budget_chars(self, max_tokens: int, cap_tokens: Optional[int] = None) -> int:
        """How many transcript characters a call asking for ``max_tokens`` of answer can carry."""
        tokens = self.context_tokens - max_tokens - PROMPT_OVERHEAD_TOKENS - CONTEXT_MARGIN_TOKENS
        if cap_tokens:
            tokens = min(tokens, cap_tokens)
        return max(int(tokens * self._chars_per_token), MIN_TRANSCRIPT_CHARS)

    def _call(self, transcript: str, task: str, instruction: str, template: Any, guide: str,
              json_schema: Dict[str, Any], max_tokens: int = 20480, accept_imperfect: bool = True,
              head_share: float = 0.6, cap_tokens: Optional[int] = None
              ) -> Tuple[Optional[Dict], int, List[str]]:
        """Run one structuring call with validation and repair retries.

        If every attempt still breaks the schema but produced a JSON object with the
        expected keys, that output is kept (``accept_imperfect``): schema enforcement
        later nulls only the offending values and records them, which loses far less
        than replacing the whole section with the rule-based fallback.

        A transcript too long for the model's context is condensed to its first and last pages
        (see ``condense``); the issues list says so.
        """
        issues: List[str] = []
        repair = ""
        usable: Optional[Dict] = None
        noted = False
        for attempt in range(1 + self.retries):
            shown, note = condense(transcript, self._budget_chars(max_tokens, cap_tokens), head_share)
            if note and not noted:
                issues.append(note)
                noted = True
            prompt = STRUCTURE_PROMPT.format(transcript=shown, task=task, instruction=instruction,
                                             template=json.dumps(template, indent=1), guide=guide,
                                             guardrails=manual.guardrails(), repair=repair)
            try:
                gen = self.backend.generate(prompt, json_schema=json_schema if self.backend.supports_json_schema
                                            else None, max_tokens=max_tokens)
            except BackendError as exc:
                issues.append(f"attempt {attempt + 1}: {exc}")
                counted = _INPUT_TOKENS_RE.search(str(exc))
                if counted:  # the server's own token count: use it to size the next attempt
                    self._chars_per_token = max(1.5, min(self._chars_per_token,
                                                         0.9 * len(prompt) / int(counted.group(1))))
                continue
            if gen.truncated:
                issues.append(f"attempt {attempt + 1}: output hit the token limit")
                repair = "\n\nYour previous answer was cut off. Keep text complete but avoid repeating content."
                continue
            data = parse_json_object(gen.text)
            errors = ["output is not a JSON object"] if data is None else schema.validate_against(data, json_schema)
            if not errors:
                return data, attempt + 1, issues
            if data is not None and isinstance(template, dict) and any(k in data for k in template):
                usable = data
            issues.append(f"attempt {attempt + 1}: {'; '.join(errors[:5])}")
            repair = ("\n\nYour previous answer did not match the required structure: "
                      + "; ".join(errors[:10]) + "\nReturn the corrected, complete JSON object.")
        if accept_imperfect and usable is not None:
            issues.append("kept the last answer; values that break the schema are nulled at save")
            return usable, 1 + self.retries, issues
        return None, 1 + self.retries, issues

    def structure(self, transcript: str, detail: Optional[DetailFn] = None, cancel: Optional[CancelFn] = None
                  ) -> Tuple[Dict[str, Any], List[SectionReport]]:
        def check_cancel():
            if cancel and cancel():
                raise Cancelled()

        def progress(what: str):
            return lambda done, total: detail(f"{what}: {done} of {total}") if detail else None

        # The sections and the findings index are independent: run them together.
        def section(job) -> Tuple[Dict[str, Any], SectionReport]:
            check_cancel()
            if job is None:
                return self._index(transcript)
            name, keys, instruction = job
            result, attempts, issues = self._call(
                transcript, f"extract the {name}", instruction,
                {k: schema.template()[k] for k in keys}, manual.field_guide(keys), schema.section_schema(keys),
                max_tokens=SECTION_MAX_TOKENS, head_share=SECTION_FOCUS.get(name, 0.6),
                cap_tokens=SECTION_PROMPT_TOKENS)
            if result is None and name == "executive summary" and any("token limit" in i for i in issues):
                # The summary table is too long for one answer: it is read in parts once the index
                # says where the findings start (see _read_long_summary).
                self._summary_too_long = True
                return {k: None for k in keys}, SectionReport(name, "model", attempts,
                                                              issues + ["summary table read in parts"])
            if result is None:
                fallback = self._fallback(transcript)
                return {k: fallback[k] for k in keys}, SectionReport(name, "rule_based", attempts, issues)
            return {k: result.get(k) for k in keys}, SectionReport(name, "model", attempts, issues)

        results = run_concurrently(section, [*SECTIONS, None], self.concurrency, progress("sections"))
        data: Dict[str, Any] = {}
        reports: List[SectionReport] = []
        for part, report in results[:-1]:
            data.update(part)
            reports.append(report)
        index, index_report = results[-1]
        reports.append(index_report)
        if index is None:
            data["detailed_observations"] = self._fallback(transcript)["detailed_observations"]
            self._ground(data, transcript, {})
            return data, reports

        entries, moved = correct_page_ranges(index["findings"], transcript)
        if moved:
            index_report.issues.append(f"page range of {moved} finding(s) moved to the pages where their "
                                       f"titles are printed")
        if self._summary_too_long:
            summary, summary_issues = self._read_long_summary(transcript, entries)
            reports[[r.name for r in reports].index("executive summary")].issues.extend(summary_issues)
            if summary is None:
                data["executive_summary"] = self._fallback(transcript)["executive_summary"]
                reports[[r.name for r in reports].index("executive summary")].source = "rule_based"
            else:
                data["executive_summary"] = summary
        excerpts: Dict[int, str] = {}

        def one_finding(numbered) -> Tuple[Dict[str, Any], SectionReport]:
            n, entry = numbered
            check_cancel()
            start, end = sorted((max(1, entry["start_page"]), max(1, entry["end_page"])))
            excerpt = _page_slice(transcript, start, end + 1)  # +1: evidence often spills onto the next page
            excerpts[n - 1] = excerpt
            obs, attempts, issues = self._call(
                excerpt, f"extract finding {n}",
                FINDING_INSTRUCTION.format(number=n, count=len(entries), title=entry["title"],
                                           finding_id=entry["finding_id"], start=start, end=end),
                schema.template()["detailed_observations"][0], manual.field_guide(["detailed_observations"]),
                schema.item_schema("detailed_observations"))
            name = f"finding {n}: {entry['title']}"
            if obs is None:
                obs = self._fallback_finding(transcript, entry)
                source = "rule_based" if obs.pop("_matched", False) else "empty"
                return obs, SectionReport(name, source, attempts, issues)
            return obs, SectionReport(name, "model", attempts, issues)

        found = run_concurrently(one_finding, enumerate(entries, 1), self.concurrency, progress("findings"))
        data["detailed_observations"] = [obs for obs, _ in found]
        reports.extend(report for _, report in found)
        self._ground(data, transcript, excerpts)
        return data, reports

    def _ground(self, data: Dict[str, Any], transcript: str, excerpts: Dict[int, str]) -> None:
        """Null values the transcript does not support; each finding is checked against its own pages."""
        headers = grounding.header_trigrams(transcript)
        findings = data.pop("detailed_observations", None) or []
        self.grounding_drops += grounding.ground(data, transcript, headers=headers)
        for i, obs in enumerate(findings):
            self.grounding_drops += grounding.ground(obs, excerpts.get(i, transcript),
                                                     f"detailed_observations[{i}]", headers=headers)
        data["detailed_observations"] = findings

    def _read_long_summary(self, transcript: str, entries: List[Dict[str, Any]]
                           ) -> Tuple[Optional[Dict[str, Any]], List[str]]:
        """The executive summary when its table is too long for one answer: the text fields in one call,
        the table rows a few pages at a time. The table sits before the first detailed finding."""
        first = min((e["start_page"] for e in entries), default=0)
        last_page = self._detailed_start - 1 if self._detailed_start else max(first + 1, 5)
        blocks = [m.group(0) for m in _PAGE_BLOCK_RE.finditer(transcript)]
        head = "\n\n".join(b for b in blocks if int(_PAGE_BLOCK_RE.match(b).group(1)) <= last_page)
        keys = ["executive_summary"]
        full = schema.section_schema(keys)
        table_schema = full["properties"]["executive_summary"]["properties"]["summary_table"]
        scalars_schema = json.loads(json.dumps(full))
        scalars_schema["properties"]["executive_summary"]["properties"]["summary_table"]["maxItems"] = 0
        scalars, a1, issues = self._call(
            head, "extract the executive summary", next(i for n, _, i in SECTIONS if n == "executive summary") + SUMMARY_SCALARS_NOTE,
            {k: schema.template()[k] for k in keys}, manual.field_guide(keys), scalars_schema,
            max_tokens=SECTION_MAX_TOKENS, head_share=0.8, cap_tokens=SECTION_PROMPT_TOKENS)
        if scalars is None:
            return None, issues
        rows_schema = {"type": "object", "properties": {"summary_table": table_schema},
                       "required": ["summary_table"], "additionalProperties": False}
        windows = page_windows(head, int(SUMMARY_ROWS_WINDOW_TOKENS * self._chars_per_token), 1)

        def read(window: str) -> Tuple[Optional[Dict], int, List[str]]:
            return self._call(window, "extract the summary table rows", SUMMARY_ROWS_INSTRUCTION,
                              {"summary_table": schema.template()["executive_summary"]["summary_table"]},
                              manual.field_guide(keys), rows_schema, max_tokens=SECTION_MAX_TOKENS,
                              accept_imperfect=False)

        parts = run_concurrently(read, windows, self.concurrency)
        issues += [i for _, _, found in parts for i in found]
        if any(result is None for result, _, _ in parts):
            return None, issues
        rows: List[Dict[str, Any]] = []
        seen = set()
        for result, _, _ in parts:
            for row in result["summary_table"]:
                key = (row.get("sr_no"), _norm_text(str(row.get("title") or "")), _norm_text(str(row.get("affected_asset") or "")))
                if key not in seen:
                    seen.add(key)
                    rows.append(row)
        summary = scalars.get("executive_summary") or {}
        summary["summary_table"] = rows
        issues.append(f"summary table: {len(rows)} rows read from {len(windows)} page window(s)")
        return summary, issues

    def _locate_detailed_start(self, transcript: str, total_pages: int) -> Optional[int]:
        """The page where the detailed findings section begins, read from the report's outline."""
        headings = outline(transcript)
        if not headings:
            return None
        guide = ("- `detailed_start_page`: the page where the section with each finding's detailed description "
                 "begins, or null when the report has no such separate section.")
        schema_ = {"type": "object", "properties": {"detailed_start_page": {"type": ["integer", "null"]}},
                   "required": ["detailed_start_page"], "additionalProperties": False}
        result, _, _ = self._call(headings, "locate the detailed findings section", DETAILED_START_INSTRUCTION,
                                  {"detailed_start_page": "number"}, guide, schema_, max_tokens=1024,
                                  accept_imperfect=False)
        page = (result or {}).get("detailed_start_page")
        return page if isinstance(page, int) and 1 < page <= total_pages else None

    def _index(self, transcript: str) -> Tuple[Optional[Dict[str, Any]], SectionReport]:
        template = {"findings": [{"finding_id": "string", "title": "string", "start_page": "number",
                                  "end_page": "number"}]}
        guide = manual.blocks()[manual.FINDINGS_INDEX]
        window_chars = self._budget_chars(16384, INDEX_WINDOW_TOKENS)
        windows = page_windows(transcript, window_chars)
        total_pages = len(_PAGE_BLOCK_RE.findall(transcript))
        report_outline = outline(transcript) if len(windows) > 1 else ""
        issues: List[str] = []
        region = transcript
        if len(windows) > 1:
            # A long report: the model first says where the detailed findings begin, so that rows of a
            # summary table spread over many pages are not read as findings.
            start = self._locate_detailed_start(transcript, total_pages)
            if start:
                self._detailed_start = start
                region = "\n\n".join(m.group(0) for m in _PAGE_BLOCK_RE.finditer(transcript)
                                      if int(m.group(1)) >= start)
                windows = page_windows(region, window_chars)
                issues.append(f"detailed findings read from page {start}")
        if len(windows) == 1:
            index, attempts, found = self._call(region, "index the findings", INDEX_INSTRUCTION, template,
                                                guide, INDEX_SCHEMA, max_tokens=16384, accept_imperfect=False,
                                                cap_tokens=INDEX_WINDOW_TOKENS)
            return index, SectionReport("findings index", "model" if index is not None else "rule_based",
                                        attempts, issues + found)

        def read(window: str) -> Tuple[Optional[Dict], int, List[str]]:
            numbers = [int(n) for n in re.findall(r"<!-- PAGE_START: (\d+) -->", window)]
            note = (INDEX_WINDOW_NOTE.format(first=numbers[0], last=numbers[-1], total=total_pages,
                                             outline=report_outline) if numbers else "")
            return self._call(window, "index the findings", INDEX_INSTRUCTION + note, template, guide,
                              INDEX_SCHEMA, max_tokens=16384, accept_imperfect=False)

        results = run_concurrently(read, windows, self.concurrency)
        attempts = sum(a for _, a, _ in results)
        issues += [f"read in {len(windows)} overlapping page windows"] + [i for _, _, found in results for i in found]
        if any(index is None for index, _, _ in results):
            return None, SectionReport("findings index", "rule_based", attempts, issues)
        return ({"findings": merge_index(index["findings"] for index, _, _ in results)},
                SectionReport("findings index", "model", attempts, issues))

    def _fallback_finding(self, transcript: str, entry: Dict[str, Any]) -> Dict[str, Any]:
        wanted = re.sub(r"\W+", " ", entry["title"]).strip().lower()
        for obs in self._fallback(transcript)["detailed_observations"]:
            if re.sub(r"\W+", " ", obs.get("title") or "").strip().lower() == wanted:
                return {**obs, "_matched": True}
        stub = schema.conform({"finding_id": entry["finding_id"], "title": entry["title"]},
                              schema.template()["detailed_observations"][0])
        return stub
