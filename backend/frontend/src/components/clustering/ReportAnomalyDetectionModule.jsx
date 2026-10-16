import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  CircularProgress,
  Chip,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  InputAdornment,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Paper,
  Divider,
  IconButton,
  Tooltip,
  LinearProgress
} from '@mui/material';
import {
  ErrorOutline,
  Refresh,
  Search,
  CheckCircle,
  Warning,
  Security,
  CompareArrows,
  Visibility,
  History,
  Tune,
  AutoAwesome,
  Psychology,
  Functions,
  Speed,
  InfoOutlined
} from '@mui/icons-material';

import api from '../../api/axios';
import AnomalyConfigConsole from '../anomaly/AnomalyConfigConsole';
import AnomalyKpiStrip from '../anomaly/AnomalyKpiStrip';
import AnomalyScatterPlot from '../anomaly/AnomalyScatterPlot';
import AnomalyAttributionChart from '../anomaly/AnomalyAttributionChart';
import AnomalyInspectionDrawer from '../anomaly/AnomalyInspectionDrawer';
import AnomalyComparisonModal from '../anomaly/AnomalyComparisonModal';

const TIER_COLORS = {
  CRITICAL_OUTLIER: '#FF1744',
  ELEVATED_OUTLIER: '#FF9100',
  SEMANTIC_ANOMALY: '#D500F9',
  METRIC_ANOMALY: '#FFD600',
  NOMINAL_COMPLIANT: '#00E676',
};

export default function ReportAnomalyDetectionModule() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Configuration options & active run
  const [configOptions, setConfigOptions] = useState(null);
  const [currentRunData, setCurrentRunData] = useState(null);
  const [runsHistory, setRunsHistory] = useState([]);

  // Active Execution state
  const [isExecuting, setIsExecuting] = useState(false);
  const [executingRunId, setExecutingRunId] = useState(null);
  const [currentStage, setCurrentStage] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);

  // Filters & Table state
  const [tierFilter, setTierFilter] = useState('ALL');
  const [empanelledFilter, setEmpanelledFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(15);

  // Inspection Drawer & Comparison Modal
  const [inspectRecord, setInspectRecord] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [compareModalOpen, setCompareModalOpen] = useState(false);

  const pollIntervalRef = useRef(null);

  // Load config options, latest run, and history on mount
  const loadInitialData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [configRes, latestRes, historyRes] = await Promise.allSettled([
        api.get('/api/anomaly/config-options'),
        api.get('/api/anomaly/latest'),
        api.get('/api/anomaly/runs?limit=20')
      ]);

      if (configRes.status === 'fulfilled' && configRes.value.data?.status === 'success') {
        setConfigOptions(configRes.value.data.data);
      }

      if (historyRes.status === 'fulfilled' && historyRes.value.data?.status === 'success') {
        setRunsHistory(historyRes.value.data.data.runs || []);
      }

      if (latestRes.status === 'fulfilled' && latestRes.value.data?.status === 'success') {
        const latestData = latestRes.value.data.data;
        if (latestData && latestData.run) {
          setCurrentRunData(latestData);
          if (latestData.run.status === 'RUNNING' || latestData.run.status === 'QUEUED') {
            startPolling(latestData.run.run_id);
          }
        } else {
          // If no run has ever been executed, automatically trigger a default balanced ensemble run
          handleTriggerDetection();
        }
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to initialize Anomaly Detection module.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const startPolling = (runId) => {
    setIsExecuting(true);
    setExecutingRunId(runId);

    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await api.get(`/api/anomaly/status/${runId}`);
        if (res.data?.status === 'success') {
          const st = res.data.data;
          setCurrentStage(st.current_stage || 'Processing...');
          setProgressPercent(st.progress_percent || 0);

          if (st.status === 'COMPLETED' || st.status === 'FAILED') {
            clearInterval(pollIntervalRef.current);
            setIsExecuting(false);
            setExecutingRunId(null);
            if (st.status === 'FAILED') {
              setError(st.error_message || 'Anomaly detection run failed.');
            }

            // Fetch completed run details
            const detailRes = await api.get(`/api/anomaly/runs/${runId}`);
            if (detailRes.data?.status === 'success') {
              setCurrentRunData(detailRes.data);
            }

            // Refresh historical runs
            const histRes = await api.get('/api/anomaly/runs?limit=20');
            if (histRes.data?.status === 'success') {
              setRunsHistory(histRes.data.data.runs || []);
            }
          }
        }
      } catch (err) {
        console.error('Error polling anomaly run status:', err);
      }
    }, 1500);
  };

  const handleTriggerDetection = async (customPayload) => {
    try {
      setError(null);
      const payload = customPayload || {
        algorithm_mode: 'ENSEMBLE',
        parameters: {
          contamination: 0.10,
          n_estimators: 100,
          extended_hyperplanes: false,
          k_neighbors: 5,
          weight_iforest: 0.40,
          weight_ecod: 0.35,
          weight_embedding: 0.25
        }
      };

      const res = await api.post('/api/anomaly/run', payload);
      if (res.data?.status === 'success') {
        const runId = res.data.run_id;
        startPolling(runId);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to trigger anomaly detection.');
      setIsExecuting(false);
    }
  };

  const handleSelectRun = async (runId) => {
    if (currentRunData?.run?.run_id === runId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await api.get(`/api/anomaly/runs/${runId}`);
      const payload = res.data?.data || res.data;
      if (payload && payload.run) {
        setCurrentRunData(payload);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load selected anomaly run.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenInspect = (reportId) => {
    const record = currentRunData?.records?.find(r => r.report_id === reportId);
    if (record) {
      setInspectRecord(record);
      setDrawerOpen(true);
    }
  };

  // Filter table data
  const filteredRecords = useMemo(() => {
    if (!currentRunData?.records) return [];

    return currentRunData.records.filter((rec) => {
      const meta = rec.metadata || {};

      // Tier filter
      if (tierFilter !== 'ALL' && rec.anomaly_tier !== tierFilter) {
        return false;
      }

      // Empanelled filter
      if (empanelledFilter === 'EMPANELLED' && !meta.cert_in_empanelled) return false;
      if (empanelledFilter === 'NON_EMPANELLED' && meta.cert_in_empanelled) return false;

      // Text search
      if (search) {
        const s = search.toLowerCase();
        const matchTitle = (meta.report_title || '').toLowerCase().includes(s);
        const matchAgency = (meta.agency_name || '').toLowerCase().includes(s);
        const matchCode = (meta.agency_code || '').toLowerCase().includes(s);
        if (!matchTitle && !matchAgency && !matchCode) return false;
      }

      return true;
    });
  }, [currentRunData, tierFilter, empanelledFilter, search]);

  if (loading && !currentRunData) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <CircularProgress size={48} sx={{ color: '#00D4FF', mb: 2 }} />
        <Typography variant="body1" color="text.secondary">
          Initializing Multi-Detector Anomaly Engine & Audit Telemetry...
        </Typography>
      </Box>
    );
  }

  const runInfo = currentRunData?.run || {};
  const runSummary = runInfo.summary || {};
  const fleetBenchmarks = runInfo.fleet_benchmarks || {};
  const scatterPoints = currentRunData?.scatter_points || [];

  return (
    <Box>
      {/* Page Title & Actions */}
      <Box sx={{ mb: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ p: 1.2, borderRadius: 2, bgcolor: 'rgba(0, 212, 255, 0.1)', display: 'flex' }}>
            <AutoAwesome sx={{ color: '#00D4FF', fontSize: 28 }} />
          </Box>
          <Box>
            <Typography variant="h5" fontWeight={800} color="#F1F5F9">
              Report Anomaly Detection Suite
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Tri-Model Consensus: Isolation Forest, ECOD (Empirical Cumulative Tail), and Local Sentence-BERT Vectors
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Button
            variant="outlined"
            onClick={() => setCompareModalOpen(true)}
            startIcon={<CompareArrows />}
            sx={{
              borderColor: 'rgba(255,255,255,0.15)',
              color: '#F1F5F9',
              fontWeight: 700,
              borderRadius: 2,
              '&:hover': { borderColor: '#00D4FF', color: '#00D4FF' }
            }}
          >
            Compare Runs
          </Button>
          <Button
            variant="outlined"
            onClick={loadInitialData}
            startIcon={<Refresh />}
            sx={{
              borderColor: 'rgba(255,255,255,0.15)',
              color: '#F1F5F9',
              fontWeight: 700,
              borderRadius: 2,
              '&:hover': { borderColor: '#00D4FF', color: '#00D4FF' }
            }}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* Algorithm Run Selector & Retention Notice */}
      {runsHistory.length > 0 && (
        <Box
          sx={{
            mb: 2.5,
            p: 1.5,
            borderRadius: 2,
            bgcolor: '#0B1120',
            border: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 2,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, flexWrap: 'wrap' }}>
            <Typography
              variant="caption"
              sx={{
                color: '#94A3B8',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                fontSize: '0.72rem',
                mr: 0.5,
              }}
            >
              Stored Algorithm Runs ({runsHistory.length}/4):
            </Typography>
            {runsHistory.map((r) => {
              const mode = r.algorithm_mode || r.parameters?.algorithm_mode || 'ENSEMBLE';
              const isSelected = currentRunData?.run?.run_id === r.run_id;
              return (
                <Chip
                  key={r.run_id}
                  label={`${mode} (Latest)`}
                  size="small"
                  onClick={() => handleSelectRun(r.run_id)}
                  sx={{
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    border: '1px solid',
                    borderColor: isSelected ? '#00D4FF' : 'rgba(255,255,255,0.12)',
                    bgcolor: isSelected ? 'rgba(0, 212, 255, 0.15)' : 'rgba(255,255,255,0.02)',
                    color: isSelected ? '#00D4FF' : '#94A3B8',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': {
                      borderColor: '#00D4FF',
                      color: '#00D4FF',
                      bgcolor: 'rgba(0, 212, 255, 0.08)',
                    },
                  }}
                />
              );
            })}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <InfoOutlined sx={{ fontSize: 16, color: '#64748B' }} />
            <Typography variant="caption" sx={{ color: '#64748B', fontSize: '0.73rem' }}>
              Database retains strictly 1 run per algorithm (latest). New runs replace previous runs.
            </Typography>
          </Box>
        </Box>
      )}

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {/* 1. Interactive Anomaly Configuration Console */}
      <AnomalyConfigConsole
        configOptions={configOptions}
        currentParams={runInfo}
        onRunDetection={handleTriggerDetection}
        isExecuting={isExecuting}
        currentStage={currentStage}
        progressPercent={progressPercent}
      />

      {/* 2. Surface KPI Strip */}
      <AnomalyKpiStrip
        runSummary={runSummary}
        fleetBenchmarks={fleetBenchmarks}
        totalEvaluated={runInfo.total_reports_evaluated}
        anomaliesDetected={runInfo.anomalies_detected}
      />

      {/* 3. Visual Analytics: Scatter Projection & ECOD Attribution Bar */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} lg={7}>
          <AnomalyScatterPlot
            scatterPoints={scatterPoints}
            onSelectPoint={handleOpenInspect}
            pcaVariance={runSummary.pca_explained_variance_ratio}
          />
        </Grid>
        <Grid item xs={12} lg={5}>
          <AnomalyAttributionChart
            records={currentRunData?.records || []}
            summary={runSummary}
          />
        </Grid>
      </Grid>

      {/* 4. Filterable Anomaly Reports Table */}
      <Card sx={{ bgcolor: '#0B1120', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 2 }}>
        <CardContent sx={{ p: 2.5, pb: 1.5 }}>
          {/* Table Toolbar */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Typography variant="h6" fontWeight={800} color="#F1F5F9" sx={{ fontSize: '1rem' }}>
                Monitored Audit Reports ({filteredRecords.length})
              </Typography>
              <Chip
                size="small"
                label={`Algorithm: ${runSummary.algorithm_mode || 'ENSEMBLE'}`}
                sx={{ bgcolor: 'rgba(0, 212, 255, 0.1)', color: '#00D4FF', fontWeight: 700, fontSize: '0.72rem' }}
              />
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              <TextField
                size="small"
                placeholder="Search report, agency, code..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search sx={{ color: 'text.secondary', fontSize: 18 }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  width: { xs: 180, sm: 240 },
                  '& .MuiOutlinedInput-root': {
                    bgcolor: '#0F172A',
                    color: '#F1F5F9',
                    fontSize: '0.85rem',
                    borderRadius: 1.5
                  }
                }}
              />

              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel sx={{ color: 'text.secondary' }}>Tier Filter</InputLabel>
                <Select
                  value={tierFilter}
                  label="Tier Filter"
                  onChange={(e) => { setTierFilter(e.target.value); setPage(0); }}
                  sx={{ bgcolor: '#0F172A', color: '#F1F5F9', fontSize: '0.85rem' }}
                >
                  <MenuItem value="ALL">All Tiers</MenuItem>
                  <MenuItem value="CRITICAL_OUTLIER">Critical Outliers</MenuItem>
                  <MenuItem value="ELEVATED_OUTLIER">Elevated Outliers</MenuItem>
                  <MenuItem value="SEMANTIC_ANOMALY">Semantic Anomalies</MenuItem>
                  <MenuItem value="METRIC_ANOMALY">Metric Anomalies</MenuItem>
                  <MenuItem value="NOMINAL_COMPLIANT">Nominal Compliant</MenuItem>
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel sx={{ color: 'text.secondary' }}>Agency Status</InputLabel>
                <Select
                  value={empanelledFilter}
                  label="Agency Status"
                  onChange={(e) => { setEmpanelledFilter(e.target.value); setPage(0); }}
                  sx={{ bgcolor: '#0F172A', color: '#F1F5F9', fontSize: '0.85rem' }}
                >
                  <MenuItem value="ALL">All Agencies</MenuItem>
                  <MenuItem value="EMPANELLED">CERT-In Empanelled</MenuItem>
                  <MenuItem value="NON_EMPANELLED">Standard Agencies</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </Box>

          {/* Table */}
          <TableContainer component={Paper} sx={{ bgcolor: 'transparent', boxShadow: 'none' }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <TableCell sx={{ color: 'text.secondary', fontWeight: 800 }}>Audit Report Document</TableCell>
                  <TableCell sx={{ color: 'text.secondary', fontWeight: 800 }}>Auditing Agency</TableCell>
                  <TableCell sx={{ color: 'text.secondary', fontWeight: 800 }}>Anomaly Tier</TableCell>
                  <TableCell sx={{ color: 'text.secondary', fontWeight: 800 }}>Consensus Score</TableCell>
                  <TableCell sx={{ color: 'text.secondary', fontWeight: 800 }}>Detector Breakdown</TableCell>
                  <TableCell sx={{ color: 'text.secondary', fontWeight: 800 }}>Primary Root Cause</TableCell>
                  <TableCell align="right" sx={{ color: 'text.secondary', fontWeight: 800 }}>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      No audit reports match the active filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRecords
                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                    .map((rec) => {
                      const meta = rec.metadata || {};
                      const color = TIER_COLORS[rec.anomaly_tier] || '#00D4FF';

                      return (
                        <TableRow
                          key={rec.record_id}
                          hover
                          sx={{
                            '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
                            borderBottom: '1px solid rgba(255,255,255,0.04)'
                          }}
                        >
                          {/* Report title */}
                          <TableCell sx={{ maxWidth: 220 }}>
                            <Typography noWrap variant="body2" fontWeight={700} color="#F1F5F9" title={meta.report_title}>
                              {meta.report_title}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {meta.total_findings} findings &bull; Mean {meta.avg_cvss?.toFixed(1)} &bull; {meta.page_count} pages
                            </Typography>
                          </TableCell>

                          {/* Agency */}
                          <TableCell sx={{ maxWidth: 160 }}>
                            <Typography noWrap variant="body2" color="#E2E8F0" title={meta.agency_name}>
                              {meta.agency_name}
                            </Typography>
                            <Typography variant="caption" color={meta.cert_in_empanelled ? '#00D4FF' : 'text.secondary'}>
                              {meta.agency_code} {meta.cert_in_empanelled ? '(CERT-In)' : ''}
                            </Typography>
                          </TableCell>

                          {/* Tier Chip */}
                          <TableCell>
                            <Chip
                              size="small"
                              label={rec.anomaly_tier.replace('_', ' ')}
                              sx={{
                                bgcolor: `${color}18`,
                                color,
                                fontWeight: 800,
                                fontSize: '0.68rem',
                                height: 22,
                                border: `1px solid ${color}40`
                              }}
                            />
                          </TableCell>

                          {/* Consensus Score with mini-bar */}
                          <TableCell sx={{ minWidth: 120 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Box sx={{ width: 60, height: 6, bgcolor: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                                <Box
                                  sx={{
                                    width: `${Math.min(rec.ensemble_score * 100, 100)}%`,
                                    height: '100%',
                                    bgcolor: color,
                                    borderRadius: 3
                                  }}
                                />
                              </Box>
                              <Typography variant="caption" fontWeight={800} sx={{ color }}>
                                {(rec.ensemble_score * 100).toFixed(0)}%
                              </Typography>
                            </Box>
                          </TableCell>

                          {/* Detector Badges */}
                          <TableCell sx={{ minWidth: 140 }}>
                            <Box sx={{ display: 'flex', gap: 0.6 }}>
                              <Tooltip title={`Isolation Forest Rank: ${Math.round((rec.iforest_score || 0)*100)}%`}>
                                <Chip
                                  size="small"
                                  label={`IF: ${Math.round((rec.iforest_score || 0)*100)}%`}
                                  sx={{ bgcolor: 'rgba(0, 230, 118, 0.1)', color: '#00E676', fontSize: '0.65rem', height: 18 }}
                                />
                              </Tooltip>
                              <Tooltip title={`ECOD Tail Rank: ${Math.round((rec.ecod_score || 0)*100)}%`}>
                                <Chip
                                  size="small"
                                  label={`EC: ${Math.round((rec.ecod_score || 0)*100)}%`}
                                  sx={{ bgcolor: 'rgba(255, 214, 0, 0.1)', color: '#FFD600', fontSize: '0.65rem', height: 18 }}
                                />
                              </Tooltip>
                              <Tooltip title={`SBERT Vector Rank: ${Math.round((rec.embedding_score || 0)*100)}%`}>
                                <Chip
                                  size="small"
                                  label={`EM: ${Math.round((rec.embedding_score || 0)*100)}%`}
                                  sx={{ bgcolor: 'rgba(213, 0, 249, 0.1)', color: '#D500F9', fontSize: '0.65rem', height: 18 }}
                                />
                              </Tooltip>
                            </Box>
                          </TableCell>

                          {/* Primary Driver */}
                          <TableCell sx={{ maxWidth: 220 }}>
                            <Typography noWrap variant="caption" color="#CBD5E1" title={rec.primary_drivers?.[0] || 'Conforms to fleet baseline'}>
                              {rec.primary_drivers?.[0] || 'Conforms to fleet baseline'}
                            </Typography>
                          </TableCell>

                          {/* Action Button */}
                          <TableCell align="right">
                            <Button
                              size="small"
                              onClick={() => {
                                setInspectRecord(rec);
                                setDrawerOpen(true);
                              }}
                              startIcon={<Visibility sx={{ fontSize: 14 }} />}
                              sx={{
                                color: '#00D4FF',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                textTransform: 'none',
                                bgcolor: 'rgba(0, 212, 255, 0.08)',
                                px: 1.2,
                                py: 0.3,
                                borderRadius: 1.5,
                                '&:hover': { bgcolor: '#00D4FF', color: '#0B1120' }
                              }}
                            >
                              Inspect
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
            count={filteredRecords.length}
            page={page}
            onPageChange={(e, p) => setPage(p)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[10, 15, 25, 50]}
            sx={{
              color: 'text.secondary',
              borderTop: '1px solid rgba(255,255,255,0.06)'
            }}
          />
        </CardContent>
      </Card>

      {/* 5. Deep Inspection Drawer */}
      <AnomalyInspectionDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        record={inspectRecord}
      />

      {/* 6. Comparison Modal */}
      <AnomalyComparisonModal
        open={compareModalOpen}
        onClose={() => setCompareModalOpen(false)}
        runsHistory={runsHistory}
      />
    </Box>
  );
}
