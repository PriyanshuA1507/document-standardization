import React from 'react';
import {
  Grid, Card, CardContent, Typography, Box, Chip, Tooltip as MuiTooltip
} from '@mui/material';
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend
} from 'recharts';
import {
  Timeline, BugReport, Warning, AssignmentTurnedIn, Category
} from '@mui/icons-material';

const GlassTooltip = ({ active, payload, label, unit = '' }) => {
  if (active && payload && payload.length) {
    const isForecast = payload[0]?.payload?.isForecast;
    return (
      <Box sx={{
        background: 'rgba(10, 14, 23, 0.94)',
        backdropFilter: 'blur(16px)',
        border: `1px solid ${isForecast ? 'rgba(0, 230, 118, 0.4)' : 'rgba(0, 212, 255, 0.25)'}`,
        borderRadius: 2,
        p: 1.5,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        minWidth: 170,
      }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.8, gap: 1 }}>
          <Typography variant="caption" sx={{ color: isForecast ? '#00E676' : '#00D4FF', fontWeight: 700 }}>
            Period: {label}
          </Typography>
          {isForecast && (
            <Chip
              label="TimesFM-3 Projected"
              size="small"
              sx={{ height: 18, fontSize: '0.6rem', bgcolor: 'rgba(0, 230, 118, 0.2)', color: '#00E676', fontWeight: 700 }}
            />
          )}
        </Box>
        {payload.map((entry, idx) => (
          <Box key={idx} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, mb: 0.3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: entry.color || entry.stroke || '#00D4FF' }} />
              <Typography variant="caption" sx={{ color: '#94A3B8' }}>{entry.name}:</Typography>
            </Box>
            <Typography variant="caption" sx={{ color: '#E2E8F0', fontWeight: 700 }}>
              {entry.value !== null && entry.value !== undefined ? `${entry.value}${unit}` : '--'}
            </Typography>
          </Box>
        ))}
        <Typography variant="caption" sx={{ color: '#64748B', fontSize: '0.65rem', display: 'block', mt: 0.8, fontStyle: 'italic' }}>
          Click point to drill down into underlying audit findings
        </Typography>
      </Box>
    );
  }
  return null;
};

function ChartWrapper({ title, icon, modelInfo, horizonBadge, helpText, children }) {
  return (
    <Card sx={{
      height: '100%',
      minHeight: 400,
      background: 'rgba(10, 14, 23, 0.85)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <CardContent sx={{ p: 2, pb: 1, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: helpText ? 0.6 : 0, flexWrap: 'wrap', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {icon && React.cloneElement(icon, { sx: { color: '#00D4FF', fontSize: 20 } })}
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#E2E8F0' }}>
              {title}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
            {horizonBadge && (
              <Chip
                label={horizonBadge}
                size="small"
                sx={{
                  height: 22,
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  bgcolor: 'rgba(0, 212, 255, 0.08)',
                  color: '#00D4FF',
                  border: '1px solid rgba(0, 212, 255, 0.25)',
                }}
              />
            )}
            {modelInfo && (
              <MuiTooltip title={`Forecasting Engine: ${modelInfo.model_name || 'N/A'} | Version: ${modelInfo.model_version || 'TimesFM-3'} | Backtested WAPE: ${modelInfo.backtest_metrics?.wape ?? 'N/A'}`}>
                <Chip
                  label={modelInfo.model_name?.includes('TimesFM') ? `TimesFM-3 (WAPE: ${modelInfo.backtest_metrics?.wape})` : modelInfo.model_name ? `${modelInfo.model_name.split(' ')[0]} (WAPE: ${modelInfo.backtest_metrics?.wape})` : 'Baseline'}
                  size="small"
                  sx={{
                    height: 22,
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    bgcolor: modelInfo.model_name?.includes('TimesFM') ? 'rgba(0, 230, 118, 0.15)' : 'rgba(0, 212, 255, 0.1)',
                    color: modelInfo.model_name?.includes('TimesFM') ? '#00E676' : '#00D4FF',
                    border: `1px solid ${modelInfo.model_name?.includes('TimesFM') ? 'rgba(0, 230, 118, 0.4)' : 'rgba(0, 212, 255, 0.25)'}`,
                  }}
                />
              </MuiTooltip>
            )}
          </Box>
        </Box>
        {helpText && (
          <Typography variant="caption" sx={{ color: '#94A3B8', fontSize: '0.73rem', display: 'block', mt: 0.3 }}>
            💡 <strong style={{ color: '#CBD5E1' }}>Plain English:</strong> {helpText}
          </Typography>
        )}
      </CardContent>
      <Box sx={{ p: 2, flex: 1, width: '100%', minHeight: 300 }}>
        {children}
      </Box>
    </Card>
  );
}

export default function FindingTrendsCharts({ metrics, forecastResults, onDrilldown, horizon = 6 }) {
  if (!metrics) return null;

  const {
    total_findings = [],
    new_vs_closed = [],
    severity_over_time = [],
    top_cwes = [],
  } = metrics;

  const targets = forecastResults?.targets || {};
  const activeHorizon = Math.max(1, Number(horizon) || 6);
  const horizonBadgeLabel = `Horizon: +${activeHorizon} Mo`;

  // 1. CHART 1: Total Findings + TimesFM-3 Forecast (Seamless bridge, no gap)
  const totalFindingsForecast = (targets.total_findings?.forecast_points || []).slice(0, activeHorizon);
  const combinedTotalData = [
    ...total_findings.map((d, idx) => {
      const isLast = idx === total_findings.length - 1;
      return {
        period: d.period,
        actual: d.count,
        // Seamlessly bridge the forecast line from the last historical point
        forecast: isLast && totalFindingsForecast.length > 0 ? d.count : null,
        lower_80: isLast && totalFindingsForecast.length > 0 ? d.count : null,
        upper_80: isLast && totalFindingsForecast.length > 0 ? d.count : null,
        isForecast: false,
      };
    }),
    ...totalFindingsForecast.map(f => ({
      period: f.period,
      actual: null,
      forecast: f.predicted,
      lower_80: f.lower_80,
      upper_80: f.upper_80,
      isForecast: true,
    }))
  ];

  // 2. CHART 2: Threat Severity Breakdown (Critical to Low) with Forecast Horizon
  const critForecast = (targets.severity_critical?.forecast_points || []).slice(0, activeHorizon);
  const highForecast = (targets.severity_high?.forecast_points || []).slice(0, activeHorizon);
  const medForecast = (targets.severity_medium?.forecast_points || []).slice(0, activeHorizon);
  const lowForecast = (targets.severity_low?.forecast_points || []).slice(0, activeHorizon);

  const combinedSeverityData = [
    ...severity_over_time.map(d => ({ ...d, isForecast: false })),
    ...critForecast.map((cf, idx) => ({
      period: cf.period,
      critical: cf.predicted,
      high: highForecast[idx]?.predicted ?? 0,
      medium: medForecast[idx]?.predicted ?? 0,
      low: lowForecast[idx]?.predicted ?? 0,
      isForecast: true,
    }))
  ];

  // 3. CHART 3: Discovery Influx vs Verified Retest Closures with Forecast Horizon
  const newForecast = (targets.total_findings?.forecast_points || []).slice(0, activeHorizon);
  const closedForecast = (targets.verified_closures?.forecast_points || []).slice(0, activeHorizon);

  const combinedNewVsClosedData = [
    ...new_vs_closed.map(d => ({ ...d, isForecast: false })),
    ...newForecast.map((nf, idx) => ({
      period: nf.period,
      new_count: nf.predicted,
      closed_count: closedForecast[idx]?.predicted ?? 0,
      isForecast: true,
    }))
  ];

  // 4. CHART 4: Top Root Cause Weaknesses (Recurring CWEs) with Forecast Horizon
  const cweKeys = Object.keys(top_cwes[0] || {}).filter(k => k !== 'period');
  const futurePeriods = (targets.total_findings?.forecast_points || []).slice(0, activeHorizon).map(f => f.period);

  const combinedCweData = [
    ...top_cwes.map(d => ({ ...d, isForecast: false })),
    ...futurePeriods.map((p, idx) => {
      const row = { period: p, isForecast: true };
      cweKeys.forEach(k => {
        const targetKey = `cwe_${k}`;
        const pts = (targets[targetKey]?.forecast_points || []).slice(0, activeHorizon);
        row[k] = pts[idx]?.predicted ?? null;
      });
      return row;
    })
  ];

  const handlePointClick = (state) => {
    if (state && state.activeLabel && onDrilldown) {
      onDrilldown({ period: state.activeLabel });
    }
  };

  return (
    <Box sx={{ mb: 4 }}>
      {/* Section Header */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, color: '#E2E8F0', display: 'flex', alignItems: 'center', gap: 1 }}>
          <Timeline sx={{ color: '#00D4FF' }} /> Key Strategic Vulnerability Trends & TimesFM-3 Forecasts
        </Typography>
        <Typography variant="caption" sx={{ color: '#94A3B8' }}>
          Displaying historical trends dynamically projected across a <strong>{activeHorizon}-month forecast horizon</strong>. Click any point to view underlying audit findings.
        </Typography>
      </Box>

      {/* 4 Core Essential Charts in a clean 2x2 Grid */}
      <Grid container spacing={3}>
        {/* CHART 1: Total Findings & TimesFM-3 Forecast */}
        <Grid item xs={12} md={6}>
          <ChartWrapper
            title="1. Vulnerability Workload & TimesFM-3 Forecast"
            icon={<BugReport />}
            modelInfo={targets.total_findings}
            horizonBadge={horizonBadgeLabel}
            helpText="Shows past vulnerability volume and projects future expected findings over the next months with 80% confidence bands so you can plan patch engineering staffing."
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={combinedTotalData} onClick={handlePointClick}>
                <defs>
                  <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00D4FF" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#00D4FF" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00E676" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#00E676" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="period" stroke="#64748B" fontSize={11} />
                <YAxis stroke="#64748B" fontSize={11} />
                <RechartsTooltip content={<GlassTooltip />} />
                <Legend />
                <Area type="monotone" dataKey="actual" name="Historical Actual" stroke="#00D4FF" fill="url(#actualGrad)" strokeWidth={2} />
                <Area type="monotone" dataKey="forecast" name="TimesFM-3 Prediction" stroke="#00E676" strokeDasharray="5 5" fill="url(#forecastGrad)" strokeWidth={2} />
                <Area type="monotone" dataKey="upper_80" name="80% Upper Bound" stroke="#00E676" strokeOpacity={0.25} fill="transparent" strokeDasharray="2 2" />
                <Area type="monotone" dataKey="lower_80" name="80% Lower Bound" stroke="#00E676" strokeOpacity={0.25} fill="transparent" strokeDasharray="2 2" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartWrapper>
        </Grid>

        {/* CHART 2: Findings by Severity Progression with Projected Horizon */}
        <Grid item xs={12} md={6}>
          <ChartWrapper
            title="2. Threat Severity Breakdown (Critical to Low)"
            icon={<Warning />}
            modelInfo={targets.severity_critical}
            horizonBadge={horizonBadgeLabel}
            helpText="Tracks the proportion of Critical, High, Medium, and Low severity flaws and projects future risk distribution across the forecast horizon."
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={combinedSeverityData} onClick={handlePointClick}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="period" stroke="#64748B" fontSize={11} />
                <YAxis stroke="#64748B" fontSize={11} />
                <RechartsTooltip content={<GlassTooltip />} />
                <Legend />
                <Area type="monotone" dataKey="critical" name="Critical" stackId="1" stroke="#FF1744" fill="#FF1744" fillOpacity={0.65} />
                <Area type="monotone" dataKey="high" name="High" stackId="1" stroke="#FF9100" fill="#FF9100" fillOpacity={0.65} />
                <Area type="monotone" dataKey="medium" name="Medium" stackId="1" stroke="#FFD600" fill="#FFD600" fillOpacity={0.65} />
                <Area type="monotone" dataKey="low" name="Low" stackId="1" stroke="#00E676" fill="#00E676" fillOpacity={0.65} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartWrapper>
        </Grid>

        {/* CHART 3: Discovery Influx vs Verified Retest Closures with Projected Horizon */}
        <Grid item xs={12} md={6}>
          <ChartWrapper
            title="3. Remediation Velocity: New Flaws vs Verified Closures"
            icon={<AssignmentTurnedIn />}
            modelInfo={targets.verified_closures}
            horizonBadge={horizonBadgeLabel}
            helpText="Compares historical and projected newly discovered vulnerabilities against anticipated retest closures across the forecast horizon."
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={combinedNewVsClosedData} onClick={handlePointClick}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="period" stroke="#64748B" fontSize={11} />
                <YAxis stroke="#64748B" fontSize={11} />
                <RechartsTooltip content={<GlassTooltip />} />
                <Legend />
                <Bar dataKey="new_count" name="New Findings Discovered" fill="#00D4FF" radius={[4, 4, 0, 0]} />
                <Bar dataKey="closed_count" name="Verified Retest Closures" fill="#00E676" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartWrapper>
        </Grid>

        {/* CHART 4: Top Recurring Weakness Classes (Top CWEs) with Projected Horizon */}
        <Grid item xs={12} md={6}>
          <ChartWrapper
            title="4. Top Root Cause Weaknesses (Recurring CWEs)"
            icon={<Category />}
            horizonBadge={horizonBadgeLabel}
            helpText="Identifies historical recurring defect categories (e.g. Broken Access Control, SQL Injection) and projects their trajectory across the forecast horizon."
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={combinedCweData} onClick={handlePointClick}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="period" stroke="#64748B" fontSize={11} />
                <YAxis stroke="#64748B" fontSize={11} />
                <RechartsTooltip content={<GlassTooltip />} />
                <Legend />
                {cweKeys.map((cweKey, i) => {
                  const colors = ['#00D4FF', '#00E676', '#FF9100', '#E040FB', '#FF1744'];
                  return (
                    <Line key={cweKey} type="monotone" dataKey={cweKey} name={cweKey} stroke={colors[i % colors.length]} strokeWidth={2.5} dot={{ r: 3 }} />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </ChartWrapper>
        </Grid>
      </Grid>
    </Box>
  );
}
