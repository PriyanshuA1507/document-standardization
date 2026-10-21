import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Typography,
  Box,
  CircularProgress,
  Checkbox,
  Tooltip,
} from '@mui/material';
import {
  History,
  PlayArrow,
  CheckCircle,
  Error,
  HourglassEmpty,
  CompareArrows,
  Bolt,
  Psychology,
  Hub,
  AutoAwesome,
} from '@mui/icons-material';

const MODEL_BADGES = {
  TIMEFM_3: { label: 'TimeFM 3.0', color: '#00E676', bg: 'rgba(0, 230, 118, 0.15)' },
  CHRONOS_2: { label: 'Chronos-2', color: '#00D4FF', bg: 'rgba(0, 212, 255, 0.15)' },
  MOIRAI_2: { label: 'Moirai 2.0', color: '#B388FF', bg: 'rgba(179, 136, 255, 0.15)' },
  ENSEMBLE: { label: 'Consensus', color: '#FFD600', bg: 'rgba(255, 214, 0, 0.15)' },
};

export default function RunHistoryModal({
  open,
  onClose,
  historyRuns,
  isLoading,
  onSelectRun,
  onOpenCompare = null,
}) {
  const [selectedRunIds, setSelectedRunIds] = useState([]);

  const handleToggleSelect = (runId) => {
    setSelectedRunIds((prev) => {
      if (prev.includes(runId)) {
        return prev.filter((id) => id !== runId);
      }
      if (prev.length >= 2) {
        // Keep the latest clicked one and replace the oldest
        return [prev[1], runId];
      }
      return [...prev, runId];
    });
  };

  const handleLaunchCompare = () => {
    if (selectedRunIds.length === 2 && onOpenCompare) {
      onOpenCompare(selectedRunIds[0], selectedRunIds[1]);
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          background: 'rgba(10, 14, 23, 0.95)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(0, 212, 255, 0.3)',
          borderRadius: 3,
        },
      }}
    >
      <DialogTitle
        sx={{
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 1.5,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <History sx={{ color: '#00D4FF' }} />
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#E2E8F0' }}>
              Historical Trend Analysis & Forecasting Runs
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Review previous foundation model forecasts or select 2 runs to benchmark side-by-side
            </Typography>
          </Box>
        </Box>

        {selectedRunIds.length === 2 && onOpenCompare && (
          <Button
            variant="contained"
            size="small"
            startIcon={<CompareArrows />}
            onClick={handleLaunchCompare}
            sx={{
              background: 'linear-gradient(135deg, #00D4FF 0%, #00E676 100%)',
              color: '#0A0E17',
              fontWeight: 800,
              textTransform: 'none',
              boxShadow: '0 0 16px rgba(0, 212, 255, 0.4)',
            }}
          >
            Compare Selected 2 Runs
          </Button>
        )}
      </DialogTitle>

      <DialogContent sx={{ p: 2.5 }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress sx={{ color: '#00D4FF' }} />
          </Box>
        ) : !historyRuns || historyRuns.length === 0 ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography variant="body2" sx={{ color: '#94A3B8' }}>
              No past forecasting runs found. Configure parameters on the dashboard and click "Run Forecast" to execute your first model run.
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ '& th': { borderColor: 'rgba(255,255,255,0.08)', color: '#94A3B8', fontWeight: 600 } }}>
                  <TableCell padding="checkbox">
                    <Tooltip title="Select any 2 runs to compare side-by-side">
                      <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 700 }}>CMP</Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell>Run ID</TableCell>
                  <TableCell>Model / Engine</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Backtest WAPE</TableCell>
                  <TableCell>Configuration</TableCell>
                  <TableCell>Executed At</TableCell>
                  <TableCell align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {historyRuns.map((r) => {
                  const isDone = r.status === 'COMPLETED';
                  const isFailed = r.status === 'FAILED';
                  const isSelected = selectedRunIds.includes(r.run_id);
                  const mBadge = MODEL_BADGES[r.model_id] || MODEL_BADGES.TIMEFM_3;

                  return (
                    <TableRow
                      key={r.run_id}
                      hover
                      selected={isSelected}
                      sx={{
                        '& td': { borderColor: 'rgba(255,255,255,0.04)', color: '#E2E8F0' },
                        '&.Mui-selected, &.Mui-selected:hover': { bgcolor: 'rgba(0, 212, 255, 0.08)' },
                      }}
                    >
                      <TableCell padding="checkbox">
                        <Checkbox
                          size="small"
                          checked={isSelected}
                          disabled={!isDone}
                          onChange={() => handleToggleSelect(r.run_id)}
                          sx={{
                            color: 'rgba(255,255,255,0.2)',
                            '&.Mui-checked': { color: '#00D4FF' },
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#00D4FF' }}>
                        {r.run_id.substring(0, 8)}...
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={r.engine_name || mBadge.label}
                          sx={{
                            bgcolor: mBadge.bg,
                            color: mBadge.color,
                            fontWeight: 700,
                            fontSize: '0.72rem',
                            border: `1px solid ${mBadge.color}35`,
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={r.status}
                          size="small"
                          color={isDone ? 'success' : isFailed ? 'error' : 'warning'}
                          sx={{ height: 20, fontSize: '0.7rem', fontWeight: 700 }}
                        />
                      </TableCell>
                      <TableCell>
                        {r.wape !== null && r.wape !== undefined ? (
                          <Chip
                            size="small"
                            label={`${(r.wape * 100).toFixed(1)}%`}
                            sx={{
                              height: 20,
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              bgcolor: r.wape < 0.25 ? 'rgba(0,230,118,0.15)' : 'rgba(0,212,255,0.15)',
                              color: r.wape < 0.25 ? '#00E676' : '#00D4FF',
                            }}
                          />
                        ) : (
                          <Typography variant="caption" sx={{ color: '#64748B' }}>—</Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.8rem' }}>
                        {r.frequency === 'W' ? 'Weekly' : 'Monthly'} ({r.horizon} steps) &bull; {r.total_findings?.toLocaleString() || 0} findings
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.8rem', color: '#94A3B8' }}>
                        {r.created_at ? new Date(r.created_at).toLocaleString() : 'N/A'}
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={!isDone}
                          onClick={() => {
                            onSelectRun(r.run_id);
                            onClose();
                          }}
                          sx={{ fontSize: '0.75rem', borderColor: 'rgba(0, 212, 255, 0.3)', color: '#00D4FF' }}
                        >
                          View Results
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>

      <DialogActions sx={{ borderTop: '1px solid rgba(255,255,255,0.08)', px: 3, py: 1.5, justifyContent: 'space-between' }}>
        <Typography variant="caption" color="text.secondary">
          {selectedRunIds.length === 0
            ? 'Select any 2 runs to unlock comparison matrix'
            : selectedRunIds.length === 1
            ? 'Select 1 more run to compare'
            : '2 runs selected — click Compare above or below'}
        </Typography>

        <Box sx={{ display: 'flex', gap: 1 }}>
          {selectedRunIds.length === 2 && onOpenCompare && (
            <Button
              variant="contained"
              size="small"
              startIcon={<CompareArrows />}
              onClick={handleLaunchCompare}
              sx={{ bgcolor: '#00D4FF', color: '#0A0E17', fontWeight: 800 }}
            >
              Compare 2 Runs
            </Button>
          )}
          <Button onClick={onClose} sx={{ color: '#94A3B8' }}>Close</Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}
