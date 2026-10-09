"""Long reports: a transcript too big for one model call is shown to the model in parts."""
import json
import re

from report_to_json import schema, vlm
from report_to_json.backends import BackendError, Generation
from report_to_json.schema import manual

from conftest import FakeBackend, filled


def transcript_of(pages: int, line: str = "Finding text about the application and its settings. " * 6) -> str:
    return "\n\n".join(f"<!-- PAGE_START: {n} -->\n## Page {n}\n\n{line}{n}\n\n<!-- PAGE_END: {n} -->"
                       for n in range(1, pages + 1))


def page_numbers(text: str):
    return [int(n) for n in re.findall(r"<!-- PAGE_START: (\d+) -->", text)]


def test_condense_leaves_a_transcript_that_fits_alone():
    text = transcript_of(5)
    assert vlm.condense(text, len(text)) == (text, None)


def test_condense_keeps_the_first_and_last_pages_and_marks_the_gap():
    text = transcript_of(40)
    shown, note = vlm.condense(text, len(text) // 4, head_share=0.5)
    pages = page_numbers(shown)
    assert pages[0] == 1 and pages[-1] == 40 and len(shown) <= len(text) // 4 + 200
    gap = [b - a for a, b in zip(pages, pages[1:]) if b - a > 1]
    assert len(gap) == 1 and re.search(r"PAGES \d+-\d+ OMITTED", shown)
    assert note.startswith("transcript condensed to pages 1-")


def test_condense_favours_the_end_when_asked():
    text = transcript_of(40)
    shown, _ = vlm.condense(text, len(text) // 4, head_share=0.1)
    pages = page_numbers(shown)
    assert sum(1 for p in pages if p > 20) > sum(1 for p in pages if p <= 20)


def test_windows_cover_every_page_and_overlap():
    text = transcript_of(30)
    windows = vlm.page_windows(text, len(text) // 5, overlap_pages=2)
    assert len(windows) > 2
    covered = set()
    for before, after in zip(windows, windows[1:]):
        assert set(page_numbers(before)) & set(page_numbers(after))
    for window in windows:
        assert len(window) <= len(text) // 5 + 400
        covered |= set(page_numbers(window))
    assert covered == set(range(1, 31))


def test_a_finding_seen_in_two_windows_is_merged_but_repeated_titles_are_not():
    first = [{"finding_id": "1", "title": "Open Port", "start_page": 3, "end_page": 6},
             {"finding_id": "2", "title": "Weak Cipher", "start_page": 7, "end_page": 9}]
    second = [{"finding_id": "2", "title": "Weak cipher", "start_page": 8, "end_page": 11},
              {"finding_id": "3", "title": "Open Port", "start_page": 40, "end_page": 41}]
    merged = vlm.merge_index([first, second])
    assert [(m["finding_id"], m["start_page"], m["end_page"]) for m in merged] == \
        [("1", 3, 6), ("2", 7, 11), ("3", 40, 41)]


def structurer_for(responder, context_tokens):
    backend = FakeBackend(responder)
    backend.context_tokens = context_tokens
    return vlm.Pass2Structurer(backend), backend


def long_responder(findings, detailed_start=None):
    """Answers each call the way a model would, from the pages the prompt actually shows."""
    def respond(prompt, image, json_schema):
        shown = set(page_numbers(prompt.split("<transcript>")[1].split("</transcript>")[0]))
        if "TASK: index the findings" in prompt:
            return json.dumps({"findings": [f for f in findings if f["start_page"] in shown]})
        if "TASK: locate the detailed findings section" in prompt:
            return json.dumps({"detailed_start_page": detailed_start})
        if "TASK: extract finding" in prompt:
            return json.dumps(schema.conform({"title": "x"}, schema.template()["detailed_observations"][0]))
        task = re.search(r"TASK: extract the ([^\n]+)", prompt).group(1)
        keys = next(k for name, k, _ in vlm.SECTIONS if name == task)
        return json.dumps(filled(keys))
    return respond


def test_a_long_report_is_read_in_parts_and_every_finding_is_found(monkeypatch):
    monkeypatch.setattr(vlm, "PROMPT_OVERHEAD_TOKENS", 100)
    monkeypatch.setattr(vlm, "CONTEXT_MARGIN_TOKENS", 10)
    text = transcript_of(60)
    findings = [{"finding_id": str(i), "title": f"Finding {i}", "start_page": 1 + 3 * i, "end_page": 2 + 3 * i}
                for i in range(20)]
    # 6 pages of ~340 chars fit a window; 3 chars/token and 16384 answer tokens leave room for ~20k chars
    structurer, backend = structurer_for(long_responder(findings), context_tokens=16384 + 7000)
    data, reports = structurer.structure(text)
    index_calls = [c for c in backend.calls if "TASK: index the findings" in c["prompt"]]
    assert len(index_calls) > 1
    assert len(data["detailed_observations"]) == 20
    assert all(r.source == "model" for r in reports)
    index_report = next(r for r in reports if r.name == "findings index")
    assert any("overlapping page windows" in i for i in index_report.issues)


def test_sections_of_a_long_report_see_the_start_or_the_end_not_everything(monkeypatch):
    monkeypatch.setattr(vlm, "SECTION_PROMPT_TOKENS", 1_000)   # about 3,000 characters of transcript
    text = transcript_of(60)
    structurer, backend = structurer_for(long_responder([]), context_tokens=262_144)
    data, reports = structurer.structure(text)
    by_task = {re.search(r"TASK: ([^\n]+)", c["prompt"]).group(1): c["prompt"] for c in backend.calls}
    front = page_numbers(by_task["extract the front matter"])
    appendices = page_numbers(by_task["extract the appendices"])
    assert front[0] == 1 and sum(p <= 30 for p in front) > sum(p > 30 for p in front)
    assert appendices[-1] == 60 and sum(p > 30 for p in appendices) > sum(p <= 30 for p in appendices)
    assert "OMITTED" in by_task["extract the front matter"]
    report = next(r for r in reports if r.name == "front matter")
    assert any(i.startswith("transcript condensed") for i in report.issues)


def test_a_short_report_is_sent_whole():
    text = transcript_of(6)
    structurer, backend = structurer_for(long_responder([]), context_tokens=262_144)
    structurer.structure(text)
    assert all("OMITTED" not in c["prompt"] for c in backend.calls)
    assert len([c for c in backend.calls if "TASK: index the findings" in c["prompt"]]) == 1


def test_the_servers_own_token_count_resizes_the_next_attempt(monkeypatch):
    sizes = []

    def respond(prompt, image, json_schema):
        sizes.append(len(prompt))
        if len(sizes) == 1:
            return BackendError("returned HTTP 400: ... your prompt contains at least 9000 input tokens ...")
        return json.dumps(filled(["appendices"]))

    monkeypatch.setattr(vlm, "MIN_TRANSCRIPT_CHARS", 1_000)
    structurer, backend = structurer_for(respond, context_tokens=20_000)
    text = transcript_of(80)
    result, attempts, issues = structurer._call(
        text, "extract the appendices", "x", {"appendices": schema.template()["appendices"]},
        manual.field_guide(["appendices"]), schema.section_schema(["appendices"]), max_tokens=1000)
    assert result is not None and attempts == 2
    assert sizes[1] < sizes[0]                       # learned that the text is denser than first assumed
    assert structurer._chars_per_token < vlm.CHARS_PER_TOKEN


def test_the_backend_reads_the_servers_context_length(monkeypatch):
    from report_to_json import backends, config

    backend = backends.OpenAICompatBackend(config.get_model(config.DEFAULT_MODEL), "http://127.0.0.1:8000/v1")
    served = config.served_model_name(backend.profile)
    monkeypatch.setattr(backend, "_request", lambda *a, **k: {"data": [{"id": served, "max_model_len": 65536}]})
    backend.check()
    assert backend.context_tokens == 65536


def numbered_report(titles_by_page):
    pages = []
    for n in range(1, 21):
        body = "\n".join(f"Observation/ Vulnerability title {t}" for t in titles_by_page.get(n, [])) or "Plain text"
        pages.append(f"<!-- PAGE_START: {n} -->\n## Page {n}\n\n{body}\n\n<!-- PAGE_END: {n} -->")
    return "\n\n".join(pages)


def test_a_drifted_page_range_is_moved_to_where_the_title_is_printed():
    text = numbered_report({5: ["Cross Site Scripting in the search form"], 9: ["Weak cipher suites are accepted"]})
    entries = [{"finding_id": "1", "title": "Cross Site Scripting in the search form", "start_page": 5, "end_page": 5},
               {"finding_id": "2", "title": "Weak cipher suites are accepted", "start_page": 6, "end_page": 7}]
    fixed, moved = vlm.correct_page_ranges(entries, text)
    assert moved == 1
    assert (fixed[0]["start_page"], fixed[0]["end_page"]) == (5, 5)    # right already: untouched
    assert (fixed[1]["start_page"], fixed[1]["end_page"]) == (9, 10)   # moved, keeping its span


def test_a_title_printed_on_several_pages_is_matched_in_order_once_each():
    title = "Amazon Linux 2023 gawk advisory"
    text = numbered_report({12: [title], 13: [title], 14: [title]})
    entries = [{"finding_id": str(i), "title": title, "start_page": 9 + i, "end_page": 9 + i} for i in range(1, 4)]
    fixed, _ = vlm.correct_page_ranges(entries, text)
    assert [e["start_page"] for e in fixed] == [12, 13, 14]


def test_an_unfindable_or_short_title_is_left_alone():
    text = numbered_report({4: ["Something else entirely"]})
    entries = [{"finding_id": "1", "title": "Reworded by the model completely", "start_page": 8, "end_page": 8},
               {"finding_id": "2", "title": "XSS", "start_page": 2, "end_page": 2}]
    fixed, moved = vlm.correct_page_ranges(entries, text)
    assert moved == 0 and fixed[0]["start_page"] == 8 and fixed[1]["start_page"] == 2


def test_a_summary_table_too_long_for_one_answer_is_read_in_parts(monkeypatch):
    monkeypatch.setattr(vlm, "SUMMARY_ROWS_WINDOW_TOKENS", 400)   # about 1,300 characters: a few pages a window
    text = transcript_of(30)

    def respond(prompt, image, json_schema):
        shown = page_numbers(prompt.split("<transcript>")[1].split("</transcript>")[0])
        if "TASK: extract the executive summary" in prompt and "read separately" not in prompt:
            return Generation(text="{", truncated=True)       # the whole table does not fit one answer
        if "TASK: extract the executive summary" in prompt:
            return json.dumps(filled(["executive_summary"], executive_summary={"total_findings": 12}))
        if "TASK: extract the summary table rows" in prompt:
            rows = [schema.conform({"sr_no": p, "title": f"Row {p}"},
                                   schema.template()["executive_summary"]["summary_table"][0])
                    for p in shown if 5 <= p <= 14]
            return json.dumps({"summary_table": rows})
        if "TASK: index the findings" in prompt:
            return json.dumps({"findings": [{"finding_id": "1", "title": "Finding on page fifteen", "start_page": 15,
                                             "end_page": 15}]})
        if "TASK: extract finding" in prompt:
            return json.dumps(schema.conform({"title": "x"}, schema.template()["detailed_observations"][0]))
        task = re.search(r"TASK: extract the ([^\n]+)", prompt).group(1)
        return json.dumps(filled(next(k for name, k, _ in vlm.SECTIONS if name == task)))

    structurer, backend = structurer_for(respond, context_tokens=262_144)
    data, reports = structurer.structure(text)
    summary = data["executive_summary"]
    assert summary["total_findings"] == 12
    assert [r["sr_no"] for r in summary["summary_table"]] == list(range(5, 15))   # overlapping windows deduplicated
    report = next(r for r in reports if r.name == "executive summary")
    assert report.source == "model" and any("rows read from" in i for i in report.issues)


def _page(n, lines):
    return f"<!-- PAGE_START: {n} -->\n" + "\n".join(lines) + f"\n<!-- PAGE_END: {n} -->"


def test_the_outline_lists_each_heading_once_with_its_first_page():
    pages = [_page(1, ["# Executive Summary", "table"]), _page(2, ["text"]),
             _page(3, ["# Detailed Observations", "## ii. Title"]), _page(4, ["## ii. Title", "x"])]
    assert vlm.outline("\n\n".join(pages)).splitlines() == [
        "p1: Executive Summary", "p3: Detailed Observations", "p3: ii. Title (and on 1 later pages)"]


def test_index_windows_carry_the_outline_of_the_whole_report(monkeypatch):
    monkeypatch.setattr(vlm, "PROMPT_OVERHEAD_TOKENS", 100)
    monkeypatch.setattr(vlm, "CONTEXT_MARGIN_TOKENS", 10)
    text = transcript_of(60).replace("## Page 40", "# Detailed Observations")
    structurer, backend = structurer_for(long_responder([]), context_tokens=16384 + 7000)
    structurer.structure(text)
    windows = [c["prompt"] for c in backend.calls if "TASK: index the findings" in c["prompt"]]
    assert len(windows) > 1 and all("p40: Detailed Observations" in w for w in windows)


def test_the_index_reads_only_the_detailed_section_once_the_model_says_where_it_starts(monkeypatch):
    monkeypatch.setattr(vlm, "PROMPT_OVERHEAD_TOKENS", 100)
    monkeypatch.setattr(vlm, "CONTEXT_MARGIN_TOKENS", 10)
    text = transcript_of(60).replace("## Page 40", "# Detailed Observations")
    findings = [{"finding_id": str(i), "title": f"Finding {i}", "start_page": 40 + 2 * i, "end_page": 41 + 2 * i}
                for i in range(8)]
    structurer, backend = structurer_for(long_responder(findings, detailed_start=40), context_tokens=16384 + 7000)
    data, reports = structurer.structure(text)
    seen = set()
    for call in backend.calls:
        if "TASK: index the findings" in call["prompt"]:
            seen |= set(page_numbers(call["prompt"].split("<transcript>")[1].split("</transcript>")[0]))
    assert min(seen) == 40 and max(seen) == 60
    assert len(data["detailed_observations"]) == 8
    index_report = next(r for r in reports if r.name == "findings index")
    assert "detailed findings read from page 40" in index_report.issues


def test_a_window_of_numbered_rows_that_comes_back_empty_is_asked_again(monkeypatch):
    monkeypatch.setattr(vlm, "SUMMARY_ROWS_WINDOW_TOKENS", 100_000)
    pages = []
    for n in range(1, 31):
        rows = "\n".join(f"| {10 * n + i} | asset | Title {10 * n + i} | Low |" for i in range(3))
        pages.append(f"<!-- PAGE_START: {n} -->\n## Page {n}\n\n{rows}\n\n<!-- PAGE_END: {n} -->")
    text = "\n\n".join(pages)
    asked = {"empty": 0}

    def respond(prompt, image, json_schema):
        if "TASK: extract the executive summary" in prompt and "read separately" not in prompt:
            return Generation(text="{", truncated=True)
        if "TASK: extract the executive summary" in prompt:
            return json.dumps(filled(["executive_summary"]))
        if "TASK: extract the summary table rows" in prompt:
            if "cannot be empty" not in prompt:
                asked["empty"] += 1
                return json.dumps({"summary_table": []})        # the model misses the table the first time
            rows = [schema.conform({"sr_no": 1, "title": "Row"}, schema.template()["executive_summary"]["summary_table"][0])]
            return json.dumps({"summary_table": rows})
        if "TASK: locate the detailed findings section" in prompt:
            return json.dumps({"detailed_start_page": 25})
        if "TASK: index the findings" in prompt:
            return json.dumps({"findings": []})
        task = re.search(r"TASK: extract the ([^\n]+)", prompt).group(1)
        return json.dumps(filled(next(k for name, k, _ in vlm.SECTIONS if name == task)))

    monkeypatch.setattr(vlm, "PROMPT_OVERHEAD_TOKENS", 100)
    monkeypatch.setattr(vlm, "CONTEXT_MARGIN_TOKENS", 10)
    structurer, backend = structurer_for(respond, context_tokens=16384 + 40000)
    summary, issues = structurer._read_long_summary(text, [{"start_page": 25}])
    assert asked["empty"] >= 1 and len(summary["summary_table"]) >= 1
    assert any("asked again" in i for i in issues)
