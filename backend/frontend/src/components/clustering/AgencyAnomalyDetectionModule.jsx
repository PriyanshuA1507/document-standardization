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
  OpenInNew
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

export default function AgencyAnomalyDetectionModule() {
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
  const [inspectAgency, setInspectAgency] = useState(null);
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
    return data.filter(agency => {
      if (statusFilter === 'OUTLIER' && !agency.is_anomaly) return false;
      if (statusFilter === 'NORMAL' && agency.is_anomaly) return false;
      if (empanelledFilter === 'EMPANELLED' && !agency.cert_in_empanelled) return false;
      if (empanelledFilter === 'NON_EMPANELLED' && agency.cert_in_empanelled) return false;
      if (search) {
        const s = search.toLowerCase();
        const matchName = agency.agency_name?.toLowerCase().includes(s);
        const matchCode = agency.agency_code?.toLowerCase().includes(s);
        if (!matchName && !matchCode) return false;
      }
      return true;
    });
  }, [data, statusFilter, empanelledFilter, search]);

  const handleOpenInspect = async (agencyId) => {
    try {
      setInspectLoading(true);
      const res = await api.get(`/api/ml/anomalies/agency/${agencyId}`);
      if (res.data?.status === 'success') {
        const parentMeta = data.find(d => d.agency_id === agencyId) || {};
        setInspectAgency({ ...res.data, parentMeta });
      }
    } catch (err) {
      console.error('Failed to load agency details', err);
    } finally {
      setInspectLoading(false);
    }
  };


  // Scatter plot data (Findings vs Avg CVSS)
  const scatterData = useMemo(() => {
    return data.map(item => ({
      x: item.total_findings,
      y: item.avg_cvss,
      z: item.critical_high_count || 1,
      name: item.agency_name,
      is_anomaly: item.is_anomaly,
      score: item.anomaly_score,
      reports: item.total_reports,
      sla_breaches: item.sla_breach_count,
      color: item.is_anomaly ? '#FF1744' : '#00E676'
    }));
  }, [data]);

  // Outlier comparison bar chart data
  const outlierComparisonData = useMemo(() => {
    const outliers = data.filter(d => d.is_anomaly).slice(0, 5);
    if (!outliers.length) return [];
    return outliers.map(o => ({
      name: o.agency_name.length > 18 ? o.agency_name.slice(0, 18) + '...' : o.agency_name,
      avg_cvss: o.avg_cvss,
      fleet_median: fleetBenchmarks?.fleet_median_cvss || 7.0,
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
                Agency Audit Anomaly Detection (Isolation Forest)
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Unsupervised ensemble anomaly detector isolating anomalous agency auditing behavior across report volume, severity variances, and SLA backlog metrics.
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
                <Chip size="small" label="Model: Isolation Forest (iForest)" sx={{ bgcolor: 'rgba(0, 212, 255, 0.1)', color: '#00D4FF', fontWeight: 700 }} />
                <Chip size="small" label="Space: 7 Telemetry Dimensions" sx={{ bgcolor: 'rgba(255, 255, 255, 0.05)', color: '#94A3B8' }} />
                <Chip size="small" label={`Contamination Sensitivity: ${Math.round(contamination * 100)}%`} sx={{ bgcolor: 'rgba(255, 255, 255, 0.05)', color: '#94A3B8' }} />
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
                      Lower = strict (only extreme anomalies). Higher = permissive (flags more borderline variances).
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
            title="Monitored Agencies"
            value={data.length}
            subtitle="Full fleet coverage"
            icon={<Business />}
            color="#00D4FF"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Detected Outliers"
            value={outlierCount}
            subtitle={`${Math.round((outlierCount / Math.max(data.length, 1)) * 100)}% anomalous rate`}
            icon={<ErrorOutline />}
            color="#FF1744"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Fleet Median CVSS"
            value={fleetBenchmarks?.fleet_median_cvss !== undefined ? fleetBenchmarks.fleet_median_cvss : '0.0'}
            subtitle={`Avg ${fleetBenchmarks?.fleet_avg_findings ?? 0} findings/agency`}
            icon={<Security />}
            color="#00E676"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Fleet SLA Breach Rate"
            value={`${fleetBenchmarks?.fleet_sla_breach_rate ?? 0}%`}
            subtitle="Vulnerabilities overdue fleet-wide"
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
              Multivariate Anomaly Map (Findings Density vs Mean CVSS)
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
              Red markers represent isolated anomalies positioned far from the dense fleet distribution centroid
            </Typography>
            <Box sx={{ height: 230 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    type="number"
                    dataKey="x"
                    name="Total Findings"
                    stroke="#64748B"
                    fontSize={12}
                    label={{ value: 'Total Vulnerabilities Reported', position: 'insideBottom', offset: -10, fill: '#64748B', fontSize: 11 }}
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
                  <ZAxis type="number" dataKey="z" range={[60, 400]} name="Critical Findings" />
                  <RechartsTooltip
                    cursor={{ strokeDasharray: '3 3' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <Box sx={{ bgcolor: '#0D1527', border: '1px solid rgba(255,255,255,0.1)', p: 1.5, borderRadius: 2, boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
                            <Typography variant="subtitle2" fontWeight={800} sx={{ color: d.is_anomaly ? '#FF1744' : '#00E676' }}>
                              {d.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                              Status: <strong>{d.is_anomaly ? 'Outlier Anomaly' : 'Fleet Normal'}</strong> (Score: {d.score.toFixed(3)})
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
              Top Outliers vs Fleet Median
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
              Comparison of anomalous agencies' Mean CVSS against fleet benchmark
            </Typography>
            <Box sx={{ height: 230 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={outlierComparisonData} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" stroke="#64748B" fontSize={11} angle={-20} textAnchor="end" />
                  <YAxis stroke="#64748B" fontSize={12} domain={[0, 10]} />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: '#0D1527', borderColor: 'rgba(255,255,255,0.1)', borderRadius: 8, color: '#FFF' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '0.75rem', paddingTop: '8px' }} />
                  <Bar dataKey="avg_cvss" name="Agency Mean CVSS" fill="#FF1744" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="fleet_median" name={`Fleet Benchmark (${fleetBenchmarks?.fleet_median_cvss !== undefined ? fleetBenchmarks.fleet_median_cvss : '0.0'})`} fill="#00E676" radius={[4, 4, 0, 0]} />
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
              placeholder="Search agency name, organization code..."
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
                <MenuItem value="ALL">All Statuses ({data.length})</MenuItem>
                <MenuItem value="OUTLIER">Outliers Only ({outlierCount})</MenuItem>
                <MenuItem value="NORMAL">Normal Fleet ({data.length - outlierCount})</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={6} md={4}>
            <FormControl fullWidth size="small">
              <InputLabel sx={{ color: 'text.secondary' }}>Certification / Empanelment</InputLabel>
              <Select
                value={empanelledFilter}
                label="Certification / Empanelment"
                onChange={(e) => setEmpanelledFilter(e.target.value)}
                sx={{ bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 2 }}
              >
                <MenuItem value="ALL">All Agencies</MenuItem>
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
                <TableCell sx={{ color: 'text.secondary', fontWeight: 800 }}>Agency Profile</TableCell>
                <TableCell sx={{ color: 'text.secondary', fontWeight: 800 }}>Empanelled</TableCell>
                <TableCell sx={{ color: 'text.secondary', fontWeight: 800 }}>Status</TableCell>
                <TableCell sx={{ color: 'text.secondary', fontWeight: 800, width: 140 }}>iForest Score</TableCell>
                <TableCell sx={{ color: 'text.secondary', fontWeight: 800 }}>Audits / Reports</TableCell>
                <TableCell sx={{ color: 'text.secondary', fontWeight: 800 }}>Findings Density</TableCell>
                <TableCell sx={{ color: 'text.secondary', fontWeight: 800 }}>Mean CVSS</TableCell>
                <TableCell sx={{ color: 'text.secondary', fontWeight: 800 }}>Primary Drivers</TableCell>
                <TableCell sx={{ color: 'text.secondary', fontWeight: 800, textAlign: 'right' }}>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 6 }}>
                    <CircularProgress sx={{ color: '#00D4FF' }} />
                  </TableCell>
                </TableRow>
              ) : filteredData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 6 }}>
                    <Typography variant="body2" color="text.secondary">
                      No agencies match the selected filters.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((agency) => {
                  const isOutlier = agency.is_anomaly;
                  const tierColor = ANOMALY_TIER_COLORS[agency.anomaly_tier] || '#00D4FF';
                  return (
                    <TableRow
                      key={agency.agency_id}
                      hover
                      sx={{
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
                        borderBottom: '1px solid rgba(255,255,255,0.04)'
                      }}
                    >
                      {/* Agency Name */}
                      <TableCell sx={{ maxWidth: 220 }}>
                        <Typography variant="body2" fontWeight={700} sx={{ color: '#F1F5F9' }} noWrap>
                          {agency.agency_name}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, mt: 0.3 }}>
                          <Typography variant="caption" color="text.secondary">
                            Code: {agency.agency_code}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            &bull; {agency.agency_type.replace(/_/g, ' ')}
                          </Typography>
                        </Box>
                      </TableCell>

                      {/* Empanelled */}
                      <TableCell>
                        {agency.cert_in_empanelled ? (
                          <Chip
                            size="small"
                            icon={<Shield sx={{ fontSize: '14px !important' }} />}
                            label="CERT-In"
                            sx={{ height: 20, bgcolor: 'rgba(0, 212, 255, 0.15)', color: '#00D4FF', fontWeight: 700, fontSize: '0.65rem' }}
                          />
                        ) : (
                          <Typography variant="caption" color="text.secondary">
                            Standard
                          </Typography>
                        )}
                      </TableCell>

                      {/* Outlier Status */}
                      <TableCell>
                        <Chip
                          size="small"
                          label={agency.is_anomaly ? 'Outlier' : 'Normal'}
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
                            {agency.anomaly_score.toFixed(2)}
                          </Typography>
                          <Box sx={{ flex: 1, height: 6, bgcolor: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                            <Box
                              sx={{
                                width: `${Math.min(Math.max((agency.anomaly_score + 0.3) / 0.6 * 100, 10), 100)}%`,
                                height: '100%',
                                bgcolor: tierColor,
                                borderRadius: 3
                              }}
                            />
                          </Box>
                        </Box>
                      </TableCell>

                      {/* Reports */}
                      <TableCell>
                        <Typography variant="body2" fontWeight={700}>
                          {agency.total_reports} {agency.total_reports === 1 ? 'Report' : 'Reports'}
                        </Typography>
                      </TableCell>

                      {/* Findings Density */}
                      <TableCell>
                        <Typography variant="body2" fontWeight={700} color="#E2E8F0">
                          {agency.total_findings} findings
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {agency.critical_high_count} Crit/High ({Math.round((agency.critical_ratio || 0) * 100)}%)
                        </Typography>
                      </TableCell>

                      {/* Mean CVSS */}
                      <TableCell>
                        <Typography variant="body2" fontWeight={800} sx={{ color: agency.avg_cvss >= 8.0 ? '#FF1744' : agency.avg_cvss >= 6.5 ? '#FF9100' : '#00E676' }}>
                          {agency.avg_cvss.toFixed(2)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          p90: {agency.p90_cvss.toFixed(1)}
                        </Typography>
                      </TableCell>

                      {/* Primary Drivers */}
                      <TableCell sx={{ maxWidth: 260 }}>
                        {agency.primary_drivers && agency.primary_drivers.length > 0 ? (
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                            {agency.primary_drivers.slice(0, 2).map((d, i) => (
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
                                    maxWidth: 240,
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
                          onClick={() => handleOpenInspect(agency.agency_id)}
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
          Isolation Forest (iForest) Mathematical Foundations & Anomaly Scoring
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Isolation Forest isolates observations by randomly selecting a feature and randomly splitting between the minimum and maximum values. Anomalies require significantly fewer partitions to isolate than normal points.
        </Typography>

        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <Box sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.02)', borderRadius: 2, border: '1px solid rgba(255,255,255,0.05)' }}>
              <Typography variant="caption" color="#00D4FF" fontWeight={800}>1. Recursive Partitioning</Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', color: '#E2E8F0', my: 0.5 }}>
                h(x) = Tree Path Depth
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Number of splittings required to isolate instance x.
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
                Average path length of unsuccessful search in BST.
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
                When E(h(x)) &rarr; 0, score &rarr; 1 (Outlier Anomaly).
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
        open={Boolean(inspectAgency)}
        onClose={() => setInspectAgency(null)}
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
            <Business sx={{ color: '#00D4FF' }} />
            <Box>
              <Typography variant="h6" fontWeight={800} color="#F1F5F9">
                Agency Audit Telemetry & Root Cause Analysis
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Code: {inspectAgency?.agency?.agency_code} &bull; ID: {inspectAgency?.agency?.agency_id}
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={() => setInspectAgency(null)} sx={{ color: 'text.secondary' }}>
            <Close />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 3 }}>
          {inspectAgency && (
            <Box>
              {/* Header Info */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2, mb: 3 }}>
                <Box>
                  <Typography variant="h5" fontWeight={800} color="#00D4FF">
                    {inspectAgency.agency?.agency_name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    Type: <strong>{inspectAgency.agency?.agency_type}</strong> &bull; Contact: {inspectAgency.agency?.contact_person} ({inspectAgency.agency?.contact_email})
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                    {inspectAgency.agency?.cert_in_empanelled ? (
                      <Chip size="small" icon={<Shield sx={{ fontSize: '14px !important' }} />} label="CERT-In Empanelled" color="primary" sx={{ fontWeight: 700 }} />
                    ) : (
                      <Chip size="small" label="Private Assessor" sx={{ bgcolor: 'rgba(255,255,255,0.05)', color: '#94A3B8' }} />
                    )}
                    <Chip size="small" label={`City: ${inspectAgency.agency?.city || 'India'}`} sx={{ bgcolor: 'rgba(255,255,255,0.05)', color: '#94A3B8' }} />
                  </Box>
                </Box>

                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700 }}>
                    ISOLATION FOREST SCORE
                  </Typography>
                  <Typography variant="h4" fontWeight={900} sx={{ color: inspectAgency.parentMeta?.is_anomaly ? '#FF1744' : '#00E676' }}>
                    {inspectAgency.parentMeta?.anomaly_score?.toFixed(3) ?? '-0.19'}
                  </Typography>
                  <Chip
                    size="small"
                    label={inspectAgency.parentMeta?.tier_label || 'Critical Risk Outlier'}
                    sx={{
                      bgcolor: inspectAgency.parentMeta?.is_anomaly ? 'rgba(255, 23, 68, 0.2)' : 'rgba(0, 230, 118, 0.2)',
                      color: inspectAgency.parentMeta?.is_anomaly ? '#FF1744' : '#00E676',
                      fontWeight: 800,
                      mt: 0.5
                    }}
                  />
                </Box>
              </Box>

              {/* KPI Cards */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={6} sm={3}>
                  <Box sx={{ p: 1.5, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 2 }}>
                    <Typography variant="caption" color="text.secondary">Total Reports</Typography>
                    <Typography variant="body1" fontWeight={800} color="#E2E8F0">
                      {inspectAgency.stats?.total_reports} Reports
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Box sx={{ p: 1.5, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 2 }}>
                    <Typography variant="caption" color="text.secondary">Total Findings</Typography>
                    <Typography variant="body1" fontWeight={800} color="#00D4FF">
                      {inspectAgency.stats?.total_findings} Observations
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Box sx={{ p: 1.5, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 2 }}>
                    <Typography variant="caption" color="text.secondary">Critical Findings</Typography>
                    <Typography variant="body1" fontWeight={800} color="#FF1744">
                      {inspectAgency.stats?.critical_findings} Critical
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Box sx={{ p: 1.5, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 2 }}>
                    <Typography variant="caption" color="text.secondary">Open Backlog</Typography>
                    <Typography variant="body1" fontWeight={800} color="#FF9100">
                      {inspectAgency.stats?.open_findings} Unresolved
                    </Typography>
                  </Box>
                </Grid>
              </Grid>

              {/* Anomaly Drivers */}
              <Typography variant="subtitle2" fontWeight={800} color="#00D4FF" sx={{ mb: 1 }}>
                Multivariate Anomaly Attribution Drivers
              </Typography>
              <Box sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.02)', borderRadius: 2, border: '1px solid rgba(255,255,255,0.05)', mb: 3 }}>
                {inspectAgency.parentMeta?.primary_drivers && inspectAgency.parentMeta.primary_drivers.length > 0 ? (
                  inspectAgency.parentMeta.primary_drivers.map((driver, idx) => (
                    <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1, my: 0.5 }}>
                      <Warning sx={{ color: '#FF1744', fontSize: 18 }} />
                      <Typography variant="body2" color="#E2E8F0" fontWeight={600}>
                        {driver}
                      </Typography>
                    </Box>
                  ))
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No critical individual deviation. Tagged as standard audit distribution.
                  </Typography>
                )}
              </Box>

              {/* Sample Findings Table */}
              <Typography variant="subtitle2" fontWeight={800} color="#00E676" sx={{ mb: 1 }}>
                Recent Vulnerability Findings ({inspectAgency.sample_findings?.length || 0})
              </Typography>
              <TableContainer sx={{ maxHeight: 220, bgcolor: 'rgba(255,255,255,0.02)', borderRadius: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ color: 'text.secondary' }}>Finding Title</TableCell>
                      <TableCell sx={{ color: 'text.secondary' }}>Severity</TableCell>
                      <TableCell sx={{ color: 'text.secondary' }}>CVSS</TableCell>
                      <TableCell sx={{ color: 'text.secondary' }}>Status</TableCell>
                      <TableCell sx={{ color: 'text.secondary' }}>Days Open</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {inspectAgency.sample_findings?.map(f => (
                      <TableRow key={f.finding_id}>
                        <TableCell sx={{ maxWidth: 260 }}>
                          <Typography variant="caption" fontWeight={700} noWrap sx={{ display: 'block' }}>
                            {f.title}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={f.severity}
                            sx={{
                              height: 18,
                              fontSize: '0.65rem',
                              bgcolor: f.severity === 'Critical' ? 'rgba(255,23,68,0.2)' : 'rgba(255,145,0,0.2)',
                              color: f.severity === 'Critical' ? '#FF1744' : '#FF9100'
                            }}
                          />
                        </TableCell>
                        <TableCell>{f.cvss_score}</TableCell>
                        <TableCell>{f.status}</TableCell>
                        <TableCell>{f.days_open}d</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <Button onClick={() => setInspectAgency(null)} sx={{ color: 'text.secondary' }}>
            Close
          </Button>
          <Button
            variant="contained"
            onClick={() => setInspectAgency(null)}
            sx={{ bgcolor: '#00D4FF', color: '#0B1120', fontWeight: 800 }}
          >
            Mark For Audit Review
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
