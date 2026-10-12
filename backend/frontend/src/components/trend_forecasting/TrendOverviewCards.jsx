import React from 'react';
import {
  Grid, Card, CardContent, Typography, Box, Chip, Tooltip
} from '@mui/material';
import {
  TrendingUp, TrendingDown, TrendingFlat, BugReport,
  NewReleases, Warning, CheckCircle, Replay, Speed, Devices
} from '@mui/icons-material';

function KpiCard({ title, value, subtitle, changePct, color, icon, priorMissing, tooltip }) {
  const renderTrend = () => {
    if (priorMissing) {
      return (
        <Tooltip title="Prior period data is missing or incomparable for baseline delta.">
          <Chip label="Baseline N/A" size="small" sx={{ height: 20, fontSize: '0.65rem', bgcolor: 'rgba(255,255,255,0.06)', color: '#94A3B8' }} />
        </Tooltip>
      );
    }
    if (changePct === undefined || changePct === null) return null;

    const isPositive = changePct > 0;
    const isNeutral = changePct === 0;

    return (
      <Chip
        icon={isNeutral ? <TrendingFlat sx={{ fontSize: '12px !important' }} /> : isPositive ? <TrendingUp sx={{ fontSize: '12px !important' }} /> : <TrendingDown sx={{ fontSize: '12px !important' }} />}
        label={`${isPositive ? '+' : ''}${changePct}%`}
        size="small"
        sx={{
          height: 20,
          fontSize: '0.7rem',
          fontWeight: 700,
          bgcolor: isPositive ? 'rgba(255, 23, 68, 0.15)' : 'rgba(0, 230, 118, 0.15)',
          color: isPositive ? '#FF1744' : '#00E676',
          border: `1px solid ${isPositive ? 'rgba(255, 23, 68, 0.3)' : 'rgba(0, 230, 118, 0.3)'}`,
        }}
      />
    );
  };

  return (
    <Card sx={{
      height: '100%',
      background: 'rgba(10, 14, 23, 0.75)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <Box sx={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        bgcolor: color || '#00D4FF'
      }} />
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Tooltip title={tooltip || ''}>
            <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {title}
            </Typography>
          </Tooltip>
          <Box sx={{ color: color || '#00D4FF', opacity: 0.8 }}>
            {icon}
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, my: 0.5 }}>
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#E2E8F0', fontSize: '1.75rem', letterSpacing: '-0.02em' }}>
            {value !== undefined && value !== null ? value : '--'}
          </Typography>
          {renderTrend()}
        </Box>

        {subtitle && (
          <Typography variant="caption" sx={{ color: '#94A3B8', fontSize: '0.72rem', display: 'block', mt: 0.5 }}>
            {subtitle}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

export default function TrendOverviewCards({ overview }) {
  if (!overview) return null;

  const {
    total_findings = {},
    new_findings = {},
    repeat_findings = {},
    open_critical = {},
    open_high = {},
    critical_high_backlog = {},
    verified_closures = {},
    mean_cvss = {},
    mean_epss = {},
    findings_per_100_assets = {},
    has_comparable_prior_period = false,
  } = overview;

  return (
    <Box sx={{ mb: 3 }}>
      <Grid container spacing={2}>
        {/* 1. Total Distinct Findings */}
        <Grid item xs={12} sm={6} md={4} lg={2.4}>
          <KpiCard
            title="Total Findings"
            value={total_findings.value?.toLocaleString()}
            subtitle="Distinct findings in selected period"
            changePct={total_findings.change_pct}
            priorMissing={!has_comparable_prior_period}
            color="#00D4FF"
            icon={<BugReport sx={{ fontSize: 22 }} />}
            tooltip="Count of unique finding IDs observed within the timeframe."
          />
        </Grid>

        {/* 2. New Findings */}
        <Grid item xs={12} sm={6} md={4} lg={2.4}>
          <KpiCard
            title="New Findings"
            value={new_findings.value?.toLocaleString()}
            subtitle="First-time vulnerabilities observed"
            changePct={new_findings.change_pct}
            priorMissing={!has_comparable_prior_period}
            color="#00E676"
            icon={<NewReleases sx={{ fontSize: 22 }} />}
            tooltip="Findings classified as New or first recorded in the period."
          />
        </Grid>

        {/* 3. Open Critical Findings */}
        <Grid item xs={12} sm={6} md={4} lg={2.4}>
          <KpiCard
            title="Open Critical"
            value={open_critical.value?.toLocaleString()}
            subtitle="Latest-known Open Critical severity"
            changePct={null}
            priorMissing={true}
            color="#FF1744"
            icon={<Warning sx={{ fontSize: 22 }} />}
            tooltip="Latest-known findings with Critical severity and Open remediation status."
          />
        </Grid>

        {/* 4. Open High Findings */}
        <Grid item xs={12} sm={6} md={4} lg={2.4}>
          <KpiCard
            title="Open High"
            value={open_high.value?.toLocaleString()}
            subtitle="Latest-known Open High severity"
            changePct={null}
            priorMissing={true}
            color="#FF9100"
            icon={<Warning sx={{ fontSize: 22 }} />}
            tooltip="Latest-known findings with High severity and Open status."
          />
        </Grid>

        {/* 5. Critical + High Backlog */}
        <Grid item xs={12} sm={6} md={4} lg={2.4}>
          <KpiCard
            title="Critical + High Backlog"
            value={critical_high_backlog.value?.toLocaleString()}
            subtitle="Latest-known Critical & High findings"
            changePct={null}
            priorMissing={true}
            color="#E040FB"
            icon={<Warning sx={{ fontSize: 22 }} />}
            tooltip="Combined open Critical + High vulnerabilities in latest audit snapshot."
          />
        </Grid>

        {/* 6. Verified Closures */}
        <Grid item xs={12} sm={6} md={4} lg={2.4}>
          <KpiCard
            title="Verified Closures"
            value={verified_closures.value?.toLocaleString()}
            subtitle="Retest verified & closed findings"
            changePct={verified_closures.change_pct}
            priorMissing={!has_comparable_prior_period}
            color="#00E676"
            icon={<CheckCircle sx={{ fontSize: 22 }} />}
            tooltip="Findings confirmed closed via retest closure appendices."
          />
        </Grid>

        {/* 7. Repeat Findings */}
        <Grid item xs={12} sm={6} md={4} lg={2.4}>
          <KpiCard
            title="Repeat Findings"
            value={repeat_findings.value?.toLocaleString()}
            subtitle="Recurring audit observations"
            changePct={repeat_findings.change_pct}
            priorMissing={!has_comparable_prior_period}
            color="#FFD600"
            icon={<Replay sx={{ fontSize: 22 }} />}
            tooltip="Findings classified as Repeat in source audit reports."
          />
        </Grid>

        {/* 8. Mean CVSS & EPSS */}
        <Grid item xs={12} sm={6} md={4} lg={2.4}>
          <KpiCard
            title="Mean CVSS / EPSS"
            value={mean_cvss.value ? `${mean_cvss.value} / 10` : '--'}
            subtitle={mean_epss.is_sparse ? 'EPSS: 0% populated in source' : `Mean EPSS: ${mean_epss.value}`}
            changePct={null}
            priorMissing={true}
            color="#00D4FF"
            icon={<Speed sx={{ fontSize: 22 }} />}
            tooltip={`Average CVSS score across ${mean_cvss.sample_size || 0} scored findings.`}
          />
        </Grid>

        {/* 9. Findings Per 100 Assets */}
        <Grid item xs={12} sm={6} md={4} lg={2.4}>
          <KpiCard
            title="Findings / 100 Assets"
            value={findings_per_100_assets.value || 0}
            subtitle={`Normalized across ${findings_per_100_assets.denominator_assets || 0} assets`}
            changePct={null}
            priorMissing={true}
            color="#7C4DFF"
            icon={<Devices sx={{ fontSize: 22 }} />}
            tooltip="Distinct findings divided by distinct assessed assets in engagement scope * 100."
          />
        </Grid>
      </Grid>
    </Box>
  );
}

