import React from 'react';
import { Box, Grid, Card, CardContent, Typography } from '@mui/material';
import {
  Shield,
  Warning,
  ErrorOutline,
  Assessment,
  Speed,
  AutoAwesome,
  Psychology,
  Functions
} from '@mui/icons-material';

function KpiCard({ title, value, subtitle, icon, color = '#00D4FF', badgeText }) {
  return (
    <Card sx={{ bgcolor: '#0B1120', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 2, height: '100%' }}>
      <CardContent sx={{ p: 2.2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {title}
            </Typography>
            <Typography variant="h4" fontWeight={900} sx={{ color, my: 0.3, letterSpacing: -0.5 }}>
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                {subtitle}
              </Typography>
            )}
            {badgeText && (
              <Typography variant="caption" sx={{ color, fontWeight: 700, fontSize: '0.7rem' }}>
                {badgeText}
              </Typography>
            )}
          </Box>
          <Box sx={{ p: 1.2, borderRadius: 2, bgcolor: `${color}18`, display: 'flex' }}>
            {React.cloneElement(icon, { sx: { fontSize: 26, color } })}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

export default function AnomalyKpiStrip({ runSummary, fleetBenchmarks, totalEvaluated, anomaliesDetected }) {
  const tiers = runSummary?.tier_distribution || {};
  const critCount = tiers['CRITICAL_OUTLIER'] || 0;
  const elevCount = tiers['ELEVATED_OUTLIER'] || 0;
  const semanticCount = tiers['SEMANTIC_ANOMALY'] || 0;
  const metricCount = tiers['METRIC_ANOMALY'] || 0;
  const normalCount = tiers['NOMINAL_COMPLIANT'] || 0;

  const total = totalEvaluated || runSummary?.total_reports || 0;
  const anomTotal = anomaliesDetected || runSummary?.anomalies_detected || 0;
  const rate = total > 0 ? ((anomTotal / total) * 100).toFixed(1) : '0.0';

  return (
    <Grid container spacing={2.5} sx={{ mb: 3 }}>
      <Grid item xs={12} sm={6} md={3}>
        <KpiCard
          title="Monitored Fleet Audits"
          value={total}
          subtitle="Cross-agency audit repository"
          badgeText={`${rate}% Outlier Contamination`}
          icon={<Assessment />}
          color="#00D4FF"
        />
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <KpiCard
          title="Critical Risk Outliers"
          value={critCount}
          subtitle="Tri-model consensus agreement"
          badgeText="Immediate CERT-In triage required"
          icon={<ErrorOutline />}
          color="#FF1744"
        />
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <KpiCard
          title="Elevated Anomalies"
          value={elevCount + metricCount}
          subtitle={`${metricCount} metric spike + ${elevCount} elevated`}
          badgeText="Deviates from baseline medians"
          icon={<Warning />}
          color="#FF9100"
        />
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <KpiCard
          title="Semantic / Narrative Outliers"
          value={semanticCount}
          subtitle="SBERT narrative vector deviation"
          badgeText={`Fleet Mean CVSS: ${fleetBenchmarks?.fleet_median_cvss ?? '7.2'}`}
          icon={<Psychology />}
          color="#D500F9"
        />
      </Grid>
    </Grid>
  );
}
