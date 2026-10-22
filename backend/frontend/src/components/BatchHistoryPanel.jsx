import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Chip,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  TextField,
  Pagination,
  CircularProgress,
  Collapse,
  useTheme,
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  Stop,
  Replay,
  CheckCircle,
  Cancel,
  Pending,
  Autorenew,
  FolderOpen,
  CloudUpload,
  Visibility,
  Refresh,
  Lock,
  LockOpen,
  KeyboardArrowDown,
  KeyboardArrowUp,
  OpenInNew,
  Speed,
  AccessTime,
  DeleteOutline,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import api from '../api/axios';
import { useBulkUpload } from '../contexts/BulkUploadContext';

const BatchHistoryPanel = () => {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const {
    activeBatchId,
    activeBatch,
    activeBatchItems,
    isStreaming,
    streamStatus,
    pauseBatch,
    resumeBatch,
    cancelBatch,
    retryFailedBatch,
    deleteBatch,
    loadBatchDetails,
  } = useBulkUpload();

  // History table state
  const [batches, setBatches] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Detail Modal state
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [selectedBatchDetails, setSelectedBatchDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Delete Batch Confirmation Dialog state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [batchToDelete, setBatchToDelete] = useState(null);

  // Filtering for active batch items
  const [itemFilter, setItemFilter] = useState('ALL'); // ALL, RUNNING, SUCCESS, FAILED
  const [activeItemsExpanded, setActiveItemsExpanded] = useState(true);

  // Fetch batch history
  const fetchHistory = useCallback(async (pageNum = 1) => {
    setLoadingHistory(true);
    try {
      const res = await api.get('/api/batches', {
        params: { page: pageNum, page_size: 10 },
      });
      setBatches(res.data.batches || []);
      setTotalCount(res.data.total || 0);
      setTotalPages(Math.ceil((res.data.total || 0) / 10) || 1);
      setPage(pageNum);
    } catch (err) {
      console.error('Failed to load batch history', err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory(1);
  }, [fetchHistory]);

  // When active batch completes or changes, refresh history
  useEffect(() => {
    if (activeBatch && (activeBatch.status === 'COMPLETED' || activeBatch.status === 'FAILED' || activeBatch.status === 'CANCELLED')) {
      fetchHistory(page);
    }
  }, [activeBatch?.status, fetchHistory, page]);

  // Open batch detail dialog
  const handleOpenDetails = async (batch) => {
    setSelectedBatch(batch);
    setDetailsOpen(true);
    setLoadingDetails(true);
    try {
      const res = await api.get(`/api/batches/${batch.batch_id}`);
      setSelectedBatchDetails(res.data);
    } catch (err) {
      enqueueSnackbar('Failed to load batch items', { variant: 'error' });
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleCloseDetails = () => {
    setDetailsOpen(false);
    setSelectedBatch(null);
    setSelectedBatchDetails(null);
  };

  const handleRetry = async (batchId) => {
    try {
      await retryFailedBatch(batchId);
      enqueueSnackbar('Failed items re-queued for processing', { variant: 'success' });
      fetchHistory(page);
    } catch (err) {
      enqueueSnackbar(err.response?.data?.detail || 'Failed to retry batch', { variant: 'error' });
    }
  };

  const handleDeleteBatch = (batch) => {
    if ((batch.completed_files || 0) > 0) {
      enqueueSnackbar('Batch cannot be deleted because one or more files have succeeded.', { variant: 'error' });
      return;
    }
    setBatchToDelete(batch);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!batchToDelete) return;
    try {
      await deleteBatch(batchToDelete.batch_id);
      fetchHistory(page);
      if (detailsOpen && selectedBatch?.batch_id === batchToDelete.batch_id) {
        handleCloseDetails();
      }
    } catch (err) {
      // Handled in context
    } finally {
      setDeleteConfirmOpen(false);
      setBatchToDelete(null);
    }
  };

  const renderStatusChip = (status) => {
    switch (status) {
      case 'PENDING':
        return <Chip size="small" icon={<Pending fontSize="small" />} label="Pending" color="default" />;
      case 'UPLOADING':
        return (
          <Chip
            size="small"
            icon={<Autorenew fontSize="small" sx={{ animation: 'spin 2s linear infinite', '@keyframes spin': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } } }} />}
            label="Uploading"
            color="info"
          />
        );
      case 'PIPELINE':
      case 'RUNNING':
        return (
          <Chip
            size="small"
            icon={<Autorenew fontSize="small" sx={{ animation: 'spin 2s linear infinite', '@keyframes spin': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } } }} />}
            label="Running"
            color="primary"
          />
        );
      case 'PAUSED':
        return <Chip size="small" icon={<Pause fontSize="small" />} label="Paused" color="warning" />;
      case 'SUCCESS':
      case 'COMPLETED':
        return <Chip size="small" icon={<CheckCircle fontSize="small" />} label="Completed" color="success" />;
      case 'FAILED':
        return <Chip size="small" icon={<Cancel fontSize="small" />} label="Failed" color="error" />;
      case 'CANCELLED':
      case 'SKIPPED':
        return <Chip size="small" label="Cancelled" color="default" />;
      default:
        return <Chip size="small" label={status || 'Unknown'} />;
    }
  };

  // Filter items for active batch
  const filteredActiveItems = (activeBatchItems || []).filter((item) => {
    if (itemFilter === 'SUCCESS') return item.status === 'SUCCESS';
    if (itemFilter === 'FAILED') return item.status === 'FAILED';
    if (itemFilter === 'RUNNING') return item.status === 'UPLOADING' || item.status === 'PIPELINE' || item.status === 'PENDING';
    return true;
  });

  const totalFiles = activeBatch?.total_files || activeBatchItems?.length || 0;
  const completedFiles = activeBatch?.completed_files || activeBatchItems?.filter((i) => i.status === 'SUCCESS').length || 0;
  const failedFiles = activeBatch?.failed_files || activeBatchItems?.filter((i) => i.status === 'FAILED').length || 0;
  const progressPct = totalFiles > 0 ? Math.round(((completedFiles + failedFiles) / totalFiles) * 100) : 0;

  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* ---------------------------------------------------- */}
      {/* ACTIVE BATCH CARD (Shown if an active batch is live) */}
      {/* ---------------------------------------------------- */}
      {activeBatchId && activeBatch && (
        <Card
          sx={{
            background: isLight ? '#FFFFFF' : 'linear-gradient(135deg, rgba(10, 14, 23, 0.95), rgba(15, 23, 42, 0.95))',
            border: isLight ? '1px solid rgba(15, 23, 42, 0.08)' : '1px solid rgba(0, 212, 255, 0.4)',
            borderRadius: 3,
            boxShadow: isLight ? '0 4px 20px -2px rgba(15, 23, 42, 0.05)' : '0 8px 32px rgba(0, 212, 255, 0.15)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Glowing accent bar */}
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 4,
              background: 'linear-gradient(90deg, #00D4FF, #00E676, #00D4FF)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 3s linear infinite',
              '@keyframes shimmer': { '0%': { backgroundPosition: '200% 0' }, '100%': { backgroundPosition: '-200% 0' } },
            }}
          />

          <CardContent sx={{ p: 3 }}>
            {/* Header row */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                {activeBatch.source_type === 'SERVER_PATH' ? (
                  <FolderOpen sx={{ color: '#00D4FF', fontSize: 30 }} />
                ) : (
                  <CloudUpload sx={{ color: '#00D4FF', fontSize: 30 }} />
                )}
                <Box>
                  <Typography variant="h6" fontWeight={700} color="#FFFFFF">
                    {activeBatch.name || `Batch ${activeBatch.batch_id.slice(0, 8)}`}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Source: {activeBatch.source_type === 'SERVER_PATH' ? `Server Path (${activeBatch.server_path})` : 'Browser Upload'}
                    {activeBatch.agency_name ? ` • Agency: ${activeBatch.agency_name}` : ''}
                  </Typography>
                </Box>
              </Box>

              {/* Status and Action Buttons */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {renderStatusChip(activeBatch.status)}

                {activeBatch.status === 'RUNNING' && (
                  <Button
                    variant="outlined"
                    size="small"
                    color="warning"
                    startIcon={<Pause />}
                    onClick={() => pauseBatch(activeBatchId)}
                    sx={{ textTransform: 'none' }}
                  >
                    Pause
                  </Button>
                )}

                {activeBatch.status === 'PAUSED' && (
                  <Button
                    variant="contained"
                    size="small"
                    color="success"
                    startIcon={<PlayArrow />}
                    onClick={() => resumeBatch(activeBatchId)}
                    sx={{ textTransform: 'none' }}
                  >
                    Resume
                  </Button>
                )}

                {(activeBatch.status === 'RUNNING' || activeBatch.status === 'PAUSED') && (
                  <Button
                    variant="outlined"
                    size="small"
                    color="error"
                    startIcon={<Stop />}
                    onClick={() => cancelBatch(activeBatchId)}
                    sx={{ textTransform: 'none' }}
                  >
                    Cancel
                  </Button>
                )}

                {(activeBatch.status === 'COMPLETED' || activeBatch.status === 'FAILED') && failedFiles > 0 && (
                  <Button
                    variant="contained"
                    size="small"
                    color="primary"
                    startIcon={<Replay />}
                    onClick={() => handleRetry(activeBatchId)}
                    sx={{ textTransform: 'none' }}
                  >
                    Retry Failed ({failedFiles})
                  </Button>
                )}

                <IconButton size="small" onClick={() => loadBatchDetails(activeBatchId)} title="Refresh">
                  <Refresh fontSize="small" sx={{ color: '#00D4FF' }} />
                </IconButton>
              </Box>
            </Box>

            {/* Progress Bar & Stats */}
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Processed <strong>{completedFiles + failedFiles}</strong> of <strong>{totalFiles}</strong> files ({progressPct}%)
                </Typography>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Typography variant="caption" sx={{ color: '#00E676', fontWeight: 600 }}>
                    ✓ Succeeded: {completedFiles}
                  </Typography>
                  {failedFiles > 0 && (
                    <Typography variant="caption" sx={{ color: '#FF5252', fontWeight: 600 }}>
                      ✗ Failed: {failedFiles}
                    </Typography>
                  )}
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    ◷ Concurrency: {activeBatch.concurrency}x
                  </Typography>
                </Box>
              </Box>
              <LinearProgress
                variant="determinate"
                value={progressPct}
                sx={{
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  '& .MuiLinearProgress-bar': {
                    background: failedFiles > 0 && completedFiles === 0
                      ? 'linear-gradient(90deg, #FF5252, #FF1744)'
                      : 'linear-gradient(90deg, #00D4FF, #00E676)',
                  },
                }}
              />
            </Box>

            {/* Toggle file item list */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pt: 1, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <Button
                size="small"
                onClick={() => setActiveItemsExpanded(!activeItemsExpanded)}
                endIcon={activeItemsExpanded ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
                sx={{ textTransform: 'none', color: '#00D4FF' }}
              >
                {activeItemsExpanded ? 'Hide File Details' : `Show File Details (${activeBatchItems.length} files)`}
              </Button>

              {activeItemsExpanded && (
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {['ALL', 'RUNNING', 'SUCCESS', 'FAILED'].map((f) => (
                    <Button
                      key={f}
                      size="small"
                      variant={itemFilter === f ? 'contained' : 'text'}
                      onClick={() => setItemFilter(f)}
                      sx={{
                        fontSize: '0.75rem',
                        py: 0.2,
                        px: 1,
                        textTransform: 'none',
                        minWidth: 'auto',
                        background: itemFilter === f ? 'rgba(0, 212, 255, 0.2)' : 'transparent',
                        color: itemFilter === f ? '#00D4FF' : 'text.secondary',
                      }}
                    >
                      {f}
                    </Button>
                  ))}
                </Box>
              )}
            </Box>

            {/* Active Batch Item Table */}
            <Collapse in={activeItemsExpanded}>
              <TableContainer component={Paper} sx={{ mt: 2, maxHeight: 350, background: 'rgba(0, 0, 0, 0.2)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow sx={{ '& th': { background: '#0F172A', color: 'text.secondary', fontSize: '0.75rem', fontWeight: 600 } }}>
                      <TableCell>File Name</TableCell>
                      <TableCell width={130}>Status</TableCell>
                      <TableCell>Step Details</TableCell>
                      <TableCell width={100}>Protected</TableCell>
                      <TableCell width={80} align="center">Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredActiveItems.map((item) => (
                      <TableRow key={item.item_id || item.original_filename} hover sx={{ '& td': { borderColor: 'rgba(255,255,255,0.04)', py: 0.8 } }}>
                        <TableCell sx={{ color: '#FFFFFF', fontWeight: 500, fontSize: '0.85rem' }}>
                          {item.original_filename}
                        </TableCell>
                        <TableCell>{renderStatusChip(item.status)}</TableCell>
                        <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <Tooltip title={item.detail || item.error_message || ''}>
                            <span>{item.detail || item.error_message || '-'}</span>
                          </Tooltip>
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                          {item.is_protected === 'Decrypted' ? (
                            <Tooltip title="Decrypted using password"><LockOpen fontSize="small" sx={{ color: '#00E676', verticalAlign: 'middle' }} /></Tooltip>
                          ) : item.is_protected === 'Yes' ? (
                            <Tooltip title="Encrypted"><Lock fontSize="small" sx={{ color: '#FFB300', verticalAlign: 'middle' }} /></Tooltip>
                          ) : (
                            'No'
                          )}
                        </TableCell>
                        <TableCell align="center">
                          {item.report_id && (
                            <Tooltip title="Open Report Details">
                              <IconButton
                                size="small"
                                onClick={() => navigate(`/reports/${item.report_id}`)}
                                sx={{ color: '#00D4FF' }}
                              >
                                <OpenInNew fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredActiveItems.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                          No files match current filter.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Collapse>
          </CardContent>
        </Card>
      )}

      {/* ---------------------------------------------------- */}
      {/* BATCH HISTORY TABLE */}
      {/* ---------------------------------------------------- */}
      <Card
        sx={{
          background: isLight ? '#FFFFFF' : 'rgba(15, 23, 42, 0.75)',
          border: isLight ? '1px solid rgba(15, 23, 42, 0.08)' : '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 2,
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
            <Box>
              <Typography variant="h6" fontWeight={600} color={isLight ? '#0F172A' : '#FFFFFF'}>
                Batch Processing History
              </Typography>
              <Typography variant="body2" color="text.secondary">
                All server-side batches processed. Sessions continue in background even if your browser closes.
              </Typography>
            </Box>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Refresh />}
              onClick={() => fetchHistory(page)}
              disabled={loadingHistory}
              sx={{ color: '#00D4FF', borderColor: 'rgba(0, 212, 255, 0.3)', textTransform: 'none' }}
            >
              Refresh History
            </Button>
          </Box>

          {loadingHistory ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress size={32} sx={{ color: '#00D4FF' }} />
            </Box>
          ) : batches.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
              <Typography variant="body1">No batch processing history found.</Typography>
              <Typography variant="caption">Start a bulk upload above to create your first batch!</Typography>
            </Box>
          ) : (
            <>
              <TableContainer component={Paper} sx={{ background: 'transparent', boxShadow: 'none' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ '& th': { bgcolor: isLight ? '#F1F5F9' : undefined, borderColor: isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255,255,255,0.08)', color: isLight ? '#475569' : 'text.secondary', fontWeight: 600 } }}>
                      <TableCell>Batch Name / ID</TableCell>
                      <TableCell>Created At</TableCell>
                      <TableCell>Source</TableCell>
                      <TableCell align="center">Files</TableCell>
                      <TableCell align="center">Success Rate</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {batches.map((batch) => {
                      const total = batch.total_files || 0;
                      const completed = batch.completed_files || 0;
                      const failed = batch.failed_files || 0;
                      const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

                      return (
                        <TableRow key={batch.batch_id} hover sx={{ '& td': { borderColor: isLight ? 'rgba(15, 23, 42, 0.06)' : 'rgba(255,255,255,0.05)', py: 1.5 } }}>
                          <TableCell>
                            <Typography variant="body2" fontWeight={600} color={isLight ? '#0F172A' : '#FFFFFF'}>
                              {batch.name || `Batch ${batch.batch_id.slice(0, 8)}`}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                              {batch.batch_id.slice(0, 13)}...
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>
                            {batch.created_at ? new Date(batch.created_at).toLocaleString() : '-'}
                          </TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={batch.source_type === 'SERVER_PATH' ? 'Server Path' : 'Upload'}
                              icon={batch.source_type === 'SERVER_PATH' ? <FolderOpen fontSize="small" /> : <CloudUpload fontSize="small" />}
                              sx={{
                                background: batch.source_type === 'SERVER_PATH' ? (isLight ? 'rgba(2, 132, 199, 0.1)' : 'rgba(0, 212, 255, 0.1)') : (isLight ? 'rgba(15, 23, 42, 0.05)' : 'rgba(255, 255, 255, 0.05)'),
                                color: batch.source_type === 'SERVER_PATH' ? (isLight ? '#0284C7' : '#00D4FF') : 'text.primary',
                                fontSize: '0.75rem',
                              }}
                            />
                          </TableCell>
                          <TableCell align="center" sx={{ color: isLight ? '#0F172A' : '#FFFFFF', fontWeight: 600 }}>
                            {total}
                          </TableCell>
                          <TableCell align="center">
                            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="caption" sx={{ color: failed > 0 ? '#FF5252' : '#00E676', fontWeight: 600 }}>
                                {completed}/{total} ({rate}%)
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell>{renderStatusChip(batch.status)}</TableCell>
                          <TableCell align="right">
                            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<Visibility />}
                                onClick={() => handleOpenDetails(batch)}
                                sx={{ textTransform: 'none', fontSize: '0.75rem', borderColor: 'rgba(255,255,255,0.15)', color: '#FFFFFF' }}
                              >
                                Items
                              </Button>
                              {failed > 0 && batch.status !== 'RUNNING' && batch.status !== 'CANCELLED' && (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color="warning"
                                  startIcon={<Replay />}
                                  onClick={() => handleRetry(batch.batch_id)}
                                  sx={{ textTransform: 'none', fontSize: '0.75rem' }}
                                >
                                  Retry ({failed})
                                </Button>
                              )}
                              {batch.status !== 'RUNNING' && (
                                <Tooltip
                                  title={
                                    batch.completed_files > 0
                                      ? 'Batch cannot be deleted because one or more files have succeeded'
                                      : 'Delete Batch'
                                  }
                                >
                                  <span>
                                    <IconButton
                                      size="small"
                                      color="error"
                                      disabled={batch.completed_files > 0}
                                      onClick={() => handleDeleteBatch(batch)}
                                      sx={{
                                        opacity: batch.completed_files > 0 ? 0.35 : 0.85,
                                        '&:hover': { opacity: 1, backgroundColor: 'rgba(255, 82, 82, 0.1)' },
                                      }}
                                    >
                                      <DeleteOutline fontSize="small" />
                                    </IconButton>
                                  </span>
                                </Tooltip>
                              )}
                            </Box>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Pagination */}
              {totalPages > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                  <Pagination
                    count={totalPages}
                    page={page}
                    onChange={(_, p) => fetchHistory(p)}
                    color="primary"
                    size="small"
                  />
                </Box>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ---------------------------------------------------- */}
      {/* BATCH DETAILS DIALOG */}
      {/* ---------------------------------------------------- */}
      <Dialog
        open={detailsOpen}
        onClose={handleCloseDetails}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            background: '#0F172A',
            border: '1px solid rgba(0, 212, 255, 0.3)',
            borderRadius: 3,
            color: '#FFFFFF',
          },
        }}
      >
        <DialogTitle sx={{ borderBottom: '1px solid rgba(255,255,255,0.08)', pb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="h6" fontWeight={700}>
                {selectedBatch?.name || 'Batch Details'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                ID: {selectedBatch?.batch_id} • Status: {selectedBatch?.status}
              </Typography>
            </Box>
            {selectedBatch && renderStatusChip(selectedBatch.status)}
          </Box>
        </DialogTitle>

        <DialogContent sx={{ py: 2 }}>
          {loadingDetails ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress size={32} sx={{ color: '#00D4FF' }} />
            </Box>
          ) : (
            <TableContainer component={Paper} sx={{ background: 'transparent', boxShadow: 'none' }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ '& th': { borderColor: 'rgba(255,255,255,0.08)', color: 'text.secondary', fontWeight: 600 } }}>
                    <TableCell>Filename</TableCell>
                    <TableCell width={130}>Status</TableCell>
                    <TableCell>Details / Error</TableCell>
                    <TableCell width={100}>Protected</TableCell>
                    <TableCell width={80} align="center">Report</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(selectedBatchDetails?.items || []).map((item) => (
                    <TableRow key={item.item_id} hover sx={{ '& td': { borderColor: 'rgba(255,255,255,0.04)' } }}>
                      <TableCell sx={{ color: '#FFFFFF', fontWeight: 500, fontSize: '0.85rem' }}>
                        {item.original_filename}
                      </TableCell>
                      <TableCell>{renderStatusChip(item.status)}</TableCell>
                      <TableCell sx={{ color: item.error_message ? '#FF5252' : 'text.secondary', fontSize: '0.8rem', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <Tooltip title={item.error_message || item.detail || ''}>
                          <span>{item.error_message || item.detail || '-'}</span>
                        </Tooltip>
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                        {item.is_protected === 'Decrypted' ? (
                          <LockOpen fontSize="small" sx={{ color: '#00E676', verticalAlign: 'middle' }} />
                        ) : item.is_protected === 'Yes' ? (
                          <Lock fontSize="small" sx={{ color: '#FFB300', verticalAlign: 'middle' }} />
                        ) : (
                          'No'
                        )}
                      </TableCell>
                      <TableCell align="center">
                        {item.report_id && (
                          <Tooltip title="View Report">
                            <IconButton
                              size="small"
                              onClick={() => {
                                handleCloseDetails();
                                navigate(`/reports/${item.report_id}`);
                              }}
                              sx={{ color: '#00D4FF' }}
                            >
                              <OpenInNew fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!selectedBatchDetails?.items || selectedBatchDetails.items.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                        No items found for this batch.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>

        <DialogActions sx={{ borderTop: '1px solid rgba(255,255,255,0.08)', px: 3, py: 2, justifyContent: 'space-between' }}>
          <Box>
            {selectedBatch && selectedBatch.completed_files === 0 && selectedBatch.status !== 'RUNNING' && (
              <Button
                variant="outlined"
                color="error"
                size="small"
                startIcon={<DeleteOutline />}
                onClick={() => handleDeleteBatch(selectedBatch)}
                sx={{ textTransform: 'none' }}
              >
                Delete Batch
              </Button>
            )}
            {selectedBatch && selectedBatch.completed_files > 0 && (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Cannot delete batch (contains {selectedBatch.completed_files} succeeded reports)
              </Typography>
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {selectedBatch?.failed_files > 0 && selectedBatch?.status !== 'RUNNING' && selectedBatch?.status !== 'CANCELLED' && (
              <Button
                variant="contained"
                color="warning"
                size="small"
                startIcon={<Replay />}
                onClick={() => {
                  handleRetry(selectedBatch.batch_id);
                  handleCloseDetails();
                }}
                sx={{ textTransform: 'none' }}
              >
                Retry Failed Items
              </Button>
            )}
            <Button onClick={handleCloseDetails} sx={{ color: 'text.secondary', textTransform: 'none' }}>
              Close
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

      {/* Delete Batch Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        PaperProps={{
          sx: {
            background: 'rgba(15, 23, 42, 0.95)',
            border: '1px solid rgba(255, 82, 82, 0.4)',
            borderRadius: 2,
            minWidth: 380,
            backdropFilter: 'blur(10px)',
          },
        }}
      >
        <DialogTitle sx={{ color: '#FF5252', fontWeight: 600 }}>Delete Batch</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Are you sure you want to permanently delete{' '}
            <strong style={{ color: '#FFFFFF' }}>{batchToDelete?.name || `Batch ${batchToDelete?.batch_id?.slice(0, 8)}`}</strong>?
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            This action will remove the batch records and clean up any remaining staging files. This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteConfirmOpen(false)} sx={{ color: 'text.secondary', textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleConfirmDelete}
            sx={{ textTransform: 'none' }}
          >
            Confirm Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BatchHistoryPanel;
