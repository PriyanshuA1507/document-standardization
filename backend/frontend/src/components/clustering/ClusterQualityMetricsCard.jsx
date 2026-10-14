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
} from '@mui/icons-material';

/**
 * Evaluates Silhouette score into label, color, and human interpretation.
 * Range: [-1, +1], Higher is better.
 */
function interpretSilhouette(score) {
  if (score === null || score === undefined) return { label: 'N/A', color: '#94A3B8', desc: 'Insufficient data' };
  if (score >= 0.6) {
    return { label: 'Excellent Separation', color: '#00E676', desc: 'Clusters are well-separated, dense, and distinctly partitioned.' };
  } else if (score >= 0.4) {
    return { label: 'Good Structure', color: '#00D4FF', desc: 'Reasonable cluster structure with solid boundary separation.' };
  } else if (score >= 0.2) {
    return { label: 'Moderate Overlap', color: '#FFD600', desc: 'Clusters exhibit moderate overlap; some boundary ambiguity.' };
  } else if (score >= 0) {
    return { label: 'Weak Separation', color: '#FF9100', desc: 'High cluster overlap; boundaries are diffuse.' };
  } else {
    return { label: 'Incorrect Assignment', color: '#FF1744', desc: 'Negative score indicates points may belong to neighboring clusters.' };
  }
}

/**
 * Evaluates Davies-Bouldin Index into label, color, and human interpretation.
 * Range: [0, ∞), Lower is better.
 */
function interpretDBI(score) {
  if (score === null || score === undefined) return { label: 'N/A', color: '#94A3B8', desc: 'Insufficient data' };
  if (score < 0.8) {
    return { label: 'High Compactness', color: '#00E676', desc: 'Low similarity between clusters; highly compact and well-separated.' };
  } else if (score < 1.3) {
    return { label: 'Good Separation', color: '#00D4FF', desc: 'Clusters are compact with low inter-cluster similarity.' };
  } else if (score < 1.8) {
    return { label: 'Moderate Spread', color: '#FFD600', desc: 'Moderate intra-cluster dispersion relative to centroid distance.' };
  } else {
    return { label: 'High Cluster Spread', color: '#FF9100', desc: 'Clusters have high dispersion or significant proximity.' };
  }
}

function formatScore(val, digits = 4) {
  if (val === null || val === undefined || isNaN(val)) return '—';
  return Number(val).toFixed(digits);
}

export default function ClusterQualityMetricsCard({
  summary,
  parameters,
  clusteringType = 'VULNERABILITY',
}) {
  const [guideOpen, setGuideOpen] = useState(false);

  const metrics = summary?.quality_metrics;
  const isGpu = summary?.gpu_accelerated || parameters?.gpu_accelerated || false;
  const gpuName = summary?.gpu_name || parameters?.gpu_name || (isGpu ? 'NVIDIA GPU (CUDA)' : null);
  const vectorizer = summary?.vectorizer || parameters?.vectorizer || (clusteringType === 'VULNERABILITY' ? 'Sentence-BERT (768-dim)' : 'StandardScaler (Risk Profile)');

  const silScore = metrics?.silhouette_score;
  const dbiScore = metrics?.davies_bouldin_index;
  const nClusters = metrics?.n_clusters ?? summary?.discovered_cluster_count ?? 0;
  const nClustered = metrics?.n_clustered_points ?? (summary?.total_findings ? summary.total_findings - (summary.noise_count || 0) : null);
  const nNoise = metrics?.n_noise_points ?? summary?.noise_count ?? 0;
  const noiseRatio = metrics?.noise_ratio ?? (nClustered && (nClustered + nNoise > 0) ? nNoise / (nClustered + nNoise) : 0);

  const silInterp = interpretSilhouette(silScore);
  const dbiInterp = interpretDBI(dbiScore);

  // Normalized progress bar for Silhouette (-1 to +1 -> 0% to 100%)
  const silPercent = silScore !== null && silScore !== undefined
    ? Math.max(0, Math.min(100, ((silScore + 1) / 2) * 100))
    : 50;

  // Coverage percentage
  const totalCount = (nClustered || 0) + nNoise;
  const coveragePercent = totalCount > 0 ? (((nClustered || 0) / totalCount) * 100).toFixed(1) : 100;

  return (
    <Card
      sx={{
        bgcolor: '#0B1220',
        border: '1px solid rgba(0, 212, 255, 0.25)',
        borderRadius: 3,
        mb: 3,
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
      }}
    >
      {/* Decorative accent top stripe */}
      <Box
        sx={{
          height: 3,
          background: isGpu
            ? 'linear-gradient(90deg, #00E676 0%, #00D4FF 50%, #7C4DFF 100%)'
            : 'linear-gradient(90deg, #00D4FF 0%, #38BDF8 50%, #7C4DFF 100%)',
        }}
      />

      <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
        {/* Header Bar */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: 2,
            mb: 2.5,
          }}
        >
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <AutoGraph sx={{ color: '#00D4FF', fontSize: 26 }} />
              <Typography variant="h6" fontWeight={800} sx={{ color: '#F1F5F9', letterSpacing: -0.2 }}>
                Cluster Quality & Separation Validation
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 680 }}>
              Dataset-independent mathematical metrics evaluated on non-noise points ({nClustered !== null ? `${nClustered.toLocaleString()} observations` : 'all clustered items'}) across {nClusters} clusters.
            </Typography>
          </Box>

          {/* Hardware & Settings Badges */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            {isGpu ? (
              <Chip
                icon={<Bolt sx={{ color: '#00E676 !important', fontSize: 18 }} />}
                label={gpuName ? `GPU: ${gpuName}` : 'GPU Accelerated (CUDA)'}
                sx={{
                  bgcolor: 'rgba(0, 230, 118, 0.12)',
                  color: '#00E676',
                  border: '1px solid rgba(0, 230, 118, 0.35)',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                }}
              />
            ) : (
              <Chip
                icon={<Memory sx={{ color: '#94A3B8 !important', fontSize: 18 }} />}
                label="CPU Compute"
                sx={{
                  bgcolor: 'rgba(148, 163, 184, 0.1)',
                  color: '#CBD5E1',
                  border: '1px solid rgba(148, 163, 184, 0.25)',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                }}
              />
            )}

            <Chip
              icon={<Hub sx={{ color: '#00D4FF !important', fontSize: 16 }} />}
              label={vectorizer}
              sx={{
                bgcolor: 'rgba(0, 212, 255, 0.08)',
                color: '#00D4FF',
                border: '1px solid rgba(0, 212, 255, 0.25)',
                fontWeight: 600,
                fontSize: '0.75rem',
              }}
            />

            <Tooltip title="Click to view mathematical definitions and interpretation guidelines">
              <Chip
                icon={<HelpOutline sx={{ fontSize: 16 }} />}
                label={guideOpen ? 'Hide Guide' : 'Metrics Guide'}
                onClick={() => setGuideOpen(!guideOpen)}
                clickable
                sx={{
                  bgcolor: guideOpen ? 'rgba(124, 77, 255, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                  color: guideOpen ? '#B388FF' : '#94A3B8',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  '&:hover': { bgcolor: 'rgba(124, 77, 255, 0.15)' },
                }}
              />
            </Tooltip>
          </Box>
        </Box>

        {/* Notice if metrics cannot be computed */}
        {metrics?.note && (
          <Box
            sx={{
              mb: 2.5,
              p: 1.5,
              bgcolor: 'rgba(255, 145, 0, 0.1)',
              borderRadius: 2,
              border: '1px solid rgba(255, 145, 0, 0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
            }}
          >
            <WarningAmber sx={{ color: '#FF9100' }} />
            <Typography variant="body2" sx={{ color: '#FFB74D' }}>
              <strong>Notice:</strong> {metrics.note}
            </Typography>
          </Box>
        )}

        {/* 2 Primary Universal Metrics Grid */}
        <Grid container spacing={2.5}>
          {/* 1. Silhouette Score */}
          <Grid item xs={12} md={6}>
            <Paper
              elevation={0}
              sx={{
                p: 3,
                bgcolor: 'rgba(13, 21, 39, 0.9)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 2.5,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'all 0.2s',
                '&:hover': { borderColor: 'rgba(0, 212, 255, 0.4)', bgcolor: 'rgba(13, 21, 39, 0.98)' },
              }}
            >
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                  <Typography variant="subtitle2" sx={{ color: '#94A3B8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                    1. Silhouette Score
                  </Typography>
                  <Tooltip title="Measures how close each point is to its own cluster compared with other clusters. Standardized range from -1 to +1. Higher is better.">
                    <InfoOutlined sx={{ fontSize: 18, color: '#64748B', cursor: 'help' }} />
                  </Tooltip>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, mb: 1 }}>
                  <Typography variant="h3" fontWeight={900} sx={{ color: silInterp.color }}>
                    {silScore !== null && silScore !== undefined ? (silScore > 0 ? `+${formatScore(silScore)}` : formatScore(silScore)) : 'N/A'}
                  </Typography>
                  <Typography variant="body1" color="text.secondary" fontWeight={600}>
                    / 1.00
                  </Typography>
                </Box>

                <Chip
                  size="small"
                  label={silInterp.label}
                  sx={{
                    mb: 2,
                    bgcolor: `${silInterp.color}1A`,
                    color: silInterp.color,
                    fontWeight: 800,
                    fontSize: '0.75rem',
                    border: `1px solid ${silInterp.color}40`,
                    px: 0.5,
                  }}
                />

                {/* Progress bar visual for [-1, +1] */}
                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                    <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600 }}>-1.0 (Misassigned)</Typography>
                    <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600 }}>0 (Overlapping)</Typography>
                    <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600 }}>+1.0 (Well-Separated)</Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={silPercent}
                    sx={{
                      height: 8,
                      borderRadius: 4,
                      bgcolor: 'rgba(255, 255, 255, 0.08)',
                      '& .MuiLinearProgress-bar': {
                        bgcolor: silInterp.color,
                        borderRadius: 4,
                      },
                    }}
                  />
                </Box>
              </Box>

              <Typography variant="body2" sx={{ color: '#94A3B8', fontSize: '0.85rem', lineHeight: 1.4, pt: 1, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                {silInterp.desc}
              </Typography>
            </Paper>
          </Grid>

          {/* 2. Davies-Bouldin Index */}
          <Grid item xs={12} md={6}>
            <Paper
              elevation={0}
              sx={{
                p: 3,
                bgcolor: 'rgba(13, 21, 39, 0.9)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 2.5,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'all 0.2s',
                '&:hover': { borderColor: 'rgba(0, 212, 255, 0.4)', bgcolor: 'rgba(13, 21, 39, 0.98)' },
              }}
            >
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                  <Typography variant="subtitle2" sx={{ color: '#94A3B8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                    2. Davies–Bouldin Index (DBI)
                  </Typography>
                  <Tooltip title="Measures cluster similarity based on intra-cluster spread and separation between clusters. Standardized ratio (0 to ∞). Lower is better.">
                    <InfoOutlined sx={{ fontSize: 18, color: '#64748B', cursor: 'help' }} />
                  </Tooltip>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, mb: 1 }}>
                  <Typography variant="h3" fontWeight={900} sx={{ color: dbiInterp.color }}>
                    {formatScore(dbiScore)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" fontWeight={600}>
                    (Lower is better)
                  </Typography>
                </Box>

                <Chip
                  size="small"
                  label={dbiInterp.label}
                  sx={{
                    mb: 2,
                    bgcolor: `${dbiInterp.color}1A`,
                    color: dbiInterp.color,
                    fontWeight: 800,
                    fontSize: '0.75rem',
                    border: `1px solid ${dbiInterp.color}40`,
                    px: 0.5,
                  }}
                />

                {/* Progress bar visual for DBI (0 to 3 scale) */}
                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                    <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600 }}>0.0 (Compact & Isolated)</Typography>
                    <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600 }}>1.0 (Threshold)</Typography>
                    <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600 }}>2.0+ (Diffuse)</Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={dbiScore !== null && dbiScore !== undefined ? Math.min(100, Math.max(5, (dbiScore / 2.0) * 100)) : 50}
                    sx={{
                      height: 8,
                      borderRadius: 4,
                      bgcolor: 'rgba(255, 255, 255, 0.08)',
                      '& .MuiLinearProgress-bar': {
                        bgcolor: dbiInterp.color,
                        borderRadius: 4,
                      },
                    }}
                  />
                </Box>
              </Box>

              <Typography variant="body2" sx={{ color: '#94A3B8', fontSize: '0.85rem', lineHeight: 1.4, pt: 1, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                {dbiInterp.desc}
              </Typography>
            </Paper>
          </Grid>
        </Grid>

        {/* Coverage & Partition Distribution Banner */}
        <Box
          sx={{
            mt: 2.5,
            p: 2,
            bgcolor: 'rgba(13, 21, 39, 0.6)',
            borderRadius: 2,
            border: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            justifyContent: 'space-between',
            alignItems: { xs: 'stretch', md: 'center' },
            gap: 2,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
            <Box>
              <Typography variant="caption" color="text.secondary">Clustered Coverage</Typography>
              <Typography variant="subtitle2" fontWeight={800} sx={{ color: '#00E676' }}>
                {coveragePercent}% ({nClustered !== null ? nClustered.toLocaleString() : '—'} items)
              </Typography>
            </Box>

            <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255, 255, 255, 0.1)', display: { xs: 'none', sm: 'block' } }} />

            <Box>
              <Typography variant="caption" color="text.secondary">Outlier / Noise Ratio</Typography>
              <Typography variant="subtitle2" fontWeight={800} sx={{ color: noiseRatio > 0.2 ? '#FF9100' : '#38BDF8' }}>
                {(noiseRatio * 100).toFixed(1)}% ({nNoise.toLocaleString()} items)
              </Typography>
            </Box>

            <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255, 255, 255, 0.1)', display: { xs: 'none', sm: 'block' } }} />

            <Box>
              <Typography variant="caption" color="text.secondary">Discovered Partitions</Typography>
              <Typography variant="subtitle2" fontWeight={800} sx={{ color: '#E2E8F0' }}>
                {nClusters} Discovered Clusters
              </Typography>
            </Box>
          </Box>

          <Box sx={{ minWidth: 240 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="caption" sx={{ color: '#00E676', fontWeight: 700 }}>
                Clustered: {coveragePercent}%
              </Typography>
              <Typography variant="caption" sx={{ color: '#FF9100', fontWeight: 700 }}>
                Noise: {(noiseRatio * 100).toFixed(1)}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={Number(coveragePercent)}
              sx={{
                height: 6,
                borderRadius: 3,
                bgcolor: 'rgba(255, 145, 0, 0.3)',
                '& .MuiLinearProgress-bar': {
                  bgcolor: '#00E676',
                  borderRadius: 3,
                },
              }}
            />
          </Box>
        </Box>

        {/* Expandable Mathematical Reference Guide */}
        <Collapse in={guideOpen}>
          <Box
            sx={{
              mt: 2.5,
              p: 2.5,
              bgcolor: 'rgba(10, 14, 23, 0.95)',
              borderRadius: 2.5,
              border: '1px solid rgba(124, 77, 255, 0.3)',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <Science sx={{ color: '#B388FF', fontSize: 22 }} />
              <Typography variant="subtitle1" fontWeight={800} sx={{ color: '#E2E8F0' }}>
                Dataset-Independent Validation Metrics Guide
              </Typography>
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Unlike dataset-dependent metrics (such as Inertia/WCSS or Calinski-Harabasz, which grow or shift with sample size), these two metrics provide absolute, standardized evaluation criteria:
            </Typography>

            <TableContainer component={Paper} sx={{ bgcolor: 'transparent', boxShadow: 'none' }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ '& th': { borderColor: 'rgba(255, 255, 255, 0.08)', color: '#94A3B8', fontWeight: 700 } }}>
                    <TableCell>Metric</TableCell>
                    <TableCell>Mathematical Range</TableCell>
                    <TableCell>Optimal Target</TableCell>
                    <TableCell>Auditing Interpretation</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody sx={{ '& td': { borderColor: 'rgba(255, 255, 255, 0.06)', color: '#CBD5E1', fontSize: '0.82rem' } }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, color: '#00D4FF !important' }}>1. Silhouette Score</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace' }}>−1.00 to +1.00</TableCell>
                    <TableCell sx={{ color: '#00E676 !important', fontWeight: 700 }}>Higher is better (&gt; 0.50)</TableCell>
                    <TableCell>
                      Measures how close each observation is to its own cluster compared to neighboring clusters.
                      Scores near +1 indicate dense, isolated clusters. Negative scores warn of potential misassignments.
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, color: '#00E676 !important' }}>2. Davies–Bouldin Index (DBI)</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace' }}>0 to ∞</TableCell>
                    <TableCell sx={{ color: '#00E676 !important', fontWeight: 700 }}>Lower is better (&lt; 1.00)</TableCell>
                    <TableCell>
                      Calculates the similarity between clusters as the ratio of within-cluster spread to centroid distance.
                      Scores &lt; 1.0 indicate compact, well-separated clusters.
                    </TableCell>
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
