import asyncio
import uuid
import random
import hashlib
from datetime import datetime, timedelta, timezone, date
import sys
import os
import json

# Ensure app is in Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import select, delete, text
from app.database import AsyncSessionLocal, engine
from app.models.agency import Agency
from app.models.user import User, Role, UserRole, UserSession
from app.models.report import (
    Report, ReportMetadata, FileValidation, FileStorage, ReportsData,
    DetailedObservation, UploadStatus, ObservationSeverity,
    ObservationStatus, ObservationImpact, ObservationLikelihood,
    ObservationNewRepeat
)
from app.models.audit import AuditLog, SecurityEvent
from app.models.clustering import (
    ClusteringRun, VulnerabilityClusterMember, ReportClusterMember,
    ClusteringType, RunStatus
)
from app.models.trend_analysis import TrendAnalysisRun, TrendRunStatus
from app.utils.security import hash_password

# ---------------------------------------------------------
# MASTER DATA CATALOGS
# ---------------------------------------------------------

AGENCIES_DATA = [
    # CERT-In Empanelled
    ("AG-CERT-001", "KPMG Cyber Security Services India", "CERT_IN_EMPANELLED", True, "cert-in@kpmg.co.in", "Rajiv Chandrasekhar", "9811023451", "New Delhi", "Delhi", "110001", "DL-REG-10492", "CERTIN/EMP/2023/014"),
    ("AG-CERT-002", "PwC India Risk Advisory Labs", "CERT_IN_EMPANELLED", True, "cyber.advisory@pwc.co.in", "Sunil Venkatesh", "9820034562", "Mumbai", "Maharashtra", "400051", "MH-REG-20384", "CERTIN/EMP/2023/028"),
    ("AG-CERT-003", "Deloitte Touche Cyber Risk Services", "CERT_IN_EMPANELLED", True, "infosec@deloitte.co.in", "Ananya Deshpande", "9845012398", "Bengaluru", "Karnataka", "560001", "KA-REG-30485", "CERTIN/EMP/2023/035"),
    ("AG-CERT-004", "Ernst & Young Cybersecurity Solutions", "CERT_IN_EMPANELLED", True, "ey.cyber@ey.co.in", "Vikram Rathore", "9810098712", "Gurugram", "Haryana", "122002", "HR-REG-40291", "CERTIN/EMP/2023/042"),
    ("AG-CERT-005", "SISA Information Security India", "CERT_IN_EMPANELLED", True, "compliance@sisa.co.in", "Dharshan Shanthamurthy", "9880012345", "Bengaluru", "Karnataka", "560025", "KA-REG-50211", "CERTIN/EMP/2023/055"),
    ("AG-CERT-006", "Kratikal Tech Cyber Defense Labs", "CERT_IN_EMPANELLED", True, "audit@kratikal.co.in", "Pavan Kushwaha", "9818045612", "Noida", "Uttar Pradesh", "201301", "UP-REG-60192", "CERTIN/EMP/2023/067"),
    ("AG-CERT-007", "Torrid Networks Security Research", "CERT_IN_EMPANELLED", True, "contact@torridnetworks.co.in", "Rohit Srivastava", "9811054321", "New Delhi", "Delhi", "110019", "DL-REG-70381", "CERTIN/EMP/2023/073"),
    ("AG-CERT-008", "Cyberops Infosec Research Centre", "CERT_IN_EMPANELLED", True, "security@cyberops.co.in", "Mukesh Choudhary", "9829012389", "Jaipur", "Rajasthan", "302015", "RJ-REG-80122", "CERTIN/EMP/2023/089"),
    ("AG-CERT-009", "Aujas Cybersecurity India Ltd", "CERT_IN_EMPANELLED", True, "vapt@aujas.co.in", "Srinivas Rao", "9845034567", "Bengaluru", "Karnataka", "560037", "KA-REG-90341", "CERTIN/EMP/2023/094"),
    ("AG-CERT-010", "Paramount Computer Systems India", "CERT_IN_EMPANELLED", True, "support@paramount.co.in", "Premchand Kurup", "9820067891", "Mumbai", "Maharashtra", "400093", "MH-REG-10928", "CERTIN/EMP/2023/102"),
    ("AG-CERT-011", "Network Intelligence India Pvt Ltd", "CERT_IN_EMPANELLED", True, "assessments@niiconsulting.co.in", "K. K. Mookhey", "9820078912", "Mumbai", "Maharashtra", "400013", "MH-REG-11823", "CERTIN/EMP/2023/118"),
    ("AG-CERT-012", "SecurEyes Solutions Cyber Division", "CERT_IN_EMPANELLED", True, "audit@secureyes.co.in", "Karmendra Kohli", "9880023456", "Bengaluru", "Karnataka", "560076", "KA-REG-12938", "CERTIN/EMP/2023/125"),
    ("AG-CERT-013", "Inspira Enterprise Risk Assessment", "CERT_IN_EMPANELLED", True, "cyber@inspiraenterprise.co.in", "Manoj Kanodia", "9821034567", "Mumbai", "Maharashtra", "400079", "MH-REG-13829", "CERTIN/EMP/2023/133"),
    ("AG-CERT-014", "Lucideus Tech (Safe Security)", "CERT_IN_EMPANELLED", True, "compliance@safe.security.co.in", "Saket Modi", "9811087654", "New Delhi", "Delhi", "110020", "DL-REG-14728", "CERTIN/EMP/2023/149"),
    ("AG-CERT-015", "Valency Networks Penetration Testing", "CERT_IN_EMPANELLED", True, "security@valencynetworks.co.in", "Prashant Phatak", "9822012345", "Pune", "Maharashtra", "411038", "MH-REG-15629", "CERTIN/EMP/2023/158"),

    # Government Agencies
    ("AG-GOV-001", "National Informatics Centre CERT (NIC-CERT)", "GOVERNMENT_AGENCY", True, "nic-cert@nic.in", "Dr. Neeta Verma", "01124305000", "New Delhi", "Delhi", "110003", "GOV-NIC-001", "GOV/CERTIN/2022/001"),
    ("AG-GOV-002", "National Critical Information Infrastructure Protection (NCIIPC)", "GOVERNMENT_AGENCY", True, "assessment@nciipc.gov.in", "Navin Kumar Singh", "01126101111", "New Delhi", "Delhi", "110066", "GOV-NCIIPC-002", "GOV/CERTIN/2022/002"),
    ("AG-GOV-003", "STQC Directorate IT Testing Centre", "GOVERNMENT_AGENCY", True, "it.testing@stqc.gov.in", "Alok Srivastava", "01124363089", "New Delhi", "Delhi", "110003", "GOV-STQC-003", "GOV/CERTIN/2022/003"),
    ("AG-GOV-004", "Centre for Development of Advanced Computing (C-DAC)", "GOVERNMENT_AGENCY", True, "cybersec@cdac.in", "E. Magesh", "02025704100", "Pune", "Maharashtra", "411007", "GOV-CDAC-004", "GOV/CERTIN/2022/004"),
    ("AG-GOV-005", "CERT-In Incident Response & Audit Directorate", "GOVERNMENT_AGENCY", True, "incident@cert-in.org.in", "Dr. Sanjay Bahl", "01124368544", "New Delhi", "Delhi", "110003", "GOV-CERTIN-005", "GOV/CERTIN/2022/005"),

    # Internal Audit Teams
    ("AG-INT-001", "State Bank of India Cyber Defence Centre", "INTERNAL_AUDIT_TEAM", False, "ciso.office@sbi.co.in", "S. Ramesh Babu", "02227560001", "Navi Mumbai", "Maharashtra", "400614", "INT-SBI-01", None),
    ("AG-INT-002", "HDFC Bank Information Security Group", "INTERNAL_AUDIT_TEAM", False, "infosec.audit@hdfcbank.com", "Sameer Ratolikar", "02266521000", "Mumbai", "Maharashtra", "400013", "INT-HDFC-02", None),
    ("AG-INT-003", "ICICI Bank Cyber Threat Intelligence Team", "INTERNAL_AUDIT_TEAM", False, "cyberthreat@icicibank.com", "B. S. Rao", "02226531414", "Mumbai", "Maharashtra", "400051", "INT-ICICI-03", None),
    ("AG-INT-004", "UIDAI Aadhaar Security & Compliance Cell", "INTERNAL_AUDIT_TEAM", False, "security.compliance@uidai.gov.in", "Dr. Saurabh Garg", "08023555555", "Bengaluru", "Karnataka", "560001", "INT-UIDAI-04", None),
    ("AG-INT-005", "IRCTC Enterprise Cyber Security Wing", "INTERNAL_AUDIT_TEAM", False, "infosec@irctc.co.in", "Manoj Kumar", "01123311263", "New Delhi", "Delhi", "110001", "INT-IRCTC-05", None),
    ("AG-INT-006", "Reserve Bank of India Cyber Security Unit", "INTERNAL_AUDIT_TEAM", False, "cyberaudit@rbi.org.in", "Deepak Kumar", "02222601000", "Mumbai", "Maharashtra", "400001", "INT-RBI-06", None),

    # Private Auditors
    ("AG-PVT-001", "Mandiant Threat Intelligence & Red Team", "PRIVATE_AUDITOR", False, "india.redteam@mandiant.com", "Stuart McKenzie", "08040001111", "Bengaluru", "Karnataka", "560103", "PVT-MND-01", None),
    ("AG-PVT-002", "CrowdStrike Cyber Services India", "PRIVATE_AUDITOR", False, "services.in@crowdstrike.com", "Shawn Henry", "02067002222", "Pune", "Maharashtra", "411014", "PVT-CRW-02", None),
    ("AG-PVT-003", "Rapid7 Cybersecurity Research Labs", "PRIVATE_AUDITOR", False, "research.apac@rapid7.com", "Corey Thomas", "08061234567", "Bengaluru", "Karnataka", "560008", "PVT-RPD-03", None),
    ("AG-PVT-004", "Bishop Fox Offensive Security Assessments", "PRIVATE_AUDITOR", False, "consulting@bishopfox.com", "Vincent Liu", "08049876543", "Bengaluru", "Karnataka", "560017", "PVT-BSH-04", None),
    ("AG-PVT-005", "NCC Group Information Security Advisory", "PRIVATE_AUDITOR", False, "india.office@nccgroup.com", "Mike Maddison", "04068123456", "Hyderabad", "Telangana", "500081", "PVT-NCC-05", None),

    # Third Party Assessors
    ("AG-TPA-001", "TÜV SÜD South Asia Cyber Assurance", "THIRD_PARTY_ASSESSOR", False, "cyber.assurance@tuvsud.com", "Niranjan Nadkarni", "02266845555", "Mumbai", "Maharashtra", "400072", "TPA-TUV-01", None),
    ("AG-TPA-002", "BSI Group India Information Security", "THIRD_PARTY_ASSESSOR", False, "infosec.india@bsigroup.com", "Venkatraman G.", "01126929000", "New Delhi", "Delhi", "110025", "TPA-BSI-02", None),
    ("AG-TPA-003", "DNV GL Business Cyber Risk Assurance", "THIRD_PARTY_ASSESSOR", False, "risk.india@dnvgl.com", "Percy Lakdawalla", "08040821000", "Bengaluru", "Karnataka", "560045", "TPA-DNV-03", None),
    ("AG-TPA-004", "Bureau Veritas Cybersecurity Services", "THIRD_PARTY_ASSESSOR", False, "cybersecurity@bureauveritas.co.in", "Amit Ghosh", "04428191234", "Chennai", "Tamil Nadu", "600002", "TPA-BVR-04", None),
]

ADDITIONAL_USERS = [
    # Username, Email, Full Name, Role Name
    ("ciso_rajesh", "ciso.rajesh@cyberaudit.local", "Rajesh Sharma", "ADMIN"),
    ("admin_sneha", "admin.sneha@cyberaudit.local", "Sneha Kulkarni", "ADMIN"),
    ("auditor_vikram", "auditor.vikram@cyberaudit.local", "Vikram Malhotra", "AUDITOR"),
    ("auditor_ananya", "auditor.ananya@cyberaudit.local", "Ananya Iyer", "AUDITOR"),
    ("auditor_rohit", "auditor.rohit@cyberaudit.local", "Rohit Verma", "AUDITOR"),
    ("auditor_pooja", "auditor.pooja@cyberaudit.local", "Pooja Nair", "AUDITOR"),
    ("auditor_karthik", "auditor.karthik@cyberaudit.local", "Karthik Sundaram", "AUDITOR"),
    ("auditor_arjun", "auditor.arjun@cyberaudit.local", "Arjun Deshmukh", "AUDITOR"),
    ("auditor_meera", "auditor.meera@cyberaudit.local", "Meera Sen", "AUDITOR"),
    ("reviewer_amit", "reviewer.amit@cyberaudit.local", "Amitabh Sen", "REVIEWER"),
    ("reviewer_divya", "reviewer.divya@cyberaudit.local", "Divya Kapoor", "REVIEWER"),
    ("reviewer_suresh", "reviewer.suresh@cyberaudit.local", "Suresh Patel", "REVIEWER"),
    ("reviewer_neha", "reviewer.neha@cyberaudit.local", "Neha Chawla", "REVIEWER"),
    ("reviewer_alok", "reviewer.alok@cyberaudit.local", "Alok Gupta", "REVIEWER"),
]

REPORT_TEMPLATES = [
    ("CoreBanking_Finacle_VAPT_Assessment", "Core Banking Solution (Finacle v11.4)", "VAPT"),
    ("NPCI_Unified_Payments_Interface_Switch_Audit", "NPCI UPI Switching Infrastructure", "Compliance Audit"),
    ("UIDAI_Aadhaar_Enrolment_Client_Security_Review", "Aadhaar Enrolment Client Desktop App", "Source Code Review"),
    ("AIIMS_Digital_Health_Mission_EHR_VAPT", "National Digital Health Mission Portal", "VAPT"),
    ("IncomeTax_eFiling_Portal_Annual_Assessment", "Income Tax e-Filing v2.0 Platform", "Cloud Architecture Review"),
    ("RBI_Regulatory_Payment_Aggregator_Compliance", "Merchant Payment Gateway Integration", "Regulatory Audit"),
    ("DigiLocker_API_Microservices_Security_Evaluation", "DigiLocker Issuer & Requester APIs", "API Security Assessment"),
    ("CoWIN_Vaccination_Management_VAPT", "CoWIN Citizen & Admin Microservices", "VAPT"),
    ("IRCTC_NextGen_eTicketing_SourceCode_Review", "IRCTC PRS Real-Time Ticketing Engine", "Source Code Review"),
    ("StateBank_YONO_Mobile_Application_VAPT", "YONO Enterprise Mobile Banking", "Mobile App VAPT"),
    ("NSE_Clearing_Platform_Network_Architecture", "NSE High-Frequency Clearing Network", "Network Architecture Review"),
    ("PassportSeva_Kendra_Perimeter_Security_Audit", "Passport Seva Core Perimeter Firewalls", "Perimeter Audit"),
    ("MeitY_Gov_Cloud_MeghRaj_Compliance", "MeghRaj Government Cloud Enclave", "ISO 27001 Compliance"),
    ("ISRO_Telemetry_GroundStation_AirGap_Review", "Telemetry Air-Gapped Network Segment", "Air-Gap Assessment"),
    ("SmartCities_Mission_IoT_Gateway_VAPT", "Municipal SCADA & IoT Sensor Hubs", "IoT & SCADA Assessment"),
    ("EPFO_ProvidentFund_MemberPortal_Security", "EPFO Unified Unified Member Portal", "VAPT"),
    ("GSTN_GoodsServicesTax_Network_Infra_Audit", "GST System Central Data Center", "Infrastructure Review"),
    ("Customs_ICEGATE_Electronic_Data_Interchange", "ICEGATE Customs Clearance Gateway", "Perimeter Audit"),
    ("BharatBillPay_National_Switch_VAPT", "Bharat Bill Payment System (BBPS)", "VAPT"),
    ("FASTag_Electronic_Toll_Collection_System", "NETC FASTag Acquirer Switching Host", "API Security Assessment"),
    ("National_Health_Authority_Ayushman_Bharat", "PM-JAY Hospital Transaction Management", "VAPT"),
    ("Department_of_Posts_IndiaPost_Core_Banking", "Department of Posts Financial Services", "Compliance Audit"),
    ("ONDC_Open_Network_Digital_Commerce_Gateway", "ONDC Gateway & Protocol Adaptors", "API Security Assessment"),
    ("Defence_Research_DRDO_Intranet_Penetration_Test", "DRDO R&D Classified Intranet", "Red Team Assessment"),
    ("PowerGrid_National_Load_Despatch_SCADA_Review", "POSOCO Grid SCADA Telemetry System", "SCADA Security Review"),
]

VULN_TEMPLATES = [
    # 1. SQL Injection (Critical)
    {
        "title": "SQL Injection in User Authentication Endpoint",
        "cwe": ["CWE-89"],
        "cve": ["CVE-2023-38606"],
        "severity": ObservationSeverity.CRITICAL,
        "impact_level": ObservationImpact.MAJOR,
        "likelihood_level": ObservationLikelihood.EASY,
        "cvss_score": 9.8,
        "cvss_vector": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
        "reported_epss_score": 0.8920,
        "description": "Unsanitized user input in the username parameter of the authentication endpoint allows an unauthenticated remote attacker to manipulate backend SQL queries, bypass authentication filters, and dump database records.",
        "impact": "Complete compromise of backend database confidentiality, unauthorized authentication as system administrator, and potential remote code execution via database file write procedures.",
        "root_cause": "Dynamic SQL query concatenation within legacy authentication stored procedures rather than parameterized queries.",
        "recommendation": "Migrate all database queries to parameterized prepared statements using SQLAlchemy/Hibernate ORM and implement strict input validation on login credentials.",
        "preconditions": "Network access to login portal; no WAF blocking SQL keywords.",
        "severity_rationale": "Allows unauthenticated remote data extraction and administrative access.",
        "category": "Injection",
    },
    # 2. RCE via Deserialization (Critical)
    {
        "title": "Remote Code Execution via Insecure Java Deserialization",
        "cwe": ["CWE-502"],
        "cve": ["CVE-2024-21626"],
        "severity": ObservationSeverity.CRITICAL,
        "impact_level": ObservationImpact.MAJOR,
        "likelihood_level": ObservationLikelihood.EASY,
        "cvss_score": 9.8,
        "cvss_vector": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
        "reported_epss_score": 0.9450,
        "description": "The enterprise application processes untrusted binary payloads via standard Java ObjectInputStream deserialization without enforcing class-whitelisting or validation filters.",
        "impact": "Arbitrary command execution on host operating system with privileges of application service account.",
        "root_cause": "Use of unsafe deserialization libraries (CommonsCollections gadget chain) on unauthenticated endpoints.",
        "recommendation": "Replace Java native serialization with safe structured formats like JSON/Protocol Buffers, or implement SerialFilter with strict whitelists.",
        "preconditions": "Direct HTTP access to message broker or queue listener.",
        "severity_rationale": "Unauthenticated remote execution leading to full host control.",
        "category": "Deserialization",
    },
    # 3. Server-Side Request Forgery (Critical)
    {
        "title": "Server-Side Request Forgery (SSRF) in Webhook Dispatcher",
        "cwe": ["CWE-918"],
        "cve": ["CVE-2023-22515"],
        "severity": ObservationSeverity.CRITICAL,
        "impact_level": ObservationImpact.MAJOR,
        "likelihood_level": ObservationLikelihood.MODERATE,
        "cvss_score": 9.1,
        "cvss_vector": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:L/A:N",
        "reported_epss_score": 0.7810,
        "description": "The webhook configuration module allows users to supply custom callback endpoints. The backend HTTP client issues outbound requests without filtering private IP addresses or link-local cloud metadata services.",
        "impact": "Attacker can query AWS/Azure instance metadata endpoints (169.254.169.254) to exfiltrate IAM role credentials, pivot to internal VPC services, and bypass perimeter firewalls.",
        "root_cause": "Failure to validate and sanitize user-supplied URLs against private IP CIDR ranges before issuing backend requests.",
        "recommendation": "Deploy a dedicated proxy for outbound webhook traffic, block requests to private IP ranges (RFC 1918, RFC 3927), and enforce DNS resolution checks before connection.",
        "preconditions": "Ability to configure custom webhook or callback URLs.",
        "severity_rationale": "High likelihood of compromising cloud credentials and internal infrastructure.",
        "category": "Server-Side Request Forgery",
    },
    # 4. Broken Object Level Authorization (High)
    {
        "title": "Broken Object Level Authorization (BOLA / IDOR) in Customer Accounts API",
        "cwe": ["CWE-639", "CWE-284"],
        "cve": None,
        "severity": ObservationSeverity.HIGH,
        "impact_level": ObservationImpact.MAJOR,
        "likelihood_level": ObservationLikelihood.EASY,
        "cvss_score": 8.6,
        "cvss_vector": "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:N",
        "reported_epss_score": 0.3540,
        "description": "The REST endpoint `/api/v2/customer/{customer_id}/statements` fails to verify whether the authenticated session user has ownership rights over the requested customer account record.",
        "impact": "Any authenticated user can enumerate customer IDs sequentially to view, download, and alter sensitive banking statements of other users.",
        "root_cause": "Missing tenant and object-level permission check in API route handler.",
        "recommendation": "Enforce object-level access control checks within business logic layer: verify session user_id owns the requested resource before returning records.",
        "preconditions": "Valid authenticated user session.",
        "severity_rationale": "Widespread horizontal privilege escalation and customer financial data leakage.",
        "category": "Broken Access Control",
    },
    # 5. Stored XSS (High)
    {
        "title": "Stored Cross-Site Scripting (XSS) in Citizen Feedback Form",
        "cwe": ["CWE-79"],
        "cve": ["CVE-2023-24488"],
        "severity": ObservationSeverity.HIGH,
        "impact_level": ObservationImpact.MODERATE,
        "likelihood_level": ObservationLikelihood.EASY,
        "cvss_score": 8.0,
        "cvss_vector": "CVSS:3.1/AV:N/AC:L/PR:L/UI:R/S:C/C:H/I:H/A:N",
        "reported_epss_score": 0.4200,
        "description": "The citizen feedback submission allows HTML markup in the comments field. This payload is stored in the database and rendered without contextual encoding in the administrative review console.",
        "impact": "Execution of arbitrary JavaScript within the session context of administrative reviewers, enabling session token theft and privilege escalation.",
        "root_cause": "Improper output encoding when rendering user-generated content in the administrative dashboard.",
        "recommendation": "Contextually encode all user inputs before rendering in HTML templates, and implement a strict Content-Security-Policy (CSP) restricting inline script execution.",
        "preconditions": "Authenticated citizen user account.",
        "severity_rationale": "High impact due to potential targeting of administrative accounts.",
        "category": "Cross-Site Scripting",
    },
    # 6. Hardcoded Secrets (High)
    {
        "title": "Hardcoded Cloud Production Secrets in Frontend Client Bundle",
        "cwe": ["CWE-798", "CWE-200"],
        "cve": None,
        "severity": ObservationSeverity.HIGH,
        "impact_level": ObservationImpact.MAJOR,
        "likelihood_level": ObservationLikelihood.EASY,
        "cvss_score": 8.2,
        "cvss_vector": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:L/A:N",
        "reported_epss_score": 0.6210,
        "description": "Production AWS S3 Access Keys, secret keys, and Firebase administrative credentials were discovered embedded inside publicly accessible minified JavaScript bundles.",
        "impact": "Public access to production document storage buckets, allowing unauthorized download and modification of confidential audit reports and citizen identity files.",
        "root_cause": "Inadvertent inclusion of backend environment variables during frontend build and bundling phase.",
        "recommendation": "Immediately revoke and rotate compromised credentials; remove credentials from source code; use IAM instance roles and secure backend secret managers (Vault/AWS Secrets Manager).",
        "preconditions": "Public access to web application homepage.",
        "severity_rationale": "Direct exposure of production cloud credentials to any web visitor.",
        "category": "Sensitive Data Exposure",
    },
    # 7. Path Traversal (High)
    {
        "title": "Path Traversal Leading to Arbitrary System File Read",
        "cwe": ["CWE-22"],
        "cve": ["CVE-2024-1709"],
        "severity": ObservationSeverity.HIGH,
        "impact_level": ObservationImpact.MAJOR,
        "likelihood_level": ObservationLikelihood.MODERATE,
        "cvss_score": 7.8,
        "cvss_vector": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N",
        "reported_epss_score": 0.3120,
        "description": "The file download endpoint `/api/export/report?filename=...` fails to validate path traversal sequences like `../../../../etc/passwd` or `..\\..\\Windows\\System32`.",
        "impact": "Unauthorized reading of sensitive configuration files, system user records, encryption keys, and source code files.",
        "root_cause": "Direct concatenation of user-supplied filename parameter into file system read functions without path canonicalization.",
        "recommendation": "Resolve absolute canonical paths and verify the requested file resides strictly within the intended export directory. Disallow path traversal characters.",
        "preconditions": "Network access to export endpoint.",
        "severity_rationale": "Allows reading arbitrary OS files and application secrets.",
        "category": "Path Traversal",
    },
    # 8. Missing Multi-Factor Authentication (High)
    {
        "title": "Missing Multi-Factor Authentication (MFA) for Administrative Portals",
        "cwe": ["CWE-308", "CWE-287"],
        "cve": None,
        "severity": ObservationSeverity.HIGH,
        "impact_level": ObservationImpact.MAJOR,
        "likelihood_level": ObservationLikelihood.MODERATE,
        "cvss_score": 7.5,
        "cvss_vector": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N",
        "reported_epss_score": 0.1850,
        "description": "The administrative portal permits administrative logins with single-factor username and password credentials without requiring TOTP, FIDO2, or hardware token authentication.",
        "impact": "Increases susceptibility to credential stuffing, password spraying, and phishing attacks targeting administrator accounts.",
        "root_cause": "Lack of mandatory MFA enforcement policy for privileged user roles.",
        "recommendation": "Enforce mandatory Multi-Factor Authentication (MFA) via TOTP or WebAuthn/FIDO2 hardware tokens for all privileged administrative accounts.",
        "preconditions": "Administrative credentials obtained via phishing or leak.",
        "severity_rationale": "High privilege accounts lack modern defense-in-depth safeguards.",
        "category": "Authentication",
    },
    # 9. Insecure Direct Object References in Invoices (Medium)
    {
        "title": "Insecure Direct Object Reference in Invoices and Billing Records",
        "cwe": ["CWE-639"],
        "cve": None,
        "severity": ObservationSeverity.MEDIUM,
        "impact_level": ObservationImpact.MODERATE,
        "likelihood_level": ObservationLikelihood.EASY,
        "cvss_score": 6.5,
        "cvss_vector": "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N",
        "reported_epss_score": 0.0980,
        "description": "The invoice retrieval API endpoint `/api/billing/invoice/{invoice_id}` uses sequential integers and does not restrict invoice access to the issuing organization.",
        "impact": "Competitors or unauthorized clients can scrape financial volume, transaction values, and client lists.",
        "root_cause": "Predictable numeric resource keys coupled with insufficient authorization checks.",
        "recommendation": "Use random UUIDv4 identifiers for billing documents and enforce strict entity ownership checks before serving files.",
        "preconditions": "Authenticated account with normal billing permissions.",
        "severity_rationale": "Financial records of third-party clients are exposed without authorization.",
        "category": "Broken Access Control",
    },
    # 10. CORS Misconfiguration (Medium)
    {
        "title": "CORS Misconfiguration Permitting Arbitrary Origins with Credentials",
        "cwe": ["CWE-942"],
        "cve": None,
        "severity": ObservationSeverity.MEDIUM,
        "impact_level": ObservationImpact.MODERATE,
        "likelihood_level": ObservationLikelihood.MODERATE,
        "cvss_score": 6.5,
        "cvss_vector": "CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:H/I:N/A:N",
        "reported_epss_score": 0.0540,
        "description": "The API server reflects the client's `Origin` request header in the `Access-Control-Allow-Origin` response header while setting `Access-Control-Allow-Credentials: true`.",
        "impact": "Malicious websites visited by logged-in users can execute background requests to the API and read response data containing confidential profile details.",
        "root_cause": "Improper CORS middleware configuration reflecting the Origin header indiscriminately.",
        "recommendation": "Restrict CORS allowed origins to an explicit whitelist of trusted enterprise domains; never mirror arbitrary Origin headers when credentials are true.",
        "preconditions": "User visits attacker's webpage while holding an active authenticated session.",
        "severity_rationale": "Bypasses browser Same-Origin Policy for sensitive endpoints.",
        "category": "CORS",
    },
    # 11. Sensitive Data in Error Traces (Medium)
    {
        "title": "Sensitive Information Disclosure via Verbose Stack Traces",
        "cwe": ["CWE-209", "CWE-200"],
        "cve": None,
        "severity": ObservationSeverity.MEDIUM,
        "impact_level": ObservationImpact.MINOR,
        "likelihood_level": ObservationLikelihood.EASY,
        "cvss_score": 5.3,
        "cvss_vector": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N",
        "reported_epss_score": 0.0410,
        "description": "When unhandled exceptions occur in backend REST endpoints, the server returns full Python/Node stack traces containing internal directory structures, library versions, and database queries.",
        "impact": "Assists attackers in fingerprinting technology stacks and identifying specific vulnerable third-party dependencies.",
        "root_cause": "Debug mode enabled or missing generic exception handler in production environment.",
        "recommendation": "Disable verbose debug mode in production; implement global error handling that returns sanitized generic error messages and correlation IDs.",
        "preconditions": "Submitting malformed input to trigger unhandled exception.",
        "severity_rationale": "Leads to reconnaissance advantage for external adversaries.",
        "category": "Information Disclosure",
    },
    # 12. Rate Limiting Missing on OTP (High)
    {
        "title": "Absence of Rate Limiting on SMS OTP Verification Service",
        "cwe": ["CWE-307"],
        "cve": None,
        "severity": ObservationSeverity.HIGH,
        "impact_level": ObservationImpact.MAJOR,
        "likelihood_level": ObservationLikelihood.EASY,
        "cvss_score": 7.7,
        "cvss_vector": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N",
        "reported_epss_score": 0.2850,
        "description": "The 6-digit OTP verification endpoint allows unlimited submission attempts without applying rate limits, IP throttling, or account lockout mechanisms.",
        "impact": "Attackers can brute-force 6-digit OTP codes in under 15 minutes using multithreaded requests to take over user accounts.",
        "root_cause": "Missing rate-limiting middleware on authentication verification endpoints.",
        "recommendation": "Limit OTP verification to a maximum of 5 attempts before invalidating the OTP code and enforce IP-based rate limiting via Redis token bucket.",
        "preconditions": "Known phone number or citizen ID of target victim.",
        "severity_rationale": "Enables reliable account takeover via automated brute-force scripts.",
        "category": "Brute Force",
    },
    # 13. Weak TLS Configuration (Low)
    {
        "title": "Deprecated TLS 1.0/1.1 Protocols and Weak Ciphers Enabled",
        "cwe": ["CWE-326"],
        "cve": None,
        "severity": ObservationSeverity.LOW,
        "impact_level": ObservationImpact.MINOR,
        "likelihood_level": ObservationLikelihood.HARD,
        "cvss_score": 3.7,
        "cvss_vector": "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:N/A:N",
        "reported_epss_score": 0.0090,
        "description": "The reverse proxy terminates HTTPS with support for TLS 1.0, TLS 1.1, and CBC-mode ciphers vulnerable to cryptographic downgrade and SWEET32 attacks.",
        "impact": "Possible eavesdropping or man-in-the-middle attacks on client traffic under legacy network downgrade scenarios.",
        "root_cause": "Outdated SSL/TLS cipher suite configuration in Nginx/Apache configuration.",
        "recommendation": "Disable TLS 1.0 and 1.1; enforce TLS 1.2 and TLS 1.3 only; configure modern PFS ciphers (ECDHE-ECDSA-AES128-GCM-SHA256, etc.).",
        "preconditions": "Position on the local network path capable of intercepting traffic.",
        "severity_rationale": "Exploitation requires complex active MITM positioning.",
        "category": "Cryptography",
    },
    # 14. Missing HSTS Header (Low)
    {
        "title": "Missing HTTP Strict Transport Security (HSTS) Header",
        "cwe": ["CWE-693"],
        "cve": None,
        "severity": ObservationSeverity.LOW,
        "impact_level": ObservationImpact.MINOR,
        "likelihood_level": ObservationLikelihood.MODERATE,
        "cvss_score": 3.1,
        "cvss_vector": "CVSS:3.1/AV:N/AC:H/PR:N/UI:R/S:U/C:L/I:N/A:N",
        "reported_epss_score": 0.0050,
        "description": "The web server does not transmit the `Strict-Transport-Security` response header on HTTPS connections.",
        "impact": "Users typing the domain without HTTPS prefix may initially connect via plaintext HTTP, enabling SSL-stripping attacks on insecure public Wi-Fi.",
        "root_cause": "HSTS header omitted from reverse proxy response headers configuration.",
        "recommendation": "Add `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` header to all HTTPS responses.",
        "preconditions": "Initial unencrypted HTTP connection attempt on public network.",
        "severity_rationale": "Standard defense-in-depth hardening header missing.",
        "category": "Security Headers",
    },
    # 15. Missing CSP and Clickjacking Protection (Low)
    {
        "title": "Missing Content-Security-Policy (CSP) and Clickjacking Headers",
        "cwe": ["CWE-693", "CWE-1021"],
        "cve": None,
        "severity": ObservationSeverity.LOW,
        "impact_level": ObservationImpact.MINOR,
        "likelihood_level": ObservationLikelihood.MODERATE,
        "cvss_score": 3.4,
        "cvss_vector": "CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:N/I:L/A:N",
        "reported_epss_score": 0.0080,
        "description": "The web application does not specify `X-Frame-Options` or `Content-Security-Policy: frame-ancestors` directives.",
        "impact": "Attackers can embed the target application inside transparent `<iframe>` containers on third-party sites to perform clickjacking attacks.",
        "root_cause": "Missing frame protection headers in web server responses.",
        "recommendation": "Configure `Content-Security-Policy: frame-ancestors 'none'` or `X-Frame-Options: DENY` on all authenticated application pages.",
        "preconditions": "Victim visits attacker's webpage containing embedded iframe.",
        "severity_rationale": "Minor risk, remediable with standard HTTP response headers.",
        "category": "Security Headers",
    },
]

ASSETS_POOL = [
    "auth.finacle.bank.in",
    "api-gateway.gov.in:8443",
    "core-db-primary.internal",
    "payment-switch-prod.npci.in",
    "k8s-ingress-controller-01.mumbai",
    "citizen-portal.uidai.gov.in",
    "redis-session-cache-cluster",
    "admin-dashboard.intra.gov.in",
    "s3-reports-bucket.ap-south-1",
    "mobile-api-backend.services.in",
    "vpn-gateway.perimeter.corp",
    "citrix-adc-netscaler.prod.net",
    "waf-edge-node-mumbai-01",
    "graphql-federation-service",
    "internal-vault.secrets.local",
    "prs-ticketing-engine.irctc.co.in",
    "telemetry-ground-station.isro.gov.in",
    "scada-rtu-gateway-node-14",
    "cowin-vaccine-registration.api",
    "fastag-toll-acquirer-host.in"
]

# ---------------------------------------------------------
# SEED SCRIPT MAIN
# ---------------------------------------------------------

async def seed_database():
    print("=" * 60)
    print("🚀 STARTING COMPREHENSIVE DATABASE SEEDING FOR VISUALIZATIONS")
    print("=" * 60)

    async with AsyncSessionLocal() as session:
        # 1. Fetch or create roles
        print("\n[1/8] Verifying User Roles...")
        role_map = {}
        role_res = await session.execute(select(Role))
        for r in role_res.scalars().all():
            role_map[r.role_name] = r.role_id

        # 2. Fetch or preserve admin user
        print("\n[2/8] Checking Admin User...")
        admin_res = await session.execute(select(User).where(User.username == "admin"))
        admin_user = admin_res.scalar_one_or_none()
        if not admin_user:
            admin_user = User(
                user_id=uuid.uuid4(),
                username="admin",
                email="admin@cyberaudit.local",
                password_hash=hash_password("Admin@123"),
                full_name="System Administrator",
                is_active=True,
                created_at=datetime.now(timezone.utc) - timedelta(days=400),
            )
            session.add(admin_user)
            await session.flush()
            if "ADMIN" in role_map:
                session.add(UserRole(user_id=admin_user.user_id, role_id=role_map["ADMIN"]))
                await session.flush()
            print("  Created default admin user.")
        else:
            print(f"  Existing admin user found: {admin_user.username}")

        # 3. Create Additional Users
        print("\n[3/8] Seeding Realistic System Users...")
        created_users = [admin_user]
        default_pwd_hash = hash_password("User@123")

        for username, email, full_name, role_name in ADDITIONAL_USERS:
            u_check = await session.execute(select(User).where(User.username == username))
            existing_u = u_check.scalar_one_or_none()
            if not existing_u:
                user = User(
                    user_id=uuid.uuid4(),
                    username=username,
                    email=email,
                    full_name=full_name,
                    password_hash=default_pwd_hash,
                    is_active=True,
                    created_at=datetime.now(timezone.utc) - timedelta(days=random.randint(60, 365)),
                    last_login=datetime.now(timezone.utc) - timedelta(hours=random.randint(1, 72))
                )
                session.add(user)
                await session.flush()
                if role_name in role_map:
                    session.add(UserRole(user_id=user.user_id, role_id=role_map[role_name]))
                created_users.append(user)
            else:
                created_users.append(existing_u)
        await session.commit()
        print(f"  Total users ready: {len(created_users)}")

        # 4. Seed Agencies
        print("\n[4/8] Seeding Security & Auditing Agencies...")
        seeded_agencies = []
        for code, name, a_type, cert_in, email, contact, phone, city, state, pin, reg, emp in AGENCIES_DATA:
            ag_check = await session.execute(select(Agency).where(Agency.agency_code == code))
            existing_ag = ag_check.scalar_one_or_none()
            if not existing_ag:
                agency = Agency(
                    agency_id=uuid.uuid4(),
                    agency_code=code,
                    agency_name=name,
                    agency_type=a_type,
                    cert_in_empanelled=cert_in,
                    registration_number=reg,
                    empanelment_number=emp,
                    empanelment_expiry=date(2027, 12, 31) if emp else None,
                    contact_person=contact,
                    contact_email=email,
                    contact_phone=phone,
                    website=f"https://www.{name.lower().replace(' ', '').replace('(', '').replace(')', '')[:15]}.co.in",
                    city=city,
                    state=state,
                    country="India",
                    pincode=pin,
                    status="ACTIVE",
                    onboarding_date=date(2023, random.randint(1, 12), random.randint(1, 28)),
                    remarks=f"Empanelled & active assessment partner since 2023."
                )
                session.add(agency)
                seeded_agencies.append(agency)
            else:
                seeded_agencies.append(existing_ag)
        await session.commit()
        print(f"  Total agencies ready: {len(seeded_agencies)}")

        # 5. Check existing reports count
        rep_count_res = await session.execute(select(Report))
        existing_reports = rep_count_res.scalars().all()
        print(f"\n[5/8] Current reports count in database: {len(existing_reports)}")

        # Generate reports across last 14 months
        target_total_reports = 180
        reports_to_create = max(0, target_total_reports - len(existing_reports))
        print(f"  Generating {reports_to_create} comprehensive audit reports...")

        now = datetime.now(timezone.utc)
        all_reports = list(existing_reports)

        for i in range(reports_to_create):
            # Spread across last 14 months (420 days)
            days_ago = random.randint(2, 420)
            report_time = now - timedelta(days=days_ago, hours=random.randint(1, 23), minutes=random.randint(1, 59))
            report_date = report_time.date()

            template_name, scope_desc, audit_type = random.choice(REPORT_TEMPLATES)
            ext = random.choices([".pdf", ".docx", ".txt"], weights=[0.75, 0.20, 0.05])[0]
            filename = f"{template_name}_v{random.randint(1, 4)}.{random.randint(0, 9)}{ext}"

            # Status distribution
            status_choice = random.choices(
                [UploadStatus.VALIDATED, UploadStatus.UPLOADED, UploadStatus.REJECTED, UploadStatus.QUARANTINED],
                weights=[0.82, 0.10, 0.05, 0.03]
            )[0]

            uploader = random.choice(created_users)
            agency = random.choice(seeded_agencies)
            report_id = uuid.uuid4()
            sha256 = hashlib.sha256(f"{report_id}-{filename}".encode()).hexdigest()
            file_size = random.randint(180_000, 6_500_000)
            page_count = random.randint(15, 120) if ext == ".pdf" else None

            report = Report(
                report_id=report_id,
                uploaded_by=uploader.user_id,
                agency_id=agency.agency_id,
                original_filename=filename,
                stored_filename=f"enc_{uuid.uuid4().hex}{ext}",
                file_extension=ext,
                mime_type="application/pdf" if ext == ".pdf" else ("application/vnd.openxmlformats-officedocument.wordprocessingml.document" if ext == ".docx" else "text/plain"),
                file_size=file_size,
                sha256_hash=sha256,
                simhash=hashlib.md5(f"{filename}".encode()).hexdigest(),
                page_count=page_count,
                upload_status=status_choice,
                created_at=report_time,
                updated_at=report_time
            )
            session.add(report)

            # Report Metadata
            meta = ReportMetadata(
                metadata_id=uuid.uuid4(),
                report_id=report_id,
                title=f"Cybersecurity Audit Report: {scope_desc}",
                author=f"{agency.agency_name} - Assessment Team",
                producer=random.choice(["Burp Suite Enterprise v2024.3", "Nessus Professional v10.7", "OWASP ZAP Core 2.14", "Checkmarx SAST Engine"]),
                subject=f"Cybersecurity Technical Risk Assessment for {scope_desc}",
                keywords=f"VAPT, CERT-In, Compliance, {audit_type}, OWASP Top 10",
                creation_date=report_time,
                modification_date=report_time,
                metadata_json={
                    "audit_type": audit_type,
                    "target_scope": scope_desc,
                    "lead_auditor": agency.contact_person,
                    "assessment_standard": "CERT-In Technical Guidelines & OWASP ASVS v4.0",
                    "tools_used": ["Burp Suite Pro", "Nmap", "Nessus", "Wireshark", "Metasploit"]
                },
                extracted_at=report_time
            )
            session.add(meta)

            # File Validation
            val = FileValidation(
                validation_id=uuid.uuid4(),
                report_id=report_id,
                file_type_valid=True,
                malware_scan_status="CLEAN" if status_choice != UploadStatus.QUARANTINED else "MALWARE_DETECTED",
                duplicate_status="UNIQUE",
                validation_status="PASSED" if status_choice == UploadStatus.VALIDATED else ("QUARANTINED" if status_choice == UploadStatus.QUARANTINED else "PENDING"),
                validation_notes=f"Cryptographic hash {sha256[:16]}... validated against blacklist. File structure verified.",
                validated_at=report_time
            )
            session.add(val)

            # File Storage
            storage = FileStorage(
                storage_id=uuid.uuid4(),
                report_id=report_id,
                encrypted_file_path=f"/storage/reports/{report_time.year}/{report_time.month:02d}/enc_{report_id.hex}{ext}",
                encryption_algorithm="AES-256-GCM",
                encryption_key_id=f"kms-key-{agency.agency_code.lower()}",
                checksum=sha256,
                stored_at=report_time
            )
            session.add(storage)

            # ReportsData (JSON pipeline payload & report_date)
            rd = ReportsData(
                report_id=report_id,
                report_date=report_date,
                data={
                    "metadata": {
                        "title": f"Security Assessment: {scope_desc}",
                        "date": report_date.isoformat(),
                        "agency": agency.agency_name,
                        "audit_type": audit_type,
                    },
                    "scope": {
                        "target": scope_desc,
                        "network_ranges": ["10.140.0.0/16", "172.24.10.0/24"],
                        "web_endpoints": [f"https://{random.choice(ASSETS_POOL)}"]
                    },
                    "executive_summary": {
                        "overview": f"A comprehensive cybersecurity assessment of {scope_desc} was performed by {agency.agency_name}. Identified risks and remediation controls are cataloged below."
                    }
                },
                created_at=report_time,
                updated_at=report_time
            )
            session.add(rd)

            all_reports.append(report)

            # Commit in batches of 30 reports to keep session lean
            if i % 30 == 0:
                await session.commit()
                print(f"    Inserted {i + 1}/{reports_to_create} reports...")

        await session.commit()
        print(f"  All {len(all_reports)} reports committed.")

        # 6. Detailed Observations (Vulnerabilities)
        print("\n[6/8] Seeding Detailed Observations / Vulnerabilities...")
        obs_count_res = await session.execute(select(DetailedObservation))
        existing_obs = obs_count_res.scalars().all()
        print(f"  Current detailed observations count: {len(existing_obs)}")

        if len(existing_obs) < 500:
            new_obs_count = 0
            for report in all_reports:
                # Generate 8 to 20 findings per report
                num_findings = random.randint(8, 20)
                rep_date = report.created_at.date()

                for v_idx in range(num_findings):
                    tpl = random.choice(VULN_TEMPLATES)
                    asset = random.choice(ASSETS_POOL)

                    # Randomize status realistically (older reports have more closed issues)
                    days_old = (now.date() - rep_date).days
                    if days_old > 180:
                        status = random.choices([ObservationStatus.CLOSED, ObservationStatus.PARTIALLY_REMEDIATED, ObservationStatus.OPEN], weights=[0.65, 0.20, 0.15])[0]
                    elif days_old > 60:
                        status = random.choices([ObservationStatus.CLOSED, ObservationStatus.PARTIALLY_REMEDIATED, ObservationStatus.OPEN], weights=[0.45, 0.25, 0.30])[0]
                    else:
                        status = random.choices([ObservationStatus.OPEN, ObservationStatus.PARTIALLY_REMEDIATED, ObservationStatus.CLOSED], weights=[0.60, 0.20, 0.20])[0]

                    new_repeat = random.choices([ObservationNewRepeat.NEW, ObservationNewRepeat.REPEAT], weights=[0.68, 0.32])[0]

                    # Slight score fluctuation (+-0.4) around template cvss
                    jitter = round(random.uniform(-0.3, 0.3), 1)
                    final_cvss = max(1.0, min(10.0, round(tpl["cvss_score"] + jitter, 1)))

                    finding_id = uuid.uuid4()
                    obs = DetailedObservation(
                        finding_id=finding_id,
                        report_id=report.report_id,
                        title=f"{tpl['title']} #{v_idx + 1}",
                        status=status,
                        severity=tpl["severity"],
                        impact_level=tpl["impact_level"],
                        likelihood_level=tpl["likelihood_level"],
                        cve_id=tpl["cve"],
                        cvss_score=final_cvss,
                        cvss_vector=tpl["cvss_vector"],
                        severity_rationale=tpl["severity_rationale"],
                        reported_epss_score=tpl["reported_epss_score"],
                        observation_date=rep_date,
                        cwe=tpl["cwe"],
                        affected_asset=[asset, f"{asset}:443"],
                        regulatory_references=["CERT-In Technical Direction 2022", "RBI Cyber Security Framework", "ISO/IEC 27001:2022 A.8.8"],
                        observation_description=tpl["description"],
                        preconditions=tpl["preconditions"],
                        impact=tpl["impact"],
                        likely_root_cause=tpl["root_cause"],
                        recommendation=tpl["recommendation"],
                        reference=f"https://cwe.mitre.org/data/definitions/{tpl['cwe'][0].split('-')[-1]}.html",
                        new_or_repeat=new_repeat,
                        meta_data={
                            "category": tpl["category"],
                            "discovered_by": "Automated Scanner & Manual Verification",
                            "validation_phase": "Phase II Penetration Testing"
                        },
                        created_at=report.created_at,
                        updated_at=report.created_at
                    )
                    session.add(obs)
                    new_obs_count += 1

                if new_obs_count % 300 == 0:
                    await session.commit()
                    print(f"    Inserted {new_obs_count} findings...")

            await session.commit()
            print(f"  Successfully seeded {new_obs_count} detailed observations across {len(all_reports)} reports!")
        else:
            print(f"  Detailed observations ({len(existing_obs)}) are already populated. Skipping observation insertion.")

        # 7. Audit Logs & Security Events
        print("\n[7/8] Seeding Audit Logs & Security Events...")
        log_count_res = await session.execute(select(AuditLog))
        existing_logs = log_count_res.scalars().all()
        if len(existing_logs) < 100:
            audit_actions = ["FILE_UPLOAD", "FILE_DELETE", "USER_LOGIN", "USER_CREATE"]
            for j in range(350):
                u = random.choice(created_users)
                r = random.choice(all_reports)
                log_time = now - timedelta(days=random.randint(1, 90), hours=random.randint(0, 23), minutes=random.randint(0, 59))
                act = random.choice(audit_actions)
                log = AuditLog(
                    log_id=uuid.uuid4(),
                    user_id=u.user_id,
                    report_id=r.report_id if act == "FILE_UPLOAD" else None,
                    action=act,
                    status="SUCCESS" if random.random() < 0.94 else "FAILED",
                    details={
                        "ip_address": f"10.{random.randint(10, 50)}.{random.randint(1, 254)}.{random.randint(1, 254)}",
                        "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0.0.0",
                        "resource": r.original_filename if act == "FILE_UPLOAD" else u.username
                    },
                    created_at=log_time
                )
                session.add(log)
            await session.commit()
            print("  Audit logs seeded.")
        else:
            print(f"  Audit logs ({len(existing_logs)}) already present.")

        # Security events
        event_types = [
            ("BRUTE_FORCE_ATTEMPT", "HIGH", "Exceeded maximum failed login attempts (5) from single remote IP."),
            ("SUSPICIOUS_LOGIN_LOCATION", "MEDIUM", "Account login detected from anomalous IP block not in regular VPN pool."),
            ("MALWARE_SCAN_QUARANTINE", "CRITICAL", "Malware signature Win32/Emotet.gen detected during upload stream scan."),
            ("RAPID_REPORT_DOWNLOADS", "MEDIUM", "User downloaded more than 15 reports within a 2-minute rolling window."),
            ("UNAUTHORIZED_ACCESS_ATTEMPT", "HIGH", "Attempted access to restricted administrative API without requisite AUDITOR role.")
        ]
        for k in range(50):
            ev_type, sev, desc = random.choice(event_types)
            ev_time = now - timedelta(days=random.randint(1, 60), hours=random.randint(0, 23))
            ev = SecurityEvent(
                event_id=uuid.uuid4(),
                user_id=random.choice(created_users).user_id,
                severity=sev,
                event_type=ev_type,
                description=desc,
                event_metadata={
                    "source_ip": f"198.51.100.{random.randint(10, 250)}",
                    "action_taken": "BLOCKED_AND_ALERTED"
                },
                created_at=ev_time
            )
            session.add(ev)

        await session.commit()
        print("  Audit logs & Security events successfully seeded.")

        # 8. Trigger real Clustering and Trend Analysis runs
        print("\n[8/8] Executing ML Clustering & Trend Forecasting Engines on seeded data...")
        try:
            from app.services.clustering_service import _run_vulnerability_clustering_job, _run_report_clustering_job
            from app.services.trend_analysis.run_service import _execute_trend_analysis_job

            # Vulnerability Clustering
            v_run_id = uuid.uuid4()
            v_run = ClusteringRun(
                run_id=v_run_id,
                clustering_type=ClusteringType.VULNERABILITY.value,
                status=RunStatus.QUEUED.value,
                current_stage="Queued",
                progress_percent=0,
                requested_by=admin_user.user_id,
                parameters={"algorithm": "HDBSCAN", "features": "TF-IDF + TruncatedSVD"},
                created_at=now
            )
            session.add(v_run)

            # Report Clustering
            r_run_id = uuid.uuid4()
            r_run = ClusteringRun(
                run_id=r_run_id,
                clustering_type=ClusteringType.REPORT.value,
                status=RunStatus.QUEUED.value,
                current_stage="Queued",
                progress_percent=0,
                requested_by=admin_user.user_id,
                parameters={"algorithm": "HDBSCAN", "features": "Audit Profile & Severity Density"},
                created_at=now
            )
            session.add(r_run)

            # Trend Analysis Run
            t_run_id = uuid.uuid4()
            t_run = TrendAnalysisRun(
                run_id=t_run_id,
                status=TrendRunStatus.QUEUED.value,
                current_stage="Queued",
                progress_percent=0,
                requested_by=admin_user.user_id,
                parameters={"date_basis": "effective", "frequency": "M", "horizon": 6, "severity": "ALL", "status": "ALL"},
                created_at=now
            )
            session.add(t_run)
            await session.commit()

            # Anomaly Detection Run
            from app.models.anomaly import AnomalyRun, AnomalyRunStatus
            from app.services.anomaly_service import execute_anomaly_detection_job, _get_device_metadata

            a_run_id = uuid.uuid4()
            dev_meta = _get_device_metadata()
            a_cfg = {
                "algorithm_mode": "ENSEMBLE",
                "selected_features": [
                    "total_findings", "avg_cvss", "max_cvss", "cvss_variance",
                    "p90_cvss", "critical_ratio", "open_findings", "sla_breach_count",
                    "page_count", "report_narrative"
                ],
                "parameters": {
                    "contamination": 0.10,
                    "n_estimators": 100,
                    "extended_hyperplanes": False,
                    "k_neighbors": 5,
                    "weight_iforest": 0.40,
                    "weight_ecod": 0.35,
                    "weight_embedding": 0.25
                }
            }
            a_run = AnomalyRun(
                run_id=a_run_id,
                status=AnomalyRunStatus.QUEUED.value,
                current_stage="Queued",
                progress_percent=0,
                requested_by=admin_user.user_id,
                parameters={
                    "algorithm_mode": a_cfg["algorithm_mode"],
                    "selected_features": a_cfg["selected_features"],
                    "parameters": a_cfg["parameters"],
                    "compute_device": dev_meta["compute_device"],
                    "gpu_accelerated": dev_meta["gpu_accelerated"],
                    "gpu_name": dev_meta["gpu_name"]
                },
                created_at=now
            )
            session.add(a_run)
            await session.commit()

            print("  Running Vulnerability HDBSCAN Clustering...")
            await _run_vulnerability_clustering_job(v_run_id)

            print("  Running Report HDBSCAN Clustering...")
            await _run_report_clustering_job(r_run_id)

            print("  Running Trend Analysis & Forecasting Engine...")
            await _execute_trend_analysis_job(t_run_id, {"date_basis": "effective", "frequency": "M", "horizon": 6, "severity": "ALL", "status": "ALL"})

            print("  Running Multi-Paradigm Anomaly Detection (Isolation Forest + ECOD + S-BERT)...")
            await execute_anomaly_detection_job(a_run_id, a_cfg, requested_by=admin_user.user_id)

            print("  ML Algorithms completed successfully!")

        except Exception as e:
            print(f"  Warning: ML background computation encountered: {e}")
            import traceback
            traceback.print_exc()

    print("\n" + "=" * 60)
    print("🎉 DATABASE SEEDING COMPLETED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(seed_database())
