import React, { useState } from 'react';
import {
  Box, Card, CardContent, Typography, Grid, Chip, LinearProgress,
  Tooltip, Collapse, IconButton, Alert
} from '@mui/material';
import {
  CheckCircle, Cancel, HelpOutline, ExpandMore, ExpandLess,
  Storage, DateRange, Security, Assessment, VerifiedUser, InfoOutlined
} from '@mui/icons-material';

export default function DataReadinessPanel({ readiness }) {
  const [expanded, setExpanded] = useState(false);

  if (!readiness) return null;

  const {
    total_reports = 0,
    total_findings = 0,
    explicit_dates_count = 0,
    explicit_dates_pct = 0,
    effective_dates_count = 0,
    effective_dates_pct = 0,
    missing_observation_dates = 0,
    missing_observation_dates_pct = 0,
    min_observation_date,
    max_observation_date,
    min_effective_date,
    max_effective_date,
    populated_monthly_buckets_count = 0,
    populated_weekly_buckets_count = 0,
    cvss_coverage_count = 0,
    cvss_coverage_pct = 0,
    epss_coverage_count = 0,
    epss_coverage_pct = 0,
    retest_closure_reports_count = 0,
    total_retest_closures_count = 0,
    assessed_assets_count = 0,
    metric_eligibility = {},
  } = readiness;

  return (
    <Card sx={{ mb: 3, border: '1px solid rgba(0, 212, 255, 0.2)', background: 'rgba(10, 14, 23, 0.75)' }}>
      <CardContent sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Assessment sx={{ color: '#00D4FF', fontSize: 24 }} />
            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem', color: '#E2E8F0' }}>
              Historical Data Readiness & Quality Assessment
            </Typography>
            <Chip
              label={populated_monthly_buckets_count >= 5 ? 'Forecast-Ready' : 'Sparse History'}
              color={populated_monthly_buckets_count >= 5 ? 'success' : 'warning'}
              size="small"
              sx={{ fontWeight: 600, fontSize: '0.75rem' }}
            />
          </Box>
          <IconButton size="small" onClick={() => setExpanded(!expanded)} sx={{ color: '#94A3B8' }}>
            {expanded ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </Box>

        <Typography variant="body2" sx={{ color: '#94A3B8', mb: 2 }}>
          Ground-truth audit evidence evaluation across <strong>{total_reports}</strong> standardized reports and <strong>{total_findings.toLocaleString()}</strong> distinct findings.
        </Typography>

        <Grid container spacing={2}>
          {/* Usable Dates */}
          <Grid item xs={12} sm={6} md={3}>
            <Box sx={{ p: 1.5, borderRadius: 2, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <Typography variant="caption" sx={{ color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <DateRange sx={{ fontSize: 14, color: '#00D4FF' }} /> Observation Dates
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#00D4FF', mt: 0.5 }}>
                {effective_dates_pct}%
              </Typography>
              <Typography variant="caption" sx={{ color: '#94A3B8' }}>
                {effective_dates_count.toLocaleString()} of {total_findings.toLocaleString()} dated ({min_effective_date || 'N/A'} to {max_effective_date || 'N/A'})
              </Typography>
              <LinearProgress
                variant="determinate"
                value={effective_dates_pct}
                sx={{ mt: 1, height: 4, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.05)', '& .MuiLinearProgress-bar': { bgcolor: '#00D4FF' } }}
              />
            </Box>
          </Grid>

          {/* Time Buckets */}
          <Grid item xs={12} sm={6} md={3}>
            <Box sx={{ p: 1.5, borderRadius: 2, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <Typography variant="caption" sx={{ color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Storage sx={{ fontSize: 14, color: '#00E676' }} /> Populated Buckets
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#00E676', mt: 0.5 }}>
                {populated_monthly_buckets_count} Months
              </Typography>
              <Typography variant="caption" sx={{ color: '#94A3B8' }}>
                {populated_weekly_buckets_count} populated weekly periods
              </Typography>
              <LinearProgress
                variant="determinate"
                value={Math.min(100, (populated_monthly_buckets_count / 12) * 100)}
                sx={{ mt: 1, height: 4, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.05)', '& .MuiLinearProgress-bar': { bgcolor: '#00E676' } }}
              />
            </Box>
          </Grid>

          {/* CVSS Coverage */}
          <Grid item xs={12} sm={6} md={3}>
            <Box sx={{ p: 1.5, borderRadius: 2, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <Typography variant="caption" sx={{ color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Security sx={{ fontSize: 14, color: '#FF9100' }} /> CVSS Score Coverage
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#FF9100', mt: 0.5 }}>
                {cvss_coverage_pct}%
              </Typography>
              <Typography variant="caption" sx={{ color: '#94A3B8' }}>
                {cvss_coverage_count.toLocaleString()} scored findings
              </Typography>
              <LinearProgress
                variant="determinate"
                value={cvss_coverage_pct}
                sx={{ mt: 1, height: 4, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.05)', '& .MuiLinearProgress-bar': { bgcolor: '#FF9100' } }}
              />
            </Box>
          </Grid>

          {/* Retest Closures */}
          <Grid item xs={12} sm={6} md={3}>
            <Box sx={{ p: 1.5, borderRadius: 2, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <Typography variant="caption" sx={{ color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <VerifiedUser sx={{ fontSize: 14, color: '#7C4DFF' }} /> Verified Retest Evidence
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#7C4DFF', mt: 0.5 }}>
                {total_retest_closures_count.toLocaleString()} Closures
              </Typography>
              <Typography variant="caption" sx={{ color: '#94A3B8' }}>
                Across {retest_closure_reports_count} retested audit reports
              </Typography>
              <LinearProgress
                variant="determinate"
                value={Math.min(100, (retest_closure_reports_count / 150) * 100)}
                sx={{ mt: 1, height: 4, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.05)', '& .MuiLinearProgress-bar': { bgcolor: '#7C4DFF' } }}
              />
            </Box>
          </Grid>
        </Grid>

        {/* Collapsible Details: Metric Eligibility */}
        <Collapse in={expanded} timeout="auto" unmountOnExit>
          <Box sx={{ mt: 2.5, pt: 2, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#E2E8F0', mb: 1.5 }}>
              Target Metric Forecasting Feasibility & Constraint Audit
            </Typography>
            <Grid container spacing={1.5}>
              {Object.entries(metric_eligibility).map(([key, val]) => {
                const label = key.replace(/_/g, ' ').toUpperCase();
                const isEligible = val.eligible;
                const isLabeled = val.status_labeled_latest_known;

                return (
                  <Grid item xs={12} md={6} key={key}>
                    <Box sx={{
                      p: 1.5, borderRadius: 1.5,
                      background: isEligible ? 'rgba(0, 230, 118, 0.05)' : isLabeled ? 'rgba(255, 145, 0, 0.05)' : 'rgba(255, 23, 68, 0.05)',
                      border: `1px solid ${isEligible ? 'rgba(0, 230, 118, 0.2)' : isLabeled ? 'rgba(255, 145, 0, 0.2)' : 'rgba(255, 23, 68, 0.2)'}`,
                      display: 'flex', alignItems: 'flex-start', gap: 1
                    }}>
                      {isEligible ? (
                        <CheckCircle sx={{ color: '#00E676', fontSize: 18, mt: 0.2 }} />
                      ) : isLabeled ? (
                        <InfoOutlined sx={{ color: '#FF9100', fontSize: 18, mt: 0.2 }} />
                      ) : (
                        <Cancel sx={{ color: '#FF1744', fontSize: 18, mt: 0.2 }} />
                      )}
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: '#E2E8F0', fontSize: '0.8rem' }}>
                          {label}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block', mt: 0.3 }}>
                          {val.reason}
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                );
              })}
            </Grid>

            {epss_coverage_pct === 0 && (
              <Alert severity="info" sx={{ mt: 2, background: 'rgba(124, 77, 255, 0.1)', color: '#E2E8F0', border: '1px solid rgba(124, 77, 255, 0.3)' }}>
                <strong>EPSS Quality Disclosure:</strong> Reported EPSS coverage is currently 0.0% in source PDF audit extractions. The EPSS trend chart provides coverage tracking but forecasting is safely halted to avoid ungrounded synthetic estimates.
              </Alert>
            )}
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  );
}

