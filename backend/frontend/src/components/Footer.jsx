import React, { useState } from 'react';
import {
  Box,
  Container,
  Grid,
  Typography,
  Link,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Divider,
  Stack,
  Tooltip,
} from '@mui/material';
import {
  Shield,
  Security,
  VerifiedUser,
  Gavel,
  Memory,
  HealthAndSafety,
  Storage,
  Lock,
  CheckCircle,
  Close,
  OpenInNew,
  Speed,
  CloudDone,
} from '@mui/icons-material';

export default function Footer() {
  const [modalType, setModalType] = useState(null); // 'compliance' | 'certin' | 'architecture' | null

  const handleOpenModal = (type) => (e) => {
    e.preventDefault();
    setModalType(type);
  };

  const handleCloseModal = () => setModalType(null);

  return (
    <Box
      component="footer"
      sx={{
        mt: 'auto',
        backgroundColor: 'rgba(9, 14, 26, 0.85)',
        backdropFilter: 'blur(16px)',
        borderTop: '1px solid rgba(255, 255, 255, 0.07)',
        pt: { xs: 3.5, sm: 4 },
        pb: 2.5,
        px: { xs: 2, sm: 3, lg: 4 },
        color: '#94A3B8',
        position: 'relative',
        zIndex: 10,
      }}
    >
      {/* Top Banner: Brand + Telemetry Pills */}
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          pb: 2.5,
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        }}
      >
        {/* Brand identity */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(0, 240, 255, 0.2) 0%, rgba(13, 21, 39, 0.9) 100%)',
              border: '1px solid rgba(0, 240, 255, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 16px rgba(0, 240, 255, 0.15)',
            }}
          >
            <Shield sx={{ color: '#00F0FF', fontSize: 22 }} />
          </Box>
          <Box>
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 800,
                letterSpacing: '0.04em',
                color: '#F8FAFC',
                fontSize: '0.95rem',
                lineHeight: 1.2,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              CyberAudit Intelligence Platform
              <Chip
                label="v2.4.0 PROD"
                size="small"
                sx={{
                  height: 18,
                  fontSize: '0.62rem',
                  fontWeight: 700,
                  backgroundColor: 'rgba(0, 240, 255, 0.1)',
                  color: '#00F0FF',
                  border: '1px solid rgba(0, 240, 255, 0.25)',
                  letterSpacing: '0.05em',
                }}
              />
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: '#64748B',
                fontSize: '0.72rem',
                display: 'block',
                mt: 0.2,
              }}
            >
              National Document Standardization & Anomaly Detection • MeitY / CERT-In Framework
            </Typography>
          </Box>
        </Box>

        {/* Realtime Engine Telemetry Badges */}
        <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 1 }}>
          <Tooltip title="Real-time pipeline ingestion & verification workers">
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.8,
                px: 1.4,
                py: 0.5,
                borderRadius: '6px',
                backgroundColor: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                fontSize: '0.72rem',
                color: '#34D399',
                fontFamily: 'monospace',
                fontWeight: 600,
              }}
            >
              <Box
                sx={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  backgroundColor: '#10B981',
                  boxShadow: '0 0 8px #10B981',
                  animation: 'pulse 2s infinite',
                }}
              />
              Pipeline: Operational
            </Box>
          </Tooltip>

          <Tooltip title="Vision-Language Model processing complex layouts & tables">
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.8,
                px: 1.4,
                py: 0.5,
                borderRadius: '6px',
                backgroundColor: 'rgba(0, 240, 255, 0.06)',
                border: '1px solid rgba(0, 240, 255, 0.2)',
                fontSize: '0.72rem',
                color: '#38BDF8',
                fontFamily: 'monospace',
                fontWeight: 500,
              }}
            >
              <Memory sx={{ fontSize: 13, color: '#38BDF8' }} />
              VLM: Nemotron-3-Nano
            </Box>
          </Tooltip>

          <Tooltip title="ClamAV quarantine & zero-day file sanitization">
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.8,
                px: 1.4,
                py: 0.5,
                borderRadius: '6px',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                fontSize: '0.72rem',
                color: '#CBD5E1',
                fontFamily: 'monospace',
                fontWeight: 500,
              }}
            >
              <HealthAndSafety sx={{ fontSize: 13, color: '#10B981' }} />
              Malware Gate: Clean
            </Box>
          </Tooltip>
        </Stack>
      </Box>

      {/* Middle Grid: Navigation / Standards / Legal */}
      <Box sx={{ py: 3 }}>
        <Grid container spacing={3}>
          {/* Col 1: Compliance & Legal */}
          <Grid item xs={12} sm={6} md={4}>
            <Typography
              variant="overline"
              sx={{
                fontSize: '0.68rem',
                fontWeight: 700,
                color: '#E2E8F0',
                letterSpacing: '0.1em',
                display: 'flex',
                alignItems: 'center',
                gap: 0.8,
                mb: 1.5,
              }}
            >
              <Gavel sx={{ fontSize: 14, color: '#00F0FF' }} />
              Statutory Compliance
            </Typography>
            <Stack spacing={1}>
              <Link
                href="#"
                onClick={handleOpenModal('certin')}
                sx={{
                  color: '#94A3B8',
                  fontSize: '0.8rem',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.8,
                  transition: 'color 0.15s ease',
                  '&:hover': { color: '#00F0FF' },
                }}
              >
                <span>• CERT-In Empanelled Auditor Guidelines</span>
              </Link>
              <Link
                href="#"
                onClick={handleOpenModal('compliance')}
                sx={{
                  color: '#94A3B8',
                  fontSize: '0.8rem',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.8,
                  transition: 'color 0.15s ease',
                  '&:hover': { color: '#00F0FF' },
                }}
              >
                <span>• Information Technology Act (Sec 70B & 43A)</span>
              </Link>
              <Link
                href="#"
                onClick={handleOpenModal('compliance')}
                sx={{
                  color: '#94A3B8',
                  fontSize: '0.8rem',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.8,
                  transition: 'color 0.15s ease',
                  '&:hover': { color: '#00F0FF' },
                }}
              >
                <span>• ISO/IEC 27001:2022 Security Controls</span>
              </Link>
            </Stack>
          </Grid>

          {/* Col 2: Pipeline Architecture */}
          <Grid item xs={12} sm={6} md={4}>
            <Typography
              variant="overline"
              sx={{
                fontSize: '0.68rem',
                fontWeight: 700,
                color: '#E2E8F0',
                letterSpacing: '0.1em',
                display: 'flex',
                alignItems: 'center',
                gap: 0.8,
                mb: 1.5,
              }}
            >
              <Storage sx={{ fontSize: 14, color: '#10B981' }} />
              Pipeline Architecture
            </Typography>
            <Stack spacing={1}>
              <Link
                href="#"
                onClick={handleOpenModal('architecture')}
                sx={{
                  color: '#94A3B8',
                  fontSize: '0.8rem',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.8,
                  transition: 'color 0.15s ease',
                  '&:hover': { color: '#10B981' },
                }}
              >
                <span>• Asynchronous Celery + Redis Task Queue</span>
              </Link>
              <Link
                href="#"
                onClick={handleOpenModal('architecture')}
                sx={{
                  color: '#94A3B8',
                  fontSize: '0.8rem',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.8,
                  transition: 'color 0.15s ease',
                  '&:hover': { color: '#10B981' },
                }}
              >
                <span>• ML Risk Clustering & Anomaly Isolation</span>
              </Link>
              <Link
                href="#"
                onClick={handleOpenModal('architecture')}
                sx={{
                  color: '#94A3B8',
                  fontSize: '0.8rem',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.8,
                  transition: 'color 0.15s ease',
                  '&:hover': { color: '#10B981' },
                }}
              >
                <span>• Cryptographic Hash Verification (SHA-256)</span>
              </Link>
            </Stack>
          </Grid>

          {/* Col 3: Security & Classification Notice */}
          <Grid item xs={12} sm={12} md={4}>
            <Box
              sx={{
                p: 2,
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Lock sx={{ fontSize: 15, color: '#F59E0B' }} />
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    color: '#F59E0B',
                    textTransform: 'uppercase',
                    fontSize: '0.68rem',
                  }}
                >
                  Restricted Official System
                </Typography>
              </Box>
              <Typography
                variant="body2"
                sx={{
                  color: '#64748B',
                  fontSize: '0.74rem',
                  lineHeight: 1.5,
                }}
              >
                Authorized personnel only. All access, document ingestion, and anomaly inspection
                sessions are cryptographically logged with immutable audit timestamps.
              </Typography>
              <Box sx={{ mt: 1.5, display: 'flex', gap: 1, alignItems: 'center' }}>
                <Chip
                  icon={<VerifiedUser sx={{ fontSize: '13px !important', color: '#10B981 !important' }} />}
                  label="MeitY Empanelled"
                  size="small"
                  sx={{
                    height: 22,
                    fontSize: '0.65rem',
                    fontWeight: 600,
                    backgroundColor: 'rgba(16, 185, 129, 0.08)',
                    color: '#34D399',
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                  }}
                />
                <Chip
                  icon={<Speed sx={{ fontSize: '13px !important', color: '#38BDF8 !important' }} />}
                  label="TLS 1.3 Active"
                  size="small"
                  sx={{
                    height: 22,
                    fontSize: '0.65rem',
                    fontWeight: 600,
                    backgroundColor: 'rgba(56, 189, 248, 0.08)',
                    color: '#38BDF8',
                    border: '1px solid rgba(56, 189, 248, 0.2)',
                  }}
                />
              </Box>
            </Box>
          </Grid>
        </Grid>
      </Box>

      {/* Bottom Sub-Bar: Copyright & Telemetry info */}
      <Box
        sx={{
          pt: 2,
          borderTop: '1px solid rgba(255, 255, 255, 0.04)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1.5,
        }}
      >
        <Typography
          variant="caption"
          sx={{
            color: '#64748B',
            fontSize: '0.73rem',
            letterSpacing: '0.01em',
          }}
        >
          © 2026 CyberAudit Management System. All rights reserved. Government of India / MeitY.
        </Typography>

        <Stack direction="row" spacing={2} sx={{ fontSize: '0.72rem', color: '#64748B', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#10B981' }} />
            <span>Region: AP-SOUTH-1 (In-Country)</span>
          </Box>
          <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255, 255, 255, 0.1)', height: 12, my: 'auto' }} />
          <span>Latency: ~18ms</span>
          <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255, 255, 255, 0.1)', height: 12, my: 'auto' }} />
          <span>AES-256-GCM Encrypted</span>
        </Stack>
      </Box>

      {/* Interactive Information Dialog */}
      <Dialog
        open={Boolean(modalType)}
        onClose={handleCloseModal}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: '#0D1527',
            border: '1px solid rgba(0, 240, 255, 0.2)',
            borderRadius: '14px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.7)',
            backgroundImage: 'radial-gradient(ellipse at top right, rgba(0, 240, 255, 0.05), transparent 60%)',
          },
        }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            pb: 1.5,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
            <Shield sx={{ color: '#00F0FF', fontSize: 22 }} />
            <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 700, color: '#F8FAFC' }}>
              {modalType === 'certin' && 'CERT-In Auditor Standards'}
              {modalType === 'compliance' && 'Legal & Statutory Compliance'}
              {modalType === 'architecture' && 'Platform Processing Pipeline'}
            </Typography>
          </Box>
          <IconButton size="small" onClick={handleCloseModal} sx={{ color: '#94A3B8', '&:hover': { color: '#FFF' } }}>
            <Close fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: 2.5, pb: 1, color: '#CBD5E1' }}>
          {modalType === 'certin' && (
            <Stack spacing={2}>
              <Typography variant="body2" sx={{ fontSize: '0.85rem', lineHeight: 1.6 }}>
                CyberAudit enforces standardization protocols specified by the Indian Computer Emergency
                Response Team (CERT-In) for security audit reporting across Indian cyberspace.
              </Typography>
              <Box sx={{ p: 2, borderRadius: '8px', backgroundColor: 'rgba(0, 240, 255, 0.04)', border: '1px solid rgba(0, 240, 255, 0.15)' }}>
                <Typography variant="caption" sx={{ color: '#00F0FF', fontWeight: 700, display: 'block', mb: 0.5 }}>
                  KEY REQUIREMENTS ENFORCED:
                </Typography>
                <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block', lineHeight: 1.5 }}>
                  1. Structured Executive Summaries & Methodology Disclosures<br />
                  2. CVSS v3.1 Scoring & Vulnerability Impact Categorization<br />
                  3. Clear Remediation Timeframes & Verification Proofs<br />
                  4. Proof of Concept (PoC) Redaction & Sensitive Data Scrubbing
                </Typography>
              </Box>
            </Stack>
          )}

          {modalType === 'compliance' && (
            <Stack spacing={2}>
              <Typography variant="body2" sx={{ fontSize: '0.85rem', lineHeight: 1.6 }}>
                Platform architecture strictly complies with Government of India Information Technology Act provisions:
              </Typography>
              <Box sx={{ p: 2, borderRadius: '8px', backgroundColor: 'rgba(16, 185, 129, 0.04)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                <Typography variant="caption" sx={{ color: '#34D399', fontWeight: 700, display: 'block', mb: 0.5 }}>
                  REGULATORY FRAMEWORK:
                </Typography>
                <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block', lineHeight: 1.5 }}>
                  • <strong>Section 70B:</strong> Mandatory reporting of cybersecurity incidents within 6 hours.<br />
                  • <strong>Section 43A:</strong> Implementation of reasonable security practices and procedures.<br />
                  • <strong>Data Localization:</strong> 100% in-country data residency on sovereign infrastructure.
                </Typography>
              </Box>
            </Stack>
          )}

          {modalType === 'architecture' && (
            <Stack spacing={2}>
              <Typography variant="body2" sx={{ fontSize: '0.85rem', lineHeight: 1.6 }}>
                The ingestion architecture utilizes a zero-trust multi-stage pipeline:
              </Typography>
              <Box sx={{ p: 2, borderRadius: '8px', backgroundColor: 'rgba(56, 189, 248, 0.04)', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                <Typography variant="caption" sx={{ color: '#38BDF8', fontWeight: 700, display: 'block', mb: 0.5 }}>
                  INGESTION STAGES:
                </Typography>
                <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block', lineHeight: 1.5 }}>
                  1. <strong>Malware Gate:</strong> Realtime ClamAV buffer analysis & header validation.<br />
                  2. <strong>OCR & Structure Extraction:</strong> PyMuPDF + docx table normalization.<br />
                  3. <strong>VLM Layout Parser:</strong> Vision-Language tokenization for complex tables.<br />
                  4. <strong>ML Anomaly Engine:</strong> Density-based clustering for cross-report risk detection.
                </Typography>
              </Box>
            </Stack>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2, pt: 1, borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
          <Button
            onClick={handleCloseModal}
            variant="outlined"
            size="small"
            sx={{
              borderColor: 'rgba(255, 255, 255, 0.2)',
              color: '#F8FAFC',
              '&:hover': { borderColor: '#00F0FF', backgroundColor: 'rgba(0, 240, 255, 0.05)' },
            }}
          >
            Dismiss
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
