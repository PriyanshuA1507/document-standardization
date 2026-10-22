import React from 'react';
import {
  Box,
  Typography,
  Chip,
  Divider,
  Stack,
  Tooltip,
  useTheme,
} from '@mui/material';
import {
  Shield,
  VerifiedUser,
  Memory,
  HealthAndSafety,
  Lock,
  CheckCircle,
} from '@mui/icons-material';

export default function Footer() {
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';

  const primaryAccent = isLight ? '#0284C7' : '#00F0FF';
  const successAccent = isLight ? '#059669' : '#10B981';

  return (
    <Box
      component="footer"
      sx={{
        mt: 'auto',
        backgroundColor: isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(9, 14, 26, 0.85)',
        backdropFilter: 'blur(16px)',
        borderTop: isLight ? '1px solid rgba(15, 23, 42, 0.08)' : '1px solid rgba(255, 255, 255, 0.07)',
        pt: { xs: 3.5, sm: 4 },
        pb: 2.5,
        px: { xs: 2, sm: 3, lg: 4 },
        color: isLight ? '#475569' : '#94A3B8',
        position: 'relative',
        zIndex: 10,
        transition: 'background-color 0.25s ease, border-color 0.25s ease',
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
          borderBottom: isLight ? '1px solid rgba(15, 23, 42, 0.08)' : '1px solid rgba(255, 255, 255, 0.05)',
        }}
      >
        {/* Brand identity */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: '10px',
              background: isLight
                ? 'linear-gradient(135deg, rgba(2, 132, 199, 0.15) 0%, rgba(241, 245, 249, 0.9) 100%)'
                : 'linear-gradient(135deg, rgba(0, 240, 255, 0.2) 0%, rgba(13, 21, 39, 0.9) 100%)',
              border: isLight ? '1px solid rgba(2, 132, 199, 0.3)' : '1px solid rgba(0, 240, 255, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: isLight ? '0 0 12px rgba(2, 132, 199, 0.15)' : '0 0 16px rgba(0, 240, 255, 0.15)',
            }}
          >
            <Shield sx={{ color: primaryAccent, fontSize: 22 }} />
          </Box>
          <Box>
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 800,
                letterSpacing: '0.04em',
                color: isLight ? '#0F172A' : '#F8FAFC',
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
                  backgroundColor: isLight ? 'rgba(2, 132, 199, 0.1)' : 'rgba(0, 240, 255, 0.1)',
                  color: primaryAccent,
                  border: isLight ? '1px solid rgba(2, 132, 199, 0.25)' : '1px solid rgba(0, 240, 255, 0.25)',
                  letterSpacing: '0.05em',
                }}
              />
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: isLight ? '#64748B' : '#64748B',
                fontSize: '0.72rem',
                fontWeight: 600,
                letterSpacing: '0.03em',
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
                backgroundColor: isLight ? 'rgba(5, 150, 105, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                border: isLight ? '1px solid rgba(5, 150, 105, 0.25)' : '1px solid rgba(16, 185, 129, 0.25)',
                fontSize: '0.72rem',
                color: successAccent,
                fontFamily: 'monospace',
                fontWeight: 650,
              }}
            >
              <Box
                sx={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  backgroundColor: successAccent,
                  boxShadow: `0 0 8px ${successAccent}`,
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
                backgroundColor: isLight ? 'rgba(2, 132, 199, 0.08)' : 'rgba(0, 240, 255, 0.06)',
                border: isLight ? '1px solid rgba(2, 132, 199, 0.25)' : '1px solid rgba(0, 240, 255, 0.2)',
                fontSize: '0.72rem',
                color: primaryAccent,
                fontFamily: 'monospace',
                fontWeight: 600,
              }}
            >
              <Memory sx={{ fontSize: 13, color: primaryAccent }} />
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
                backgroundColor: isLight ? 'rgba(15, 23, 42, 0.04)' : 'rgba(255, 255, 255, 0.04)',
                border: isLight ? '1px solid rgba(15, 23, 42, 0.08)' : '1px solid rgba(255, 255, 255, 0.1)',
                fontSize: '0.72rem',
                color: isLight ? '#475569' : '#CBD5E1',
                fontFamily: 'monospace',
                fontWeight: 600,
              }}
            >
              <HealthAndSafety sx={{ fontSize: 13, color: successAccent }} />
              Malware Gate: Clean
            </Box>
          </Tooltip>
        </Stack>
      </Box>

      {/* Security & Classification Notice Bar */}
      <Box sx={{ py: 2 }}>
        <Box
          sx={{
            p: 2,
            borderRadius: '8px',
            backgroundColor: isLight ? '#F8FAFC' : 'rgba(255, 255, 255, 0.02)',
            border: isLight ? '1px solid rgba(15, 23, 42, 0.08)' : '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            alignItems: { xs: 'flex-start', md: 'center' },
            justifyContent: 'space-between',
            gap: 2,
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: { xs: 'flex-start', sm: 'center' },
              gap: 1.5,
              flex: 1,
              flexDirection: { xs: 'column', sm: 'row' },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, flexShrink: 0 }}>
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
                color: isLight ? '#475569' : '#64748B',
                fontSize: '0.74rem',
                lineHeight: 1.5,
              }}
            >
              Authorized personnel only. All access, document ingestion, and anomaly inspection
              sessions are cryptographically logged with immutable audit timestamps.
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
            <Chip
              icon={<VerifiedUser sx={{ fontSize: '13px !important', color: `${successAccent} !important` }} />}
              label="MeitY Empanelled"
              size="small"
              sx={{
                height: 22,
                fontSize: '0.65rem',
                fontWeight: 600,
                backgroundColor: isLight ? 'rgba(5, 150, 105, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                color: successAccent,
                border: isLight ? '1px solid rgba(5, 150, 105, 0.25)' : '1px solid rgba(16, 185, 129, 0.25)',
              }}
            />
            <Chip
              icon={<CheckCircle sx={{ fontSize: '13px !important', color: `${primaryAccent} !important` }} />}
              label="Air-Gapped Ready"
              size="small"
              sx={{
                height: 22,
                fontSize: '0.65rem',
                fontWeight: 600,
                backgroundColor: isLight ? 'rgba(2, 132, 199, 0.08)' : 'rgba(0, 240, 255, 0.08)',
                color: primaryAccent,
                border: isLight ? '1px solid rgba(2, 132, 199, 0.25)' : '1px solid rgba(0, 240, 255, 0.25)',
              }}
            />
          </Box>
        </Box>
      </Box>

      {/* Bottom Legal Copyright Bar */}
      <Box
        sx={{
          pt: 2.5,
          borderTop: isLight ? '1px solid rgba(15, 23, 42, 0.08)' : '1px solid rgba(255, 255, 255, 0.05)',
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
            color: isLight ? '#64748B' : '#64748B',
            fontSize: '0.73rem',
            letterSpacing: '0.01em',
          }}
        >
          © 2026 CyberAudit Management System. All rights reserved. Government of India / MeitY.
        </Typography>

        <Stack direction="row" spacing={2} sx={{ fontSize: '0.72rem', color: isLight ? '#64748B' : '#64748B', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: successAccent }} />
            <span>Region: AP-SOUTH-1 (In-Country)</span>
          </Box>
          <Divider orientation="vertical" flexItem sx={{ borderColor: isLight ? 'rgba(15, 23, 42, 0.1)' : 'rgba(255, 255, 255, 0.1)', height: 12, my: 'auto' }} />
          <span>Latency: ~18ms</span>
          <Divider orientation="vertical" flexItem sx={{ borderColor: isLight ? 'rgba(15, 23, 42, 0.1)' : 'rgba(255, 255, 255, 0.1)', height: 12, my: 'auto' }} />
          <span>AES-256-GCM Encrypted</span>
        </Stack>
      </Box>
    </Box>
  );
}
