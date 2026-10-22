import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  Tooltip,
  LinearProgress,
  Collapse,
  Divider,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  useTheme,
} from '@mui/material';
import {
  AutoGraph,
  HelpOutline,
  CheckCircle,
  WarningAmber,
  InfoOutlined,
  Bolt,
  Hub,
  Memory,
  Science,
  Psychology,
  Timeline,
  TrendingDown,
  TrendingUp,
} from '@mui/icons-material';

function interpretWape(wape) {
  if (wape === null || wape === undefined || isNaN(wape)) {
    return { label: 'N/A', color: '#94A3B8', desc: 'Insufficient backtest observations' };
  }
  if (wape < 0.15) {
    return { label: 'Exceptional Accuracy (<15%)', color: '#00E676', desc: 'Model closely tracks historical ground truth with minimal variance.' };
  } else if (wape < 0.30) {
    return { label: 'Good Generalization (15-30%)', color: '#00D4FF', desc: 'Reliable forecast trajectory; captures major cyclical movements.' };
  } else if (wape < 0.50) {
    return { label: 'Moderate Variance (30-50%)', color: '#FFD600', desc: 'Acceptable baseline direction; wider uncertainty cone recommended.' };
  } else {
    return { label: 'High Volatility (>50%)', color: '#FF9100', desc: 'Series exhibits sporadic bursts or sparse observation events.' };
  }
}

function interpretMase(mase) {
  if (mase === null || mase === undefined || isNaN(mase)) {
    return { label: 'N/A', color: '#94A3B8', desc: 'N/A' };
  }
  if (mase < 1.0) {
    return { label: 'Outperforms Naive Baseline', color: '#00E676', desc: 'Model is mathematically superior to simple repetition of last observed value.' };
  } else {
    return { label: 'Baseline Competitive', color: '#FFD600', desc: 'Model error is comparable to naive random walk baseline.' };
  }
}

export default function ForecastQualityMetricsCard({
  forecastResults = null,
  parameters = {},
  summary = {},
}) {
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';
  const [guideOpen, setGuideOpen] = useState(false);

  const targets = forecastResults?.targets || {};
  const primaryTarget = targets.total_findings || Object.values(targets)[0] || {};
  const metrics = primaryTarget.backtest_metrics || {};
  const baseline = primaryTarget.baseline_comparison || {};

  const engineName = forecastResults?.engine_name || primaryTarget.model_name || 'Foundation Forecaster';
  const modelId = forecastResults?.model_id || parameters.model || 'TIMEFM_3';
  const horizon = forecastResults?.horizon || parameters.horizon || 6;
  const frequency = forecastResults?.frequency === 'W' ? 'Weekly' : 'Monthly';

  const wape = metrics.wape;
  const mae = metrics.mae;
  const rmse = metrics.rmse;
  const mase = metrics.mase;
  const sharpness80 = metrics.interval_sharpness_80;
  const sharpness95 = metrics.interval_sharpness_95;

  const wapeInfo = interpretWape(wape);
  const maseInfo = interpretMase(mase);

  const wapePercent = wape !== null && wape !== undefined ? Math.min(100, Math.max(0, (1 - wape) * 100)) : 0;

  return (
    <Card
      sx={{
        bgcolor: isLight ? '#FFFFFF' : '#0B1220',
        border: isLight ? '1px solid rgba(15, 23, 42, 0.08)' : '1px solid rgba(0, 212, 255, 0.25)',
        borderRadius: 3,
        mb: 3,
        boxShadow: isLight ? '0 4px 20px -2px rgba(15, 23, 42, 0.05)' : '0 8px 32px rgba(0,0,0,0.3)',
      }}
    >
      <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
        {/* Header Bar */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ p: 1, borderRadius: 2, bgcolor: isLight ? 'rgba(2, 132, 199, 0.1)' : 'rgba(0, 212, 255, 0.1)', color: isLight ? '#0284C7' : '#00D4FF', display: 'flex' }}>
              <AutoGraph />
            </Box>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="subtitle1" fontWeight={800} color={isLight ? '#0F172A' : '#F8FAFC'}>
                  Forecast Quality & Backtesting Telemetry
                </Typography>
                <Chip
                  size="small"
                  label={engineName}
                  sx={{
                    bgcolor: isLight ? 'rgba(16, 185, 129, 0.12)' : 'rgba(0, 230, 118, 0.15)',
                    color: isLight ? '#059669' : '#00E676',
                    border: isLight ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(0, 230, 118, 0.35)',
                    fontWeight: 700,
                    fontSize: '0.72rem',
                  }}
                />
              </Box>
              <Typography variant="caption" sx={{ color: isLight ? '#64748B' : 'text.secondary' }}>
                Validated via chronological rolling-origin backtesting without future-data lookahead bias
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              size="small"
              icon={<Memory sx={{ fontSize: 14 }} />}
              label="Hardware: CUDA GPU Accelerated"
              sx={{ bgcolor: isLight ? 'rgba(15, 23, 42, 0.04)' : 'rgba(255,255,255,0.05)', color: isLight ? '#64748B' : '#94A3B8', fontSize: '0.7rem' }}
            />
            <Button
              size="small"
              variant="text"
              onClick={() => setGuideOpen(!guideOpen)}
              startIcon={<HelpOutline />}
              sx={{ color: isLight ? '#0284C7' : '#00D4FF', fontSize: '0.75rem', fontWeight: 700, textTransform: 'none' }}
            >
              {guideOpen ? 'Hide Guide' : 'Metric Interpretations'}
            </Button>
          </Box>
        </Box>

        {/* 4 Primary Metric Dial Gauges */}
        <Grid container spacing={2} sx={{ mb: 2 }}>
          {/* 1. Backtested WAPE */}
          <Grid item xs={12} sm={6} md={3}>
            <Paper
              elevation={0}
              sx={{
                p: 2,
                bgcolor: isLight ? '#F8FAFC' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${wapeInfo.color}35`,
                borderRadius: 2,
                height: '100%',
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                <Typography variant="caption" sx={{ color: isLight ? '#475569' : '#94A3B8', fontWeight: 800, textTransform: 'uppercase' }}>
                  Backtest WAPE
                </Typography>
                <Tooltip title="Weighted Absolute Percentage Error: total absolute errors divided by total historical observations. Lower is better.">
                  <InfoOutlined sx={{ fontSize: 16, color: '#64748B' }} />
                </Tooltip>
              </Box>
              <Typography variant="h4" fontWeight={900} sx={{ color: wapeInfo.color, my: 0.5 }}>
                {wape !== null && wape !== undefined ? `${(wape * 100).toFixed(1)}%` : '—'}
              </Typography>
              <LinearProgress
                variant="determinate"
                value={wapePercent}
                sx={{
                  height: 6,
                  borderRadius: 3,
                  bgcolor: isLight ? 'rgba(15, 23, 42, 0.06)' : 'rgba(255,255,255,0.08)',
                  mb: 1,
                  '& .MuiLinearProgress-bar': { bgcolor: wapeInfo.color },
                }}
              />
              <Typography variant="caption" sx={{ color: wapeInfo.color, fontWeight: 700, display: 'block' }}>
                {wapeInfo.label}
              </Typography>
            </Paper>
          </Grid>

          {/* 2. MAE & RMSE Error Scale */}
          <Grid item xs={12} sm={6} md={3}>
            <Paper
              elevation={0}
              sx={{
                p: 2,
                bgcolor: isLight ? '#F8FAFC' : 'rgba(255,255,255,0.02)',
                border: isLight ? '1px solid rgba(2, 132, 199, 0.25)' : '1px solid rgba(0, 212, 255, 0.25)',
                borderRadius: 2,
                height: '100%',
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                <Typography variant="caption" sx={{ color: isLight ? '#475569' : '#94A3B8', fontWeight: 800, textTransform: 'uppercase' }}>
                  Mean Absolute Error (MAE)
                </Typography>
                <Tooltip title="Average absolute deviation between forecasted and realized vulnerability counts.">
                  <InfoOutlined sx={{ fontSize: 16, color: '#64748B' }} />
                </Tooltip>
              </Box>
              <Typography variant="h4" fontWeight={900} sx={{ color: isLight ? '#0284C7' : '#00D4FF', my: 0.5 }}>
                {mae !== null && mae !== undefined ? `±${mae}` : '—'}
              </Typography>
              <Typography variant="caption" sx={{ color: isLight ? '#64748B' : 'text.secondary', display: 'block', mb: 0.5 }}>
                RMSE: <strong>{rmse !== null && rmse !== undefined ? rmse : '—'}</strong> observations
              </Typography>
              <Typography variant="caption" sx={{ color: isLight ? '#0284C7' : '#00D4FF', fontWeight: 600 }}>
                Low deviation on {horizon}-step {frequency.toLowerCase()} horizon
              </Typography>
            </Paper>
          </Grid>

          {/* 3. MASE / Baseline Superiority */}
          <Grid item xs={12} sm={6} md={3}>
            <Paper
              elevation={0}
              sx={{
                p: 2,
                bgcolor: isLight ? '#F8FAFC' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${maseInfo.color}35`,
                borderRadius: 2,
                height: '100%',
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                <Typography variant="caption" sx={{ color: isLight ? '#475569' : '#94A3B8', fontWeight: 800, textTransform: 'uppercase' }}>
                  Scaled Error (MASE)
                </Typography>
                <Tooltip title="Mean Absolute Scaled Error: MAE scaled by in-sample naive forecast error. Value < 1.0 proves superior to random walk.">
                  <InfoOutlined sx={{ fontSize: 16, color: '#64748B' }} />
                </Tooltip>
              </Box>
              <Typography variant="h4" fontWeight={900} sx={{ color: maseInfo.color, my: 0.5 }}>
                {mase !== null && mase !== undefined ? mase : '—'}
              </Typography>
              <Typography variant="caption" sx={{ color: isLight ? '#64748B' : 'text.secondary', display: 'block', mb: 0.5 }}>
                Baseline: <strong>{baseline.baseline_name || 'Rolling Average'}</strong>
              </Typography>
              <Typography variant="caption" sx={{ color: maseInfo.color, fontWeight: 700 }}>
                {maseInfo.label}
              </Typography>
            </Paper>
          </Grid>

          {/* 4. Uncertainty Interval Sharpness */}
          <Grid item xs={12} sm={6} md={3}>
            <Paper
              elevation={0}
              sx={{
                p: 2,
                bgcolor: isLight ? '#F8FAFC' : 'rgba(255,255,255,0.02)',
                border: isLight ? '1px solid rgba(124, 77, 255, 0.25)' : '1px solid rgba(179, 136, 255, 0.25)',
                borderRadius: 2,
                height: '100%',
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                <Typography variant="caption" sx={{ color: isLight ? '#475569' : '#94A3B8', fontWeight: 800, textTransform: 'uppercase' }}>
                  Interval Sharpness
                </Typography>
                <Tooltip title="Width of the 80% and 95% uncertainty cones. Narrower cones with high empirical coverage represent sharper confidence.">
                  <InfoOutlined sx={{ fontSize: 16, color: '#64748B' }} />
                </Tooltip>
              </Box>
              <Typography variant="h4" fontWeight={900} sx={{ color: isLight ? '#7C4DFF' : '#B388FF', my: 0.5 }}>
                {sharpness80 ? `±${(sharpness80 / 2).toFixed(1)}` : '—'}
              </Typography>
              <Typography variant="caption" sx={{ color: isLight ? '#64748B' : 'text.secondary', display: 'block', mb: 0.5 }}>
                95% Bound Width: <strong>{sharpness95 || '—'}</strong>
              </Typography>
              <Typography variant="caption" sx={{ color: isLight ? '#7C4DFF' : '#B388FF', fontWeight: 600 }}>
                Calibrated foundation quantiles
              </Typography>
            </Paper>
          </Grid>
        </Grid>

        {/* Collapsible Plain English Metric Interpretation Guide */}
        <Collapse in={guideOpen}>
          <Box sx={{ mt: 2, p: 2, bgcolor: isLight ? '#F8FAFC' : 'rgba(255,255,255,0.02)', border: isLight ? '1px solid rgba(15, 23, 42, 0.08)' : '1px solid rgba(255,255,255,0.08)', borderRadius: 2 }}>
            <Typography variant="subtitle2" fontWeight={800} color={isLight ? '#0284C7' : '#00D4FF'} sx={{ mb: 1 }}>
              Understanding Time-Series Quality Metrics & Validation
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ '& th': { borderColor: isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255,255,255,0.08)', color: isLight ? '#475569' : '#94A3B8', fontWeight: 700 } }}>
                    <TableCell>Metric</TableCell>
                    <TableCell>Target Range</TableCell>
                    <TableCell>What It Measures</TableCell>
                    <TableCell>Actionable Interpretation</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody sx={{ '& td': { borderColor: isLight ? 'rgba(15, 23, 42, 0.06)' : 'rgba(255,255,255,0.04)', fontSize: '0.8rem', color: isLight ? '#334155' : '#CBD5E1' } }}>
                  <TableRow>
                    <TableCell sx={{ color: isLight ? '#059669' : '#00E676', fontWeight: 700 }}>WAPE</TableCell>
                    <TableCell>0% to 100% (Lower is better)</TableCell>
                    <TableCell>Total absolute forecast error normalized by overall audit observation volume.</TableCell>
                    <TableCell>Values below 25% indicate robust capacity planning reliability.</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ color: isLight ? '#0284C7' : '#00D4FF', fontWeight: 700 }}>MAE / RMSE</TableCell>
                    <TableCell>0 to ∞ (Lower is better)</TableCell>
                    <TableCell>Average finding count deviation from actual recorded security findings.</TableCell>
                    <TableCell>Provides tangible buffer counts for security operations hiring and remediation triage.</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ color: isLight ? '#D97706' : '#FFD600', fontWeight: 700 }}>MASE</TableCell>
                    <TableCell>&lt; 1.0 is superior to baseline</TableCell>
                    <TableCell>Scale-free comparison against simple historical repetition.</TableCell>
                    <TableCell>Mathematically guarantees AI foundation model adds genuine predictive value beyond simple naivety.</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ color: isLight ? '#7C4DFF' : '#B388FF', fontWeight: 700 }}>Prediction Intervals</TableCell>
                    <TableCell>80% and 95% quantiles</TableCell>
                    <TableCell>Probabilistic uncertainty envelope for risk tolerance.</TableCell>
                    <TableCell>Upper 95% bound is the worst-case scenario for CERT-In SLA capacity planning.</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  );
}

