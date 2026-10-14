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
  Checkbox,
  FormControlLabel,
  Tooltip,
  Collapse,
  IconButton,
  Divider,
  Paper,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Tune,
  ExpandMore,
  ExpandLess,
  RestartAlt,
  PlayArrow,
  BubbleChart,
  Hub,
  AccountTree,
  CheckCircle,
  HelpOutline,
  AutoAwesome,
  Memory,
  Science,
  Bolt,
  Close,
  ShowChart,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import api from '../../api/axios';

const ALGORITHM_CONFIGS = {
  HDBSCAN: {
    id: 'HDBSCAN',
    name: 'HDBSCAN',
    tagline: 'Hierarchical Density-Based Clustering',
    description: 'Discovers natural clusters of arbitrary shapes and isolates one-off noise/outliers. Best for semantic text embeddings.',
    color: '#00D4FF',
    icon: <BubbleChart sx={{ fontSize: 24 }} />,
    supports_noise: true,
    defaults: {
      min_cluster_size: 5,
      min_samples: 3,
      metric: 'euclidean',
      cluster_selection_method: 'eom',
    },
  },
  KMEANS: {
    id: 'KMEANS',
    name: 'K-Means++',
    tagline: 'Centroid-Based Partitioning',
    description: 'Fast geometric partitioning into an exact number of cohorts (k). Computes centroids and cluster inertia (WCSS).',
    color: '#00E676',
    icon: <Hub sx={{ fontSize: 24 }} />,
    supports_noise: false,
    defaults: {
      n_clusters: 8,
      init: 'k-means++',
      max_iter: 300,
      n_init: 10,
    },
  },
  AGGLOMERATIVE: {
    id: 'AGGLOMERATIVE',
    name: 'Agglomerative Hierarchical',
    tagline: 'Connectivity & Tree-Based Clustering',
    description: 'Builds a bottom-up cluster hierarchy (dendrogram) and cuts it at your desired cluster count for clean taxonomies.',
    color: '#B388FF',
    icon: <AccountTree sx={{ fontSize: 24 }} />,
    supports_noise: false,
    defaults: {
      n_clusters: 8,
      linkage: 'ward',
      metric: 'euclidean',
    },
  },
};

const DEFAULT_VULN_FEATURES = [
  { key: 'title', label: 'Finding Title', required: true, default: true },
  { key: 'observation_description', label: 'Detailed Description', required: false, default: true },
  { key: 'cwe', label: 'CWE Taxonomies', required: false, default: true },
  { key: 'impact', label: 'Threat Impact', required: false, default: true },
  { key: 'cve_id', label: 'CVE Identifiers', required: false, default: true },
  { key: 'likely_root_cause', label: 'Likely Root Cause', required: false, default: false },
  { key: 'recommendation', label: 'Remediation Advice', required: false, default: false },
  { key: 'cvss_score', label: 'CVSS Score (Numeric Dimension)', required: false, default: false },
];

const DEFAULT_REPORT_FEATURES = [
  { key: 'clean_name', label: 'Report Name & Title', required: true, default: true },
  { key: 'audit_type', label: 'Audit Classification', required: false, default: true },
  { key: 'sample_findings', label: 'Sample Finding Profiles', required: false, default: true },
  { key: 'total_vulns', label: 'Vulnerability Scope (Numeric)', required: false, default: true },
  { key: 'avg_cvss', label: 'Average CVSS Severity (Numeric)', required: false, default: true },
  { key: 'crit_ratio', label: 'Critical Finding Ratio (Numeric)', required: false, default: true },
  { key: 'open_ratio', label: 'Unresolved Finding Ratio (Numeric)', required: false, default: false },
];

export default function ClusteringConfigConsole({
  clusteringType = 'VULNERABILITY',
  onTriggerRun,
  triggering = false,
  activeRun = null,
  configOptions = null,
}) {
  const [expanded, setExpanded] = useState(false);
  const [selectedAlgo, setSelectedAlgo] = useState('HDBSCAN');
  
  const isVuln = clusteringType === 'VULNERABILITY';
  const availableFeatures = isVuln ? DEFAULT_VULN_FEATURES : DEFAULT_REPORT_FEATURES;

  const [selectedFeatures, setSelectedFeatures] = useState(
    availableFeatures.filter(f => f.default).map(f => f.key)
  );

  const [algoParams, setAlgoParams] = useState({
    HDBSCAN: { ...ALGORITHM_CONFIGS.HDBSCAN.defaults },
    KMEANS: { ...ALGORITHM_CONFIGS.KMEANS.defaults, n_clusters: isVuln ? 8 : 5 },
    AGGLOMERATIVE: { ...ALGORITHM_CONFIGS.AGGLOMERATIVE.defaults, n_clusters: isVuln ? 8 : 5 },
  });

  const currentParams = algoParams[selectedAlgo] || {};
  const currentAlgoMeta = ALGORITHM_CONFIGS[selectedAlgo];

  const [optimizingK, setOptimizingK] = useState(false);
  const [sweepResult, setSweepResult] = useState(null);
  const [sweepError, setSweepError] = useState(null);

  const handleRunAutoOptimizeK = async () => {
    setOptimizingK(true);
    setSweepError(null);
    try {
      const res = await api.post('/api/clustering/optimize-k', {
        clustering_type: clusteringType,
        algorithm: selectedAlgo,
        selected_features: selectedFeatures,
        include_numeric_features: selectedFeatures.some(f => f.includes('cvss') || f.includes('ratio') || f.includes('total_vulns')),
        k_min: 2,
        k_max: 12,
      });
      if (res.data?.status === 'success') {
        setSweepResult(res.data.data);
      }
    } catch (err) {
      setSweepError(err.response?.data?.detail || 'Failed to auto-optimize k.');
    } finally {
      setOptimizingK(false);
    }
  };

  const handleFeatureToggle = (featureKey) => {
    const feat = availableFeatures.find(f => f.key === featureKey);
    if (feat?.required) return; // Prevent disabling required anchor feature

    setSelectedFeatures(prev =>
      prev.includes(featureKey)
        ? prev.filter(k => k !== featureKey)
        : [...prev, featureKey]
    );
  };

  const handleParamChange = (key, val) => {
    setAlgoParams(prev => ({
      ...prev,
      [selectedAlgo]: {
        ...prev[selectedAlgo],
        [key]: val,
      },
    }));
  };

  const applyPreset = (presetAlgo, presetFeatures, presetParams) => {
    setSelectedAlgo(presetAlgo);
    if (presetFeatures) setSelectedFeatures(presetFeatures);
    if (presetParams) {
      setAlgoParams(prev => ({
        ...prev,
        [presetAlgo]: { ...prev[presetAlgo], ...presetParams },
      }));
    }
  };

  const resetDefaults = () => {
    setSelectedAlgo('HDBSCAN');
    setSelectedFeatures(availableFeatures.filter(f => f.default).map(f => f.key));
    setAlgoParams({
      HDBSCAN: { ...ALGORITHM_CONFIGS.HDBSCAN.defaults },
      KMEANS: { ...ALGORITHM_CONFIGS.KMEANS.defaults, n_clusters: isVuln ? 8 : 5 },
      AGGLOMERATIVE: { ...ALGORITHM_CONFIGS.AGGLOMERATIVE.defaults, n_clusters: isVuln ? 8 : 5 },
    });
  };

  const handleExecute = () => {
    const payload = {
      algorithm: selectedAlgo,
      selected_features: selectedFeatures,
      parameters: currentParams,
      include_numeric_features: selectedFeatures.some(f => f.includes('cvss') || f.includes('ratio') || f.includes('total_vulns')),
    };
    onTriggerRun(payload);
  };

  return (
    <Card
      sx={{
        bgcolor: '#0B1220',
        border: '1px solid rgba(0, 212, 255, 0.25)',
        borderRadius: 3,
        mb: 3,
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      }}
    >
      {/* Console Header Bar */}
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
              p: 1,
              borderRadius: 2,
              bgcolor: `${currentAlgoMeta.color}15`,
              color: currentAlgoMeta.color,
              display: 'flex',
            }}
          >
            <Tune />
          </Box>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle1" fontWeight={800} sx={{ color: '#F8FAFC' }}>
                Dynamic Clustering Console
              </Typography>
              <Chip
                size="small"
                label={currentAlgoMeta.name}
                sx={{
                  bgcolor: `${currentAlgoMeta.color}20`,
                  color: currentAlgoMeta.color,
                  border: `1px solid ${currentAlgoMeta.color}40`,
                  fontWeight: 800,
                  fontSize: '0.72rem',
                }}
              />
              <Chip
                size="small"
                label={`${selectedFeatures.length} features`}
                sx={{
                  bgcolor: 'rgba(255,255,255,0.05)',
                  color: '#94A3B8',
                  fontSize: '0.72rem',
                }}
              />
            </Box>
            <Typography variant="caption" color="text.secondary">
              Configure algorithms, feature weights, and hyperparameters before execution
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
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
              '&:hover': { borderColor: currentAlgoMeta.color, color: currentAlgoMeta.color },
            }}
          >
            {expanded ? 'Hide Controls' : 'Configure Parameters & Features'}
          </Button>

          <Button
            variant="contained"
            disabled={Boolean(activeRun) || triggering}
            onClick={handleExecute}
            startIcon={<PlayArrow />}
            sx={{
              bgcolor: currentAlgoMeta.color,
              color: '#0A0E17',
              fontWeight: 800,
              px: 2.5,
              py: 0.8,
              borderRadius: 2,
              boxShadow: `0 0 16px ${currentAlgoMeta.color}40`,
              '&:hover': { bgcolor: currentAlgoMeta.color, filter: 'brightness(1.1)' },
              '&:disabled': { bgcolor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)' },
            }}
          >
            {Boolean(activeRun) ? 'Clustering...' : triggering ? 'Submitting...' : `Run ${currentAlgoMeta.name}`}
          </Button>
        </Box>
      </Box>

      {/* Expandable Configuration Body */}
      <Collapse in={expanded}>
        <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
          {/* Quick Preset Selector */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 0.8, mb: 1.2 }}>
              <AutoAwesome sx={{ fontSize: 16, color: '#FFD600' }} />
              Quick Configuration Presets:
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip
                label="Semantic HDBSCAN (Recommended)"
                onClick={() => applyPreset('HDBSCAN', isVuln ? ['title', 'observation_description', 'cwe', 'impact', 'cve_id'] : ['clean_name', 'audit_type', 'sample_findings', 'total_vulns', 'avg_cvss'], { min_cluster_size: 5, min_samples: 3, metric: 'euclidean' })}
                clickable
                variant={selectedAlgo === 'HDBSCAN' ? 'filled' : 'outlined'}
                sx={{
                  bgcolor: selectedAlgo === 'HDBSCAN' ? 'rgba(0,212,255,0.15)' : 'transparent',
                  color: selectedAlgo === 'HDBSCAN' ? '#00D4FF' : '#94A3B8',
                  borderColor: selectedAlgo === 'HDBSCAN' ? '#00D4FF' : 'rgba(255,255,255,0.1)',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                }}
              />
              <Chip
                label={isVuln ? "Balanced 8-Cohort K-Means++" : "5-Tier Risk K-Means++"}
                onClick={() => applyPreset('KMEANS', isVuln ? ['title', 'cwe', 'impact', 'cvss_score'] : ['clean_name', 'audit_type', 'total_vulns', 'avg_cvss', 'crit_ratio'], { n_clusters: isVuln ? 8 : 5, init: 'k-means++', max_iter: 300 })}
                clickable
                variant={selectedAlgo === 'KMEANS' ? 'filled' : 'outlined'}
                sx={{
                  bgcolor: selectedAlgo === 'KMEANS' ? 'rgba(0,230,118,0.15)' : 'transparent',
                  color: selectedAlgo === 'KMEANS' ? '#00E676' : '#94A3B8',
                  borderColor: selectedAlgo === 'KMEANS' ? '#00E676' : 'rgba(255,255,255,0.1)',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                }}
              />
              <Chip
                label="Hierarchical Ward Taxonomy"
                onClick={() => applyPreset('AGGLOMERATIVE', isVuln ? ['title', 'observation_description', 'cwe'] : ['clean_name', 'audit_type', 'total_vulns'], { n_clusters: isVuln ? 8 : 5, linkage: 'ward', metric: 'euclidean' })}
                clickable
                variant={selectedAlgo === 'AGGLOMERATIVE' ? 'filled' : 'outlined'}
                sx={{
                  bgcolor: selectedAlgo === 'AGGLOMERATIVE' ? 'rgba(179,136,255,0.15)' : 'transparent',
                  color: selectedAlgo === 'AGGLOMERATIVE' ? '#B388FF' : '#94A3B8',
                  borderColor: selectedAlgo === 'AGGLOMERATIVE' ? '#B388FF' : 'rgba(255,255,255,0.1)',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                }}
              />
              <IconButton size="small" onClick={resetDefaults} sx={{ color: '#64748B', '&:hover': { color: '#E2E8F0' } }} title="Reset to Defaults">
                <RestartAlt sx={{ fontSize: 18 }} />
              </IconButton>
            </Box>
          </Box>

          {/* ════════ SECTION 1: ALGORITHM SELECTION CARDS ════════ */}
          <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', mb: 1.5 }}>
            1. Select Clustering Algorithm:
          </Typography>

          <Grid container spacing={2} sx={{ mb: 3 }}>
            {Object.values(ALGORITHM_CONFIGS).map((algo) => {
              const isSelected = selectedAlgo === algo.id;
              return (
                <Grid item xs={12} md={4} key={algo.id}>
                  <Paper
                    elevation={0}
                    onClick={() => setSelectedAlgo(algo.id)}
                    sx={{
                      p: 2,
                      bgcolor: isSelected ? 'rgba(13, 21, 39, 0.95)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${isSelected ? algo.color : 'rgba(255,255,255,0.08)'}`,
                      borderRadius: 2.5,
                      cursor: 'pointer',
                      height: '100%',
                      transition: 'all 0.2s',
                      position: 'relative',
                      boxShadow: isSelected ? `0 0 20px ${algo.color}25` : 'none',
                      '&:hover': {
                        borderColor: algo.color,
                        bgcolor: 'rgba(13, 21, 39, 0.8)',
                      },
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ color: algo.color, display: 'flex' }}>{algo.icon}</Box>
                        <Typography variant="subtitle2" fontWeight={800} sx={{ color: isSelected ? '#FFFFFF' : '#CBD5E1' }}>
                          {algo.name}
                        </Typography>
                      </Box>
                      {isSelected && <CheckCircle sx={{ color: algo.color, fontSize: 18 }} />}
                    </Box>

                    <Typography variant="caption" sx={{ color: algo.color, fontWeight: 700, display: 'block', mb: 0.8 }}>
                      {algo.tagline}
                    </Typography>

                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.78rem', lineHeight: 1.4 }}>
                      {algo.description}
                    </Typography>
                  </Paper>
                </Grid>
              );
            })}
          </Grid>

          <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', my: 2.5 }} />

          {/* ════════ SECTION 2: DYNAMIC FEATURE SELECTION ════════ */}
          <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', mb: 1.5 }}>
            2. Feature Selection (Vector Space Construction):
          </Typography>

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3 }}>
            {availableFeatures.map((feat) => {
              const checked = selectedFeatures.includes(feat.key);
              return (
                <Chip
                  key={feat.key}
                  label={feat.label}
                  clickable={!feat.required}
                  onClick={() => handleFeatureToggle(feat.key)}
                  icon={checked ? <CheckCircle sx={{ fontSize: 16, color: `${currentAlgoMeta.color} !important` }} /> : undefined}
                  sx={{
                    bgcolor: checked ? `${currentAlgoMeta.color}15` : 'rgba(255,255,255,0.03)',
                    color: checked ? '#FFFFFF' : '#64748B',
                    border: `1px solid ${checked ? currentAlgoMeta.color : 'rgba(255,255,255,0.08)'}`,
                    fontWeight: checked ? 700 : 500,
                    fontSize: '0.78rem',
                    py: 1.8,
                    cursor: feat.required ? 'default' : 'pointer',
                  }}
                />
              );
            })}
          </Box>

          <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', my: 2.5 }} />

          {/* ════════ SECTION 3: DYNAMIC ALGORITHM HYPERPARAMETERS ════════ */}
          <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', mb: 1.5 }}>
            3. {currentAlgoMeta.name} Hyperparameters:
          </Typography>

          {/* HDBSCAN PARAMETERS */}
          {selectedAlgo === 'HDBSCAN' && (
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 700, display: 'block', mb: 1 }}>
                  Min Cluster Size: <strong>{currentParams.min_cluster_size}</strong>
                </Typography>
                <Slider
                  size="small"
                  value={currentParams.min_cluster_size || 5}
                  min={2}
                  max={40}
                  onChange={(e, val) => handleParamChange('min_cluster_size', val)}
                  sx={{ color: currentAlgoMeta.color }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                  Minimum items required to establish a valid cluster.
                </Typography>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 700, display: 'block', mb: 1 }}>
                  Min Samples (Density): <strong>{currentParams.min_samples}</strong>
                </Typography>
                <Slider
                  size="small"
                  value={currentParams.min_samples || 3}
                  min={1}
                  max={15}
                  onChange={(e, val) => handleParamChange('min_samples', val)}
                  sx={{ color: currentAlgoMeta.color }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                  Conservative neighborhood threshold; higher = more noise.
                </Typography>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <FormControl size="small" fullWidth>
                  <InputLabel sx={{ color: '#94A3B8' }}>Distance Metric</InputLabel>
                  <Select
                    value={currentParams.metric || 'euclidean'}
                    label="Distance Metric"
                    onChange={(e) => handleParamChange('metric', e.target.value)}
                    sx={{ color: '#E2E8F0', bgcolor: 'rgba(255,255,255,0.03)' }}
                  >
                    <MenuItem value="euclidean">Euclidean (Cosine Normalized)</MenuItem>
                    <MenuItem value="manhattan">Manhattan (L1 Distance)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <FormControl size="small" fullWidth>
                  <InputLabel sx={{ color: '#94A3B8' }}>Selection Method</InputLabel>
                  <Select
                    value={currentParams.cluster_selection_method || 'eom'}
                    label="Selection Method"
                    onChange={(e) => handleParamChange('cluster_selection_method', e.target.value)}
                    sx={{ color: '#E2E8F0', bgcolor: 'rgba(255,255,255,0.03)' }}
                  >
                    <MenuItem value="eom">EOM (Excess of Mass - Balanced)</MenuItem>
                    <MenuItem value="leaf">Leaf (Fine-Grained Subclusters)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          )}

          {/* K-MEANS PARAMETERS */}
          {selectedAlgo === 'KMEANS' && (
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                  <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 700 }}>
                    Target Clusters (k): <strong>{currentParams.n_clusters}</strong>
                  </Typography>
                  <Tooltip title="Runs multi-k sweep (2..12) to calculate mathematical optimal k using Silhouette & Inertia">
                    <Button
                      size="small"
                      onClick={handleRunAutoOptimizeK}
                      disabled={optimizingK}
                      startIcon={optimizingK ? <CircularProgress size={12} sx={{ color: '#00D4FF' }} /> : <Bolt sx={{ fontSize: 14 }} />}
                      sx={{
                        p: '2px 8px',
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        color: '#00D4FF',
                        bgcolor: 'rgba(0, 212, 255, 0.1)',
                        '&:hover': { bgcolor: 'rgba(0, 212, 255, 0.2)' },
                      }}
                    >
                      {optimizingK ? 'Sweeping...' : 'Auto-k'}
                    </Button>
                  </Tooltip>
                </Box>
                <Slider
                  size="small"
                  value={currentParams.n_clusters || 8}
                  min={2}
                  max={25}
                  onChange={(e, val) => handleParamChange('n_clusters', val)}
                  sx={{ color: currentAlgoMeta.color }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                  Exact number of partition cohorts to generate.
                </Typography>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <FormControl size="small" fullWidth>
                  <InputLabel sx={{ color: '#94A3B8' }}>Centroid Init</InputLabel>
                  <Select
                    value={currentParams.init || 'k-means++'}
                    label="Centroid Init"
                    onChange={(e) => handleParamChange('init', e.target.value)}
                    sx={{ color: '#E2E8F0', bgcolor: 'rgba(255,255,255,0.03)' }}
                  >
                    <MenuItem value="k-means++">k-means++ (Smart seeding)</MenuItem>
                    <MenuItem value="random">Random (Uniform seed)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 700, display: 'block', mb: 1 }}>
                  Max Iterations: <strong>{currentParams.max_iter}</strong>
                </Typography>
                <Slider
                  size="small"
                  value={currentParams.max_iter || 300}
                  min={100}
                  max={800}
                  step={50}
                  onChange={(e, val) => handleParamChange('max_iter', val)}
                  sx={{ color: currentAlgoMeta.color }}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 700, display: 'block', mb: 1 }}>
                  Random Restarts (n_init): <strong>{currentParams.n_init}</strong>
                </Typography>
                <Slider
                  size="small"
                  value={currentParams.n_init || 10}
                  min={1}
                  max={20}
                  onChange={(e, val) => handleParamChange('n_init', val)}
                  sx={{ color: currentAlgoMeta.color }}
                />
              </Grid>
            </Grid>
          )}

          {/* AGGLOMERATIVE PARAMETERS */}
          {selectedAlgo === 'AGGLOMERATIVE' && (
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6} md={4}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                  <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 700 }}>
                    Target Clusters (k): <strong>{currentParams.n_clusters}</strong>
                  </Typography>
                  <Tooltip title="Runs multi-k sweep (2..12) to calculate mathematical optimal k using Silhouette & Inertia">
                    <Button
                      size="small"
                      onClick={handleRunAutoOptimizeK}
                      disabled={optimizingK}
                      startIcon={optimizingK ? <CircularProgress size={12} sx={{ color: '#00D4FF' }} /> : <Bolt sx={{ fontSize: 14 }} />}
                      sx={{
                        p: '2px 8px',
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        color: '#00D4FF',
                        bgcolor: 'rgba(0, 212, 255, 0.1)',
                        '&:hover': { bgcolor: 'rgba(0, 212, 255, 0.2)' },
                      }}
                    >
                      {optimizingK ? 'Sweeping...' : 'Auto-k'}
                    </Button>
                  </Tooltip>
                </Box>
                <Slider
                  size="small"
                  value={currentParams.n_clusters || 8}
                  min={2}
                  max={25}
                  onChange={(e, val) => handleParamChange('n_clusters', val)}
                  sx={{ color: currentAlgoMeta.color }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                  Number of clusters cut from the dendrogram tree.
                </Typography>
              </Grid>

              <Grid item xs={12} sm={6} md={4}>
                <FormControl size="small" fullWidth>
                  <InputLabel sx={{ color: '#94A3B8' }}>Linkage Criterion</InputLabel>
                  <Select
                    value={currentParams.linkage || 'ward'}
                    label="Linkage Criterion"
                    onChange={(e) => handleParamChange('linkage', e.target.value)}
                    sx={{ color: '#E2E8F0', bgcolor: 'rgba(255,255,255,0.03)' }}
                  >
                    <MenuItem value="ward">Ward (Variance Minimization)</MenuItem>
                    <MenuItem value="complete">Complete (Maximum Pairwise Distance)</MenuItem>
                    <MenuItem value="average">Average (Mean Distance Linkage)</MenuItem>
                    <MenuItem value="single">Single (Minimum Pairwise Distance)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6} md={4}>
                <FormControl size="small" fullWidth>
                  <InputLabel sx={{ color: '#94A3B8' }}>Distance Metric</InputLabel>
                  <Select
                    value={currentParams.linkage === 'ward' ? 'euclidean' : (currentParams.metric || 'euclidean')}
                    disabled={currentParams.linkage === 'ward'}
                    label="Distance Metric"
                    onChange={(e) => handleParamChange('metric', e.target.value)}
                    sx={{ color: '#E2E8F0', bgcolor: 'rgba(255,255,255,0.03)' }}
                  >
                    <MenuItem value="euclidean">Euclidean</MenuItem>
                    <MenuItem value="cosine">Cosine</MenuItem>
                    <MenuItem value="manhattan">Manhattan</MenuItem>
                  </Select>
                </FormControl>
                {currentParams.linkage === 'ward' && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, fontSize: '0.7rem' }}>
                    *Ward linkage strictly requires Euclidean metric.
                  </Typography>
                )}
              </Grid>
            </Grid>
          )}

          {/* Optimal-K Auto-Optimizer Results Panel */}
          {sweepResult && (
            <Paper
              sx={{
                mt: 3,
                p: 2.5,
                bgcolor: 'rgba(10, 14, 23, 0.95)',
                border: '1px solid rgba(0, 212, 255, 0.3)',
                borderRadius: 2.5,
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AutoAwesome sx={{ color: '#00D4FF', fontSize: 20 }} />
                  <Typography variant="subtitle2" fontWeight={800} sx={{ color: '#F8FAFC' }}>
                    Optimal k Auto-Optimizer (Elbow & Silhouette Sweep)
                  </Typography>
                  <Chip
                    size="small"
                    label={`Recommended k = ${sweepResult.optimal_k}`}
                    sx={{ bgcolor: 'rgba(0, 230, 118, 0.15)', color: '#00E676', fontWeight: 800, border: '1px solid rgba(0, 230, 118, 0.3)' }}
                  />
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    size="small"
                    variant="contained"
                    onClick={() => handleParamChange('n_clusters', sweepResult.optimal_k)}
                    sx={{
                      bgcolor: '#00D4FF',
                      color: '#0B1120',
                      fontWeight: 800,
                      fontSize: '0.72rem',
                      '&:hover': { bgcolor: '#38BDF8' },
                    }}
                  >
                    Apply k={sweepResult.optimal_k}
                  </Button>
                  <IconButton size="small" onClick={() => setSweepResult(null)} sx={{ color: '#64748B' }}>
                    <Close fontSize="small" />
                  </IconButton>
                </Box>
              </Box>

              <Typography variant="body2" sx={{ color: '#94A3B8', fontSize: '0.82rem', mb: 2 }}>
                {sweepResult.recommendation_reason}
              </Typography>

              <Box sx={{ height: 180, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sweepResult.sweep_results} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="k" stroke="#64748B" fontSize={11} label={{ value: 'Clusters (k)', position: 'insideBottom', offset: -4, fill: '#64748B', fontSize: 10 }} />
                    <YAxis yAxisId="left" stroke="#00E676" fontSize={11} domain={[-0.2, 1.0]} />
                    <YAxis yAxisId="right" orientation="right" stroke="#00D4FF" fontSize={11} />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: '#0D1527', borderColor: 'rgba(255,255,255,0.1)', borderRadius: 8 }}
                      formatter={(val, name) => [typeof val === 'number' ? val.toFixed(3) : val, name === 'silhouette_score' ? 'Silhouette Score (Separation)' : 'Inertia / WCSS (Compactness)']}
                    />
                    <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
                    <Line yAxisId="left" type="monotone" dataKey="silhouette_score" name="Silhouette Score (Higher is Better)" stroke="#00E676" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                    <Line yAxisId="right" type="monotone" dataKey="inertia" name="Inertia / WCSS (Lower is Better)" stroke="#00D4FF" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </Paper>
          )}

          {sweepError && (
            <Alert severity="error" sx={{ mt: 2 }} onClose={() => setSweepError(null)}>
              {sweepError}
            </Alert>
          )}
        </CardContent>
      </Collapse>
    </Card>
  );
}
