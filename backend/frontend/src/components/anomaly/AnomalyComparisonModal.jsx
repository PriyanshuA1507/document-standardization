import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  Grid,
  Paper,
  Chip,
  IconButton,
  CircularProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import {
  Close,
  CompareArrows,
  CheckCircle,
  Warning,
  ErrorOutline
} from '@mui/icons-material';
import api from '../../api/axios';

export default function AnomalyComparisonModal({ open, onClose, runsHistory = [] }) {
  const [runId1, setRunId1] = useState(runsHistory[0]?.run_id || '');
  const [runId2, setRunId2] = useState(runsHistory[1]?.run_id || '');
  const [loading, setLoading] = useState(false);
  const [comparison, setComparison] = useState(null);
  const [error, setError] = useState(null);

  const handleExecuteComparison = async () => {
    if (!runId1 || !runId2) return;
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/api/anomaly/compare', {
        params: { run_id_1: runId1, run_id_2: runId2 }
      });
      if (res.data?.status === 'success') {
        setComparison(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to compare anomaly runs.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: '#0B1120',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          backgroundImage: 'none',
          borderRadius: 2
        }
      }}
    >
      <DialogTitle sx={{ p: 2.5, bgcolor: '#0F172A', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: 'rgba(0, 212, 255, 0.1)', display: 'flex' }}>
            <CompareArrows sx={{ color: '#00D4FF', fontSize: 22 }} />
          </Box>
          <Box>
            <Typography variant="h6" fontWeight={800} color="#F1F5F9" sx={{ fontSize: '1.05rem' }}>
              Anomaly Detector Benchmark & Run Comparison
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Benchmark agreement rate and discordant reports across two historical executions
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={onClose} sx={{ color: '#94A3B8' }}><Close /></IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 3 }}>
        {/* Selection Bar */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={5}>
            <FormControl fullWidth size="small">
              <InputLabel sx={{ color: 'text.secondary' }}>Run A (Baseline)</InputLabel>
              <Select
                value={runId1}
                label="Run A (Baseline)"
                onChange={(e) => setRunId1(e.target.value)}
                sx={{ bgcolor: '#0F172A', color: '#F1F5F9' }}
              >
                {runsHistory.map(r => (
                  <MenuItem key={r.run_id} value={r.run_id}>
                    {(r.algorithm_mode || r.parameters?.algorithm_mode || 'ENSEMBLE')} (Latest) &bull; {new Date(r.created_at).toLocaleDateString()} ({r.anomalies_detected} outliers)
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={5}>
            <FormControl fullWidth size="small">
              <InputLabel sx={{ color: 'text.secondary' }}>Run B (Comparison)</InputLabel>
              <Select
                value={runId2}
                label="Run B (Comparison)"
                onChange={(e) => setRunId2(e.target.value)}
                sx={{ bgcolor: '#0F172A', color: '#F1F5F9' }}
              >
                {runsHistory.map(r => (
                  <MenuItem key={r.run_id} value={r.run_id}>
                    {(r.algorithm_mode || r.parameters?.algorithm_mode || 'ENSEMBLE')} (Latest) &bull; {new Date(r.created_at).toLocaleDateString()} ({r.anomalies_detected} outliers)
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={2}>
            <Button
              fullWidth
              variant="contained"
              onClick={handleExecuteComparison}
              disabled={loading || !runId1 || !runId2}
              sx={{ bgcolor: '#00D4FF', color: '#0B1120', fontWeight: 800, height: 40, borderRadius: 1.5 }}
            >
              {loading ? <CircularProgress size={20} /> : 'Compare'}
            </Button>
          </Grid>
        </Grid>

        {error && (
          <Typography color="#FF1744" variant="body2" sx={{ mb: 2 }}>{error}</Typography>
        )}

        {/* Results */}
        {comparison && (
          <Box>
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={3}>
                <Paper sx={{ p: 1.5, textAlign: 'center', bgcolor: 'rgba(0, 212, 255, 0.08)', borderRadius: 2 }}>
                  <Typography variant="h4" fontWeight={900} color="#00D4FF">
                    {comparison.comparison_metrics?.agreement_rate_percent}%
                  </Typography>
                  <Typography variant="caption" color="text.secondary" fontWeight={700}>
                    Overall Agreement Rate
                  </Typography>
                </Paper>
              </Grid>

              <Grid item xs={3}>
                <Paper sx={{ p: 1.5, textAlign: 'center', bgcolor: 'rgba(0, 230, 118, 0.08)', borderRadius: 2 }}>
                  <Typography variant="h4" fontWeight={900} color="#00E676">
                    {comparison.comparison_metrics?.both_anomalous_count}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" fontWeight={700}>
                    Consensus Anomalies
                  </Typography>
                </Paper>
              </Grid>

              <Grid item xs={3}>
                <Paper sx={{ p: 1.5, textAlign: 'center', bgcolor: 'rgba(255, 145, 0, 0.08)', borderRadius: 2 }}>
                  <Typography variant="h4" fontWeight={900} color="#FF9100">
                    {comparison.comparison_metrics?.only_run_a_anomalous}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" fontWeight={700}>
                    Only in Run A
                  </Typography>
                </Paper>
              </Grid>

              <Grid item xs={3}>
                <Paper sx={{ p: 1.5, textAlign: 'center', bgcolor: 'rgba(213, 0, 249, 0.08)', borderRadius: 2 }}>
                  <Typography variant="h4" fontWeight={900} color="#D500F9">
                    {comparison.comparison_metrics?.only_run_b_anomalous}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" fontWeight={700}>
                    Only in Run B
                  </Typography>
                </Paper>
              </Grid>
            </Grid>

            {/* Top Discordant Reports */}
            <Typography variant="caption" fontWeight={800} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', mb: 1 }}>
              Top Discordant Audit Reports (Greatest Score Deviation)
            </Typography>
            <TableContainer component={Paper} sx={{ bgcolor: '#0F172A', borderRadius: 2, maxHeight: 260 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ color: 'text.secondary', fontWeight: 800 }}>Audit Report Title</TableCell>
                    <TableCell sx={{ color: 'text.secondary', fontWeight: 800 }}>Run A Score</TableCell>
                    <TableCell sx={{ color: 'text.secondary', fontWeight: 800 }}>Run B Score</TableCell>
                    <TableCell sx={{ color: 'text.secondary', fontWeight: 800 }}>Delta</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {comparison.top_discordant_reports?.slice(0, 8).map((rep) => (
                    <TableRow key={rep.report_id}>
                      <TableCell sx={{ color: '#F1F5F9', fontWeight: 600, maxWidth: 260 }}>
                        <Typography variant="body2" noWrap>{rep.report_title}</Typography>
                      </TableCell>
                      <TableCell sx={{ color: '#00D4FF', fontWeight: 700 }}>
                        {Math.round(rep.score_a * 100)}%
                      </TableCell>
                      <TableCell sx={{ color: '#D500F9', fontWeight: 700 }}>
                        {Math.round(rep.score_b * 100)}%
                      </TableCell>
                      <TableCell sx={{ color: '#FF9100', fontWeight: 800 }}>
                        {Math.round(rep.abs_difference * 100)}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <Button onClick={onClose} sx={{ color: 'text.secondary' }}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
