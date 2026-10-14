import React, { useState, useEffect, useMemo } from 'react';
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
  Checkbox,
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
  CompareArrows,
} from '@mui/icons-material';
import api from '../../api/axios';
import ClusterQualityMetricsCard from './ClusterQualityMetricsCard';
import ClusterComparisonModal from './ClusterComparisonModal';

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
  const [selectedRunIds, setSelectedRunIds] = useState([]);
  const [compareModalOpen, setCompareModalOpen] = useState(false);

  // Derive the active clustering_type of the current selection (if any)
  const selectedRuns = useMemo(() => {
    return (history.items || []).filter((r) => selectedRunIds.includes(r.run_id));
  }, [history.items, selectedRunIds]);

  const activeSelectedType = selectedRuns.length > 0 ? selectedRuns[0].clustering_type : null;

  const handleToggleSelectRun = (r) => {
    const runId = r.run_id;
    if (selectedRunIds.includes(runId)) {
      setSelectedRunIds(selectedRunIds.filter((id) => id !== runId));
    } else {
      // Strictly enforce same-type comparison:
      // If user clicks a run of a different type, start a fresh selection with this run
      if (activeSelectedType && r.clustering_type !== activeSelectedType) {
        setSelectedRunIds([runId]);
        return;
      }
      if (selectedRunIds.length >= 2) {
        setSelectedRunIds([selectedRunIds[1], runId]);
      } else {
        setSelectedRunIds([...selectedRunIds, runId]);
      }
    }
  };

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
                Retaining the latest run for each algorithm (HDBSCAN, K-Means++, Agglomerative). New runs automatically replace previous runs of the same algorithm to keep database storage lean.
              </Typography>
              <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                <Chip size="small" label="Top 3 History: 1 Per Algorithm" sx={{ bgcolor: 'rgba(0, 212, 255, 0.12)', color: '#00D4FF', fontWeight: 700, fontSize: '0.72rem', border: '1px solid rgba(0, 212, 255, 0.25)' }} />
                <Chip size="small" label="Auto-Prunes Previous Run" sx={{ bgcolor: 'rgba(0, 230, 118, 0.12)', color: '#00E676', fontWeight: 700, fontSize: '0.72rem', border: '1px solid rgba(0, 230, 118, 0.25)' }} />
              </Box>
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

      {/* Comparison Action Banner */}
      {selectedRunIds.length > 0 && (
        <Box
          sx={{
            mb: 2,
            p: 1.5,
            px: 2.5,
            bgcolor: 'rgba(0, 212, 255, 0.1)',
            border: '1px solid rgba(0, 212, 255, 0.3)',
            borderRadius: 2,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 1.5,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <CompareArrows sx={{ color: '#00D4FF' }} />
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography variant="body2" sx={{ color: '#E2E8F0', fontWeight: 700 }}>
                  {selectedRunIds.length === 1
                    ? `1 ${activeSelectedType === 'VULNERABILITY' ? 'Vulnerability' : 'Report'} run selected. Select a 2nd ${activeSelectedType === 'VULNERABILITY' ? 'Vulnerability' : 'Report'} run to compare.`
                    : `2 ${activeSelectedType === 'VULNERABILITY' ? 'Vulnerability' : 'Report'} runs selected for benchmark matrix.`}
                </Typography>
                {activeSelectedType && (
                  <Chip
                    size="small"
                    label={activeSelectedType === 'VULNERABILITY' ? 'Vulnerability Findings' : 'Audit Reports'}
                    sx={{
                      bgcolor: activeSelectedType === 'VULNERABILITY' ? 'rgba(0,212,255,0.15)' : 'rgba(0,230,118,0.15)',
                      color: activeSelectedType === 'VULNERABILITY' ? '#00D4FF' : '#00E676',
                      fontWeight: 800,
                      fontSize: '0.68rem',
                    }}
                  />
                )}
              </Box>
              <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block', mt: 0.3 }}>
                *Comparison is strictly isolated by type: Vulnerabilities compare against Vulnerabilities, and Reports against Reports.
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Button
              size="small"
              variant="text"
              onClick={() => setSelectedRunIds([])}
              sx={{ color: '#94A3B8', fontSize: '0.75rem' }}
            >
              Clear
            </Button>
            <Button
              size="small"
              variant="contained"
              disabled={selectedRunIds.length !== 2}
              onClick={() => setCompareModalOpen(true)}
              startIcon={<CompareArrows />}
              sx={{
                bgcolor: '#00D4FF',
                color: '#0D1527',
                fontWeight: 800,
                fontSize: '0.75rem',
                '&:hover': { bgcolor: '#38BDF8' },
              }}
            >
              Compare Runs ({selectedRunIds.length}/2)
            </Button>
          </Box>
        </Box>
      )}

      <Card sx={{ bgcolor: '#0B1120', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 2.5 }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ bgcolor: '#0D1527', width: 44, p: 0.5 }} align="center">
                  <Tooltip title="Select up to 2 runs to compare">
                    <CompareArrows sx={{ fontSize: 16, color: '#64748B' }} />
                  </Tooltip>
                </TableCell>
                <TableCell sx={{ bgcolor: '#0D1527', fontWeight: 700 }}>Run ID</TableCell>
                <TableCell sx={{ bgcolor: '#0D1527', fontWeight: 700 }}>Type</TableCell>
                <TableCell sx={{ bgcolor: '#0D1527', fontWeight: 700 }}>Algorithm</TableCell>
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
                  <TableCell colSpan={11} align="center" sx={{ py: 6 }}>
                    <CircularProgress size={32} sx={{ color: '#00D4FF' }} />
                  </TableCell>
                </TableRow>
              ) : history.items?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                    No clustering run records found.
                  </TableCell>
                </TableRow>
              ) : (
                history.items?.map((r) => {
                  const statusConf = STATUS_CHIPS[r.status] || { color: 'default' };
                  const isVuln = r.clustering_type === 'VULNERABILITY';
                  const algoRaw = r.summary?.algorithm || r.parameters?.algorithm || (r.algorithm_version ? r.algorithm_version.split('-')[0] : 'HDBSCAN');
                  const algoKey = String(algoRaw).toUpperCase();
                  let algoLabel = 'HDBSCAN';
                  let algoColor = '#00D4FF';
                  let algoBg = 'rgba(0, 212, 255, 0.15)';

                  if (algoKey.includes('KMEANS')) {
                    algoLabel = 'K-Means++';
                    algoColor = '#B388FF';
                    algoBg = 'rgba(124, 77, 255, 0.15)';
                  } else if (algoKey.includes('AGGLOMERATIVE')) {
                    algoLabel = 'Agglomerative';
                    algoColor = '#FF9100';
                    algoBg = 'rgba(255, 145, 0, 0.15)';
                  }

                  const isChecked = selectedRunIds.includes(r.run_id);

                  return (
                    <TableRow key={r.run_id} hover sx={{ bgcolor: isChecked ? 'rgba(0,212,255,0.04)' : 'transparent', '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' } }}>
                      <TableCell align="center" sx={{ p: 0.5, width: 44 }}>
                        <Tooltip
                          title={
                            activeSelectedType && r.clustering_type !== activeSelectedType
                              ? `Cannot mix types. Click to start a new ${r.clustering_type === 'VULNERABILITY' ? 'Vulnerability' : 'Report'} comparison.`
                              : isChecked
                              ? 'Deselect run'
                              : 'Select run for comparison'
                          }
                        >
                          <Checkbox
                            size="small"
                            checked={isChecked}
                            onChange={() => handleToggleSelectRun(r)}
                            sx={{
                              color: activeSelectedType && r.clustering_type !== activeSelectedType ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.2)',
                              p: 0.5,
                              '&.Mui-checked': { color: '#00D4FF' },
                            }}
                          />
                        </Tooltip>
                      </TableCell>
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
                          label={algoLabel}
                          sx={{
                            bgcolor: algoBg,
                            color: algoColor,
                            fontWeight: 800,
                            fontSize: '0.72rem',
                            border: `1px solid ${algoColor}33`,
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
        maxWidth="lg"
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
            Clustering Run Details & Validation Metrics
          </Typography>
          <IconButton onClick={() => setDetailsModal({ open: false, run: null })} sx={{ color: 'text.secondary' }}>
            <Close />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 3 }}>
          {detailsModal.run && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2, p: 2, bgcolor: 'rgba(255,255,255,0.02)', borderRadius: 2, border: '1px solid rgba(255,255,255,0.06)' }}>
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
                  <Typography variant="caption" color="text.secondary">Algorithm</Typography>
                  <Typography variant="body2" fontWeight={800} sx={{ color: detailsModal.run.algorithm_version?.includes('KMEANS') ? '#B388FF' : detailsModal.run.algorithm_version?.includes('AGGLOMERATIVE') ? '#FF9100' : '#00D4FF' }}>
                    {detailsModal.run.summary?.algorithm || detailsModal.run.parameters?.algorithm || detailsModal.run.algorithm_version || 'HDBSCAN'}
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

                {/* Display active selected features if present */}
                {(detailsModal.run.summary?.selected_features?.length > 0 || detailsModal.run.parameters?.selected_features?.length > 0) && (
                  <Box sx={{ gridColumn: '1 / -1', pt: 1, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, fontWeight: 700 }}>
                      Active Features Used for Clustering ({((detailsModal.run.summary?.selected_features || detailsModal.run.parameters?.selected_features) || []).length}):
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                      {((detailsModal.run.summary?.selected_features || detailsModal.run.parameters?.selected_features) || []).map((feat) => (
                        <Chip
                          key={feat}
                          size="small"
                          label={feat}
                          sx={{
                            bgcolor: 'rgba(0, 212, 255, 0.1)',
                            color: '#00D4FF',
                            fontSize: '0.72rem',
                            border: '1px solid rgba(0, 212, 255, 0.25)',
                          }}
                        />
                      ))}
                    </Box>
                  </Box>
                )}
              </Box>

              {detailsModal.run.error_message && (
                <Alert severity="error">
                  <strong>Execution Failure:</strong> {detailsModal.run.error_message}
                </Alert>
              )}

              {/* Cluster Quality & Separation Metrics */}
              {detailsModal.run.summary && (
                <ClusterQualityMetricsCard
                  summary={detailsModal.run.summary}
                  parameters={detailsModal.run.parameters}
                  clusteringType={detailsModal.run.clustering_type}
                />
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

      {/* Cross-Run Comparison Modal */}
      <ClusterComparisonModal
        open={compareModalOpen}
        onClose={() => setCompareModalOpen(false)}
        runId1={selectedRunIds[0]}
        runId2={selectedRunIds[1]}
      />
    </Box>
  );
}

