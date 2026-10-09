from report_to_json import grounding

TRANSCRIPT = """Released 18-06-2026. Audit from 27-05-2026 to 05-06-2026.
Contact hr@miroxindia.
com   URL https://x.example.com/login
## 14.1 Broken Authentication
Severity: High. CWE-ID: 287. Impact is high.
"""


def run(node, text=TRANSCRIPT):
    return grounding.ground(node, text), node


def test_placeholders_are_nulled_unless_the_document_says_them():
    drops, node = run({"criticality": "string", "exclusions": ["string"], "note": "Not answerable"})
    assert node == {"criticality": None, "exclusions": [None], "note": None} or node["criticality"] is None
    assert {d["path"] for d in drops} >= {"criticality"}
    drops, node = run({"criticality": "Not specified"}, "Criticality: Not specified")
    assert node["criticality"] == "Not specified" and not drops


def test_scores_and_levels_need_a_label_and_the_value_in_the_text():
    node = {"cvss_score": 9.8, "reported_epss_score": 0.99, "impact_level": "Major", "likelihood_level": "Easy"}
    drops, node = run(node)
    assert all(v is None for v in node.values())
    assert len(drops) == 4
    drops, node = run({"cvss_score": 9.8, "cvss_vector": "CVSS:3.1/AV:N"}, "CVSS 9.8 CVSS:3.1/AV:N")
    assert node["cvss_score"] == 9.8 and node["cvss_vector"] and not drops


def test_dates_match_any_written_form():
    node = {"report_release_date": "2026-06-18", "observation_date": "2023-01-01",
            "audit_period": {"from": "2026-05-27", "to": "2026-06-05"}}
    drops, node = run(node)
    assert node["report_release_date"] == "2026-06-18" and node["audit_period"]["to"] == "2026-06-05"
    assert node["observation_date"] is None and len(drops) == 1
    assert grounding.dates_in("05th June 2026 and Jun 5, 2026") == {grounding._dt.date(2026, 6, 5)}


def test_cwe_cve_and_severity():
    node = {"severity": "Critical", "cwe": ["CWE-287: Improper Authentication", "CWE-284"], "cve_id": ["CVE-2020-1"]}
    drops, node = run(node)
    assert node["severity"] is None
    assert node["cwe"] == ["CWE-287: Improper Authentication"] and node["cve_id"] == []
    assert len(drops) == 3


def test_verbatim_identifiers_ignore_line_wrapping_but_not_invention():
    node = {"email": "hr@miroxindia.com", "url": "https://x.example.com/login", "internal_ip": "10.0.0.1"}
    drops, node = run(node)
    assert node["email"] and node["url"] and node["internal_ip"] is None and len(drops) == 1


def test_drop_paths_are_prefixed_and_indexed():
    drops = grounding.ground({"a": [{"severity": "Critical"}]}, TRANSCRIPT, "detailed_observations[2]")
    assert drops[0]["path"] == "detailed_observations[2].a[0].severity"


def test_finding_severity_needs_a_label_beside_it():
    text = "Severity: High\nThe High availability setup is fine. Medium effort."
    assert grounding.ground({"severity": "High"}, text, "detailed_observations[0]") == []
    drops = grounding.ground({"severity": "Medium"}, text, "detailed_observations[0]")
    assert len(drops) == 1
    assert grounding.ground({"severity": "Medium"}, "| Severity |\n| a |\n| Medium |") == []


def test_scalar_lists_are_capped_in_the_schema():
    from report_to_json import schema
    cwe = schema.item_schema("detailed_observations")["properties"]["cwe"]
    assert cwe["maxItems"] == schema.MAX_SCALAR_LIST_ITEMS


def test_prose_is_nulled_only_when_it_shares_almost_nothing_with_the_document():
    source = ("The application accepts requests without checking the session token so an attacker "
              "can read other users data directly from the server response body")
    invented = "Inadequate validation of uploaded file types allows remote attackers to place hostile scripts"
    paraphrase = ("The application accepts requests without checking the session token, which lets "
                  "attackers read the data of other users")
    node = {"likely_root_cause": invented, "impact": paraphrase, "title": "Session token"}
    drops = grounding.ground(node, source)
    assert [d["path"] for d in drops] == ["likely_root_cause"]
    assert node["impact"] == paraphrase and node["title"] == "Session token"


ROWS = """| S.No | Vulnerability | Severity | Status |
| 1 | Clickjacking Attack | Info | Closed |
| 2 | Version Disclosure | Low | Closed |
## 2 Version Disclosure
Status: Open
"""


def test_summary_rows_are_checked_against_their_own_row():
    table = {"summary_table": [{"title": "Clickjacking Attack", "severity": "Low", "status": "Closed",
                                "new_or_repeat": "Repeat"}]}
    drops = grounding.ground(table, ROWS, "executive_summary")
    row = table["summary_table"][0]
    # Low appears in the document, but not on this row; Repeat appears nowhere
    assert row["severity"] is None and row["new_or_repeat"] is None and row["status"] == "Closed"
    assert len(drops) == 2


def test_a_finding_with_its_own_section_is_not_confined_to_a_table_row():
    finding = {"title": "Version Disclosure", "status": "Open"}
    assert grounding.ground(finding, ROWS, "detailed_observations[1]") == []
    rowonly = {"title": "Clickjacking Attack", "status": "Open"}
    assert len(grounding.ground(rowonly, ROWS, "detailed_observations[0]")) == 1


def test_identifiers_inside_longer_text_must_appear_in_the_document():
    source = "Affected: https://app.example.test/login and 10.1.2.3 are in scope"
    node = {"affected_asset": ["https://app.example.test/login", "https://api.example.com", "10.9.9.9"],
            "reference": "See https://owasp.org/www-community/attacks/Clickjacking"}
    drops = grounding.ground(node, source)
    assert node["affected_asset"] == ["https://app.example.test/login", None, None]
    assert node["reference"] is None and len(drops) == 3


def test_remarks_about_the_document_are_not_values():
    node = {"exclusions": ["No exclusions stated in the report."], "other": ["Not applicable"]}
    drops = grounding.ground(node, "Exclusions: Not applicable")
    assert node["exclusions"] == [None] and node["other"] == ["Not applicable"] and len(drops) == 1


def _page(n, lines):
    return f"<!-- PAGE_START: {n} -->\n" + "\n".join(lines) + f"\n<!-- PAGE_END: {n} -->\n"


def test_running_headers_are_not_values_but_repeated_titles_are():
    pages = ""
    for n in range(1, 13):
        body = [f"Body line {i} of page {n}" for i in range(8)]
        pages += _page(n, ["Private & Confidential", f"Mirox Web VAPT Report {n}", *body,
                           "Broken Authentication Vulnerability", "More body text", "Even more body text",
                           "Private & Confidential", "Mirox Web VAPT Report"])
    pages += _page(13, ["Broken Authentication Vulnerability", "Text"])
    headers = grounding.header_trigrams(pages)
    node = {"reference": "Private & Confidential Mirox Web VAPT Report 19",
            "title": "Broken Authentication Vulnerability", "other": "Body of text here"}
    drops = grounding.ground(node, pages, headers=headers)
    assert node["reference"] is None and len(drops) == 1
    assert node["title"] == "Broken Authentication Vulnerability" and node["other"] == "Body of text here"


def test_redaction_and_totals_need_a_statement_in_the_document():
    assert grounding.ground({"redacted": "No"}, "Evidence shown") != []
    assert grounding.ground({"redacted": "No"}, "Evidence shown, sensitive data redacted: No") == []
    stated = "TOTAL ISSUES | CRITICAL | HIGH\n| 4 | - | 1 |"
    assert grounding.ground({"total_findings": 4}, stated) == []
    assert len(grounding.ground({"total_findings": 12}, stated + "\n" + "Filler text about the engagement. " * 10 + "\n12 Improper Validation Closed")) == 1
    assert grounding.ground({"total_findings": 7}, "We identified 7 vulnerabilities in total") == []


def test_verbatim_phrases_must_mostly_come_from_the_document():
    source = "Affected: Trace An Object Web Application"
    node = {"affected_asset": ["Trace An Object Web Application", "All application endpoints"]}
    grounding.ground(node, source)
    assert node["affected_asset"] == ["Trace An Object Web Application", None]
