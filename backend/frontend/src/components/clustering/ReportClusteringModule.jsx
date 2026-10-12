import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  CircularProgress,
  LinearProgress,
  Chip,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Divider,
} from '@mui/material';
import {
  PlayArrow,
  Description,
  BubbleChart,
  Schedule,
  Layers,
  Assessment,
  OpenInNew,
  Security,
  GppMaybe,
} from '@mui/icons-material';
import api from '../../api/axios';
import ClusterMembersModal from './ClusterMembersModal';

function StatCard({ title, value, subtitle, icon, color = '#00E676' }) {
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

export default function ReportClusteringModule() {
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [activeRun, setActiveRun] = useState(null);
  const [completedRun, setCompletedRun] = useState(null);
  const [error, setError] = useState(null);
  const [inspectModal, setInspectModal] = useState({ open: false, clusterId: null, label: '' });

  const pollingTimerRef = useRef(null);

  const loadLatestResults = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/api/clustering/latest/REPORT');
      if (res.data?.status === 'success') {
        const { active_run, latest_completed_run } = res.data.data;
        setActiveRun(active_run);
        setCompletedRun(latest_completed_run);

        if (active_run?.run_id) {
          startPolling(active_run.run_id);
        }
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load report clustering results.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLatestResults();
    return () => {
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
    };
  }, []);

  const startPolling = (runId) => {
    if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
    pollingTimerRef.current = setInterval(async () => {
      try {
        const res = await api.get(`/api/clustering/status/${runId}`);
        if (res.data?.status === 'success') {
          const runData = res.data.data;
          setActiveRun(runData);

          if (runData.status === 'COMPLETED' || runData.status === 'FAILED') {
            clearInterval(pollingTimerRef.current);
            pollingTimerRef.current = null;
            setActiveRun(null);
            const latestRes = await api.get('/api/clustering/latest/REPORT');
            if (latestRes.data?.status === 'success') {
              setCompletedRun(latestRes.data.data.latest_completed_run);
            }
          }
        }
      } catch (err) {
        clearInterval(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
    }, 1500);
  };

  const handleTriggerRun = async () => {
    setTriggering(true);
    setError(null);
    try {
      const res = await api.post('/api/clustering/reports/run');
      if (res.data?.status === 'success') {
        const runId = res.data.run_id;
        setActiveRun({
          run_id: runId,
          status: 'QUEUED',
          current_stage: 'Queued',
          progress_percent: 0,
        });
        startPolling(runId);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to trigger report clustering.');
    } finally {
      setTriggering(false);
    }
  };

  const summary = completedRun?.summary || {};
  const clusters = summary.clusters || [];
  const totalReports = completedRun?.input_record_count || 0;
  const clusterCount = completedRun?.discovered_cluster_count || 0;
  const noiseCount = completedRun?.noise_record_count || 0;

  return (
    <Box>
      {/* Action Header Card */}
      <Card sx={{ bgcolor: '#0D1527', border: '1px solid rgba(0,230,118,0.2)', borderRadius: 3, mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <Box>
              <Typography variant="h5" fontWeight={800} sx={{ color: '#E2E8F0', display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Description sx={{ color: '#00E676' }} />
                Audit Report Security Clustering
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Multi-dimensional risk grouping over total findings, CVSS distribution, critical severity ratios, and remediation status.
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Button
                variant="contained"
                size="large"
                disabled={Boolean(activeRun) || triggering}
                onClick={handleTriggerRun}
                startIcon={Boolean(activeRun) || triggering ? <CircularProgress size={20} color="inherit" /> : <PlayArrow />}
                sx={{
                  bgcolor: '#00E676',
                  color: '#0A0E17',
                  fontWeight: 800,
                  px: 3,
                  py: 1.2,
                  borderRadius: 2,
                  boxShadow: '0 0 20px rgba(0,230,118,0.3)',
                  '&:hover': { bgcolor: '#00C853', boxShadow: '0 0 25px rgba(0,230,118,0.5)' },
                  '&:disabled': { bgcolor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)' }
                }}
              >
                {Boolean(activeRun) ? 'Clustering In Progress...' : triggering ? 'Submitting Job...' : 'Run Report Clustering'}
              </Button>
            </Box>
          </Box>

          {/* Active Job Progress Banner */}
          {activeRun && (
            <Box sx={{ mt: 3, p: 2, bgcolor: 'rgba(0, 230, 118, 0.08)', borderRadius: 2, border: '1px solid rgba(0, 230, 118, 0.2)' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircularProgress size={16} sx={{ color: '#00E676' }} />
                  <Typography variant="body2" fontWeight={700} sx={{ color: '#00E676' }}>
                    Stage: {activeRun.current_stage || 'Executing...'}
                  </Typography>
                </Box>
                <Typography variant="caption" fontWeight={700} sx={{ color: '#00E676' }}>
                  {activeRun.progress_percent}%
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={activeRun.progress_percent}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  bgcolor: 'rgba(255,255,255,0.1)',
                  '& .MuiLinearProgress-bar': { bgcolor: '#00E676' }
                }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                Run ID: {activeRun.run_id} &bull; Status: {activeRun.status}
              </Typography>
            </Box>
          )}

          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </CardContent>
      </Card>

      {/* Stat Cards */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Eligible Reports"
            value={totalReports.toLocaleString()}
            subtitle="Analyzed audit documents"
            icon={<Assessment />}
            color="#00E676"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Discovered Clusters"
            value={clusterCount.toLocaleString()}
            subtitle="Security profile cohorts"
            icon={<BubbleChart />}
            color="#00D4FF"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Outlier Reports"
            value={noiseCount.toLocaleString()}
            subtitle="Unique posture reports"
            icon={<Layers />}
            color="#FF9100"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Algorithm Version"
            value={completedRun?.algorithm_version || 'HDBSCAN-RiskProfile'}
            subtitle={completedRun?.completed_at ? `Run at ${new Date(completedRun.completed_at).toLocaleTimeString()}` : 'No run yet'}
            icon={<Schedule />}
            color="#7C4DFF"
          />
        </Grid>
      </Grid>

      {/* Main Content Area */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress sx={{ color: '#00E676' }} />
        </Box>
      ) : !completedRun ? (
        <Card sx={{ bgcolor: '#0B1120', border: '1px solid rgba(255,255,255,0.06)', p: 6, textAlign: 'center', borderRadius: 3 }}>
          <Description sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" fontWeight={700}>
            No Report Clustering Results Available
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 500, mx: 'auto', mt: 1, mb: 3 }}>
            Clustering only executes on explicit user trigger. Click "Run Report Clustering" above to group audit reports with similar risk and finding characteristics.
          </Typography>
        </Card>
      ) : (
        <Box>
          <Typography variant="h6" fontWeight={800} sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <BubbleChart sx={{ color: '#00E676', fontSize: 22 }} />
            Discovered Audit Report Cohorts ({clusters.length})
          </Typography>

          <Grid container spacing={2.5}>
            {clusters.slice(0, 12).map((c) => (
              <Grid item xs={12} md={6} lg={4} key={c.cluster_id}>
                <Card
                  sx={{
                    bgcolor: '#0B1120',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 2.5,
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'all 0.2s',
                    '&:hover': { borderColor: 'rgba(0, 230, 118, 0.4)', transform: 'translateY(-2px)' }
                  }}
                >
                  <CardContent sx={{ p: 2.5, flex: 1, display: 'flex', flexDirection: 'column' }}>
                    {/* Header */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip
                          size="small"
                          label={`#${c.cluster_id}`}
                          sx={{ bgcolor: 'rgba(0, 230, 118, 0.15)', color: '#00E676', fontWeight: 800, fontSize: '0.75rem' }}
                        />
                        <Typography variant="caption" color="text.secondary" fontWeight={700}>
                          {c.report_count} Reports
                        </Typography>
                      </Box>
                      <Chip
                        size="small"
                        label={`Avg CVSS ${c.avg_cvss}`}
                        sx={{
                          bgcolor: c.avg_cvss >= 7 ? 'rgba(255,23,68,0.15)' : c.avg_cvss >= 4 ? 'rgba(255,145,0,0.15)' : 'rgba(0,230,118,0.15)',
                          color: c.avg_cvss >= 7 ? '#FF1744' : c.avg_cvss >= 4 ? '#FF9100' : '#00E676',
                          fontWeight: 800,
                          fontSize: '0.7rem'
                        }}
                      />
                    </Box>

                    {/* Profile Title */}
                    <Typography variant="subtitle1" fontWeight={700} sx={{ color: '#E2E8F0', mb: 1, minHeight: 48, lineHeight: 1.3 }}>
                      {c.profile_type}
                    </Typography>

                    {/* Metrics Bar */}
                    <Box sx={{ bgcolor: 'rgba(255,255,255,0.02)', p: 1.5, borderRadius: 2, mb: 2 }}>
                      <Grid container spacing={1}>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            Avg Findings / Report:
                          </Typography>
                          <Typography variant="body2" fontWeight={800} color="#00D4FF">
                            {c.avg_vulns}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            Critical Finding Ratio:
                          </Typography>
                          <Typography variant="body2" fontWeight={800} color={c.avg_critical_ratio > 0.1 ? '#FF1744' : '#00E676'}>
                            {(c.avg_critical_ratio * 100).toFixed(0)}%
                          </Typography>
                        </Grid>
                      </Grid>
                    </Box>

                    {/* Representative Reports */}
                    <Box sx={{ flex: 1, borderTop: '1px solid rgba(255,255,255,0.06)', pt: 1.5, mb: 2 }}>
                      <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Representative Reports:
                      </Typography>
                      <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {(c.representative_reports || []).slice(0, 2).map((rr, idx) => (
                          <Box key={idx} sx={{ p: 1, bgcolor: 'rgba(255,255,255,0.02)', borderRadius: 1.5 }}>
                            <Typography variant="caption" fontWeight={600} noWrap sx={{ display: 'block', color: '#CBD5E1' }} title={rr.filename}>
                              {rr.filename}
                            </Typography>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                              <Typography variant="caption" color="text.secondary">
                                {rr.total_vulns} vulns &bull; {rr.audit_type || 'General'}
                              </Typography>
                              <Typography variant="caption" sx={{ color: '#00E676', fontWeight: 600 }}>
                                {(rr.membership_strength * 100).toFixed(0)}% affinity
                              </Typography>
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    </Box>

                    {/* Inspect Button */}
                    <Button
                      size="small"
                      fullWidth
                      variant="outlined"
                      onClick={() => setInspectModal({ open: true, clusterId: c.cluster_id, label: c.cluster_label })}
                      endIcon={<OpenInNew sx={{ fontSize: 16 }} />}
                      sx={{
                        borderColor: 'rgba(0,230,118,0.3)',
                        color: '#00E676',
                        fontWeight: 700,
                        '&:hover': { borderColor: '#00E676', bgcolor: 'rgba(0,230,118,0.05)' }
                      }}
                    >
                      Inspect All {c.report_count} Reports
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {/* Noise / Outlier Section */}
          <Box sx={{ mt: 4 }}>
            <Card sx={{ bgcolor: '#0B1120', border: '1px solid rgba(255,145,0,0.2)', borderRadius: 2.5 }}>
              <CardContent sx={{ p: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="subtitle1" fontWeight={700} sx={{ color: '#FF9100', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Layers sx={{ fontSize: 20 }} />
                    Outlier / Unique Audit Reports ({noiseCount.toLocaleString()})
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Reports exhibiting unique vulnerability profiles, anomalous asset scopes, or unusual severity distributions.
                  </Typography>
                </Box>
                <Button
                  variant="outlined"
                  onClick={() => setInspectModal({ open: true, clusterId: -1, label: 'Outlier / Unique Audit Reports' })}
                  sx={{ borderColor: 'rgba(255,145,0,0.4)', color: '#FF9100', fontWeight: 700 }}
                >
                  View Outlier Reports
                </Button>
              </CardContent>
            </Card>
          </Box>
        </Box>
      )}

      {/* Drill-Down Modal */}
      <ClusterMembersModal
        open={inspectModal.open}
        onClose={() => setInspectModal({ open: false, clusterId: null, label: '' })}
        runId={completedRun?.run_id}
        clusterId={inspectModal.clusterId}
        clusterLabel={inspectModal.label}
        clusteringType="REPORT"
      />
    </Box>
  );
}

