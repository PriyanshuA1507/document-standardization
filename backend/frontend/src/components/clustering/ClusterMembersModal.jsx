import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  Chip,
  CircularProgress,
  InputAdornment,
  Alert,
  useTheme
} from '@mui/material';
import { Close, Search, Description, BugReport } from '@mui/icons-material';
import api from '../../api/axios';

const SEVERITY_COLORS = {
  CRITICAL: 'error',
  HIGH: 'warning',
  MEDIUM: 'info',
  LOW: 'success',
  INFORMATIONAL: 'default'
};

export default function ClusterMembersModal({ open, onClose, runId, clusterId, clusterLabel, clusteringType }) {
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({ items: [], total: 0 });
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [search, setSearch] = useState('');
  const [error, setError] = useState(null);

  const fetchMembers = async (pageIdx = 0, size = 10, searchTxt = '') => {
    if (!runId || clusterId === undefined || clusterId === null) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/api/clustering/runs/${runId}/clusters/${clusterId}/members`, {
        params: {
          page: pageIdx + 1,
          page_size: size,
          search: searchTxt || undefined
        }
      });
      if (res.data?.status === 'success') {
        setData(res.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load cluster members.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && runId) {
      setPage(0);
      setSearch('');
      fetchMembers(0, rowsPerPage, '');
    }
  }, [open, runId, clusterId]);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearch(val);
    setPage(0);
    fetchMembers(0, rowsPerPage, val);
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
    fetchMembers(newPage, rowsPerPage, search);
  };

  const handleChangeRowsPerPage = (event) => {
    const newSize = parseInt(event.target.value, 10);
    setRowsPerPage(newSize);
    setPage(0);
    fetchMembers(0, newSize, search);
  };

  const isVuln = clusteringType === 'VULNERABILITY';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: isLight ? '#FFFFFF' : '#0B1120',
          border: isLight ? '1px solid rgba(15, 23, 42, 0.1)' : '1px solid rgba(0, 212, 255, 0.2)',
          backgroundImage: 'none',
          maxHeight: '85vh',
        }
      }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: isLight ? '1px solid rgba(15, 23, 42, 0.08)' : '1px solid rgba(255,255,255,0.06)', p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {isVuln ? <BugReport sx={{ color: '#00D4FF' }} /> : <Description sx={{ color: '#00E676' }} />}
          <Box>
            <Typography variant="h6" fontWeight={700} sx={{ color: isLight ? '#0F172A' : '#F1F5F9' }}>
              {clusterId === -1 ? 'Unassigned / Noise Records' : (clusterLabel || `Cluster #${clusterId}`)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Run ID: {runId} &bull; Total Members: {data.total}
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={onClose} sx={{ color: isLight ? '#64748B' : 'text.secondary' }}>
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 2.5 }}>
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
          <TextField
            size="small"
            placeholder={isVuln ? "Search by finding title or CWE..." : "Search by report filename..."}
            value={search}
            onChange={handleSearchChange}
            sx={{ width: 350 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search sx={{ color: 'text.secondary', fontSize: 20 }} />
                </InputAdornment>
              ),
            }}
          />
          <Typography variant="body2" color="text.secondary">
            Showing {data.items?.length || 0} of {data.total} records
          </Typography>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <TableContainer sx={{ minHeight: 300, maxHeight: 450, border: isLight ? '1px solid rgba(15, 23, 42, 0.08)' : '1px solid rgba(255,255,255,0.05)', borderRadius: 2 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                {isVuln ? (
                  <>
                    <TableCell sx={{ bgcolor: isLight ? '#F1F5F9' : '#0D1527', color: isLight ? '#475569' : '#94A3B8', fontWeight: 700 }}>Finding Title</TableCell>
                    <TableCell sx={{ bgcolor: isLight ? '#F1F5F9' : '#0D1527', color: isLight ? '#475569' : '#94A3B8', fontWeight: 700 }}>Severity</TableCell>
                    <TableCell sx={{ bgcolor: isLight ? '#F1F5F9' : '#0D1527', color: isLight ? '#475569' : '#94A3B8', fontWeight: 700 }}>CVSS</TableCell>
                    <TableCell sx={{ bgcolor: isLight ? '#F1F5F9' : '#0D1527', color: isLight ? '#475569' : '#94A3B8', fontWeight: 700 }}>CWE Categories</TableCell>
                    <TableCell sx={{ bgcolor: isLight ? '#F1F5F9' : '#0D1527', color: isLight ? '#475569' : '#94A3B8', fontWeight: 700 }}>Source Report</TableCell>
                    <TableCell sx={{ bgcolor: isLight ? '#F1F5F9' : '#0D1527', color: isLight ? '#475569' : '#94A3B8', fontWeight: 700 }}>Affinity Strength</TableCell>
                  </>
                ) : (
                  <>
                    <TableCell sx={{ bgcolor: isLight ? '#F1F5F9' : '#0D1527', color: isLight ? '#475569' : '#94A3B8', fontWeight: 700 }}>Report Filename</TableCell>
                    <TableCell sx={{ bgcolor: isLight ? '#F1F5F9' : '#0D1527', color: isLight ? '#475569' : '#94A3B8', fontWeight: 700 }}>Audit Type</TableCell>
                    <TableCell sx={{ bgcolor: isLight ? '#F1F5F9' : '#0D1527', color: isLight ? '#475569' : '#94A3B8', fontWeight: 700 }}>Total Findings</TableCell>
                    <TableCell sx={{ bgcolor: isLight ? '#F1F5F9' : '#0D1527', color: isLight ? '#475569' : '#94A3B8', fontWeight: 700 }}>Avg CVSS</TableCell>
                    <TableCell sx={{ bgcolor: isLight ? '#F1F5F9' : '#0D1527', color: isLight ? '#475569' : '#94A3B8', fontWeight: 700 }}>Critical Findings</TableCell>
                    <TableCell sx={{ bgcolor: isLight ? '#F1F5F9' : '#0D1527', color: isLight ? '#475569' : '#94A3B8', fontWeight: 700 }}>Affinity Strength</TableCell>
                  </>
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                    <CircularProgress size={32} sx={{ color: '#00D4FF' }} />
                  </TableCell>
                </TableRow>
              ) : data.items?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    No member records found matching query.
                  </TableCell>
                </TableRow>
              ) : (
                data.items?.map((item) => {
                  const meta = item.metadata || {};
                  return (
                    <TableRow key={item.member_id} hover sx={{ '&:hover': { bgcolor: isLight ? 'rgba(15, 23, 42, 0.02)' : 'rgba(255,255,255,0.02)' } }}>
                      {isVuln ? (
                        <>
                          <TableCell sx={{ maxWidth: 300 }}>
                            <Typography variant="body2" fontWeight={600} noWrap title={meta.title}>
                              {meta.title || 'Untitled Finding'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={meta.severity || 'Unknown'}
                              color={SEVERITY_COLORS[String(meta.severity).toUpperCase()] || 'default'}
                              sx={{ fontWeight: 700, fontSize: '0.7rem' }}
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight={700}>
                              {meta.cvss_score !== null && meta.cvss_score !== undefined ? meta.cvss_score : '—'}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ maxWidth: 200 }}>
                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                              {(meta.cwe || []).slice(0, 2).map((c, i) => (
                                <Chip key={i} size="small" variant="outlined" label={c} sx={{ fontSize: '0.65rem' }} />
                              ))}
                              {(meta.cwe || []).length === 0 && <Typography variant="caption" color="text.secondary">—</Typography>}
                            </Box>
                          </TableCell>
                          <TableCell sx={{ maxWidth: 240 }}>
                            <Typography variant="caption" color="text.secondary" noWrap title={meta.report_filename}>
                              {meta.report_filename || 'Linked Report'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="cyan" fontWeight={600}>
                              {(item.membership_strength * 100).toFixed(1)}%
                            </Typography>
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell sx={{ maxWidth: 320 }}>
                            <Typography variant="body2" fontWeight={600} noWrap title={meta.filename}>
                              {meta.filename}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip size="small" variant="outlined" label={meta.audit_type || 'General'} sx={{ fontSize: '0.7rem' }} />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight={700}>
                              {meta.total_vulns}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight={700} color={meta.avg_cvss >= 7 ? '#FF1744' : meta.avg_cvss >= 4 ? '#FF9100' : '#00E676'}>
                              {meta.avg_cvss}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color={meta.crit_count > 0 ? '#FF1744' : 'text.secondary'}>
                              {meta.crit_count}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="cyan" fontWeight={600}>
                              {(item.membership_strength * 100).toFixed(1)}%
                            </Typography>
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={data.total}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[10, 25, 50]}
          sx={{ borderTop: '1px solid rgba(255,255,255,0.06)', mt: 1 }}
        />
      </DialogContent>

      <DialogActions sx={{ p: 2, borderTop: isLight ? '1px solid rgba(15, 23, 42, 0.08)' : '1px solid rgba(255,255,255,0.06)' }}>
        <Button onClick={onClose} variant="outlined" sx={{ color: 'text.secondary', borderColor: isLight ? 'rgba(15, 23, 42, 0.15)' : 'rgba(255,255,255,0.1)' }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

