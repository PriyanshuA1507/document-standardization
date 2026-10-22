import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Chip,
  Slider,
  Switch,
  FormControlLabel,
  Divider,
  Collapse,
  IconButton,
  Tooltip,
  Paper,
  LinearProgress,
  Stack,
  useTheme
} from '@mui/material';
import {
  Tune,
  PlayArrow,
  RestartAlt,
  Psychology,
  Speed,
  Functions,
  BubbleChart,
  ExpandMore,
  ExpandLess,
  CheckCircle,
  HelpOutline,
  AutoAwesome,
  Security
} from '@mui/icons-material';

const DETECTOR_ICONS = {
  ENSEMBLE: <AutoAwesome sx={{ color: '#00D4FF' }} />,
  IFOREST: <Speed sx={{ color: '#00E676' }} />,
  ECOD: <Functions sx={{ color: '#FFD600' }} />,
  EMBEDDING: <Psychology sx={{ color: '#D500F9' }} />
};

export default function AnomalyConfigConsole({
  configOptions,
  currentParams,
  onRunDetection,
  isExecuting,
  currentStage,
  progressPercent
}) {
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';
  const [expanded, setExpanded] = useState(false);

  // Form state
  const [algorithmMode, setAlgorithmMode] = useState(currentParams?.algorithm_mode || 'ENSEMBLE');
  const [contamination, setContamination] = useState(currentParams?.parameters?.contamination ?? 0.10);
  const [nEstimators, setNEstimators] = useState(currentParams?.parameters?.n_estimators ?? 100);
  const [extendedHyperplanes, setExtendedHyperplanes] = useState(currentParams?.parameters?.extended_hyperplanes ?? false);
  const [kNeighbors, setKNeighbors] = useState(currentParams?.parameters?.k_neighbors ?? 5);

  // Weights for Ensemble
  const [weightIF, setWeightIF] = useState(currentParams?.parameters?.weight_iforest ?? 0.40);
  const [weightECOD, setWeightECOD] = useState(currentParams?.parameters?.weight_ecod ?? 0.35);
  const [weightEmbed, setWeightEmbed] = useState(currentParams?.parameters?.weight_embedding ?? 0.25);

  // Feature selection
  const allFeatures = configOptions?.feature_catalog?.map(f => f.key) || [
    "total_findings", "avg_cvss", "max_cvss", "cvss_variance",
    "p90_cvss", "critical_ratio", "open_findings", "sla_breach_count",
    "page_count", "report_narrative"
  ];
  const [selectedFeatures, setSelectedFeatures] = useState(currentParams?.selected_features || allFeatures);

  const presets = configOptions?.presets || [];

  const handleApplyPreset = (preset) => {
    setAlgorithmMode(preset.algorithm_mode);
    if (preset.parameters?.contamination !== undefined) setContamination(preset.parameters.contamination);
    if (preset.parameters?.n_estimators !== undefined) setNEstimators(preset.parameters.n_estimators);
    if (preset.parameters?.extended_hyperplanes !== undefined) setExtendedHyperplanes(preset.parameters.extended_hyperplanes);
    if (preset.parameters?.k_neighbors !== undefined) setKNeighbors(preset.parameters.k_neighbors);
    if (preset.parameters?.weight_iforest !== undefined) setWeightIF(preset.parameters.weight_iforest);
    if (preset.parameters?.weight_ecod !== undefined) setWeightECOD(preset.parameters.weight_ecod);
    if (preset.parameters?.weight_embedding !== undefined) setWeightEmbed(preset.parameters.weight_embedding);
    if (preset.selected_features) setSelectedFeatures(preset.selected_features);
  };

  const handleToggleFeature = (key) => {
    if (selectedFeatures.includes(key)) {
      if (selectedFeatures.length > 2) {
        setSelectedFeatures(selectedFeatures.filter(f => f !== key));
      }
    } else {
      setSelectedFeatures([...selectedFeatures, key]);
    }
  };

  const handleSelectAllFeatures = () => {
    setSelectedFeatures(allFeatures);
  };

  const handleExecute = () => {
    const payload = {
      algorithm_mode: algorithmMode,
      selected_features: selectedFeatures,
      parameters: {
        contamination,
        n_estimators: nEstimators,
        extended_hyperplanes: extendedHyperplanes,
        k_neighbors: kNeighbors,
        weight_iforest: weightIF,
        weight_ecod: weightECOD,
        weight_embedding: weightEmbed
      }
    };
    onRunDetection(payload);
  };

  return (
    <Card sx={{
      bgcolor: isLight ? '#FFFFFF' : '#0B1120',
      border: isLight ? '1px solid rgba(15, 23, 42, 0.08)' : '1px solid rgba(0, 212, 255, 0.2)',
      borderRadius: 2,
      mb: 3,
      boxShadow: isLight ? '0 4px 16px -2px rgba(15, 23, 42, 0.05)' : 'none'
    }}>
      {/* Header bar */}
      <CardContent sx={{ p: 2.5, pb: expanded ? 1.5 : 2.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: 'rgba(0, 212, 255, 0.1)', display: 'flex' }}>
              <Tune sx={{ color: '#00D4FF', fontSize: 24 }} />
            </Box>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="h6" fontWeight={800} color={isLight ? '#0F172A' : '#F1F5F9'} sx={{ fontSize: '1.05rem' }}>
                  Multi-Detector Anomaly Configuration Console
                </Typography>
                <Chip
                  size="small"
                  label={algorithmMode}
                  sx={{
                    bgcolor: 'rgba(0, 212, 255, 0.15)',
                    color: '#00D4FF',
                    fontWeight: 800,
                    fontSize: '0.72rem',
                    height: 22
                  }}
                />
              </Box>
              <Typography variant="caption" color="text.secondary">
                Configure Isolation Forest, ECOD, and Local Transformer sentence embedding detectors
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Button
              variant="contained"
              disabled={isExecuting}
              onClick={handleExecute}
              startIcon={<PlayArrow />}
              sx={{
                bgcolor: '#00D4FF',
                color: '#0B1120',
                fontWeight: 800,
                px: 2.5,
                borderRadius: 2,
                '&:hover': { bgcolor: '#38BDF8' }
              }}
            >
              {isExecuting ? 'Running Detection...' : 'Execute Anomaly Detection'}
            </Button>
            <IconButton
              size="small"
              onClick={() => setExpanded(!expanded)}
              sx={{
                color: isLight ? '#475569' : '#94A3B8',
                border: isLight ? '1px solid rgba(15, 23, 42, 0.1)' : '1px solid rgba(255,255,255,0.1)'
              }}
            >
              {expanded ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          </Box>
        </Box>

        {/* Progress bar if executing */}
        {isExecuting && (
          <Box sx={{ mt: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="caption" color="#00D4FF" fontWeight={700}>
                {currentStage || 'Processing...'}
              </Typography>
              <Typography variant="caption" color="#00D4FF" fontWeight={800}>
                {progressPercent}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={progressPercent}
              sx={{
                height: 6,
                borderRadius: 3,
                bgcolor: isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255,255,255,0.06)',
                '& .MuiLinearProgress-bar': { bgcolor: '#00D4FF' }
              }}
            />
          </Box>
        )}
      </CardContent>

      {/* Expandable Configuration Body */}
      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <Divider sx={{ borderColor: isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255, 255, 255, 0.08)' }} />
        <CardContent sx={{ p: 2.5 }}>
          {/* 1. Presets */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="caption" fontWeight={800} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Preset Quick-Selectors
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap', gap: 1 }}>
              {presets.map((preset) => (
                <Chip
                  key={preset.id}
                  label={preset.name}
                  onClick={() => handleApplyPreset(preset)}
                  icon={<AutoAwesome sx={{ fontSize: 16 }} />}
                  sx={{
                    bgcolor: isLight ? '#F1F5F9' : 'rgba(255, 255, 255, 0.04)',
                    color: isLight ? '#334155' : '#E2E8F0',
                    border: isLight ? '1px solid rgba(15, 23, 42, 0.08)' : '1px solid rgba(255, 255, 255, 0.1)',
                    fontWeight: 600,
                    fontSize: '0.78rem',
                    py: 1.8,
                    cursor: 'pointer',
                    '&:hover': {
                      bgcolor: 'rgba(0, 212, 255, 0.15)',
                      borderColor: '#00D4FF',
                      color: '#00D4FF'
                    }
                  }}
                />
              ))}
            </Stack>
          </Box>

          <Grid container spacing={3}>
            {/* 2. Algorithm Mode Selection */}
            <Grid item xs={12} md={4}>
              <Paper sx={{
                p: 2,
                bgcolor: isLight ? '#F8FAFC' : '#0F172A',
                border: isLight ? '1px solid rgba(15, 23, 42, 0.08)' : '1px solid rgba(255,255,255,0.06)',
                borderRadius: 2,
                height: '100%'
              }}>
                <Typography variant="subtitle2" fontWeight={800} color={isLight ? '#0F172A' : '#F1F5F9'} sx={{ mb: 1.5 }}>
                  Detection Engine Mode
                </Typography>
                <Stack spacing={1}>
                  {[
                    { id: 'ENSEMBLE', name: 'Tri-Model Consensus Ensemble', desc: 'Fuses Isolation Forest, ECOD, and Local Sentence-BERT embeddings' },
                    { id: 'IFOREST', name: 'Isolation Forest & EIF', desc: 'Recursive hyperplane partitioning on structured report metrics' },
                    { id: 'ECOD', name: 'ECOD (Empirical Cumulative Tail)', desc: 'Parameter-free statistical tail estimator with exact feature attribution' },
                    { id: 'EMBEDDING', name: 'Sentence-BERT Semantic Outliers', desc: 'Transformer semantic distance to peer audit reports in vector space' }
                  ].map((mode) => (
                    <Box
                      key={mode.id}
                      onClick={() => setAlgorithmMode(mode.id)}
                      sx={{
                        p: 1.5,
                        borderRadius: 1.5,
                        cursor: 'pointer',
                        bgcolor: algorithmMode === mode.id ? 'rgba(0, 212, 255, 0.12)' : (isLight ? '#FFFFFF' : 'rgba(255,255,255,0.02)'),
                        border: '1px solid',
                        borderColor: algorithmMode === mode.id ? '#00D4FF' : (isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255,255,255,0.05)'),
                        transition: 'all 0.2s',
                        '&:hover': { borderColor: 'rgba(0, 212, 255, 0.5)' }
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.3 }}>
                        {DETECTOR_ICONS[mode.id]}
                        <Typography variant="body2" fontWeight={700} color={algorithmMode === mode.id ? '#00D4FF' : (isLight ? '#0F172A' : '#F1F5F9')}>
                          {mode.name}
                        </Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.72rem' }}>
                        {mode.desc}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </Paper>
            </Grid>

            {/* 3. Hyperparameter Controls */}
            <Grid item xs={12} md={4}>
              <Paper sx={{
                p: 2,
                bgcolor: isLight ? '#F8FAFC' : '#0F172A',
                border: isLight ? '1px solid rgba(15, 23, 42, 0.08)' : '1px solid rgba(255,255,255,0.06)',
                borderRadius: 2,
                height: '100%'
              }}>
                <Typography variant="subtitle2" fontWeight={800} color={isLight ? '#0F172A' : '#F1F5F9'} sx={{ mb: 2 }}>
                  Hyperparameters & Sensitivity
                </Typography>

                {/* Contamination */}
                <Box sx={{ mb: 2.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="caption" fontWeight={700} color="text.secondary">
                      Contamination Rate (Expected Outliers)
                    </Typography>
                    <Typography variant="caption" fontWeight={800} color="#00D4FF">
                      {(contamination * 100).toFixed(0)}%
                    </Typography>
                  </Box>
                  <Slider
                    value={contamination}
                    min={0.01}
                    max={0.35}
                    step={0.01}
                    onChange={(e, val) => setContamination(val)}
                    sx={{ color: '#00D4FF' }}
                  />
                </Box>

                {/* Isolation Forest Trees */}
                {(algorithmMode === 'IFOREST' || algorithmMode === 'ENSEMBLE') && (
                  <Box sx={{ mb: 2.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="caption" fontWeight={700} color="text.secondary">
                        Isolation Forest Trees (n_estimators)
                      </Typography>
                      <Typography variant="caption" fontWeight={800} color="#00E676">
                        {nEstimators}
                      </Typography>
                    </Box>
                    <Slider
                      value={nEstimators}
                      min={50}
                      max={300}
                      step={10}
                      onChange={(e, val) => setNEstimators(val)}
                      sx={{ color: '#00E676' }}
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          size="small"
                          checked={extendedHyperplanes}
                          onChange={(e) => setExtendedHyperplanes(e.target.checked)}
                          sx={{ '& .Mui-checked': { color: '#00E676' } }}
                        />
                      }
                      label={
                        <Typography variant="caption" color="text.secondary">
                          Extended Oblique Cuts (EIF)
                        </Typography>
                      }
                    />
                  </Box>
                )}

                {/* k-Neighbors */}
                {(algorithmMode === 'EMBEDDING' || algorithmMode === 'ENSEMBLE') && (
                  <Box sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="caption" fontWeight={700} color="text.secondary">
                        Semantic k-Nearest Neighbors
                      </Typography>
                      <Typography variant="caption" fontWeight={800} color="#D500F9">
                        k = {kNeighbors}
                      </Typography>
                    </Box>
                    <Slider
                      value={kNeighbors}
                      min={2}
                      max={15}
                      step={1}
                      onChange={(e, val) => setKNeighbors(val)}
                      sx={{ color: '#D500F9' }}
                    />
                  </Box>
                )}

                {/* Ensemble Weights */}
                {algorithmMode === 'ENSEMBLE' && (
                  <Box sx={{ pt: 1, borderTop: isLight ? '1px solid rgba(15, 23, 42, 0.08)' : '1px solid rgba(255,255,255,0.06)' }}>
                    <Typography variant="caption" fontWeight={800} color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                      Ensemble Fusion Weights
                    </Typography>
                    <Grid container spacing={1}>
                      <Grid item xs={4}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>IF: {Math.round(weightIF*100)}%</Typography>
                        <Slider value={weightIF} min={0} max={1} step={0.05} onChange={(e, v) => setWeightIF(v)} size="small" sx={{ color: '#00E676' }} />
                      </Grid>
                      <Grid item xs={4}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>ECOD: {Math.round(weightECOD*100)}%</Typography>
                        <Slider value={weightECOD} min={0} max={1} step={0.05} onChange={(e, v) => setWeightECOD(v)} size="small" sx={{ color: '#FFD600' }} />
                      </Grid>
                      <Grid item xs={4}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>Embed: {Math.round(weightEmbed*100)}%</Typography>
                        <Slider value={weightEmbed} min={0} max={1} step={0.05} onChange={(e, v) => setWeightEmbed(v)} size="small" sx={{ color: '#D500F9' }} />
                      </Grid>
                    </Grid>
                  </Box>
                )}
              </Paper>
            </Grid>

            {/* 4. Feature Space Toggles */}
            <Grid item xs={12} md={4}>
              <Paper sx={{
                p: 2,
                bgcolor: isLight ? '#F8FAFC' : '#0F172A',
                border: isLight ? '1px solid rgba(15, 23, 42, 0.08)' : '1px solid rgba(255,255,255,0.06)',
                borderRadius: 2,
                height: '100%'
              }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                  <Typography variant="subtitle2" fontWeight={800} color={isLight ? '#0F172A' : '#F1F5F9'}>
                    Feature Vector Catalog
                  </Typography>
                  <Button size="small" onClick={handleSelectAllFeatures} sx={{ color: '#00D4FF', fontSize: '0.72rem', p: 0, minWidth: 0 }}>
                    Select All
                  </Button>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                  Toggle tabular indicators and narrative text profile to assemble the detection matrix:
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8, maxHeight: 220, overflowY: 'auto' }}>
                  {configOptions?.feature_catalog?.map((f) => {
                    const active = selectedFeatures.includes(f.key);
                    return (
                      <Chip
                        key={f.key}
                        label={f.label}
                        size="small"
                        onClick={() => handleToggleFeature(f.key)}
                        sx={{
                          bgcolor: active ? 'rgba(0, 212, 255, 0.15)' : (isLight ? '#FFFFFF' : 'rgba(255, 255, 255, 0.04)'),
                          color: active ? '#00D4FF' : (isLight ? '#334155' : 'text.secondary'),
                          border: '1px solid',
                          borderColor: active ? 'rgba(0, 212, 255, 0.4)' : (isLight ? 'rgba(15, 23, 42, 0.1)' : 'rgba(255, 255, 255, 0.06)'),
                          fontWeight: active ? 700 : 500,
                          fontSize: '0.72rem',
                          cursor: 'pointer'
                        }}
                      />
                    );
                  })}
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </CardContent>
      </Collapse>
    </Card>
  );
}
