import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Button,
  CircularProgress,
  TablePagination,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  History,
  CheckCircle,
  ErrorOutline,
  Schedule,
  Sync,
  Refresh,
  OpenInNew,
  BugReport,
  Description,
  Close,
} from '@mui/icons-material';
import api from '../../api/axios';

const STATUS_CHIPS = {
  COMPLETED: { color: 'success', icon: <CheckCircle sx={{ fontSize: 14 }} /> },
  RUNNING: { color: 'info', icon: <Sync sx={{ fontSize: 14, animation: 'spin 2s linear infinite' }} /> },
  QUEUED: { color: 'warning', icon: <Schedule sx={{ fontSize: 14 }} /> },
  FAILED: { color: 'error', icon: <ErrorOutline sx={{ fontSize: 14 }} /> },
};

export default function ClusteringHistoryModule({ onSelectRun }) {
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState({ items: [], total: 0 });
  const [filterType, setFilterType] = useState('ALL');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [error, setError] = useState(null);
  const [detailsModal, setDetailsModal] = useState({ open: false, run: null });

  const fetchHistory = async (type = filterType, pageIdx = page, size = rowsPerPage) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/api/clustering/history', {
        params: {
          clustering_type: type === 'ALL' ? undefined : type,
          limit: size,
          offset: pageIdx * size,
        }
      });
      if (res.data?.status === 'success') {
        setHistory(res.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to fetch clustering history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [filterType, page, rowsPerPage]);

  const handleFilterChange = (e) => {
    const val = e.target.value;
    setFilterType(val);
    setPage(0);
    fetchHistory(val, 0, rowsPerPage);
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    const newSize = parseInt(event.target.value, 10);
    setRowsPerPage(newSize);
    setPage(0);
  };

  const formatDuration = (started, completed) => {
    if (!started || !completed) return '—';
    const ms = new Date(completed) - new Date(started);
    if (ms < 1000) return `${ms}ms`;
    const secs = (ms / 1000).toFixed(1);
    return `${secs}s`;
  };

  return (
    <Box>
      <Card sx={{ bgcolor: '#0D1527', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 3, mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <Box>
              <Typography variant="h5" fontWeight={800} sx={{ color: '#E2E8F0', display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <History sx={{ color: '#00D4FF' }} />
                Clustering Execution History & Audit Trail
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Immutable versioned record of all past vulnerability and report clustering jobs.
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel sx={{ color: 'text.secondary' }}>Type</InputLabel>
                <Select
                  value={filterType}
                  label="Type"
                  onChange={handleFilterChange}
                  sx={{
                    color: '#fff',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.1)' }
                  }}
                >
                  <MenuItem value="ALL">All Types</MenuItem>
                  <MenuItem value="VULNERABILITY">Vulnerability Findings</MenuItem>
                  <MenuItem value="REPORT">Audit Reports</MenuItem>
                </Select>
              </FormControl>

              <IconButton onClick={() => fetchHistory()} sx={{ color: 'text.secondary' }}>
                <Refresh />
              </IconButton>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      <Card sx={{ bgcolor: '#0B1120', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 2.5 }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ bgcolor: '#0D1527', fontWeight: 700 }}>Run ID</TableCell>
                <TableCell sx={{ bgcolor: '#0D1527', fontWeight: 700 }}>Type</TableCell>
                <TableCell sx={{ bgcolor: '#0D1527', fontWeight: 700 }}>Status</TableCell>
                <TableCell sx={{ bgcolor: '#0D1527', fontWeight: 700 }}>Records Analyzed</TableCell>
                <TableCell sx={{ bgcolor: '#0D1527', fontWeight: 700 }}>Clusters Found</TableCell>
                <TableCell sx={{ bgcolor: '#0D1527', fontWeight: 700 }}>Noise Points</TableCell>
                <TableCell sx={{ bgcolor: '#0D1527', fontWeight: 700 }}>Duration</TableCell>
                <TableCell sx={{ bgcolor: '#0D1527', fontWeight: 700 }}>Timestamp</TableCell>
                <TableCell sx={{ bgcolor: '#0D1527', fontWeight: 700 }} align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 6 }}>
                    <CircularProgress size={32} sx={{ color: '#00D4FF' }} />
                  </TableCell>
                </TableRow>
              ) : history.items?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                    No clustering run records found.
                  </TableCell>
                </TableRow>
              ) : (
                history.items?.map((r) => {
                  const statusConf = STATUS_CHIPS[r.status] || { color: 'default' };
                  const isVuln = r.clustering_type === 'VULNERABILITY';
                  return (
                    <TableRow key={r.run_id} hover sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' } }}>
                      <TableCell>
                        <Tooltip title={r.run_id}>
                          <Typography variant="body2" fontFamily="monospace" fontWeight={700} sx={{ color: '#00D4FF' }}>
                            {r.run_id.slice(0, 8)}...
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          icon={isVuln ? <BugReport sx={{ fontSize: 14 }} /> : <Description sx={{ fontSize: 14 }} />}
                          label={isVuln ? 'Vulnerability' : 'Report'}
                          sx={{
                            bgcolor: isVuln ? 'rgba(0,212,255,0.15)' : 'rgba(0,230,118,0.15)',
                            color: isVuln ? '#00D4FF' : '#00E676',
                            fontWeight: 700,
                            fontSize: '0.72rem'
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={r.status}
                          color={statusConf.color}
                          icon={statusConf.icon}
                          sx={{ fontWeight: 800, fontSize: '0.7rem' }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={700}>
                          {r.input_record_count?.toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={700} color="#00E676">
                          {r.discovered_cluster_count}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="#FF9100">
                          {r.noise_record_count}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {formatDuration(r.started_at, r.completed_at)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {r.created_at ? new Date(r.created_at).toLocaleString() : '—'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => setDetailsModal({ open: true, run: r })}
                          sx={{
                            fontSize: '0.7rem',
                            py: 0.3,
                            px: 1.2,
                            borderColor: 'rgba(255,255,255,0.1)',
                            color: '#CBD5E1',
                            '&:hover': { borderColor: '#00D4FF', color: '#00D4FF' }
                          }}
                        >
                          Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={history.total}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[10, 20, 50]}
          sx={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        />
      </Card>

      {/* Run Details Modal */}
      <Dialog
        open={detailsModal.open}
        onClose={() => setDetailsModal({ open: false, run: null })}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#0B1120',
            border: '1px solid rgba(255,255,255,0.1)',
            backgroundImage: 'none',
          }
        }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', p: 2 }}>
          <Typography variant="h6" fontWeight={700}>
            Clustering Run Details
          </Typography>
          <IconButton onClick={() => setDetailsModal({ open: false, run: null })} sx={{ color: 'text.secondary' }}>
            <Close />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 3 }}>
          {detailsModal.run && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Run ID</Typography>
                  <Typography variant="body2" fontFamily="monospace" fontWeight={700} color="#00D4FF">
                    {detailsModal.run.run_id}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Clustering Type</Typography>
                  <Typography variant="body2" fontWeight={700}>
                    {detailsModal.run.clustering_type}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Status</Typography>
                  <Typography variant="body2" fontWeight={700}>
                    {detailsModal.run.status} ({detailsModal.run.current_stage})
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Algorithm Version</Typography>
                  <Typography variant="body2" fontWeight={700}>
                    {detailsModal.run.algorithm_version}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Started At</Typography>
                  <Typography variant="body2">
                    {detailsModal.run.started_at ? new Date(detailsModal.run.started_at).toLocaleString() : '—'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Completed At</Typography>
                  <Typography variant="body2">
                    {detailsModal.run.completed_at ? new Date(detailsModal.run.completed_at).toLocaleString() : '—'}
                  </Typography>
                </Box>
              </Box>

              {detailsModal.run.error_message && (
                <Alert severity="error" sx={{ mt: 1 }}>
                  <strong>Execution Failure:</strong> {detailsModal.run.error_message}
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <Button onClick={() => setDetailsModal({ open: false, run: null })} variant="outlined" sx={{ color: 'text.secondary' }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

