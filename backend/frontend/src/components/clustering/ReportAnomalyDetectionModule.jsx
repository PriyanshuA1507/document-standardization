import React, { useState, useEffect, useMemo } from 'react';
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
  Slider,
  Tooltip,
  Paper,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Collapse
} from '@mui/material';
import {
  ErrorOutline,
  Tune,
  Refresh,
  Search,
  CheckCircle,
  Warning,
  Security,
  Business,
  Speed,
  Functions,
  ExpandMore,
  ExpandLess,
  Shield,
  Close,
  BubbleChart,
  Assessment,
  OpenInNew,
  Description,
  InsertDriveFile
} from '@mui/icons-material';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
  BarChart,
  Bar,
  Legend
} from 'recharts';
import api from '../../api/axios';

const ANOMALY_TIER_COLORS = {
  CRITICAL_OUTLIER: '#FF1744',
  ELEVATED_OUTLIER: '#FF9100',
  TYPICAL_NORMAL: '#00E676',
  EXEMPLARY_COMPLIANT: '#00D4FF',
};

function StatCard({ title, value, subtitle, icon, color = '#00D4FF' }) {
  return (
    <Card sx={{ bgcolor: '#0B1120', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 2 }}>
      <CardContent sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {title}
            </Typography>
            <Typography variant="h4" fontWeight={800} sx={{ color, my: 0.5 }}>
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
          <Box sx={{ p: 1.2, borderRadius: 2, bgcolor: `${color}15`, display: 'flex' }}>
            {React.cloneElement(icon, { sx: { fontSize: 26, color } })}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

export default function ReportAnomalyDetectionModule() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [fleetBenchmarks, setFleetBenchmarks] = useState(null);
  const [error, setError] = useState(null);

  // Parameter Tuning
  const [contamination, setContamination] = useState(0.10);
  const [nEstimators, setNEstimators] = useState(100);
  const [showConfig, setShowConfig] = useState(false);

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [empanelledFilter, setEmpanelledFilter] = useState('ALL');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(15);

  // Inspection Modal
  const [inspectReport, setInspectReport] = useState(null);
  const [inspectLoading, setInspectLoading] = useState(false);

  const fetchAnomalies = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/api/ml/anomalies', {
        params: {
          contamination,
          n_estimators: nEstimators,
          filter_status: 'ALL'
        }
      });
      if (res.data?.status === 'success') {
        setData(res.data.data || []);
        setFleetBenchmarks(res.data.fleet_benchmarks || null);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to execute Isolation Forest anomaly detection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnomalies();
  }, []);

  const filteredData = useMemo(() => {
    return data.filter(report => {
      if (statusFilter === 'OUTLIER' && !report.is_anomaly) return false;
      if (statusFilter === 'NORMAL' && report.is_anomaly) return false;
      if (empanelledFilter === 'EMPANELLED' && !report.cert_in_empanelled) return false;
      if (empanelledFilter === 'NON_EMPANELLED' && report.cert_in_empanelled) return false;
      if (search) {
        const s = search.toLowerCase();
        const matchTitle = (report.report_title || '').toLowerCase().includes(s);
        const matchAgency = (report.agency_name || '').toLowerCase().includes(s);
        const matchCode = (report.agency_code || '').toLowerCase().includes(s);
        if (!matchTitle && !matchAgency && !matchCode) return false;
      }
      return true;
    });
  }, [data, statusFilter, empanelledFilter, search]);

  const handleOpenInspect = async (reportId) => {
    try {
      setInspectLoading(true);
      const res = await api.get(`/api/ml/anomalies/report/${reportId}`);
      if (res.data?.status === 'success') {
        const parentMeta = data.find(d => d.report_id === reportId) || {};
        setInspectReport({ ...res.data, parentMeta });
      }
    } catch (err) {
      console.error('Failed to load report audit telemetry', err);
    } finally {
      setInspectLoading(false);
    }
  };


  // Scatter plot data (Findings Density vs Avg CVSS)
  const scatterData = useMemo(() => {
    return data.map(item => ({
      x: item.total_findings,
      y: item.avg_cvss,
      z: Math.max(item.critical_count || 1, 1),
      name: item.report_title,
      agency: item.agency_name,
      is_anomaly: item.is_anomaly,
      score: item.anomaly_score,
      sla_breaches: item.sla_breach_count,
      color: item.is_anomaly ? '#FF1744' : '#00E676'
    }));
  }, [data]);

  // Outlier comparison bar chart data
  const outlierComparisonData = useMemo(() => {
    const outliers = data.filter(d => d.is_anomaly).slice(0, 6);
    if (!outliers.length) return [];
    return outliers.map(o => ({
      name: (o.report_title || 'Report').length > 20 ? (o.report_title || '').slice(0, 20) + '...' : o.report_title,
      avg_cvss: o.avg_cvss,
      fleet_median: fleetBenchmarks?.median_cvss || 7.0,
      p90_cvss: o.p90_cvss
    }));
  }, [data, fleetBenchmarks]);

  const outlierCount = data.filter(d => d.is_anomaly).length;

  return (
    <Box>
      {/* ════════════ HEADER ACTION CARD ════════════ */}
      <Card sx={{ bgcolor: '#0D1527', border: '1px solid rgba(0,212,255,0.2)', borderRadius: 3, mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <Box>
              <Typography variant="h5" fontWeight={800} sx={{ color: '#E2E8F0', display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <ErrorOutline sx={{ color: '#00D4FF' }} />
                Report Audit Anomaly Detection (Isolation Forest)
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Unsupervised ensemble anomaly detector isolating anomalous audit/VAPT reports across finding volume, severity distributions, and SLA backlog metrics.
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
                <Chip size="small" label="Model: Isolation Forest (iForest)" sx={{ bgcolor: 'rgba(0, 212, 255, 0.1)', color: '#00D4FF', fontWeight: 700 }} />
                <Chip size="small" label="Scope: Report-Level Telemetry" sx={{ bgcolor: 'rgba(0, 230, 118, 0.1)', color: '#00E676', fontWeight: 700 }} />
                <Chip size="small" label="Space: 8 Telemetry Dimensions" sx={{ bgcolor: 'rgba(255, 255, 255, 0.05)', color: '#94A3B8' }} />
                <Chip size="small" label={`Sensitivity: ${Math.round(contamination * 100)}% Contamination`} sx={{ bgcolor: 'rgba(255, 255, 255, 0.05)', color: '#94A3B8' }} />
                <Chip size="small" label={`Trees: ${nEstimators}`} sx={{ bgcolor: 'rgba(255, 255, 255, 0.05)', color: '#94A3B8' }} />
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              <Button
                variant="outlined"
                startIcon={<Tune />}
                onClick={() => setShowConfig(!showConfig)}
                endIcon={showConfig ? <ExpandLess /> : <ExpandMore />}
                sx={{
                  borderColor: showConfig ? '#00D4FF' : 'rgba(255,255,255,0.2)',
                  color: showConfig ? '#00D4FF' : '#E2E8F0',
                  fontWeight: 700,
                  bgcolor: showConfig ? 'rgba(0,212,255,0.1)' : 'transparent',
                  '&:hover': { borderColor: '#00D4FF', bgcolor: 'rgba(0,212,255,0.15)' }
                }}
              >
                Tuning & Sensitivity
              </Button>


              <Button
                variant="contained"
                disabled={loading}
                onClick={fetchAnomalies}
                startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <Refresh />}
                sx={{
                  bgcolor: '#00D4FF',
                  color: '#0A0E17',
                  fontWeight: 800,
                  px: 2.5,
                  borderRadius: 2,
                  boxShadow: '0 0 20px rgba(0,212,255,0.3)',
                  '&:hover': { bgcolor: '#00B8E6', boxShadow: '0 0 25px rgba(0,212,255,0.5)' },
                  '&:disabled': { bgcolor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)' }
                }}
              >
                {loading ? 'Evaluating...' : 'Re-run Anomaly Detector'}
              </Button>
            </Box>
          </Box>

          {/* ════════════ TUNING CONTROLS PANEL ════════════ */}
          <Collapse in={showConfig}>
            <Box sx={{ mt: 3, pt: 3, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <Grid container spacing={3} alignItems="center">
                <Grid item xs={12} sm={6}>
                  <Box sx={{ bgcolor: 'rgba(255,255,255,0.03)', p: 2, borderRadius: 2, border: '1px solid rgba(255,255,255,0.06)' }}>
                    <Typography variant="caption" color="text.secondary" fontWeight={700}>
                      Expected Outlier Contamination Rate: <strong>{Math.round(contamination * 100)}%</strong>
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, fontSize: '0.7rem' }}>
                      Lower = strict (only extreme report anomalies). Higher = permissive (flags more borderline variances).
                    </Typography>
                    <Slider
                      value={contamination}
                      min={0.02}
                      max={0.30}
                      step={0.02}
                      onChange={(e, val) => setContamination(val)}
                      sx={{ color: '#00D4FF' }}
                    />
                  </Box>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Box sx={{ bgcolor: 'rgba(255,255,255,0.03)', p: 2, borderRadius: 2, border: '1px solid rgba(255,255,255,0.06)' }}>
                    <Typography variant="caption" color="text.secondary" fontWeight={700}>
                      Ensemble Tree Estimators: <strong>{nEstimators} Trees</strong>
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, fontSize: '0.7rem' }}>
                      Controls forest depth and stability of average path length convergence.
                    </Typography>
                    <Slider
                      value={nEstimators}
                      min={50}
                      max={250}
                      step={25}
                      onChange={(e, val) => setNEstimators(val)}
                      sx={{ color: '#00E676' }}
                    />
                  </Box>
                </Grid>
              </Grid>
            </Box>
          </Collapse>

          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </CardContent>
      </Card>

      {/* ════════════ STAT KPI CARDS ════════════ */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Evaluated Audit Reports"
            value={data.length}
            subtitle="Full fleet coverage across all agencies"
            icon={<Description />}
            color="#00D4FF"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Detected Outliers"
            value={outlierCount}
            subtitle={`${Math.round((outlierCount / Math.max(data.length, 1)) * 100)}% anomalous report rate`}
            icon={<ErrorOutline />}
            color="#FF1744"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Fleet Median CVSS"
            value={fleetBenchmarks?.median_cvss ?? '7.1'}
            subtitle={`Median benchmark across ${data.length} reports`}
            icon={<Security />}
            color="#00E676"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Fleet Benchmark Density"
            value={`${fleetBenchmarks?.median_findings ?? 5} findings`}
            subtitle="Median findings per report"
            icon={<Speed />}
            color="#7C4DFF"
          />
        </Grid>
      </Grid>

      {/* ════════════ MULTIDIMENSIONAL ANOMALY VISUALIZATIONS ════════════ */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        {/* Scatter Plot: Total Findings vs Mean CVSS */}
        <Grid item xs={12} md={7}>
          <Card sx={{ bgcolor: '#0B1120', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 2.5, p: 2.5, height: '100%' }}>
            <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
              <BubbleChart sx={{ color: '#00D4FF', fontSize: 20 }} />
              Report Anomaly Map (Findings Density vs Mean CVSS)
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
              Red markers represent isolated anomalous audit reports separated by short path lengths in the isolation forest
            </Typography>
            <Box sx={{ height: 250 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    type="number"
                    dataKey="x"
                    name="Total Findings"
                    stroke="#64748B"
                    fontSize={12}
                    label={{ value: 'Total Report Findings', position: 'insideBottom', offset: -10, fill: '#64748B', fontSize: 11 }}
                  />
                  <YAxis
                    type="number"
                    dataKey="y"
                    name="Avg CVSS"
                    domain={[4, 10]}
                    stroke="#64748B"
                    fontSize={12}
                    label={{ value: 'Mean CVSS Severity', angle: -90, position: 'insideLeft', fill: '#64748B', fontSize: 11 }}
                  />
                  <ZAxis type="number" dataKey="z" range={[40, 250]} name="Critical Findings" />
                  <RechartsTooltip
                    cursor={{ strokeDasharray: '3 3' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <Box sx={{ bgcolor: '#0D1527', border: '1px solid rgba(255,255,255,0.1)', p: 1.5, borderRadius: 2, boxShadow: '0 4px 20px rgba(0,0,0,0.5)', maxWidth: 300 }}>
                            <Typography variant="subtitle2" fontWeight={800} sx={{ color: d.is_anomaly ? '#FF1744' : '#00E676' }} noWrap>
                              {d.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                              Agency: {d.agency || 'Unassigned'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                              Status: <strong>{d.is_anomaly ? 'Outlier Anomaly' : 'Conforming'}</strong> (Score: {d.score.toFixed(3)})
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                              Findings: {d.x} &bull; Mean CVSS: {d.y.toFixed(2)} &bull; SLA Breaches: {d.sla_breaches}
                            </Typography>
                          </Box>
                        );
                      }
                      return null;
                    }}
                  />
                  <Scatter data={scatterData}>
                    {scatterData.map((entry, index) => (
                      <Cell
                        key={`scatter-cell-${index}`}
                        fill={entry.color}
                        stroke={entry.is_anomaly ? '#FF1744' : '#00E676'}
                        strokeWidth={entry.is_anomaly ? 2 : 1}
                      />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </Box>
          </Card>
        </Grid>

        {/* Outlier Benchmark Deviation Comparison */}
        <Grid item xs={12} md={5}>
          <Card sx={{ bgcolor: '#0B1120', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 2.5, p: 2.5, height: '100%' }}>
            <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Assessment sx={{ color: '#FF1744', fontSize: 20 }} />
              Top Outlier Reports vs Fleet Benchmark
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
              Comparison of anomalous reports' Mean CVSS against fleet median
            </Typography>
            <Box sx={{ height: 250 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={outlierComparisonData} margin={{ top: 10, right: 10, left: -20, bottom: 35 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" stroke="#64748B" fontSize={10} angle={-25} textAnchor="end" />
                  <YAxis stroke="#64748B" fontSize={11} domain={[0, 10]} />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: '#0D1527', borderColor: 'rgba(255,255,255,0.1)', borderRadius: 8, color: '#FFF' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '0.75rem', paddingTop: '4px' }} />
                  <Bar dataKey="avg_cvss" name="Report Mean CVSS" fill="#FF1744" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="fleet_median" name="Fleet Benchmark (7.1)" fill="#00E676" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Card>
        </Grid>
      </Grid>

      {/* ════════════ SEARCH & FILTER TOOLBAR ════════════ */}
      <Card sx={{ bgcolor: '#0B1120', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 2.5, p: 2.5, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={5}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search report filename, agency name, organization code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search sx={{ color: 'text.secondary', fontSize: 20 }} />
                  </InputAdornment>
                ),
                sx: { bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 2 }
              }}
            />
          </Grid>

          <Grid item xs={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel sx={{ color: 'text.secondary' }}>Anomaly Status</InputLabel>
              <Select
                value={statusFilter}
                label="Anomaly Status"
                onChange={(e) => setStatusFilter(e.target.value)}
                sx={{ bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 2 }}
              >
                <MenuItem value="ALL">All Reports ({data.length})</MenuItem>
                <MenuItem value="OUTLIER">Outliers Only ({outlierCount})</MenuItem>
                <MenuItem value="NORMAL">Normal Reports ({data.length - outlierCount})</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={6} md={4}>
            <FormControl fullWidth size="small">
              <InputLabel sx={{ color: 'text.secondary' }}>Auditing Agency Certification</InputLabel>
              <Select
                value={empanelledFilter}
                label="Auditing Agency Certification"
                onChange={(e) => setEmpanelledFilter(e.target.value)}
                sx={{ bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 2 }}
              >
                <MenuItem value="ALL">All Auditing Agencies</MenuItem>
                <MenuItem value="EMPANELLED">CERT-In Empanelled Only</MenuItem>
                <MenuItem value="NON_EMPANELLED">Non-Empanelled / Private Assessors</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Card>

      {/* ════════════ MAIN DATA TABLE ════════════ */}
      <Card sx={{ bgcolor: '#0B1120', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 2.5, overflow: 'hidden' }}>
        <TableContainer>
          <Table size="small">
            <TableHead sx={{ bgcolor: 'rgba(255,255,255,0.02)' }}>
              <TableRow>
                <TableCell sx={{ color: 'text.secondary', fontWeight: 800 }}>Audit Report Document</TableCell>
                <TableCell sx={{ color: 'text.secondary', fontWeight: 800 }}>Assigned Agency</TableCell>
                <TableCell sx={{ color: 'text.secondary', fontWeight: 800 }}>Status</TableCell>
                <TableCell sx={{ color: 'text.secondary', fontWeight: 800, width: 140 }}>iForest Score</TableCell>
                <TableCell sx={{ color: 'text.secondary', fontWeight: 800 }}>Findings Density</TableCell>
                <TableCell sx={{ color: 'text.secondary', fontWeight: 800 }}>Severity Profile</TableCell>
                <TableCell sx={{ color: 'text.secondary', fontWeight: 800 }}>Primary Drivers</TableCell>
                <TableCell sx={{ color: 'text.secondary', fontWeight: 800, textAlign: 'right' }}>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                    <CircularProgress sx={{ color: '#00D4FF' }} />
                  </TableCell>
                </TableRow>
              ) : filteredData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                    <Typography variant="body2" color="text.secondary">
                      No reports match the selected filters.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((report) => {
                  const isOutlier = report.is_anomaly;
                  const tierColor = ANOMALY_TIER_COLORS[report.anomaly_tier] || '#00D4FF';
                  return (
                    <TableRow
                      key={report.report_id}
                      hover
                      sx={{
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
                        borderBottom: '1px solid rgba(255,255,255,0.04)'
                      }}
                    >
                      {/* Report Document */}
                      <TableCell sx={{ maxWidth: 240 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <InsertDriveFile sx={{ color: isOutlier ? '#FF1744' : '#00D4FF', fontSize: 20 }} />
                          <Box sx={{ overflow: 'hidden' }}>
                            <Typography variant="body2" fontWeight={700} sx={{ color: '#F1F5F9' }} noWrap title={report.report_title}>
                              {report.report_title}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              ID: {report.report_id.slice(0, 8)}... &bull; {report.created_at ? new Date(report.created_at).toLocaleDateString() : 'Audited'}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>

                      {/* Agency */}
                      <TableCell sx={{ maxWidth: 190 }}>
                        <Typography variant="body2" fontWeight={600} sx={{ color: '#E2E8F0' }} noWrap>
                          {report.agency_name}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 0.5, mt: 0.2 }}>
                          {report.cert_in_empanelled ? (
                            <Chip
                              size="small"
                              icon={<Shield sx={{ fontSize: '13px !important' }} />}
                              label="CERT-In"
                              sx={{ height: 18, bgcolor: 'rgba(0, 212, 255, 0.15)', color: '#00D4FF', fontWeight: 700, fontSize: '0.62rem' }}
                            />
                          ) : (
                            <Typography variant="caption" color="text.secondary">
                              {report.agency_code || 'Standard'}
                            </Typography>
                          )}
                        </Box>
                      </TableCell>

                      {/* Status */}
                      <TableCell>
                        <Chip
                          size="small"
                          label={report.is_anomaly ? 'Outlier' : 'Normal'}
                          sx={{
                            bgcolor: isOutlier ? 'rgba(255, 23, 68, 0.15)' : 'rgba(0, 230, 118, 0.15)',
                            color: isOutlier ? '#FF1744' : '#00E676',
                            fontWeight: 800,
                            fontSize: '0.75rem'
                          }}
                        />
                      </TableCell>

                      {/* iForest Score */}
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" fontWeight={800} sx={{ color: isOutlier ? '#FF1744' : '#00E676', minWidth: 42 }}>
                            {report.anomaly_score.toFixed(2)}
                          </Typography>
                          <Box sx={{ flex: 1, height: 6, bgcolor: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                            <Box
                              sx={{
                                width: `${Math.min(Math.max((report.anomaly_score + 0.3) / 0.6 * 100, 10), 100)}%`,
                                height: '100%',
                                bgcolor: tierColor,
                                borderRadius: 3
                              }}
                            />
                          </Box>
                        </Box>
                      </TableCell>

                      {/* Findings Density */}
                      <TableCell>
                        <Typography variant="body2" fontWeight={700} color="#E2E8F0">
                          {report.total_findings} findings
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {report.critical_count} Crit &bull; {report.high_count} High
                        </Typography>
                      </TableCell>

                      {/* Severity Profile */}
                      <TableCell>
                        <Typography variant="body2" fontWeight={800} sx={{ color: report.avg_cvss >= 8.0 ? '#FF1744' : report.avg_cvss >= 6.5 ? '#FF9100' : '#00E676' }}>
                          Mean {report.avg_cvss.toFixed(2)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Max: {report.max_cvss.toFixed(1)} &bull; p90: {report.p90_cvss.toFixed(1)}
                        </Typography>
                      </TableCell>

                      {/* Primary Drivers */}
                      <TableCell sx={{ maxWidth: 280 }}>
                        {report.primary_drivers && report.primary_drivers.length > 0 ? (
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                            {report.primary_drivers.slice(0, 2).map((d, i) => (
                              <Tooltip key={i} title={d}>
                                <Chip
                                  size="small"
                                  label={d}
                                  sx={{
                                    height: 18,
                                    fontSize: '0.65rem',
                                    bgcolor: isOutlier ? 'rgba(255, 23, 68, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                                    color: isOutlier ? '#FF8A80' : '#94A3B8',
                                    fontWeight: 700,
                                    maxWidth: 260,
                                    textOverflow: 'ellipsis'
                                  }}
                                />
                              </Tooltip>
                            ))}
                          </Box>
                        ) : (
                          <Typography variant="caption" color="text.secondary">
                            Conforming to fleet baseline
                          </Typography>
                        )}
                      </TableCell>

                      {/* Action */}
                      <TableCell align="right">
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => handleOpenInspect(report.report_id)}
                          sx={{
                            borderColor: 'rgba(0,212,255,0.3)',
                            color: '#00D4FF',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            py: 0.2,
                            px: 1,
                            borderRadius: 1.5,
                            '&:hover': { borderColor: '#00D4FF', bgcolor: 'rgba(0,212,255,0.1)' }
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
          rowsPerPageOptions={[10, 15, 25, 50]}
          component="div"
          count={filteredData.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(e, newP) => setPage(newP)}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          sx={{
            color: 'text.secondary',
            borderTop: '1px solid rgba(255,255,255,0.05)',
            '& .MuiTablePagination-selectIcon': { color: 'text.secondary' }
          }}
        />
      </Card>

      {/* ════════════ MATHEMATICAL METHODOLOGY CARD ════════════ */}
      <Card sx={{ bgcolor: '#0B1120', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 2.5, p: 3, mt: 3 }}>
        <Typography variant="subtitle1" fontWeight={800} sx={{ color: '#00D4FF', display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Functions sx={{ fontSize: 20 }} />
          Report-Level Isolation Forest (iForest) Mathematical Foundations & Anomaly Scoring
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Isolation Forest isolates individual report profiles across 8 multidimensional axes (CVSS distributions, critical density, SLA breaches, variance) without assuming normal distributions. Anomalies require significantly fewer partitions to isolate.
        </Typography>

        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <Box sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.02)', borderRadius: 2, border: '1px solid rgba(255,255,255,0.05)' }}>
              <Typography variant="caption" color="#00D4FF" fontWeight={800}>1. Recursive Partitioning</Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', color: '#E2E8F0', my: 0.5 }}>
                h(x) = Tree Path Depth
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Number of splittings required to isolate audit report instance x.
              </Typography>
            </Box>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Box sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.02)', borderRadius: 2, border: '1px solid rgba(255,255,255,0.05)' }}>
              <Typography variant="caption" color="#FF9100" fontWeight={800}>2. Expected Path Length</Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', color: '#E2E8F0', my: 0.5 }}>
                c(n) = 2ln(n-1) + 0.577 - 2(n-1)/n
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Average path length of unsuccessful search across n evaluated reports.
              </Typography>
            </Box>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Box sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.02)', borderRadius: 2, border: '1px solid rgba(255,255,255,0.05)' }}>
              <Typography variant="caption" color="#00E676" fontWeight={800}>3. Anomaly Score Formula</Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', color: '#E2E8F0', my: 0.5 }}>
                s(x, n) = 2^(-E(h(x)) / c(n))
              </Typography>
              <Typography variant="caption" color="text.secondary">
                When E(h(x)) &rarr; 0, score &rarr; 1 (Severe Outlier Report).
              </Typography>
            </Box>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Box sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.02)', borderRadius: 2, border: '1px solid rgba(255,255,255,0.05)' }}>
              <Typography variant="caption" color="#FF1744" fontWeight={800}>4. Decision Threshold</Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', color: '#E2E8F0', my: 0.5 }}>
                Score &lt; 0 &rArr; Anomalous Outlier
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Calculated via decision function with contamination offset.
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Card>

      {/* ════════════ INSPECTION DETAIL MODAL ════════════ */}
      <Dialog
        open={Boolean(inspectReport)}
        onClose={() => setInspectReport(null)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#0B1120',
            border: '1px solid rgba(0, 212, 255, 0.3)',
            borderRadius: 3,
            backgroundImage: 'none'
          }
        }}
      >
        <DialogTitle sx={{ p: 2.5, borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Description sx={{ color: '#00D4FF' }} />
            <Box>
              <Typography variant="h6" fontWeight={800} color="#F1F5F9">
                Report Audit Telemetry & Root Cause Analysis
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Report ID: {inspectReport?.report?.report_id}
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={() => setInspectReport(null)} sx={{ color: 'text.secondary' }}>
            <Close />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 3 }}>
          {inspectReport && (
            <Box>
              {/* Header Info */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2, mb: 3 }}>
                <Box>
                  <Typography variant="h5" fontWeight={800} color="#00D4FF">
                    {inspectReport.report?.original_filename}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, mt: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Typography variant="body2" color="text.secondary">
                      Agency: <strong>{inspectReport.report?.agency?.agency_name}</strong> ({inspectReport.report?.agency?.agency_code})
                    </Typography>
                    {inspectReport.report?.agency?.cert_in_empanelled && (
                      <Chip size="small" label="CERT-In Empanelled" sx={{ height: 20, bgcolor: 'rgba(0, 212, 255, 0.15)', color: '#00D4FF', fontWeight: 700, fontSize: '0.65rem' }} />
                    )}
                  </Box>
                </Box>

                <Box sx={{ textAlign: 'right' }}>
                  <Chip
                    label={inspectReport.parentMeta?.is_anomaly ? 'CRITICAL OUTLIER' : 'FLEET CONFORMING'}
                    sx={{
                      bgcolor: inspectReport.parentMeta?.is_anomaly ? 'rgba(255, 23, 68, 0.2)' : 'rgba(0, 230, 118, 0.2)',
                      color: inspectReport.parentMeta?.is_anomaly ? '#FF1744' : '#00E676',
                      fontWeight: 800,
                      mb: 0.5
                    }}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    iForest Score: <strong>{inspectReport.parentMeta?.anomaly_score?.toFixed(3)}</strong>
                  </Typography>
                </Box>
              </Box>

              {/* Anomaly Drivers Banner if Outlier */}
              {inspectReport.parentMeta?.is_anomaly && inspectReport.parentMeta?.primary_drivers?.length > 0 && (
                <Alert severity="warning" sx={{ mb: 3, bgcolor: 'rgba(255, 145, 0, 0.1)', color: '#FFB74D', border: '1px solid rgba(255, 145, 0, 0.3)' }}>
                  <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 0.5 }}>
                    Primary Statistical Drivers Triggering Isolation:
                  </Typography>
                  <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                    {inspectReport.parentMeta.primary_drivers.map((drv, i) => (
                      <li key={i}>
                        <Typography variant="body2">{drv}</Typography>
                      </li>
                    ))}
                  </Box>
                </Alert>
              )}

              {/* Stats Summary Strip */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={6} sm={3}>
                  <Box sx={{ bgcolor: 'rgba(255,255,255,0.03)', p: 1.5, borderRadius: 2, textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <Typography variant="caption" color="text.secondary">Total Findings</Typography>
                    <Typography variant="h6" fontWeight={800} color="#00D4FF">{inspectReport.stats?.total_findings}</Typography>
                  </Box>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Box sx={{ bgcolor: 'rgba(255,255,255,0.03)', p: 1.5, borderRadius: 2, textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <Typography variant="caption" color="text.secondary">Critical Findings</Typography>
                    <Typography variant="h6" fontWeight={800} color="#FF1744">{inspectReport.stats?.critical_count}</Typography>
                  </Box>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Box sx={{ bgcolor: 'rgba(255,255,255,0.03)', p: 1.5, borderRadius: 2, textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <Typography variant="caption" color="text.secondary">Mean CVSS</Typography>
                    <Typography variant="h6" fontWeight={800} color="#FF9100">{inspectReport.stats?.avg_cvss}</Typography>
                  </Box>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Box sx={{ bgcolor: 'rgba(255,255,255,0.03)', p: 1.5, borderRadius: 2, textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <Typography variant="caption" color="text.secondary">Open Backlog</Typography>
                    <Typography variant="h6" fontWeight={800} color="#00E676">{inspectReport.stats?.open_findings}</Typography>
                  </Box>
                </Grid>
              </Grid>

              {/* Findings Breakdown Table */}
              <Typography variant="subtitle2" fontWeight={800} color="#F1F5F9" sx={{ mb: 1 }}>
                Report Observations & Findings ({inspectReport.findings?.length || 0})
              </Typography>
              <TableContainer sx={{ maxHeight: 280, bgcolor: 'rgba(255,255,255,0.02)', borderRadius: 2, border: '1px solid rgba(255,255,255,0.05)' }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ bgcolor: '#0D1527', color: 'text.secondary', fontWeight: 800 }}>Vulnerability</TableCell>
                      <TableCell sx={{ bgcolor: '#0D1527', color: 'text.secondary', fontWeight: 800 }}>Severity</TableCell>
                      <TableCell sx={{ bgcolor: '#0D1527', color: 'text.secondary', fontWeight: 800 }}>CVSS</TableCell>
                      <TableCell sx={{ bgcolor: '#0D1527', color: 'text.secondary', fontWeight: 800 }}>Status</TableCell>
                      <TableCell sx={{ bgcolor: '#0D1527', color: 'text.secondary', fontWeight: 800 }}>Days Open</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(!inspectReport.findings || inspectReport.findings.length === 0) ? (
                      <TableRow><TableCell colSpan={5} align="center">No detailed observations recorded.</TableCell></TableRow>
                    ) : (
                      inspectReport.findings.map((f) => (
                        <TableRow key={f.finding_id}>
                          <TableCell sx={{ maxWidth: 260 }}>
                            <Typography variant="body2" fontWeight={600} color="#F1F5F9" noWrap title={f.title}>
                              {f.title}
                            </Typography>
                            {f.cve_id && f.cve_id.length > 0 && (
                              <Typography variant="caption" color="text.secondary">
                                {f.cve_id.slice(0, 2).join(', ')}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={f.severity}
                              sx={{
                                height: 18,
                                fontSize: '0.65rem',
                                fontWeight: 800,
                                bgcolor: f.severity === 'Critical' ? 'rgba(255,23,68,0.2)' : f.severity === 'High' ? 'rgba(255,145,0,0.2)' : 'rgba(0,212,255,0.2)',
                                color: f.severity === 'Critical' ? '#FF1744' : f.severity === 'High' ? '#FF9100' : '#00D4FF'
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight={800}>{f.cvss_score}</Typography>
                          </TableCell>
                          <TableCell>
                            <Chip size="small" label={f.status} sx={{ height: 18, fontSize: '0.65rem' }} />
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" color="text.secondary">{f.days_open}d</Typography>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <Button onClick={() => setInspectReport(null)} sx={{ color: 'text.secondary', fontWeight: 700 }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
