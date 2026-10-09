"""Grounding check: null every risky value that the transcript does not support.

The structuring manual forbids invented values, but a model still fills fields it cannot
see in the document: copies the template's placeholder text, writes scores or levels the
report never prints, defaults a date, or adds a plausible URL. Those are the values that
look authoritative, so they are checked mechanically. A value that fails becomes null and is
reported in the run's ``dropped_values`` with the reason; nothing is guessed or repaired.

The checks only ask whether the document gives the value. They never decide what a value
should be, and a paraphrase that still shares wording with the document passes.
"""
import datetime as _dt
import re
from typing import Any, Dict, List, Optional, Set

# Template notation and filler the model emits instead of null. Kept only if the document says it.
_FILLER = {"string", "number", "boolean", "yyyy mm dd", "not answerable", "not specified",
           "not applicable", "unknown", "none specified"}
# "No exclusions stated in the report": the model's remark about the document, not a value from it.
_REMARK_RE = re.compile(r"^(?:no|none|not|nil)\b.*\b(?:stated|specified|mentioned|provided|reported|found|"
                        r"available|applicable|identified|listed|given|disclosed|present|documented)\b")
_MONTHS = {m: i for i, m in enumerate(
    ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"], 1)}
_DATE_KEYS = {"from", "to", "date", "scope_updated_till"}
_LEVEL_KEYS = {"impact_level": "impact", "likelihood_level": "likelihood"}
_SCORE_KEYS = {"cvss_score": "cvss", "reported_epss_score": "epss"}
_VERBATIM_KEYS = {"url", "email", "internal_ip", "public_ip", "cvss_vector"}
# Values taken word for word from the document: most of their words must appear in the text they came from.
_PHRASE_KEYS = {"title", "name", "organization", "designation", "tool_name", "asset_description",
                "affected_asset", "standards_referred", "exclusions", "report_title", "document_title"}
MIN_PHRASE_WORDS_FOUND = 0.7
# A value taken from a table row is checked against that row: these are the row's own cells.
_ROW_KEYS = {"severity", "status", "new_or_repeat"}
_ENUM_KEYS = {"status", "new_or_repeat"}
# Prose is checked leniently: a paraphrase of the document still shares some three-word runs with it,
# invented text shares almost none. Only text with next to no overlap is nulled.
MIN_PROSE_WORDS = 6
MIN_PROSE_OVERLAP = 0.15
# Fields where a page header or footer gets copied in as if it were a reference. Elsewhere a value that
# also appears in the header (the document's title, the client's name) is legitimate.
_HEADER_PRONE_KEYS = {"reference", "regulatory_references"}
# Text at the edge of at least this share of the pages (and at least MIN_HEADER_PAGES of them) is a
# running header or footer, never a value.
MIN_HEADER_PAGES = 3
MIN_HEADER_SHARE = 0.25
MAX_HEADER_WORDS = 12
_STOPWORDS = {"the", "and", "for", "with", "that", "this", "from", "are", "was", "were", "has", "have",
              "not", "any", "all", "can", "may", "its", "their", "which", "will", "into", "such"}
_ISO_RE = re.compile(r"(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)")
_NUMERIC_DATE_RE = re.compile(r"(?<!\d)(\d{1,2})\s*[-/.]\s*(\d{1,2})\s*[-/.]\s*(\d{4})(?!\d)")
_DAY_MONTH_RE = re.compile(r"(?<!\d)(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})(?!\d)")
_MONTH_DAY_RE = re.compile(r"([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})(?!\d)")
_IDENTIFIER_RE = re.compile(r"https?://[^\s\"'<>)\]]+|[\w.+-]+@[\w-]+(?:\.[\w-]+)+|(?<![\d.])(?:\d{1,3}\.){3}\d{1,3}(?![\d.])")
_PAGE_BLOCK_RE = re.compile(r"<!-- PAGE_START: (\d+) -->(.*?)<!-- PAGE_END: \1 -->", re.DOTALL)
_COUNT_NOUN = r"(?:vulnerabilit\w*|findings?|issues?|observations?|weakness\w*)"


def _norm(text: str) -> str:
    return " ".join(re.sub(r"[\W_]+", " ", str(text).lower()).split())


def _squash(text: str) -> str:
    return re.sub(r"\s+", "", str(text).lower())


def _trigrams(norm_text: str) -> Set[tuple]:
    words = norm_text.split()
    return {tuple(words[i:i + 3]) for i in range(len(words) - 2)}


def _content_words(norm_text: str) -> List[str]:
    return [w for w in norm_text.split() if len(w) >= 3 and w not in _STOPWORDS]


def _date(year: int, month: int, day: int) -> Optional[_dt.date]:
    try:
        return _dt.date(year, month, day)
    except ValueError:
        return None


def dates_in(text: str) -> Set[_dt.date]:
    """Every calendar date written in ``text`` (day-first and month-first, numeric or named)."""
    found: Set[Optional[_dt.date]] = set()
    for y, m, d in _ISO_RE.findall(text):
        found.add(_date(int(y), int(m), int(d)))
    for a, b, y in _NUMERIC_DATE_RE.findall(text):
        found.add(_date(int(y), int(b), int(a)))
        found.add(_date(int(y), int(a), int(b)))
    for d, name, y in _DAY_MONTH_RE.findall(text):
        if name[:3].lower() in _MONTHS:
            found.add(_date(int(y), _MONTHS[name[:3].lower()], int(d)))
    for name, d, y in _MONTH_DAY_RE.findall(text):
        if name[:3].lower() in _MONTHS:
            found.add(_date(int(y), _MONTHS[name[:3].lower()], int(d)))
    found.discard(None)
    return found  # type: ignore[return-value]


def header_trigrams(transcript: str) -> Set[tuple]:
    """Three-word runs found at the top or bottom of many pages: the running headers and footers.

    Position matters: a finding's title also repeats across a report (contents, summary, heading), but a
    header sits at the edge of the page every time. Digits are dropped so page numbers match.
    """
    pages = _PAGE_BLOCK_RE.findall(transcript)
    if len(pages) < MIN_HEADER_PAGES:
        return set()
    need = max(MIN_HEADER_PAGES, int(MIN_HEADER_SHARE * len(pages)))
    counts: Dict[tuple, int] = {}
    for _, body in pages:
        lines = [ln for ln in body.splitlines()
                 if ln.strip() and not ln.lstrip().startswith(("## Page", "[IMAGE_PAGE"))]
        edge = " ".join(_norm(ln) for ln in lines[:3] + lines[-3:])
        for gram in _trigrams(" ".join(re.sub(r"\d+", " ", edge).split())):
            counts[gram] = counts.get(gram, 0) + 1
    return {gram for gram, seen in counts.items() if seen >= need}


def _is_header(norm_value: str, headers: Set[tuple]) -> bool:
    if len(norm_value.split()) > MAX_HEADER_WORDS:
        return False  # a running header is a few words; longer text repeated on pages is boilerplate content
    grams = _trigrams(" ".join(re.sub(r"\d+", " ", norm_value).split()))
    return bool(grams) and sum(g in headers for g in grams) / len(grams) >= 0.8


class _Scope:
    """A piece of transcript text with the lookups the checks need, computed once."""

    def __init__(self, text: str, finding: bool = False):
        self.text = text
        self.finding = finding
        self.lower = text.lower()
        self.norm = _norm(text)
        self.squashed = _squash(text)
        self._dates: Optional[Set[_dt.date]] = None
        self._trigrams: Optional[Set[tuple]] = None
        self._words: Optional[Set[str]] = None

    @property
    def dates(self) -> Set[_dt.date]:
        if self._dates is None:
            self._dates = dates_in(self.lower)
        return self._dates

    @property
    def trigrams(self) -> Set[tuple]:
        if self._trigrams is None:
            self._trigrams = _trigrams(self.norm)
        return self._trigrams

    @property
    def words(self) -> Set[str]:
        if self._words is None:
            self._words = set(self.norm.split())
        return self._words

    def has_word(self, value: Any) -> bool:
        needle = _norm(value)
        return bool(needle) and re.search(rf"(?<!\w){re.escape(needle)}(?!\w)", self.norm) is not None

    def has_number(self, value: Any) -> bool:
        text = f"{float(value):g}"
        variants = {text, f"{float(value):.1f}", f"{float(value):.2f}"}
        return any(re.search(rf"(?<![\d.]){re.escape(v)}(?![\d])", self.lower) for v in variants)

    def row_of(self, title: str, prose_allowed: bool) -> Optional["_Scope"]:
        """The table row(s) that hold ``title``, as a scope of their own; None if the title is not in a table.

        With ``prose_allowed`` False, a title that also appears in running text (a heading or a
        paragraph) means the finding has a detailed section, so its values are not confined to a row.
        """
        needle = _norm(title)
        if len(needle.split()) < 2:
            return None
        rows, prose = [], False
        for line in self.text.splitlines():
            if needle in _norm(line):
                if line.lstrip().startswith("|"):
                    rows.append(line)
                else:
                    prose = True
        if not rows or (prose and not prose_allowed):
            return None
        return _Scope("\n".join(rows))


def _as_number(value: Any) -> Optional[float]:
    if isinstance(value, bool):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _total_stated(value: Any, scope: _Scope) -> bool:
    """Whether the document states ``value`` as a count of findings (next to a count word, or beside "total")."""
    number = _as_number(value)
    if number is None or number != int(number):
        return True  # not a plain count; nothing to check it against
    n = int(number)
    text = scope.lower
    if re.search(rf"(?<![\d.]){n}\s+(?:\w+\s+){{0,2}}{_COUNT_NOUN}|{_COUNT_NOUN}\W+(?:\w+\W+){{0,3}}(?<![\d.]){n}(?![\d.])", text):
        return True
    for match in re.finditer(rf"(?<![\w.]){n}(?![\w.])", text):
        window = text[max(0, match.start() - 150):match.end() + 150]
        if re.search(r"\btotal\b|number of", window):
            return True
    return False


def _why_ungrounded(key: str, value: Any, scope: _Scope, headers: Optional[Set[tuple]] = None) -> Optional[str]:
    """The reason ``value`` (of field ``key``) is not supported by ``scope``, or None if it is."""
    if isinstance(value, str):
        norm = _norm(value)
        if norm in _FILLER and not scope.has_word(value):
            return "placeholder text, not stated in the document"
        if _REMARK_RE.match(norm) and norm not in scope.norm:
            return "a remark about the document, not a value stated in it"
        if headers and key in _HEADER_PRONE_KEYS and _is_header(norm, headers):
            return "a running page header or footer, not a value"
    if key == "total_findings":
        if not _total_stated(value, scope):
            return f"{value} is not stated as a total of findings in the document"
        return None
    number = _as_number(value) if key in _SCORE_KEYS else None
    if number is not None:
        if _SCORE_KEYS[key] not in scope.lower or not scope.has_number(number):
            return f"{value} is not printed with a {_SCORE_KEYS[key].upper()} label for this finding"
        return None
    if not isinstance(value, str):
        return None
    if key in _LEVEL_KEYS:
        if _LEVEL_KEYS[key] not in scope.norm or not scope.has_word(value):
            return f"the {_LEVEL_KEYS[key]} level '{value}' is not stated for this finding"
    elif key == "redacted":
        if "redact" not in scope.lower:
            return "the document says nothing about redaction"
    elif key == "severity":
        word = re.escape(_norm(value))
        # In a finding the rating must sit next to a severity/risk label; elsewhere (the summary
        # table) the label is a column header far from the value, so the bare word is accepted.
        labelled = rf"(severity|risk)\W+(?:\w+\W+){{0,4}}{word}(?!\w)|(?<!\w){word}\W+(?:\w+\W+){{0,2}}(severity|risk)"
        if not (re.search(labelled, scope.norm) if scope.finding else scope.has_word(value)):
            return f"severity '{value}' is not stated for this finding"
    elif key in _ENUM_KEYS:
        if not scope.has_word(value):
            return f"'{value}' is not stated in the text this value must come from"
    elif key in _VERBATIM_KEYS:
        if _squash(value) not in scope.squashed:
            return "value does not appear in the document"
    elif key in _DATE_KEYS or key.endswith("date"):
        parsed = dates_in(value)
        if parsed and not parsed & scope.dates:
            return "this date is not written anywhere in the text this value must come from"
    else:
        for token in _IDENTIFIER_RE.findall(value):
            if _squash(token.rstrip(".,;:/")) not in scope.squashed:
                return f"'{token}' does not appear in the document"
        if key in _PHRASE_KEYS:
            words = _content_words(_norm(value))
            if len(words) >= 2 and sum(w in scope.words for w in words) / len(words) < MIN_PHRASE_WORDS_FOUND:
                return "most of these words do not appear in the text this value must come from"
        elif len(value.split()) >= MIN_PROSE_WORDS:
            mine = _trigrams(_norm(value))
            if mine and len(mine & scope.trigrams) / len(mine) < MIN_PROSE_OVERLAP:
                return "this text shares almost no wording with the document"
    return None


def _cve_cwe_reason(key: str, value: Any, scope: _Scope) -> Optional[str]:
    if not isinstance(value, str):
        return None
    if key == "cve_id":
        return None if _squash(value) in scope.squashed else "CVE identifier does not appear in the document"
    numbers = re.findall(r"cwe\W*(\d+)", value.lower())
    for number in numbers:
        if not re.search(rf"cwe\W*(?:id\W*)?{number}(?!\d)", scope.lower):
            return f"CWE-{number} is not stated for this finding"
    if not numbers and _squash(value) not in scope.squashed:
        return "CWE text does not appear in the document"
    return None


def ground(node: Any, scope_text: str, path: str = "", drops: Optional[List[Dict[str, Any]]] = None,
           _scope: Optional[_Scope] = None, _key: str = "", headers: Optional[Set[tuple]] = None
           ) -> List[Dict[str, Any]]:
    """Null every unsupported checked value in ``node`` (in place); return the list of drops.

    Each drop is ``{"path", "value", "reason"}``, the same shape as the schema's dropped values.
    ``headers`` (see ``header_trigrams``) are page headers and footers that are never values.
    """
    drops = [] if drops is None else drops
    in_finding = path.startswith("detailed_observations")
    scope = _scope or _Scope(scope_text, in_finding)

    def drop(where: str, value: Any, reason: str) -> None:
        drops.append({"path": where, "value": value, "reason": f"ungrounded: {reason}"})

    if isinstance(node, dict):
        row: Optional[_Scope] = None
        title = node.get("title")
        if isinstance(title, str) and re.search(r"(?:summary_table|detailed_observations)\[\d+\]$", path):
            row = scope.row_of(title, prose_allowed="summary_table" in path)
        for key, value in list(node.items()):
            child = f"{path}.{key}".lstrip(".")
            if isinstance(value, (dict, list)):
                ground(value, scope_text, child, drops, scope, key, headers)
                continue
            if value is None or value == "":
                continue
            reason = _why_ungrounded(key, value, row if row is not None and key in _ROW_KEYS else scope, headers)
            if reason:
                drop(child, value, reason)
                node[key] = None
    elif isinstance(node, list):
        for index, value in enumerate(node):
            child = f"{path}[{index}]"
            if isinstance(value, (dict, list)):
                ground(value, scope_text, child, drops, scope, _key, headers)
                continue
            reason = (_cve_cwe_reason(_key, value, scope) if _key in ("cve_id", "cwe") else None) \
                or (_why_ungrounded(_key, value, scope, headers) if isinstance(value, str) else None)
            if reason:
                drop(child, value, reason)
                node[index] = None
        if _key in ("cve_id", "cwe"):
            node[:] = [v for v in node if v is not None]
    return drops
