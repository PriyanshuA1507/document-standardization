import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  Chip,
  Slider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Collapse,
  IconButton,
  Divider,
  Paper,
  Alert,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import {
  Tune,
  ExpandMore,
  ExpandLess,
  RestartAlt,
  PlayArrow,
  CheckCircle,
  AutoAwesome,
  Memory,
  Science,
  Bolt,
  Timeline,
  Speed,
  Psychology,
  Hub,
  Insights,
  ShowChart,
  CompareArrows,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import api from '../../api/axios';

const MODEL_CONFIGS = {
  TIMEFM_3: {
    id: 'TIMEFM_3',
    name: 'Google TimeFM 3.0',
    tagline: 'Zero-Shot 2D Grid Attention Foundation Model',
    description: "Google's 330M-parameter foundation model using 2D patch and grid attention for native multivariate forecasting across co-evolving audit streams.",
    color: '#00E676',
    badge: 'Recommended',
    icon: <Bolt sx={{ fontSize: 24 }} />,
    defaults: {
      horizon: 6,
      context_length: 18,
      frequency: 'M',
    },
  },
  CHRONOS_2: {
    id: 'CHRONOS_2',
    name: 'Amazon Chronos-2',
    tagline: 'Universal In-Context Language Model Forecaster',
    description: 'Amazon AWS foundation transformer treating time series as quantized language tokens with probabilistic Monte Carlo trajectory sampling.',
    color: '#00D4FF',
    badge: 'Probabilistic',
    icon: <Psychology sx={{ fontSize: 24 }} />,
    defaults: {
      horizon: 6,
      num_samples: 50,
      temperature: 0.8,
    },
  },
  MOIRAI_2: {
    id: 'MOIRAI_2',
    name: 'Salesforce Moirai 2.0',
    tagline: 'Multi-Resolution Decoder-Only Quantile Transformer',
    description: 'Salesforce AI Research decoder-only transformer utilizing calibrated quantile loss formulation and multi-token prediction.',
    color: '#B388FF',
    badge: 'Quantile Loss',
    icon: <Hub sx={{ fontSize: 24 }} />,
    defaults: {
      horizon: 6,
      patch_size: 16,
      num_samples: 100,
    },
  },
  ENSEMBLE: {
    id: 'ENSEMBLE',
    name: 'Tri-Model Consensus Ensemble',
    tagline: 'Multi-Engine Backtested Consensus & Auto-Selection',
    description: 'Evaluates TimeFM 3.0, Chronos-2, and Moirai 2.0 simultaneously and selects the optimal lowest-error foundation model per audit channel.',
    color: '#FFD600',
    badge: 'Best Accuracy',
    icon: <AutoAwesome sx={{ fontSize: 24 }} />,
    defaults: {
      horizon: 6,
      selection_strategy: 'best_backtest',
    },
  },
};

const DEFAULT_TARGET_CHANNELS = [
  { key: 'total_findings', label: 'Total Findings Volume', required: true, default: true, desc: 'Overall vulnerability arrival volume' },
  { key: 'severity_critical', label: 'Critical Severity Findings', required: false, default: true, desc: 'P1 critical SLA risks' },
  { key: 'severity_high', label: 'High Severity Findings', required: false, default: true, desc: 'High risk production findings' },
  { key: 'severity_medium', label: 'Medium Severity Findings', required: false, default: true, desc: 'Configuration & hygiene issues' },
  { key: 'severity_low', label: 'Low Severity Findings', required: false, default: false, desc: 'Informational & low severity observations' },
  { key: 'repeat_findings', label: 'Recurrent / Repeat Findings', required: false, default: true, desc: 'Weaknesses reappearing in retests' },
  { key: 'verified_closures', label: 'Verified Remediation Closures', required: false, default: true, desc: 'Confirmed remediation closures' },
  { key: 'mean_cvss', label: 'Average Fleet CVSS Risk', required: false, default: true, desc: 'Mean organizational severity score' },
  { key: 'top_cwes', label: 'Top Weakness Taxonomies', required: false, default: false, desc: 'Top CWE weakness trends' },
];

export default function ForecastingConfigConsole({
  onTriggerRun,
  isRunning = false,
  activeRun = null,
  currentParams = {},
  onOpenCompare = null,
}) {
  const [expanded, setExpanded] = useState(false);
  const [selectedModel, setSelectedModel] = useState(currentParams.model || 'TIMEFM_3');

  const [selectedTargets, setSelectedTargets] = useState(
    currentParams.selected_targets || DEFAULT_TARGET_CHANNELS.filter(c => c.default).map(c => c.key)
  );

  const [modelParams, setModelParams] = useState({
    TIMEFM_3: { ...MODEL_CONFIGS.TIMEFM_3.defaults, horizon: currentParams.horizon || 6 },
    CHRONOS_2: { ...MODEL_CONFIGS.CHRONOS_2.defaults, horizon: currentParams.horizon || 6 },
    MOIRAI_2: { ...MODEL_CONFIGS.MOIRAI_2.defaults, horizon: currentParams.horizon || 6 },
    ENSEMBLE: { ...MODEL_CONFIGS.ENSEMBLE.defaults, horizon: currentParams.horizon || 6 },
  });

  const activeModelMeta = MODEL_CONFIGS[selectedModel] || MODEL_CONFIGS.TIMEFM_3;
  const currentModelParams = modelParams[selectedModel] || {};

  // Auto-Optimizer / Sensitivity state
  const [optimizing, setOptimizing] = useState(false);
  const [sweepResult, setSweepResult] = useState(null);
  const [sweepError, setSweepError] = useState(null);

  const handleRunSensitivitySweep = async () => {
    setOptimizing(true);
    setSweepError(null);
    try {
      const res = await api.post('/api/trend-analysis/optimize-horizon', {
        model: selectedModel,
        selected_targets: selectedTargets,
        horizons: [3, 6, 9, 12],
        date_basis: currentParams.date_basis || 'effective',
        frequency: currentParams.frequency || 'M',
      });
      if (res.data?.status === 'success') {
        setSweepResult(res.data.data);
      }
    } catch (err) {
      setSweepError(err.response?.data?.detail || 'Failed to evaluate horizon sensitivity.');
    } finally {
      setOptimizing(false);
    }
  };

  const handleTargetToggle = (targetKey) => {
    const target = DEFAULT_TARGET_CHANNELS.find(t => t.key === targetKey);
    if (target?.required) return; // Cannot toggle mandatory anchor

    setSelectedTargets(prev =>
      prev.includes(targetKey)
        ? prev.filter(k => k !== targetKey)
        : [...prev, targetKey]
    );
  };

  const handleParamChange = (key, val) => {
    setModelParams(prev => ({
      ...prev,
      [selectedModel]: {
        ...prev[selectedModel],
        [key]: val,
      },
    }));
  };

  const applyPreset = (presetModel, presetTargets, presetParams) => {
    setSelectedModel(presetModel);
    if (presetTargets) setSelectedTargets(presetTargets);
    if (presetParams) {
      setModelParams(prev => ({
        ...prev,
        [presetModel]: { ...prev[presetModel], ...presetParams },
      }));
    }
  };

  const resetDefaults = () => {
    setSelectedModel('TIMEFM_3');
    setSelectedTargets(DEFAULT_TARGET_CHANNELS.filter(c => c.default).map(c => c.key));
    setModelParams({
      TIMEFM_3: { ...MODEL_CONFIGS.TIMEFM_3.defaults },
      CHRONOS_2: { ...MODEL_CONFIGS.CHRONOS_2.defaults },
      MOIRAI_2: { ...MODEL_CONFIGS.MOIRAI_2.defaults },
      ENSEMBLE: { ...MODEL_CONFIGS.ENSEMBLE.defaults },
    });
  };

  const handleExecute = () => {
    const horizonVal = currentModelParams.horizon || 6;
    const payload = {
      model: selectedModel,
      selected_targets: selectedTargets,
      parameters: currentModelParams,
      horizon: horizonVal,
      frequency: currentParams.frequency || 'M',
      date_basis: currentParams.date_basis || 'effective',
      start_date: currentParams.start_date || undefined,
      end_date: currentParams.end_date || undefined,
      severities: currentParams.severity && currentParams.severity !== 'ALL' ? [currentParams.severity] : undefined,
      statuses: currentParams.status && currentParams.status !== 'ALL' ? [currentParams.status] : undefined,
    };
    onTriggerRun(payload);
  };

  return (
    <Card
      sx={{
        bgcolor: '#0B1220',
        border: `1px solid ${activeModelMeta.color}35`,
        borderRadius: 3,
        mb: 3,
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
      }}
    >
      {/* ════════ HEADER BAR ════════ */}
      <Box
        sx={{
          p: 2.5,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 2,
          background: 'linear-gradient(90deg, rgba(13,21,39,0.95) 0%, rgba(15,23,42,0.95) 100%)',
          borderBottom: expanded ? '1px solid rgba(255,255,255,0.08)' : 'none',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              p: 1.2,
              borderRadius: 2,
              bgcolor: `${activeModelMeta.color}15`,
              color: activeModelMeta.color,
              display: 'flex',
            }}
          >
            <Tune />
          </Box>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle1" fontWeight={800} sx={{ color: '#F8FAFC' }}>
                Forecasting Engine & Model Console
              </Typography>
              <Chip
                size="small"
                label={activeModelMeta.name}
                sx={{
                  bgcolor: `${activeModelMeta.color}20`,
                  color: activeModelMeta.color,
                  border: `1px solid ${activeModelMeta.color}40`,
                  fontWeight: 800,
                  fontSize: '0.72rem',
                }}
              />
              <Chip
                size="small"
                label={`${selectedTargets.length} target streams`}
                sx={{
                  bgcolor: 'rgba(255,255,255,0.05)',
                  color: '#94A3B8',
                  fontSize: '0.72rem',
                }}
              />
              <Chip
                size="small"
                label={`${currentModelParams.horizon || 6} Steps`}
                sx={{
                  bgcolor: 'rgba(0, 212, 255, 0.1)',
                  color: '#00D4FF',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                }}
              />
            </Box>
            <Typography variant="caption" color="text.secondary">
              Select foundation forecasting model, configure probabilistic hyperparameters, and toggle target risk streams
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {onOpenCompare && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<CompareArrows />}
              onClick={onOpenCompare}
              sx={{
                color: '#00D4FF',
                borderColor: 'rgba(0, 212, 255, 0.3)',
                fontWeight: 700,
                textTransform: 'none',
                '&:hover': { borderColor: '#00D4FF', bgcolor: 'rgba(0, 212, 255, 0.08)' },
              }}
            >
              Model Benchmark Matrix
            </Button>
          )}

          <Button
            size="small"
            variant="outlined"
            onClick={() => setExpanded(!expanded)}
            endIcon={expanded ? <ExpandLess /> : <ExpandMore />}
            sx={{
              color: '#94A3B8',
              borderColor: 'rgba(255,255,255,0.15)',
              fontWeight: 700,
              textTransform: 'none',
              '&:hover': { borderColor: activeModelMeta.color, color: activeModelMeta.color },
            }}
          >
            {expanded ? 'Hide Controls' : 'Configure Model & Parameters'}
          </Button>

          <Button
            variant="contained"
            disabled={isRunning}
            onClick={handleExecute}
            startIcon={<PlayArrow />}
            sx={{
              bgcolor: activeModelMeta.color,
              color: '#0A0E17',
              fontWeight: 800,
              px: 2.5,
              py: 0.8,
              borderRadius: 2,
              boxShadow: `0 0 16px ${activeModelMeta.color}40`,
              '&:hover': { bgcolor: activeModelMeta.color, filter: 'brightness(1.1)' },
              '&:disabled': { bgcolor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)' },
            }}
          >
            {isRunning ? 'Forecasting...' : `Run ${activeModelMeta.name}`}
          </Button>
        </Box>
      </Box>

      {/* ════════ EXPANDABLE CONFIGURATION BODY ════════ */}
      <Collapse in={expanded}>
        <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
          {/* Quick Presets Bar */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 0.8, mb: 1.2 }}>
              <AutoAwesome sx={{ fontSize: 16, color: '#FFD600' }} />
              Quick Model Presets:
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
              <Chip
                label="Google TimeFM 3.0 Zero-Shot (Recommended)"
                onClick={() => applyPreset('TIMEFM_3', ['total_findings', 'severity_critical', 'severity_high', 'severity_medium', 'repeat_findings', 'verified_closures', 'mean_cvss'], { horizon: 6, context_length: 18 })}
                clickable
                variant={selectedModel === 'TIMEFM_3' ? 'filled' : 'outlined'}
                sx={{
                  bgcolor: selectedModel === 'TIMEFM_3' ? 'rgba(0,230,118,0.15)' : 'transparent',
                  color: selectedModel === 'TIMEFM_3' ? '#00E676' : '#94A3B8',
                  borderColor: selectedModel === 'TIMEFM_3' ? '#00E676' : 'rgba(255,255,255,0.1)',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                }}
              />
              <Chip
                label="Amazon Chronos-2 In-Context Probabilistic"
                onClick={() => applyPreset('CHRONOS_2', ['total_findings', 'severity_critical', 'severity_high', 'repeat_findings', 'verified_closures'], { horizon: 6, num_samples: 50, temperature: 0.8 })}
                clickable
                variant={selectedModel === 'CHRONOS_2' ? 'filled' : 'outlined'}
                sx={{
                  bgcolor: selectedModel === 'CHRONOS_2' ? 'rgba(0,212,255,0.15)' : 'transparent',
                  color: selectedModel === 'CHRONOS_2' ? '#00D4FF' : '#94A3B8',
                  borderColor: selectedModel === 'CHRONOS_2' ? '#00D4FF' : 'rgba(255,255,255,0.1)',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                }}
              />
              <Chip
                label="Salesforce Moirai 2.0 Multi-Resolution"
                onClick={() => applyPreset('MOIRAI_2', ['total_findings', 'severity_critical', 'severity_high', 'mean_cvss', 'verified_closures'], { horizon: 6, patch_size: 16, num_samples: 100 })}
                clickable
                variant={selectedModel === 'MOIRAI_2' ? 'filled' : 'outlined'}
                sx={{
                  bgcolor: selectedModel === 'MOIRAI_2' ? 'rgba(179,136,255,0.15)' : 'transparent',
                  color: selectedModel === 'MOIRAI_2' ? '#B388FF' : '#94A3B8',
                  borderColor: selectedModel === 'MOIRAI_2' ? '#B388FF' : 'rgba(255,255,255,0.1)',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                }}
              />
              <Chip
                label="Tri-Model Consensus & Auto-Selection"
                onClick={() => applyPreset('ENSEMBLE', ['total_findings', 'severity_critical', 'severity_high', 'severity_medium', 'repeat_findings', 'verified_closures', 'mean_cvss'], { horizon: 6, selection_strategy: 'best_backtest' })}
                clickable
                variant={selectedModel === 'ENSEMBLE' ? 'filled' : 'outlined'}
                sx={{
                  bgcolor: selectedModel === 'ENSEMBLE' ? 'rgba(255,214,0,0.15)' : 'transparent',
                  color: selectedModel === 'ENSEMBLE' ? '#FFD600' : '#94A3B8',
                  borderColor: selectedModel === 'ENSEMBLE' ? '#FFD600' : 'rgba(255,255,255,0.1)',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                }}
              />
              <IconButton size="small" onClick={resetDefaults} sx={{ color: '#64748B', '&:hover': { color: '#E2E8F0' } }} title="Reset to Defaults">
                <RestartAlt sx={{ fontSize: 18 }} />
              </IconButton>
            </Box>
          </Box>

          {/* ════════ SECTION 1: MODEL SELECTION CARDS ════════ */}
          <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', mb: 1.5 }}>
            1. Select Forecasting Engine:
          </Typography>

          <Grid container spacing={2} sx={{ mb: 3 }}>
            {Object.values(MODEL_CONFIGS).map((m) => {
              const isSelected = selectedModel === m.id;
              return (
                <Grid item xs={12} sm={6} md={3} key={m.id}>
                  <Paper
                    elevation={0}
                    onClick={() => setSelectedModel(m.id)}
                    sx={{
                      p: 2,
                      bgcolor: isSelected ? 'rgba(13, 21, 39, 0.95)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${isSelected ? m.color : 'rgba(255,255,255,0.08)'}`,
                      borderRadius: 2.5,
                      cursor: 'pointer',
                      height: '100%',
                      transition: 'all 0.2s',
                      position: 'relative',
                      boxShadow: isSelected ? `0 0 20px ${m.color}25` : 'none',
                      '&:hover': {
                        borderColor: m.color,
                        bgcolor: 'rgba(13, 21, 39, 0.8)',
                      },
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ color: m.color, display: 'flex' }}>{m.icon}</Box>
                        <Typography variant="subtitle2" fontWeight={800} sx={{ color: isSelected ? '#FFFFFF' : '#CBD5E1' }}>
                          {m.name}
                        </Typography>
                      </Box>
                      {isSelected && <CheckCircle sx={{ color: m.color, fontSize: 18 }} />}
                    </Box>

                    <Chip
                      size="small"
                      label={m.badge}
                      sx={{
                        height: 18,
                        fontSize: '0.62rem',
                        fontWeight: 800,
                        bgcolor: `${m.color}15`,
                        color: m.color,
                        border: `1px solid ${m.color}35`,
                        mb: 1,
                      }}
                    />

                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.76rem', lineHeight: 1.4 }}>
                      {m.description}
                    </Typography>
                  </Paper>
                </Grid>
              );
            })}
          </Grid>

          <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', my: 2.5 }} />

          {/* ════════ SECTION 2: DYNAMIC TARGET CHANNEL SELECTION ════════ */}
          <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', mb: 1.5 }}>
            2. Target Risk Channels (Multivariate Channels to Forecast):
          </Typography>

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3 }}>
            {DEFAULT_TARGET_CHANNELS.map((ch) => {
              const checked = selectedTargets.includes(ch.key);
              return (
                <Chip
                  key={ch.key}
                  label={ch.label}
                  clickable={!ch.required}
                  onClick={() => handleTargetToggle(ch.key)}
                  icon={checked ? <CheckCircle sx={{ fontSize: 16, color: `${activeModelMeta.color} !important` }} /> : undefined}
                  sx={{
                    bgcolor: checked ? `${activeModelMeta.color}15` : 'rgba(255,255,255,0.03)',
                    color: checked ? '#FFFFFF' : '#64748B',
                    border: `1px solid ${checked ? activeModelMeta.color : 'rgba(255,255,255,0.08)'}`,
                    fontWeight: checked ? 700 : 500,
                    fontSize: '0.78rem',
                    py: 1.8,
                    cursor: ch.required ? 'default' : 'pointer',
                  }}
                />
              );
            })}
          </Box>

          <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', my: 2.5 }} />

          {/* ════════ SECTION 3: MODEL-SPECIFIC HYPERPARAMETERS ════════ */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
            <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              3. {activeModelMeta.name} Hyperparameters & Horizon:
            </Typography>

            <Button
              size="small"
              variant="text"
              startIcon={<Science />}
              onClick={handleRunSensitivitySweep}
              disabled={optimizing}
              sx={{ color: '#00D4FF', fontSize: '0.75rem', fontWeight: 700, textTransform: 'none' }}
            >
              {optimizing ? 'Evaluating Horizons...' : 'Evaluate Horizon Stability (Sweep)'}
            </Button>
          </Box>

          <Grid container spacing={3} sx={{ mb: 2 }}>
            {/* Common Horizon Slider */}
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 700, display: 'block', mb: 1 }}>
                Forecast Horizon: <strong>{currentModelParams.horizon || 6} Steps</strong>
              </Typography>
              <Slider
                size="small"
                value={currentModelParams.horizon || 6}
                min={2}
                max={24}
                step={1}
                onChange={(e, val) => handleParamChange('horizon', val)}
                sx={{ color: activeModelMeta.color }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                Future time periods to project forward
              </Typography>
            </Grid>

            {/* TimeFM Specific: Context Length */}
            {selectedModel === 'TIMEFM_3' && (
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 700, display: 'block', mb: 1 }}>
                  Context Length: <strong>{currentModelParams.context_length || 18} Periods</strong>
                </Typography>
                <Slider
                  size="small"
                  value={currentModelParams.context_length || 18}
                  min={4}
                  max={36}
                  step={2}
                  onChange={(e, val) => handleParamChange('context_length', val)}
                  sx={{ color: activeModelMeta.color }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                  Historical lookback window used for cross-attention
                </Typography>
              </Grid>
            )}

            {/* Chronos-2 Specific: Num Samples */}
            {selectedModel === 'CHRONOS_2' && (
              <>
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 700, display: 'block', mb: 1 }}>
                    Sample Trajectories: <strong>{currentModelParams.num_samples || 50} Paths</strong>
                  </Typography>
                  <Slider
                    size="small"
                    value={currentModelParams.num_samples || 50}
                    min={20}
                    max={150}
                    step={10}
                    onChange={(e, val) => handleParamChange('num_samples', val)}
                    sx={{ color: activeModelMeta.color }}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                    Monte Carlo probabilistic trajectory paths
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 700, display: 'block', mb: 1 }}>
                    Sampling Temperature: <strong>{currentModelParams.temperature || 0.8}</strong>
                  </Typography>
                  <Slider
                    size="small"
                    value={currentModelParams.temperature || 0.8}
                    min={0.2}
                    max={1.5}
                    step={0.1}
                    onChange={(e, val) => handleParamChange('temperature', val)}
                    sx={{ color: activeModelMeta.color }}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                    Controls token sampling variability and cone width
                  </Typography>
                </Grid>
              </>
            )}

            {/* Moirai 2.0 Specific: Patch Size */}
            {selectedModel === 'MOIRAI_2' && (
              <>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel id="patch-label" sx={{ color: '#94A3B8' }}>Temporal Patch Size</InputLabel>
                    <Select
                      labelId="patch-label"
                      value={currentModelParams.patch_size || 16}
                      label="Temporal Patch Size"
                      onChange={(e) => handleParamChange('patch_size', e.target.value)}
                      sx={{ color: '#F1F5F9' }}
                    >
                      <MenuItem value={8}>8 Steps (High Granularity)</MenuItem>
                      <MenuItem value={16}>16 Steps (Balanced Default)</MenuItem>
                      <MenuItem value={32}>32 Steps (Broad Overview)</MenuItem>
                    </Select>
                  </FormControl>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', display: 'block', mt: 0.5 }}>
                    Multi-resolution grouping size for patch transformer
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 700, display: 'block', mb: 1 }}>
                    Quantile Samples: <strong>{currentModelParams.num_samples || 100} Samples</strong>
                  </Typography>
                  <Slider
                    size="small"
                    value={currentModelParams.num_samples || 100}
                    min={50}
                    max={200}
                    step={25}
                    onChange={(e, val) => handleParamChange('num_samples', val)}
                    sx={{ color: activeModelMeta.color }}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                    Samples for interval uncertainty calibration
                  </Typography>
                </Grid>
              </>
            )}

            {/* Ensemble Specific: Strategy */}
            {selectedModel === 'ENSEMBLE' && (
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel id="strat-label" sx={{ color: '#94A3B8' }}>Consensus Strategy</InputLabel>
                  <Select
                    labelId="strat-label"
                    value={currentModelParams.selection_strategy || 'best_backtest'}
                    label="Consensus Strategy"
                    onChange={(e) => handleParamChange('selection_strategy', e.target.value)}
                    sx={{ color: '#F1F5F9' }}
                  >
                    <MenuItem value="best_backtest">Best Backtested Model (Winner takes all)</MenuItem>
                    <MenuItem value="inverse_wape_weighted">Inverse-WAPE Weighted Blend</MenuItem>
                  </Select>
                </FormControl>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', display: 'block', mt: 0.5 }}>
                  Select winner per channel or blend outputs
                </Typography>
              </Grid>
            )}
          </Grid>

          {/* ════════ HORIZON SENSITIVITY SWEEP RESULTS ════════ */}
          {sweepResult && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'rgba(0, 212, 255, 0.04)', border: '1px solid rgba(0, 212, 255, 0.2)', borderRadius: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ShowChart sx={{ color: '#00D4FF' }} />
                  <Typography variant="subtitle2" fontWeight={800} color="#00D4FF">
                    Horizon Reliability Analysis (Sweep Results)
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  label={`Optimal Horizon: ${sweepResult.optimal_horizon} Steps (WAPE: ${sweepResult.optimal_wape})`}
                  sx={{ bgcolor: 'rgba(0, 230, 118, 0.15)', color: '#00E676', border: '1px solid rgba(0, 230, 118, 0.35)', fontWeight: 800 }}
                />
              </Box>

              <Box sx={{ height: 160, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sweepResult.sweep_curve} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="horizon_label" stroke="#64748B" tick={{ fontSize: 11 }} />
                    <YAxis stroke="#64748B" tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
                    <RechartsTooltip
                      contentStyle={{ bgcolor: '#0B1120', border: '1px solid rgba(0,212,255,0.3)', borderRadius: 8, fontSize: '0.75rem' }}
                    />
                    <Line type="monotone" dataKey="wape" name="Backtested WAPE" stroke="#00D4FF" strokeWidth={2} dot={{ r: 4, fill: '#00D4FF' }} />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </Box>
          )}

          {sweepError && (
            <Alert severity="warning" sx={{ mt: 2 }} onClose={() => setSweepError(null)}>
              {sweepError}
            </Alert>
          )}
        </CardContent>
      </Collapse>
    </Card>
  );
}

