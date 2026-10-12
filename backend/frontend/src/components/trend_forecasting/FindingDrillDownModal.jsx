import React from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, Typography, Box, CircularProgress
} from '@mui/material';
import { BugReport, Close } from '@mui/icons-material';

export default function FindingDrillDownModal({
  open,
  onClose,
  period,
  findings,
  isLoading,
  totalCount,
}) {
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
        }
      }}
    >
      <DialogTitle sx={{ borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <BugReport sx={{ color: '#00D4FF' }} />
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#E2E8F0' }}>
            Underlying Audit Findings — Period: {period || 'Selected Timeframe'}
          </Typography>
        </Box>
        <Chip
          label={`${totalCount !== undefined ? totalCount : (findings?.length || 0)} Findings`}
          size="small"
          sx={{ bgcolor: 'rgba(0, 212, 255, 0.15)', color: '#00D4FF', fontWeight: 700 }}
        />
      </DialogTitle>

      <DialogContent sx={{ p: 2.5 }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress sx={{ color: '#00D4FF' }} />
          </Box>
        ) : !findings || findings.length === 0 ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography variant="body2" sx={{ color: '#94A3B8' }}>
              No individual finding records matched this drill-down filter.
            </Typography>
          </Box>
        ) : (
          <TableContainer sx={{ maxHeight: 500 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow sx={{ '& th': { bgcolor: '#0A0E17', borderColor: 'rgba(255,255,255,0.08)', color: '#94A3B8', fontWeight: 600 } }}>
                  <TableCell>Finding Title</TableCell>
                  <TableCell>Severity</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>CWE / CVE</TableCell>
                  <TableCell>Affected Asset</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {findings.map((f, idx) => {
                  const sevColors = {
                    Critical: '#FF1744',
                    High: '#FF9100',
                    Medium: '#FFD600',
                    Low: '#00E676',
                  };
                  const sevColor = sevColors[f.severity] || '#94A3B8';

                  return (
                    <TableRow key={f.finding_id || idx} sx={{ '& td': { borderColor: 'rgba(255,255,255,0.04)', color: '#E2E8F0' } }}>
                      <TableCell sx={{ fontWeight: 600, maxWidth: 280 }}>
                        {f.title}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={f.severity || 'Unspecified'}
                          size="small"
                          sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700, bgcolor: `${sevColor}22`, color: sevColor, border: `1px solid ${sevColor}44` }}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={f.status || 'Open'}
                          size="small"
                          sx={{
                            height: 20, fontSize: '0.65rem', fontWeight: 600,
                            bgcolor: f.status === 'Closed' ? 'rgba(0, 230, 118, 0.15)' : 'rgba(255, 23, 68, 0.15)',
                            color: f.status === 'Closed' ? '#00E676' : '#FF1744'
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.75rem', color: '#94A3B8' }}>
                        {f.observation_date || 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={f.new_or_repeat || 'New'}
                          size="small"
                          sx={{ height: 18, fontSize: '0.6rem', bgcolor: 'rgba(255,255,255,0.05)', color: '#E2E8F0' }}
                        />
                      </TableCell>
                      <TableCell sx={{ maxWidth: 180 }}>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {(f.cwe || []).map((c, i) => (
                            <Chip key={i} label={c} size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: 'rgba(0, 212, 255, 0.1)', color: '#00D4FF' }} />
                          ))}
                          {(f.cve_id || []).map((c, i) => (
                            <Chip key={i} label={c} size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: 'rgba(0, 230, 118, 0.1)', color: '#00E676' }} />
                          ))}
                        </Box>
                      </TableCell>
                      <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.75rem', fontFamily: 'monospace', color: '#94A3B8' }}>
                        {(f.affected_asset || []).join(', ') || 'N/A'}
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

