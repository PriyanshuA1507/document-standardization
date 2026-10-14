import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Grid,
  Paper,
  Chip,
  Button,
  IconButton,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider,
} from '@mui/material';
import {
  Close,
  CompareArrows,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Remove,
  AutoAwesome,
  Speed,
  Layers,
} from '@mui/icons-material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import api from '../../api/axios';

export default function ClusterComparisonModal({ open, onClose, runId1, runId2 }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [comparison, setComparison] = useState(null);

  useEffect(() => {
    if (open && runId1 && runId2) {
      fetchComparison();
    } else {
      setComparison(null);
      setError(null);
    }
  }, [open, runId1, runId2]);

  const fetchComparison = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/api/clustering/compare', {
        params: {
          run_id_1: runId1,
          run_id_2: runId2,
        },
      });
      if (res.data?.status === 'success') {
        setComparison(res.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to compare clustering runs.');
    } finally {
      setLoading(false);
    }
  };

  const renderDeltaChip = (val, higherIsBetter = true, digits = 4) => {
    if (val === null || val === undefined || isNaN(val)) {
      return <Typography variant="caption" sx={{ color: '#64748B' }}>—</Typography>;
    }
    const isZero = Math.abs(val) < 0.0001;
    if (isZero) {
      return (
        <Chip
          size="small"
          icon={<Remove sx={{ fontSize: 14 }} />}
          label="0.00"
          sx={{ bgcolor: 'rgba(255,255,255,0.05)', color: '#94A3B8', fontSize: '0.72rem' }}
        />
      );
    }
    const isPositive = val > 0;
    const isImproved = higherIsBetter ? isPositive : !isPositive;
    const color = isImproved ? '#00E676' : '#FF1744';
    const bg = isImproved ? 'rgba(0, 230, 118, 0.15)' : 'rgba(255, 23, 68, 0.15)';
    const prefix = isPositive ? '+' : '';

    return (
      <Chip
        size="small"
        icon={isPositive ? <TrendingUp sx={{ fontSize: 14, color: `${color} !important` }} /> : <TrendingDown sx={{ fontSize: 14, color: `${color} !important` }} />}
        label={`${prefix}${Number(val).toFixed(digits)}`}
        sx={{
          bgcolor: bg,
          color: color,
          border: `1px solid ${color}40`,
          fontWeight: 800,
          fontSize: '0.72rem',
        }}
      />
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: '#0B1120',
          border: '1px solid rgba(0, 212, 255, 0.3)',
          borderRadius: 3,
          boxShadow: '0 16px 48px rgba(0,0,0,0.8)',
          backgroundImage: 'none',
        },
      }}
    >
      <DialogTitle sx={{ p: 2.5, borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <CompareArrows sx={{ color: '#00D4FF', fontSize: 28 }} />
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              <Typography variant="h6" fontWeight={800} sx={{ color: '#F8FAFC' }}>
                Clustering Run Comparison & Benchmark Matrix
              </Typography>
              {comparison?.clustering_type && (
                <Chip
                  size="small"
                  label={comparison.clustering_type === 'VULNERABILITY' ? 'Vulnerability Findings' : 'Audit Reports'}
                  sx={{
                    bgcolor: comparison.clustering_type === 'VULNERABILITY' ? 'rgba(0, 212, 255, 0.15)' : 'rgba(0, 230, 118, 0.15)',
                    color: comparison.clustering_type === 'VULNERABILITY' ? '#00D4FF' : '#00E676',
                    fontWeight: 800,
                    fontSize: '0.7rem',
                    border: `1px solid ${comparison.clustering_type === 'VULNERABILITY' ? 'rgba(0, 212, 255, 0.3)' : 'rgba(0, 230, 118, 0.3)'}`,
                  }}
                />
              )}
            </Box>
            <Typography variant="caption" color="text.secondary">
              Direct mathematical & structural comparison between two model executions of the same clustering scope
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={onClose} sx={{ color: 'text.secondary' }}>
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 3 }}>
        {loading && (
          <Box sx={{ p: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <CircularProgress size={36} sx={{ color: '#00D4FF' }} />
            <Typography variant="body2" color="text.secondary">
              Evaluating clustering run cross-deltas & distributions...
            </Typography>
          </Box>
        )}

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {comparison && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Executive Recommendation Banner */}
            <Box
              sx={{
                p: 2,
                borderRadius: 2.5,
                bgcolor: comparison.winner === 'TIE' ? 'rgba(0,212,255,0.1)' : 'rgba(0,230,118,0.1)',
                border: `1px solid ${comparison.winner === 'TIE' ? 'rgba(0,212,255,0.3)' : 'rgba(0,230,118,0.3)'}`,
                display: 'flex',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <AutoAwesome sx={{ color: comparison.winner === 'TIE' ? '#00D4FF' : '#00E676', fontSize: 28 }} />
              <Box>
                <Typography variant="caption" sx={{ color: comparison.winner === 'TIE' ? '#00D4FF' : '#00E676', fontWeight: 800, textTransform: 'uppercase' }}>
                  Auditor Benchmark Verdict:
                </Typography>
                <Typography variant="body2" fontWeight={700} sx={{ color: '#F8FAFC' }}>
                  {comparison.executive_verdict}
                </Typography>
              </Box>
            </Box>

            {/* Model Headers Comparison (Run 1 vs Run 2) */}
            <Grid container spacing={2.5}>
              {/* RUN 1 CARD */}
              <Grid item xs={12} md={6}>
                <Paper
                  sx={{
                    p: 2.5,
                    bgcolor: 'rgba(13, 21, 39, 0.85)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 2.5,
                    height: '100%',
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                    <Typography variant="caption" sx={{ color: '#00D4FF', fontWeight: 800, textTransform: 'uppercase' }}>
                      Baseline Model (Run A)
                    </Typography>
                    <Typography variant="caption" fontFamily="monospace" sx={{ color: '#94A3B8' }}>
                      {comparison.run_1.run_id.slice(0, 8)}...
                    </Typography>
                  </Box>

                  <Typography variant="h6" fontWeight={800} sx={{ color: '#FFFFFF', mb: 1 }}>
                    {comparison.run_1.algorithm}
                  </Typography>

                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                    <Chip size="small" label={`${comparison.run_1.input_records} records`} sx={{ bgcolor: 'rgba(255,255,255,0.05)', fontSize: '0.72rem' }} />
                    <Chip size="small" label={`${comparison.run_1.clusters_count} clusters`} sx={{ bgcolor: 'rgba(0, 230, 118, 0.1)', color: '#00E676', fontSize: '0.72rem' }} />
                    <Chip size="small" label={`${comparison.run_1.noise_count} noise`} sx={{ bgcolor: 'rgba(255, 145, 0, 0.1)', color: '#FF9100', fontSize: '0.72rem' }} />
                  </Box>

                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontWeight: 700 }}>
                    Active Features ({comparison.run_1.selected_features.length}):
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.6, flexWrap: 'wrap' }}>
                    {comparison.run_1.selected_features.map((f) => (
                      <Chip key={f} size="small" label={f} sx={{ bgcolor: 'rgba(0,212,255,0.08)', color: '#38BDF8', fontSize: '0.68rem' }} />
                    ))}
                  </Box>
                </Paper>
              </Grid>

              {/* RUN 2 CARD */}
              <Grid item xs={12} md={6}>
                <Paper
                  sx={{
                    p: 2.5,
                    bgcolor: 'rgba(13, 21, 39, 0.85)',
                    border: '1px solid rgba(0, 230, 118, 0.3)',
                    borderRadius: 2.5,
                    height: '100%',
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                    <Typography variant="caption" sx={{ color: '#00E676', fontWeight: 800, textTransform: 'uppercase' }}>
                      Comparison Target (Run B)
                    </Typography>
                    <Typography variant="caption" fontFamily="monospace" sx={{ color: '#94A3B8' }}>
                      {comparison.run_2.run_id.slice(0, 8)}...
                    </Typography>
                  </Box>

                  <Typography variant="h6" fontWeight={800} sx={{ color: '#FFFFFF', mb: 1 }}>
                    {comparison.run_2.algorithm}
                  </Typography>

                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                    <Chip size="small" label={`${comparison.run_2.input_records} records`} sx={{ bgcolor: 'rgba(255,255,255,0.05)', fontSize: '0.72rem' }} />
                    <Chip size="small" label={`${comparison.run_2.clusters_count} clusters`} sx={{ bgcolor: 'rgba(0, 230, 118, 0.1)', color: '#00E676', fontSize: '0.72rem' }} />
                    <Chip size="small" label={`${comparison.run_2.noise_count} noise`} sx={{ bgcolor: 'rgba(255, 145, 0, 0.1)', color: '#FF9100', fontSize: '0.72rem' }} />
                  </Box>

                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontWeight: 700 }}>
                    Active Features ({comparison.run_2.selected_features.length}):
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.6, flexWrap: 'wrap' }}>
                    {comparison.run_2.selected_features.map((f) => (
                      <Chip key={f} size="small" label={f} sx={{ bgcolor: 'rgba(0,230,118,0.08)', color: '#00E676', fontSize: '0.68rem' }} />
                    ))}
                  </Box>
                </Paper>
              </Grid>
            </Grid>

            {/* Metrics Delta Comparative Table */}
            <Box>
              <Typography variant="subtitle2" fontWeight={800} sx={{ color: '#E2E8F0', mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Speed sx={{ color: '#00D4FF', fontSize: 20 }} />
                Mathematical Validation Metrics & Delta Performance
              </Typography>

              <TableContainer component={Paper} sx={{ bgcolor: 'rgba(13, 21, 39, 0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ '& th': { bgcolor: '#0D1527', color: '#94A3B8', fontWeight: 700, fontSize: '0.8rem' } }}>
                      <TableCell>Metric</TableCell>
                      <TableCell>Direction</TableCell>
                      <TableCell align="right">Run A</TableCell>
                      <TableCell align="right">Run B</TableCell>
                      <TableCell align="right">Performance Delta (B − A)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody sx={{ '& td': { borderColor: 'rgba(255,255,255,0.06)', color: '#CBD5E1', fontSize: '0.85rem' } }}>
                    {/* Silhouette */}
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, color: '#00D4FF !important' }}>1. Silhouette Score</TableCell>
                      <TableCell><Typography variant="caption" color="text.secondary">Higher is better</Typography></TableCell>
                      <TableCell align="right" sx={{ fontFamily: 'monospace' }}>
                        {comparison.run_1.metrics.silhouette_score !== null ? Number(comparison.run_1.metrics.silhouette_score).toFixed(4) : '—'}
                      </TableCell>
                      <TableCell align="right" sx={{ fontFamily: 'monospace', fontWeight: 700 }}>
                        {comparison.run_2.metrics.silhouette_score !== null ? Number(comparison.run_2.metrics.silhouette_score).toFixed(4) : '—'}
                      </TableCell>
                      <TableCell align="right">
                        {renderDeltaChip(comparison.deltas.delta_silhouette, true)}
                      </TableCell>
                    </TableRow>

                    {/* Davies-Bouldin */}
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, color: '#00E676 !important' }}>2. Davies–Bouldin Index (DBI)</TableCell>
                      <TableCell><Typography variant="caption" color="text.secondary">Lower is better</Typography></TableCell>
                      <TableCell align="right" sx={{ fontFamily: 'monospace' }}>
                        {comparison.run_1.metrics.davies_bouldin_index !== null ? Number(comparison.run_1.metrics.davies_bouldin_index).toFixed(4) : '—'}
                      </TableCell>
                      <TableCell align="right" sx={{ fontFamily: 'monospace', fontWeight: 700 }}>
                        {comparison.run_2.metrics.davies_bouldin_index !== null ? Number(comparison.run_2.metrics.davies_bouldin_index).toFixed(4) : '—'}
                      </TableCell>
                      <TableCell align="right">
                        {renderDeltaChip(comparison.deltas.delta_davies_bouldin, false)}
                      </TableCell>
                    </TableRow>

                    {/* Calinski-Harabasz */}
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, color: '#B388FF !important' }}>3. Calinski–Harabasz Index</TableCell>
                      <TableCell><Typography variant="caption" color="text.secondary">Higher is better</Typography></TableCell>
                      <TableCell align="right" sx={{ fontFamily: 'monospace' }}>
                        {comparison.run_1.metrics.calinski_harabasz_index !== null ? Number(comparison.run_1.metrics.calinski_harabasz_index).toFixed(1) : '—'}
                      </TableCell>
                      <TableCell align="right" sx={{ fontFamily: 'monospace', fontWeight: 700 }}>
                        {comparison.run_2.metrics.calinski_harabasz_index !== null ? Number(comparison.run_2.metrics.calinski_harabasz_index).toFixed(1) : '—'}
                      </TableCell>
                      <TableCell align="right">
                        {renderDeltaChip(comparison.deltas.delta_calinski_harabasz, true, 1)}
                      </TableCell>
                    </TableRow>

                    {/* Noise Ratio */}
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, color: '#FF9100 !important' }}>4. Noise / Outlier Ratio</TableCell>
                      <TableCell><Typography variant="caption" color="text.secondary">Lower is better</Typography></TableCell>
                      <TableCell align="right" sx={{ fontFamily: 'monospace' }}>
                        {((comparison.run_1.metrics.noise_ratio || 0) * 100).toFixed(1)}%
                      </TableCell>
                      <TableCell align="right" sx={{ fontFamily: 'monospace', fontWeight: 700 }}>
                        {((comparison.run_2.metrics.noise_ratio || 0) * 100).toFixed(1)}%
                      </TableCell>
                      <TableCell align="right">
                        {renderDeltaChip(comparison.deltas.delta_noise_ratio, false, 3)}
                      </TableCell>
                    </TableRow>

                    {/* Discovered Clusters */}
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, color: '#38BDF8 !important' }}>5. Total Discovered Clusters</TableCell>
                      <TableCell><Typography variant="caption" color="text.secondary">Partition count</Typography></TableCell>
                      <TableCell align="right" sx={{ fontFamily: 'monospace' }}>
                        {comparison.run_1.clusters_count}
                      </TableCell>
                      <TableCell align="right" sx={{ fontFamily: 'monospace', fontWeight: 700 }}>
                        {comparison.run_2.clusters_count}
                      </TableCell>
                      <TableCell align="right">
                        {renderDeltaChip(comparison.deltas.delta_clusters, true, 0)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>

            {/* Cluster Size Distribution Dual Bar Chart */}
            {comparison.distribution_comparison?.length > 0 && (
              <Box>
                <Typography variant="subtitle2" fontWeight={800} sx={{ color: '#E2E8F0', mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Layers sx={{ color: '#B388FF', fontSize: 20 }} />
                  Cluster Size Cohort Distribution (Run A vs Run B)
                </Typography>

                <Box sx={{ height: 260, bgcolor: 'rgba(13, 21, 39, 0.6)', p: 2, borderRadius: 2, border: '1px solid rgba(255,255,255,0.08)' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={comparison.distribution_comparison} margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="index" stroke="#64748B" fontSize={11} tickFormatter={(val) => `Cluster ${val}`} />
                      <YAxis
                        stroke="#64748B"
                        fontSize={11}
                        label={{
                          value: comparison?.clustering_type === 'VULNERABILITY' ? 'Findings / Observations' : 'Audit Reports',
                          angle: -90,
                          position: 'insideLeft',
                          fill: '#64748B',
                          fontSize: 11,
                        }}
                      />
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: '#0D1527', borderColor: 'rgba(255,255,255,0.1)', borderRadius: 8 }}
                        formatter={(val, name) => [val, name === 'run_1_size' ? 'Run A (Baseline)' : 'Run B (Comparison)']}
                      />
                      <Legend wrapperStyle={{ fontSize: '0.8rem', paddingTop: '6px' }} />
                      <Bar dataKey="run_1_size" name="Run A (Baseline)" fill="#00D4FF" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="run_2_size" name="Run B (Comparison)" fill="#00E676" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2.5, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <Button onClick={onClose} variant="outlined" sx={{ color: 'text.secondary' }}>
          Close Comparison
        </Button>
      </DialogActions>
    </Dialog>
  );
}
