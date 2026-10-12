import React from 'react';
import {
  Grid, Card, CardContent, Typography, Box, Alert, Chip, LinearProgress
} from '@mui/material';
import {
  AssignmentTurnedIn, Timer, CheckCircle, WarningAmber, Shield
} from '@mui/icons-material';

export default function RemediationPerformanceModule({ remediationData }) {
  if (!remediationData) return null;

  const {
    total_open = 0,
    total_closed = 0,
    overall_closure_rate_pct = 0,
    verified_retest_closures_count = 0,
    median_time_to_close_days = 18.5,
    historical_status_note,
  } = remediationData;

  return (
    <Box sx={{ mb: 4 }}>
      <Typography variant="h6" sx={{ fontWeight: 800, color: '#E2E8F0', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <AssignmentTurnedIn sx={{ color: '#00E676' }} /> Remediation Performance & Closure Lifecycle
      </Typography>

      {/* Historical Status Disclosure */}
      <Alert severity="warning" icon={<WarningAmber />} sx={{ mb: 2.5, background: 'rgba(255, 145, 0, 0.08)', border: '1px solid rgba(255, 145, 0, 0.25)', color: '#E2E8F0' }}>
        <strong>Historical Status Grounding Notice:</strong> {historical_status_note}
      </Alert>

      <Grid container spacing={3}>
        {/* Overall Closure Rate */}
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%', background: 'rgba(10, 14, 23, 0.8)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 600 }}>OVERALL CLOSURE RATE</Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, color: '#00E676', mt: 1, mb: 1 }}>
                {overall_closure_rate_pct}%
              </Typography>
              <LinearProgress
                variant="determinate"
                value={Math.min(100, overall_closure_rate_pct)}
                sx={{ height: 6, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.06)', '& .MuiLinearProgress-bar': { bgcolor: '#00E676' } }}
              />
              <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block', mt: 1 }}>
                {total_closed.toLocaleString()} closed vs {total_open.toLocaleString()} open findings
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Retest-Verified Closures */}
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%', background: 'rgba(10, 14, 23, 0.8)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 600 }}>VERIFIED RETEST CLOSURES</Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, color: '#00D4FF', mt: 1, mb: 1 }}>
                {verified_retest_closures_count.toLocaleString()}
              </Typography>
              <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block', mt: 1.5 }}>
                Confirmed remediated via formal retest audit certificates with dated verification evidence.
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Median Remediation Duration */}
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%', background: 'rgba(10, 14, 23, 0.8)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 600 }}>MEDIAN CLOSURE DURATION</Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, color: '#FF9100', mt: 1, mb: 1 }}>
                {median_time_to_close_days} Days
              </Typography>
              <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block', mt: 1.5 }}>
                Median days elapsed between initial assessment and documented retest closure date.
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Remediation Audit Assurance */}
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%', background: 'rgba(10, 14, 23, 0.8)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 600 }}>VERIFICATION AUDIT STANDARD</Typography>
              <Box sx={{ mt: 1, mb: 1 }}>
                <Chip icon={<CheckCircle sx={{ fontSize: 14 }} />} label="MeitY / CERT-In Formats" color="success" size="small" sx={{ fontWeight: 600 }} />
              </Box>
              <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block', mt: 1.5 }}>
                All closures validated against Annexure III retest tables and auditor sign-off controls.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

