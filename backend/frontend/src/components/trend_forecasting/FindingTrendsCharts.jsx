import React from 'react';
import {
  Grid, Card, CardContent, Typography, Box, Chip, Tooltip as MuiTooltip
} from '@mui/material';
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend
} from 'recharts';
import {
  Timeline, TrendingUp, BugReport, Security, Speed,
  Devices, Warning, AssignmentTurnedIn, Layers, Category
} from '@mui/icons-material';

const GlassTooltip = ({ active, payload, label, unit = '' }) => {
  if (active && payload && payload.length) {
    return (
      <Box sx={{
        background: 'rgba(10, 14, 23, 0.92)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(0, 212, 255, 0.25)',
        borderRadius: 2,
        p: 1.5,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        minWidth: 160,
      }}>
        <Typography variant="caption" sx={{ color: '#00D4FF', fontWeight: 700, display: 'block', mb: 0.8 }}>
          Period: {label}
        </Typography>
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
          Click point to drill down into findings
        </Typography>
      </Box>
    );
  }
  return null;
};

function ChartWrapper({ title, icon, modelInfo, children, onDrilldownPeriod }) {
  return (
    <Card sx={{
      height: '100%',
      minHeight: 380,
      background: 'rgba(10, 14, 23, 0.8)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <CardContent sx={{ p: 2, pb: 1, borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {icon && React.cloneElement(icon, { sx: { color: '#00D4FF', fontSize: 20 } })}
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#E2E8F0' }}>
            {title}
          </Typography>
        </Box>
        {modelInfo && (
          <MuiTooltip title={`Model: ${modelInfo.model_name || 'N/A'} (WAPE: ${modelInfo.backtest_metrics?.wape || 'N/A'})`}>
            <Chip
              label={modelInfo.model_name ? `${modelInfo.model_name.split(' ')[0]} (WAPE: ${modelInfo.backtest_metrics?.wape})` : 'Baseline'}
              size="small"
              sx={{ height: 20, fontSize: '0.65rem', bgcolor: 'rgba(0, 212, 255, 0.1)', color: '#00D4FF', border: '1px solid rgba(0, 212, 255, 0.25)' }}
            />
          </MuiTooltip>
        )}
      </CardContent>
      <Box sx={{ p: 2, flex: 1, width: '100%', minHeight: 290 }}>
        {children}
      </Box>
    </Card>
  );
}

export default function FindingTrendsCharts({ metrics, forecastResults, onDrilldown }) {
  if (!metrics) return null;

  const {
    total_findings = [],
    new_vs_closed = [],
    severity_over_time = [],
    backlog_status_over_time = [],
    new_vs_repeat = [],
    mean_cvss = [],
    mean_epss = [],
    top_cwes = [],
    audit_type = [],
    critical_assets = [],
    impact_likelihood = [],
    findings_per_100_assets = [],
  } = metrics;

  const targets = forecastResults?.targets || {};

  // Build combined Total Findings series (actuals + forecast + intervals)
  const totalFindingsForecast = targets.total_findings?.forecast_points || [];
  const combinedTotalData = [
    ...total_findings.map(d => ({ period: d.period, actual: d.count, forecast: null, lower_80: null, upper_80: null })),
    ...totalFindingsForecast.map(f => ({ period: f.period, actual: null, forecast: f.predicted, lower_80: f.lower_80, upper_80: f.upper_80 }))
  ];

  // Build combined Findings per 100 Assets series
  const assetsForecast = targets.findings_per_100_assets?.forecast_points || [];
  const combinedAssetsData = [
    ...findings_per_100_assets.map(d => ({ period: d.period, actual: d.findings_per_100_assets, forecast: null, lower_80: null, upper_80: null })),
    ...assetsForecast.map(f => ({ period: f.period, actual: null, forecast: f.predicted, lower_80: f.lower_80, upper_80: f.upper_80 }))
  ];

  const handlePointClick = (state) => {
    if (state && state.activeLabel && onDrilldown) {
      onDrilldown({ period: state.activeLabel });
    }
  };

  return (
    <Box sx={{ mb: 4 }}>
      <Typography variant="h6" sx={{ fontWeight: 800, color: '#E2E8F0', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Timeline sx={{ color: '#00D4FF' }} /> Finding Trends & Time-Series Projections
      </Typography>

      <Grid container spacing={3}>
        {/* 1. Total Distinct Findings (Actual + Forecast) */}
        <Grid item xs={12} md={6}>
          <ChartWrapper title="1. Total Distinct Findings & Forecast Horizon" icon={<BugReport />} modelInfo={targets.total_findings}>
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
                <Area type="monotone" dataKey="forecast" name="Forecast Prediction" stroke="#00E676" strokeDasharray="5 5" fill="url(#forecastGrad)" strokeWidth={2} />
                <Area type="monotone" dataKey="upper_80" name="80% Upper Bound" stroke="#00E676" strokeOpacity={0.2} fill="transparent" strokeDasharray="2 2" />
                <Area type="monotone" dataKey="lower_80" name="80% Lower Bound" stroke="#00E676" strokeOpacity={0.2} fill="transparent" strokeDasharray="2 2" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartWrapper>
        </Grid>

        {/* 2. New Findings vs Verified Closures */}
        <Grid item xs={12} md={6}>
          <ChartWrapper title="2. New Findings vs Verified Closures" icon={<AssignmentTurnedIn />} modelInfo={targets.verified_closures}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={new_vs_closed} onClick={handlePointClick}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="period" stroke="#64748B" fontSize={11} />
                <YAxis stroke="#64748B" fontSize={11} />
                <RechartsTooltip content={<GlassTooltip />} />
                <Legend />
                <Bar dataKey="new_count" name="New Findings" fill="#00D4FF" radius={[4, 4, 0, 0]} />
                <Bar dataKey="closed_count" name="Verified Closures" fill="#00E676" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartWrapper>
        </Grid>

        {/* 3. Severity Breakdown Over Time */}
        <Grid item xs={12} md={6}>
          <ChartWrapper title="3. Findings by Severity Level" icon={<Warning />} modelInfo={targets.severity_critical}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={severity_over_time} onClick={handlePointClick}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="period" stroke="#64748B" fontSize={11} />
                <YAxis stroke="#64748B" fontSize={11} />
                <RechartsTooltip content={<GlassTooltip />} />
                <Legend />
                <Area type="monotone" dataKey="critical" name="Critical" stackId="1" stroke="#FF1744" fill="#FF1744" fillOpacity={0.6} />
                <Area type="monotone" dataKey="high" name="High" stackId="1" stroke="#FF9100" fill="#FF9100" fillOpacity={0.6} />
                <Area type="monotone" dataKey="medium" name="Medium" stackId="1" stroke="#FFD600" fill="#FFD600" fillOpacity={0.6} />
                <Area type="monotone" dataKey="low" name="Low" stackId="1" stroke="#00E676" fill="#00E676" fillOpacity={0.6} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartWrapper>
        </Grid>

        {/* 4. Status Distribution (Latest-Known) */}
        <Grid item xs={12} md={6}>
          <ChartWrapper title="4. Latest-Known Status Distribution & Backlog" icon={<Layers />}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={backlog_status_over_time} onClick={handlePointClick}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="period" stroke="#64748B" fontSize={11} />
                <YAxis stroke="#64748B" fontSize={11} />
                <RechartsTooltip content={<GlassTooltip />} />
                <Legend />
                <Bar dataKey="open" name="Open" fill="#FF1744" stackId="a" />
                <Bar dataKey="partially_remediated" name="Partially Remediated" fill="#FF9100" stackId="a" />
                <Bar dataKey="closed" name="Closed" fill="#00E676" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </ChartWrapper>
        </Grid>

        {/* 5. New vs Repeat Findings */}
        <Grid item xs={12} md={6}>
          <ChartWrapper title="5. New vs Repeat Audit Findings" icon={<Layers />} modelInfo={targets.repeat_findings}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={new_vs_repeat} onClick={handlePointClick}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="period" stroke="#64748B" fontSize={11} />
                <YAxis stroke="#64748B" fontSize={11} />
                <RechartsTooltip content={<GlassTooltip />} />
                <Legend />
                <Bar dataKey="new" name="First-Time (New)" fill="#00D4FF" />
                <Bar dataKey="repeat" name="Recurring (Repeat)" fill="#FF9100" />
              </BarChart>
            </ResponsiveContainer>
          </ChartWrapper>
        </Grid>

        {/* 6. Mean CVSS Score Over Time */}
        <Grid item xs={12} md={6}>
          <ChartWrapper title="6. Mean CVSS Vulnerability Severity Trend" icon={<Speed />} modelInfo={targets.mean_cvss}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={mean_cvss} onClick={handlePointClick}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="period" stroke="#64748B" fontSize={11} />
                <YAxis domain={[0, 10]} stroke="#64748B" fontSize={11} />
                <RechartsTooltip content={<GlassTooltip unit="/10" />} />
                <Legend />
                <Line type="monotone" dataKey="mean_cvss" name="Mean CVSS (0-10)" stroke="#00D4FF" strokeWidth={2} dot={{ r: 3 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </ChartWrapper>
        </Grid>

        {/* 7. Mean EPSS Score Over Time */}
        <Grid item xs={12} md={6}>
          <ChartWrapper title="7. Mean EPSS Exploitation Risk & Coverage" icon={<Security />}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mean_epss} onClick={handlePointClick}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="period" stroke="#64748B" fontSize={11} />
                <YAxis stroke="#64748B" fontSize={11} />
                <RechartsTooltip content={<GlassTooltip unit="%" />} />
                <Legend />
                <Bar dataKey="coverage_pct" name="EPSS Coverage % (Source Data)" fill="#7C4DFF" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartWrapper>
        </Grid>

        {/* 8. Findings by CWE Category */}
        <Grid item xs={12} md={6}>
          <ChartWrapper title="8. Common Weakness Categories (Top CWEs)" icon={<Category />}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={top_cwes} onClick={handlePointClick}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="period" stroke="#64748B" fontSize={11} />
                <YAxis stroke="#64748B" fontSize={11} />
                <RechartsTooltip content={<GlassTooltip />} />
                <Legend />
                {Object.keys(top_cwes[0] || {}).filter(k => k !== 'period').map((cweKey, i) => {
                  const colors = ['#00D4FF', '#00E676', '#FF9100', '#E040FB', '#FF1744'];
                  return (
                    <Line key={cweKey} type="monotone" dataKey={cweKey} name={cweKey} stroke={colors[i % colors.length]} strokeWidth={2} dot={false} />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </ChartWrapper>
        </Grid>

        {/* 9. Findings by Audit Type */}
        <Grid item xs={12} md={6}>
          <ChartWrapper title="9. Finding Volumes by Audit Category" icon={<Layers />}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={audit_type} onClick={handlePointClick}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="period" stroke="#64748B" fontSize={11} />
                <YAxis stroke="#64748B" fontSize={11} />
                <RechartsTooltip content={<GlassTooltip />} />
                <Legend />
                {Object.keys(audit_type[0] || {}).filter(k => k !== 'period').map((atKey, i) => {
                  const colors = ['#00D4FF', '#7C4DFF', '#00E676', '#FFD600'];
                  return (
                    <Bar key={atKey} dataKey={atKey} name={atKey} stackId="at" fill={colors[i % colors.length]} />
                  );
                })}
              </BarChart>
            </ResponsiveContainer>
          </ChartWrapper>
        </Grid>

        {/* 10. Critical Asset Findings */}
        <Grid item xs={12} md={6}>
          <ChartWrapper title="10. Vulnerabilities Linked to Critical Assets" icon={<Devices />}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={critical_assets} onClick={handlePointClick}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="period" stroke="#64748B" fontSize={11} />
                <YAxis stroke="#64748B" fontSize={11} />
                <RechartsTooltip content={<GlassTooltip />} />
                <Legend />
                <Area type="monotone" dataKey="critical_asset_findings" name="Findings on Critical Assets" stroke="#FF1744" fill="#FF1744" fillOpacity={0.25} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartWrapper>
        </Grid>

        {/* 11. Impact & Likelihood */}
        <Grid item xs={12} md={6}>
          <ChartWrapper title="11. Impact & Likelihood Level Distributions" icon={<Speed />}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={impact_likelihood} onClick={handlePointClick}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="period" stroke="#64748B" fontSize={11} />
                <YAxis stroke="#64748B" fontSize={11} />
                <RechartsTooltip content={<GlassTooltip />} />
                <Legend />
                <Bar dataKey="impact_major" name="Major Impact" fill="#FF1744" stackId="imp" />
                <Bar dataKey="impact_moderate" name="Moderate Impact" fill="#FF9100" stackId="imp" />
                <Bar dataKey="impact_minor" name="Minor Impact" fill="#00E676" stackId="imp" />
              </BarChart>
            </ResponsiveContainer>
          </ChartWrapper>
        </Grid>

        {/* 12. Findings per 100 Assets */}
        <Grid item xs={12} md={6}>
          <ChartWrapper title="12. Findings Per 100 Assessed Assets & Projection" icon={<Devices />} modelInfo={targets.findings_per_100_assets}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={combinedAssetsData} onClick={handlePointClick}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="period" stroke="#64748B" fontSize={11} />
                <YAxis stroke="#64748B" fontSize={11} />
                <RechartsTooltip content={<GlassTooltip />} />
                <Legend />
                <Line type="monotone" dataKey="actual" name="Historical Rate" stroke="#7C4DFF" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="forecast" name="Forecast Rate" stroke="#00E676" strokeDasharray="5 5" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartWrapper>
        </Grid>
      </Grid>
    </Box>
  );
}

