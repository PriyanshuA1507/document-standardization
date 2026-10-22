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
  Tabs,
  Tab,
  useTheme,
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
  Timeline,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
  Area,
  AreaChart,
} from 'recharts';
import api from '../../api/axios';

export default function ForecastComparisonModal({ open, onClose, runId1, runId2 }) {
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [activeChannelTab, setActiveChannelTab] = useState(0);

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
      const res = await api.get('/api/trend-analysis/compare', {
        params: {
          run_id_1: runId1,
          run_id_2: runId2,
        },
      });
      if (res.data?.status === 'success') {
        setComparison(res.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to compare forecast runs.');
    } finally {
      setLoading(false);
    }
  };

  const renderDeltaChip = (val, higherIsBetter = false, digits = 3, suffix = '') => {
    if (val === null || val === undefined || isNaN(val)) {
      return <Typography variant="caption" sx={{ color: '#64748B' }}>—</Typography>;
    }
    const isZero = Math.abs(val) < 0.0001;
    if (isZero) {
      return (
        <Chip
          size="small"
          icon={<Remove sx={{ fontSize: 14 }} />}
          label={`0.00${suffix}`}
          sx={{ bgcolor: isLight ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.05)', color: isLight ? '#64748B' : '#94A3B8', fontSize: '0.72rem' }}
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
        icon={isPositive ? <TrendingUp sx={{ fontSize: 14 }} /> : <TrendingDown sx={{ fontSize: 14 }} />}
        label={`${prefix}${Number(val).toFixed(digits)}${suffix}`}
        sx={{
          bgcolor: bg,
          color,
          fontWeight: 700,
          fontSize: '0.72rem',
          border: `1px solid ${color}40`,
        }}
      />
    );
  };

  const run1 = comparison?.run_1;
  const run2 = comparison?.run_2;
  const deltaSummary = comparison?.delta_summary;
  const channels = comparison?.channel_comparisons || [];
  const currentChannel = channels[activeChannelTab] || channels[0];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: isLight ? '#FFFFFF' : '#0B1220',
          border: isLight ? '1px solid rgba(15, 23, 42, 0.1)' : '1px solid rgba(0, 212, 255, 0.3)',
          borderRadius: 3,
          boxShadow: isLight ? '0 12px 48px rgba(15, 23, 42, 0.1)' : '0 12px 48px rgba(0,0,0,0.6)',
        },
      }}
    >
      <DialogTitle
        sx={{
          p: 2.5,
          borderBottom: isLight ? '1px solid rgba(15, 23, 42, 0.08)' : '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: isLight ? '#F8FAFC' : 'linear-gradient(90deg, rgba(13,21,39,0.95) 0%, rgba(15,23,42,0.95) 100%)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ p: 1, borderRadius: 2, bgcolor: 'rgba(0, 212, 255, 0.1)', color: '#00D4FF', display: 'flex' }}>
            <CompareArrows />
          </Box>
          <Box>
            <Typography variant="h6" fontWeight={800} color={isLight ? '#0F172A' : '#F8FAFC'}>
              Multi-Model Forecasting Benchmark Matrix
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Side-by-side evaluation of predictions, accuracy deltas, and uncertainty bounds
            </Typography>
          </Box>
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ color: isLight ? '#64748B' : '#94A3B8', '&:hover': { color: isLight ? '#0F172A' : '#FFF' } }}>
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: { xs: 2, md: 3 } }}>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
            <CircularProgress sx={{ color: '#00D4FF' }} />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        )}

        {!loading && comparison && (
          <Box>
            {/* Run Header Comparison Cards */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              {/* Run 1 Profile */}
              <Grid item xs={12} md={6}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    bgcolor: 'rgba(0, 230, 118, 0.04)',
                    border: '1px solid rgba(0, 230, 118, 0.3)',
                    borderRadius: 2.5,
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip label="RUN A" size="small" sx={{ bgcolor: 'rgba(0, 230, 118, 0.2)', color: '#00E676', fontWeight: 800 }} />
                      <Typography variant="subtitle2" fontWeight={800} color="#F1F5F9">
                        {run1.engine_name}
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                      {run1.run_id.substring(0, 8)}
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    Model ID: <strong>{run1.model_id}</strong> &bull; Horizon: <strong>{run1.horizon} Steps</strong> ({run1.frequency === 'W' ? 'Weekly' : 'Monthly'})
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Findings Volume: <strong>{run1.total_findings?.toLocaleString() || 0}</strong> observations
                  </Typography>
                </Paper>
              </Grid>

              {/* Run 2 Profile */}
              <Grid item xs={12} md={6}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    bgcolor: 'rgba(0, 212, 255, 0.04)',
                    border: '1px solid rgba(0, 212, 255, 0.3)',
                    borderRadius: 2.5,
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip label="RUN B" size="small" sx={{ bgcolor: 'rgba(0, 212, 255, 0.2)', color: '#00D4FF', fontWeight: 800 }} />
                      <Typography variant="subtitle2" fontWeight={800} color="#F1F5F9">
                        {run2.engine_name}
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                      {run2.run_id.substring(0, 8)}
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    Model ID: <strong>{run2.model_id}</strong> &bull; Horizon: <strong>{run2.horizon} Steps</strong> ({run2.frequency === 'W' ? 'Weekly' : 'Monthly'})
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Findings Volume: <strong>{run2.total_findings?.toLocaleString() || 0}</strong> observations
                  </Typography>
                </Paper>
              </Grid>
            </Grid>

            {/* Delta Summary Strip */}
            <Box sx={{
              p: 2,
              bgcolor: isLight ? '#F8FAFC' : 'rgba(255,255,255,0.02)',
              border: isLight ? '1px solid rgba(15, 23, 42, 0.08)' : '1px solid rgba(255,255,255,0.08)',
              borderRadius: 2,
              mb: 3
            }}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={4}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>
                    AVERAGE WAPE DELTA (A vs B)
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="h5" fontWeight={800} sx={{ color: deltaSummary?.wape_improved ? '#00E676' : '#00D4FF' }}>
                      {deltaSummary?.avg_delta_wape !== undefined ? `${(deltaSummary.avg_delta_wape * 100).toFixed(1)}%` : '—'}
                    </Typography>
                    {renderDeltaChip(deltaSummary?.avg_delta_wape, false, 3)}
                  </Box>
                </Grid>

                <Grid item xs={12} sm={4}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>
                    AVERAGE MAE DELTA
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="h5" fontWeight={800} sx={{ color: isLight ? '#0F172A' : '#F1F5F9' }}>
                      {deltaSummary?.avg_delta_mae !== undefined ? `${deltaSummary.avg_delta_mae}` : '—'}
                    </Typography>
                    {renderDeltaChip(deltaSummary?.avg_delta_mae, false, 2)}
                  </Box>
                </Grid>

                <Grid item xs={12} sm={4}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>
                    EMPIRICAL WINNER
                  </Typography>
                  <Chip
                    icon={<CheckCircle sx={{ fontSize: 16 }} />}
                    label={deltaSummary?.overall_winner === 'run_1' ? `Run A (${run1.engine_name.split(' ')[0]}) is more accurate` : deltaSummary?.overall_winner === 'run_2' ? `Run B (${run2.engine_name.split(' ')[0]}) is more accurate` : 'Equivalent Performance'}
                    sx={{
                      bgcolor: deltaSummary?.overall_winner === 'run_1' ? 'rgba(0, 230, 118, 0.15)' : 'rgba(0, 212, 255, 0.15)',
                      color: deltaSummary?.overall_winner === 'run_1' ? '#00E676' : '#00D4FF',
                      fontWeight: 800,
                      fontSize: '0.78rem',
                    }}
                  />
                </Grid>
              </Grid>
            </Box>

            {/* Overlaid Trajectory Visualizer */}
            {currentChannel && (
              <Box sx={{ mb: 3 }}>
                <Box sx={{ borderBottom: 1, borderColor: isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255,255,255,0.08)', mb: 2 }}>
                  <Tabs
                    value={activeChannelTab}
                    onChange={(e, val) => setActiveChannelTab(val)}
                    variant="scrollable"
                    scrollButtons="auto"
                    sx={{
                      '& .MuiTabs-indicator': { backgroundColor: '#00D4FF' },
                      '& .MuiTab-root': { color: isLight ? '#475569' : '#94A3B8', fontWeight: 700, fontSize: '0.8rem', textTransform: 'none' },
                    }}
                  >
                    {channels.map((ch, idx) => (
                      <Tab key={ch.target_key} label={ch.target_label} />
                    ))}
                  </Tabs>
                </Box>

                <Paper elevation={0} sx={{
                  p: 2,
                  bgcolor: isLight ? '#FFFFFF' : 'rgba(10, 14, 23, 0.85)',
                  border: isLight ? '1px solid rgba(15, 23, 42, 0.08)' : '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 2,
                  boxShadow: isLight ? '0 4px 16px -2px rgba(15, 23, 42, 0.05)' : 'none'
                }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="subtitle2" fontWeight={800} color={isLight ? '#0F172A' : '#F1F5F9'}>
                      Trajectory Comparison: {currentChannel.target_label}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Chip size="small" label={`Run A WAPE: ${(currentChannel.run1_wape * 100).toFixed(1)}%`} sx={{ bgcolor: 'rgba(0, 230, 118, 0.15)', color: '#00E676', fontWeight: 700 }} />
                      <Chip size="small" label={`Run B WAPE: ${(currentChannel.run2_wape * 100).toFixed(1)}%`} sx={{ bgcolor: 'rgba(0, 212, 255, 0.15)', color: '#00D4FF', fontWeight: 700 }} />
                    </Box>
                  </Box>

                  <Box sx={{ height: 260, width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={currentChannel.trajectory} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={isLight ? 'rgba(15, 23, 42, 0.06)' : 'rgba(255,255,255,0.05)'} />
                        <XAxis dataKey="period" stroke={isLight ? '#64748B' : '#64748B'} tick={{ fontSize: 11 }} />
                        <YAxis stroke={isLight ? '#64748B' : '#64748B'} tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
                        <RechartsTooltip contentStyle={{ backgroundColor: isLight ? '#FFFFFF' : '#0B1120', border: isLight ? '1px solid rgba(15, 23, 42, 0.1)' : '1px solid rgba(255,255,255,0.2)', borderRadius: 8, color: isLight ? '#0F172A' : '#F1F5F9' }} />
                        <Legend wrapperStyle={{ fontSize: '0.75rem', paddingTop: 8 }} />
                        <Line type="monotone" dataKey="run1_pred" name={`Run A: ${run1.engine_name}`} stroke="#00E676" strokeWidth={2.5} dot={{ r: 4, fill: '#00E676' }} />
                        <Line type="monotone" dataKey="run2_pred" name={`Run B: ${run2.engine_name}`} stroke="#00D4FF" strokeWidth={2.5} strokeDasharray="5 5" dot={{ r: 4, fill: '#00D4FF' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </Box>
                </Paper>
              </Box>
            )}

            {/* Per-Channel Metrics Matrix Table */}
            <Typography variant="caption" sx={{ color: isLight ? '#475569' : '#94A3B8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', mb: 1 }}>
              Channel-by-Channel Breakdown & Accuracy Deltas:
            </Typography>

            <TableContainer component={Paper} elevation={0} sx={{ bgcolor: isLight ? '#FFFFFF' : 'transparent', border: isLight ? '1px solid rgba(15, 23, 42, 0.08)' : '1px solid rgba(255,255,255,0.08)', borderRadius: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: isLight ? '#F1F5F9' : 'transparent', '& th': { borderColor: isLight ? 'rgba(15, 23, 42, 0.06)' : 'rgba(255,255,255,0.08)', color: isLight ? '#475569' : '#94A3B8', fontWeight: 800, fontSize: '0.75rem' } }}>
                    <TableCell>Channel</TableCell>
                    <TableCell>Run A WAPE</TableCell>
                    <TableCell>Run B WAPE</TableCell>
                    <TableCell>Delta WAPE</TableCell>
                    <TableCell>Run A MAE</TableCell>
                    <TableCell>Run B MAE</TableCell>
                    <TableCell>Delta MAE</TableCell>
                    <TableCell align="center">Channel Winner</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody sx={{ '& td': { borderColor: isLight ? 'rgba(15, 23, 42, 0.06)' : 'rgba(255,255,255,0.04)', fontSize: '0.78rem', color: isLight ? '#334155' : '#CBD5E1' } }}>
                  {channels.map((ch) => (
                    <TableRow key={ch.target_key} hover sx={{ '&:hover': { bgcolor: isLight ? 'rgba(15, 23, 42, 0.02)' : 'rgba(255,255,255,0.02)' } }}>
                      <TableCell sx={{ fontWeight: 700, color: isLight ? '#0F172A' : '#F1F5F9' }}>{ch.target_label}</TableCell>
                      <TableCell sx={{ color: '#00E676', fontWeight: 700 }}>{(ch.run1_wape * 100).toFixed(1)}%</TableCell>
                      <TableCell sx={{ color: '#00D4FF', fontWeight: 700 }}>{(ch.run2_wape * 100).toFixed(1)}%</TableCell>
                      <TableCell>{renderDeltaChip(ch.delta_wape, false, 3)}</TableCell>
                      <TableCell>±{ch.run1_mae}</TableCell>
                      <TableCell>±{ch.run2_mae}</TableCell>
                      <TableCell>{renderDeltaChip(ch.delta_mae, false, 2)}</TableCell>
                      <TableCell align="center">
                        <Chip
                          size="small"
                          label={ch.winner === 'run_1' ? 'Run A Winner' : ch.winner === 'run_2' ? 'Run B Winner' : 'Tie'}
                          sx={{
                            bgcolor: ch.winner === 'run_1' ? 'rgba(0, 230, 118, 0.15)' : ch.winner === 'run_2' ? 'rgba(0, 212, 255, 0.15)' : (isLight ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.05)'),
                            color: ch.winner === 'run_1' ? '#00E676' : ch.winner === 'run_2' ? '#00D4FF' : (isLight ? '#64748B' : '#94A3B8'),
                            fontWeight: 700,
                            fontSize: '0.7rem',
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, borderTop: isLight ? '1px solid rgba(15, 23, 42, 0.08)' : '1px solid rgba(255,255,255,0.08)' }}>
        <Button onClick={onClose} sx={{ color: isLight ? '#475569' : '#94A3B8', fontWeight: 700 }}>
          Close Benchmark Matrix
        </Button>
      </DialogActions>
    </Dialog>
  );
}

