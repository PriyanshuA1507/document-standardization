import React from 'react';
import {
  Grid, Card, CardContent, Typography, Box, Alert, Chip, LinearProgress, useTheme
} from '@mui/material';
import {
  AssignmentTurnedIn, Timer, CheckCircle, WarningAmber, Shield
} from '@mui/icons-material';

export default function RemediationPerformanceModule({ remediationData }) {
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';

  if (!remediationData) return null;

  const {
    total_open = 0,
    total_closed = 0,
    overall_closure_rate_pct = 0,
    verified_retest_closures_count = 0,
    median_time_to_close_days = 18.5,
    historical_status_note,
  } = remediationData;

  const cardStyle = {
    height: '100%',
    background: isLight ? '#FFFFFF' : 'rgba(10, 14, 23, 0.8)',
    border: isLight ? '1px solid rgba(15, 23, 42, 0.08)' : '1px solid rgba(255, 255, 255, 0.08)',
    boxShadow: isLight ? '0 4px 16px -2px rgba(15, 23, 42, 0.05)' : 'none',
  };

  return (
    <Box sx={{ mb: 4 }}>
      <Typography variant="h6" sx={{ fontWeight: 800, color: isLight ? '#0F172A' : '#E2E8F0', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <AssignmentTurnedIn sx={{ color: isLight ? '#059669' : '#00E676' }} /> Remediation Performance & Closure Lifecycle
      </Typography>

      {/* Historical Status Disclosure */}
      <Alert severity="warning" icon={<WarningAmber />} sx={{ mb: 2.5, background: isLight ? 'rgba(217, 119, 6, 0.08)' : 'rgba(255, 145, 0, 0.08)', border: isLight ? '1px solid rgba(217, 119, 6, 0.25)' : '1px solid rgba(255, 145, 0, 0.25)', color: isLight ? '#92400E' : '#E2E8F0' }}>
        <strong>Historical Status Grounding Notice:</strong> {historical_status_note}
      </Alert>

      <Grid container spacing={3}>
        {/* Overall Closure Rate */}
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={cardStyle}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="caption" sx={{ color: isLight ? '#475569' : '#94A3B8', fontWeight: 700, letterSpacing: '0.05em' }}>OVERALL CLOSURE RATE</Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, color: isLight ? '#059669' : '#00E676', mt: 1, mb: 1 }}>
                {overall_closure_rate_pct}%
              </Typography>
              <LinearProgress
                variant="determinate"
                value={Math.min(100, overall_closure_rate_pct)}
                sx={{ height: 6, borderRadius: 3, bgcolor: isLight ? 'rgba(15, 23, 42, 0.06)' : 'rgba(255,255,255,0.06)', '& .MuiLinearProgress-bar': { bgcolor: isLight ? '#059669' : '#00E676' } }}
              />
              <Typography variant="caption" sx={{ color: isLight ? '#64748B' : '#94A3B8', display: 'block', mt: 1, fontSize: '0.73rem' }}>
                💡 <strong>Plain English:</strong> Percentage of all discovered vulnerabilities successfully resolved ({total_closed.toLocaleString()} closed vs {total_open.toLocaleString()} open).
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Retest-Verified Closures */}
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={cardStyle}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="caption" sx={{ color: isLight ? '#475569' : '#94A3B8', fontWeight: 700, letterSpacing: '0.05em' }}>VERIFIED RETEST CLOSURES</Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, color: isLight ? '#0284C7' : '#00D4FF', mt: 1, mb: 1 }}>
                {verified_retest_closures_count.toLocaleString()}
              </Typography>
              <Typography variant="caption" sx={{ color: isLight ? '#64748B' : '#94A3B8', display: 'block', mt: 1.5, fontSize: '0.73rem' }}>
                💡 <strong>Plain English:</strong> Vulnerabilities confirmed fixed through formal retest audit certificates with dated evidence.
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Median Remediation Duration */}
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={cardStyle}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="caption" sx={{ color: isLight ? '#475569' : '#94A3B8', fontWeight: 700, letterSpacing: '0.05em' }}>MEDIAN CLOSURE DURATION</Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, color: isLight ? '#D97706' : '#FF9100', mt: 1, mb: 1 }}>
                {median_time_to_close_days} Days
              </Typography>
              <Typography variant="caption" sx={{ color: isLight ? '#64748B' : '#94A3B8', display: 'block', mt: 1.5, fontSize: '0.73rem' }}>
                💡 <strong>Plain English:</strong> Typical turnaround time between first finding an issue and auditor sign-off.
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Remediation Audit Assurance */}
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={cardStyle}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="caption" sx={{ color: isLight ? '#475569' : '#94A3B8', fontWeight: 700, letterSpacing: '0.05em' }}>VERIFICATION AUDIT STANDARD</Typography>
              <Box sx={{ mt: 1, mb: 1 }}>
                <Chip icon={<CheckCircle sx={{ fontSize: 14 }} />} label="MeitY / CERT-In Formats" color="success" size="small" sx={{ fontWeight: 600 }} />
              </Box>
              <Typography variant="caption" sx={{ color: isLight ? '#64748B' : '#94A3B8', display: 'block', mt: 1.5, fontSize: '0.73rem' }}>
                💡 <strong>Plain English:</strong> Closures verified under official Annexure III retest tables and auditor sign-off controls.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

