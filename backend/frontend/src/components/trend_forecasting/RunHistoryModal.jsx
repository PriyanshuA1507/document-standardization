import React from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, Typography, Box, CircularProgress
} from '@mui/material';
import { History, PlayArrow, CheckCircle, Error, HourglassEmpty } from '@mui/icons-material';

export default function RunHistoryModal({
  open,
  onClose,
  historyRuns,
  isLoading,
  onSelectRun,
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          background: 'rgba(10, 14, 23, 0.95)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(0, 212, 255, 0.3)',
          borderRadius: 3,
        }
      }}
    >
      <DialogTitle sx={{ borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 1 }}>
        <History sx={{ color: '#00D4FF' }} />
        <Typography variant="h6" sx={{ fontWeight: 700, color: '#E2E8F0' }}>
          Historical Trend Analysis & Forecasting Runs
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ p: 2.5 }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress sx={{ color: '#00D4FF' }} />
          </Box>
        ) : !historyRuns || historyRuns.length === 0 ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography variant="body2" sx={{ color: '#94A3B8' }}>
              No past forecasting runs found. Click "Run Trend Analysis & Forecast" on the dashboard to execute your first model run.
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ '& th': { borderColor: 'rgba(255,255,255,0.08)', color: '#94A3B8', fontWeight: 600 } }}>
                  <TableCell>Run ID</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Executed At</TableCell>
                  <TableCell>Configuration</TableCell>
                  <TableCell>Findings Analyzed</TableCell>
                  <TableCell align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {historyRuns.map((r) => {
                  const isDone = r.status === 'COMPLETED';
                  const isFailed = r.status === 'FAILED';
                  return (
                    <TableRow key={r.run_id} sx={{ '& td': { borderColor: 'rgba(255,255,255,0.04)', color: '#E2E8F0' } }}>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#00D4FF' }}>
                        {r.run_id.substring(0, 8)}...
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={r.status}
                          size="small"
                          color={isDone ? 'success' : isFailed ? 'error' : 'warning'}
                          sx={{ height: 20, fontSize: '0.7rem', fontWeight: 700 }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.8rem', color: '#94A3B8' }}>
                        {r.created_at ? new Date(r.created_at).toLocaleString() : 'N/A'}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.8rem' }}>
                        {r.frequency === 'W' ? 'Weekly' : 'Monthly'} ({r.horizon} steps) | {r.date_basis}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>
                        {r.total_findings ? r.total_findings.toLocaleString() : '--'}
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

      <DialogActions sx={{ borderTop: '1px solid rgba(255,255,255,0.08)', px: 3, py: 1.5 }}>
        <Button onClick={onClose} sx={{ color: '#94A3B8' }}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

