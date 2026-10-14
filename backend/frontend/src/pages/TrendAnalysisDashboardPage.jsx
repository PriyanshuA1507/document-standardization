import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Typography, Alert, CircularProgress, Skeleton, Button, Chip,
  Card, CardContent, Grid
} from '@mui/material';
import {
  TrendingUp, Refresh, History, CheckCircle, WarningAmber, Lightbulb, AutoGraph
} from '@mui/icons-material';
import api from '../api/axios';

import HowItWorksBanner from '../components/trend_forecasting/HowItWorksBanner';
import DataReadinessPanel from '../components/trend_forecasting/DataReadinessPanel';
import RunControlBar from '../components/trend_forecasting/RunControlBar';
import TrendOverviewCards from '../components/trend_forecasting/TrendOverviewCards';
import FindingTrendsCharts from '../components/trend_forecasting/FindingTrendsCharts';
import RecurringWeaknessModule from '../components/trend_forecasting/RecurringWeaknessModule';
import RemediationPerformanceModule from '../components/trend_forecasting/RemediationPerformanceModule';
import RunHistoryModal from '../components/trend_forecasting/RunHistoryModal';
import FindingDrillDownModal from '../components/trend_forecasting/FindingDrillDownModal';

export default function TrendAnalysisDashboardPage() {
  // Page load & summary state
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [readiness, setReadiness] = useState(null);
  const [currentRunData, setCurrentRunData] = useState(null);
  const [error, setError] = useState(null);

  // Active run execution & polling state
  const [isRunning, setIsRunning] = useState(false);
  const [activeRun, setActiveRun] = useState(null);
  const pollingRef = useRef(null);

  // Filter & control parameters
  const [params, setParams] = useState({
    date_basis: 'effective',
    frequency: 'M',
    horizon: 6,
    severity: 'ALL',
    status: 'ALL',
    start_date: '',
    end_date: '',
  });

  // Modals state
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyRuns, setHistoryRuns] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [drilldownOpen, setDrilldownOpen] = useState(false);
  const [drilldownPeriod, setDrilldownPeriod] = useState(null);
  const [drilldownFindings, setDrilldownFindings] = useState([]);
  const [drilldownTotal, setDrilldownTotal] = useState(0);
  const [drilldownLoading, setDrilldownLoading] = useState(false);

  // 1. Initial Page Load: Fetch stored summary without triggering computation
  useEffect(() => {
    fetchInitialSummary();
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const fetchInitialSummary = async () => {
    try {
      setLoadingInitial(true);
      setError(null);
      const res = await api.get('/api/trend-analysis/summary');
      const data = res.data?.data || {};

      setReadiness(data.data_readiness || null);

      if (data.active_job) {
        // Resume polling if an active run exists
        setActiveRun(data.active_job);
        setIsRunning(true);
        startPolling(data.active_job.run_id);
      } else if (data.latest_completed_run) {
        // Load latest completed run results
        setCurrentRunData(data.latest_completed_run);
        if (data.latest_completed_run.parameters?.horizon) {
          setParams(prev => ({
            ...prev,
            ...data.latest_completed_run.parameters,
            horizon: Number(data.latest_completed_run.parameters.horizon) || prev.horizon,
          }));
        }
      }
    } catch (err) {
      console.error('Failed to load trend analysis summary:', err);
      setError(err.response?.data?.detail || 'Failed to load trend summary.');
    } finally {
      setLoadingInitial(false);
    }
  };

  // 2. Poll Active Run Progress
  const startPolling = (runId) => {
    if (pollingRef.current) clearInterval(pollingRef.current);

    pollingRef.current = setInterval(async () => {
      try {
        const res = await api.get(`/api/trend-analysis/runs/${runId}`);
        const runInfo = res.data?.data;
        if (!runInfo) return;

        setActiveRun(runInfo);

        if (runInfo.status === 'COMPLETED') {
          clearInterval(pollingRef.current);
          setIsRunning(false);
          // Fetch completed results directly
          const resultRes = await api.get(`/api/trend-analysis/runs/${runId}/results`);
          const completedData = resultRes.data?.data;
          if (completedData) {
            setCurrentRunData(completedData);
            if (completedData.parameters?.horizon) {
              setParams(prev => ({
                ...prev,
                ...completedData.parameters,
                horizon: Number(completedData.parameters.horizon) || prev.horizon,
              }));
            }
            if (completedData.data_readiness) {
              setReadiness(completedData.data_readiness);
            }
          }
        } else if (runInfo.status === 'FAILED') {
          clearInterval(pollingRef.current);
          setIsRunning(false);
          setError(`Run failed: ${runInfo.error_message || 'Unknown processing error'}`);
        }
      } catch (err) {
        console.error('Error polling run status:', err);
      }
    }, 1200);
  };

  // 3. User-Initiated Explicit Trigger
  const handleTriggerRun = async () => {
    try {
      setError(null);
      setIsRunning(true);

      const payload = {
        date_basis: params.date_basis,
        frequency: params.frequency,
        horizon: params.horizon,
        severities: params.severity !== 'ALL' ? [params.severity] : undefined,
        statuses: params.status !== 'ALL' ? [params.status] : undefined,
        start_date: params.start_date ? params.start_date : undefined,
        end_date: params.end_date ? params.end_date : undefined,
      };

      const res = await api.post('/api/trend-analysis/runs', payload);
      const data = res.data;

      setActiveRun({
        run_id: data.run_id,
        status: data.job_status,
        current_stage: data.current_stage,
        progress_percent: data.progress_percent,
      });

      startPolling(data.run_id);
    } catch (err) {
      setIsRunning(false);
      console.error('Failed to trigger trend run:', err);
      setError(err.response?.data?.detail || 'Failed to initiate trend run.');
    }
  };

  // 4. Past Runs History Modal
  const handleOpenHistory = async () => {
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const res = await api.get('/api/trend-analysis/history?limit=25');
      setHistoryRuns(res.data?.data || []);
    } catch (err) {
      console.error('Failed to load run history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSelectPastRun = async (runId) => {
    try {
      setLoadingInitial(true);
      const res = await api.get(`/api/trend-analysis/runs/${runId}/results`);
      const pastData = res.data?.data;
      if (pastData) {
        setCurrentRunData(pastData);
        if (pastData.parameters?.horizon) {
          setParams(prev => ({
            ...prev,
            ...pastData.parameters,
            horizon: Number(pastData.parameters.horizon) || prev.horizon,
          }));
        }
        if (pastData.data_readiness) {
          setReadiness(pastData.data_readiness);
        }
      }
    } catch (err) {
      setError(`Failed to load run ${runId}`);
    } finally {
      setLoadingInitial(false);
    }
  };

  // 5. Drill-Down Click Handler
  const handleDrilldown = async ({ period, severity, status, cwe }) => {
    setDrilldownPeriod(period);
    setDrilldownOpen(true);
    setDrilldownLoading(true);
    try {
      const qParams = new URLSearchParams({
        period: period || '',
        frequency: params.frequency || 'M',
        date_basis: params.date_basis || 'effective',
        limit: '100',
        offset: '0',
      });
      if (severity && severity !== 'ALL') qParams.append('severity', severity);
      if (status && status !== 'ALL') qParams.append('status', status);
      if (cwe) qParams.append('cwe', cwe);

      const res = await api.get(`/api/trend-analysis/drilldown?${qParams.toString()}`);
      setDrilldownFindings(res.data?.data || []);
      setDrilldownTotal(res.data?.total || 0);
    } catch (err) {
      console.error('Failed to drill down:', err);
    } finally {
      setDrilldownLoading(false);
    }
  };

  if (loadingInitial) {
    return (
      <Box sx={{ p: 1 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 3, background: 'linear-gradient(135deg, #00D4FF, #00E676)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Cybersecurity Audit Trend Analysis & Time-Series Forecasting
        </Typography>
        <Skeleton variant="rounded" height={160} sx={{ mb: 3, borderRadius: 3 }} />
        <Skeleton variant="rounded" height={80} sx={{ mb: 3, borderRadius: 2 }} />
        <Skeleton variant="rounded" height={400} sx={{ borderRadius: 3 }} />
      </Box>
    );
  }

  const overview = currentRunData?.summary?.overview;
  const metrics = currentRunData?.summary?.metrics;
  const recurring = currentRunData?.summary?.recurring_weakness;
  const remediation = currentRunData?.summary?.remediation_performance;
  const forecastResults = currentRunData?.forecast_results;
  const warnings = currentRunData?.warnings || [];

  return (
    <Box sx={{ p: 0.5 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.02em', background: 'linear-gradient(135deg, #00D4FF 0%, #00E676 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Trend Analysis & Time-Series Forecasting
          </Typography>
          <Typography variant="body2" sx={{ color: '#94A3B8', mt: 0.5 }}>
            Powered by <strong>Google TimesFM-3</strong> (Zero-Shot Foundation Model for Multivariate Forecasting) and CERT-In / MeitY retest closure analytics across normalized audit evidence.
          </Typography>
        </Box>

        {currentRunData && (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Chip
              label="TimesFM-3 Foundation Engine"
              size="medium"
              sx={{ bgcolor: 'rgba(0, 230, 118, 0.15)', color: '#00E676', border: '1px solid rgba(0, 230, 118, 0.35)', fontWeight: 700 }}
            />
            <Chip
              label={`Run: ${String(currentRunData.run_id || '').substring(0, 8)} (${currentRunData.parameters?.frequency === 'W' ? 'Weekly' : 'Monthly'})`}
              size="medium"
              sx={{ bgcolor: 'rgba(0, 212, 255, 0.1)', color: '#00D4FF', border: '1px solid rgba(0, 212, 255, 0.3)', fontWeight: 600 }}
            />
          </Box>
        )}
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3, background: 'rgba(255, 23, 68, 0.1)', color: '#FF1744', border: '1px solid rgba(255, 23, 68, 0.3)' }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Global Warnings / Model Notices */}
      {warnings.length > 0 && (
        <Alert severity="warning" icon={<WarningAmber />} sx={{ mb: 3, background: 'rgba(255, 145, 0, 0.08)', color: '#E2E8F0', border: '1px solid rgba(255, 145, 0, 0.25)' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>Forecasting Model & Data Quality Notices:</Typography>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {warnings.map((w, i) => (
              <li key={i}><Typography variant="caption">{w}</Typography></li>
            ))}
          </ul>
        </Alert>
      )}

      {/* 1. Visual Plain-English Explainer: What We Give -> AI Engine -> What It Gives */}
      <HowItWorksBanner />

      {/* 2. Interactive Run Control Bar */}
      <RunControlBar
        params={params}
        onChangeParams={setParams}
        onTriggerRun={handleTriggerRun}
        onOpenHistory={handleOpenHistory}
        isRunning={isRunning}
        activeRun={activeRun}
      />

      {/* 3. Data Readiness Quality Panel (Audit Diagnostics) */}
      <DataReadinessPanel readiness={readiness} />

      {/* No Run Executed Prompt */}
      {!currentRunData && !isRunning && (
        <Alert severity="info" sx={{ mb: 3, background: 'rgba(0, 212, 255, 0.08)', color: '#E2E8F0', border: '1px solid rgba(0, 212, 255, 0.25)' }}>
          No trend analysis has been executed yet for this scope. Select your desired timeframe and parameters above, then click <strong>"Run TimesFM-3 Multivariate Forecast"</strong> to execute your first model run.
        </Alert>
      )}

      {/* 4. Section A: Trend Analysis Overview KPI Cards */}
      {overview && <TrendOverviewCards overview={overview} />}

      {/* 5. Plain-Language Executive Summary (What This Means For Management) */}
      {overview && (
        <Card sx={{
          mb: 3,
          background: 'rgba(10, 14, 23, 0.85)',
          border: '1px solid rgba(0, 212, 255, 0.25)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
        }}>
          <CardContent sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.2 }}>
              <Lightbulb sx={{ color: '#00D4FF', fontSize: 20 }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#E2E8F0' }}>
                Executive Plain-Language Summary: What This Data Means
              </Typography>
            </Box>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Box sx={{ p: 1.5, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', height: '100%' }}>
                  <Typography variant="caption" sx={{ color: '#00D4FF', fontWeight: 700, display: 'block', mb: 0.5 }}>
                    📈 VULNERABILITY WORKLOAD OUTLOOK
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#CBD5E1', fontSize: '0.8rem', lineHeight: 1.5 }}>
                    {overview.total_findings?.change_pct !== null && overview.total_findings?.change_pct !== undefined ? (
                      overview.total_findings.change_pct > 0 
                        ? `Incoming vulnerability arrivals grew by +${overview.total_findings.change_pct}% over recent audit periods. TimesFM-3 foundation model projects this workload will require sustained remediation capacity.`
                        : `Vulnerability arrivals decreased by ${Math.abs(overview.total_findings.change_pct)}%, showing measurable security posture stabilization across tested applications.`
                    ) : 'Sustained audit discovery volume detected across current reporting cycles.'}
                  </Typography>
                </Box>
              </Grid>

              <Grid item xs={12} md={4}>
                <Box sx={{ p: 1.5, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', height: '100%' }}>
                  <Typography variant="caption" sx={{ color: '#FF1744', fontWeight: 700, display: 'block', mb: 0.5 }}>
                    🚨 HIGH-SEVERITY RISK EXPOSURE
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#CBD5E1', fontSize: '0.8rem', lineHeight: 1.5 }}>
                    There are currently <strong>{overview.open_critical?.value || 0} Open Critical</strong> and <strong>{overview.open_high?.value || 0} Open High</strong> vulnerabilities. Remediation workflows should prioritize these to mitigate immediate breach exposure.
                  </Typography>
                </Box>
              </Grid>

              <Grid item xs={12} md={4}>
                <Box sx={{ p: 1.5, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', height: '100%' }}>
                  <Typography variant="caption" sx={{ color: '#00E676', fontWeight: 700, display: 'block', mb: 0.5 }}>
                    🛡️ FORMAL REMEDIATION VELOCITY
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#CBD5E1', fontSize: '0.8rem', lineHeight: 1.5 }}>
                    <strong>{overview.verified_closures?.value || 0}</strong> verified closures documented via formal CERT-In / MeitY retest certificates, maintaining positive remediation momentum against newly identified flaws.
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* 6. Section B: Interactive Finding Trends Charts (Tabbed & Simplified) */}
      {metrics && (
        <FindingTrendsCharts
          metrics={metrics}
          forecastResults={forecastResults}
          onDrilldown={handleDrilldown}
          horizon={params.horizon}
        />
      )}

      {/* 5. Section C: Recurring Weakness Analysis */}
      {recurring && <RecurringWeaknessModule recurringData={recurring} />}

      {/* 6. Section D: Remediation Performance & Closure Lifecycle */}
      {remediation && <RemediationPerformanceModule remediationData={remediation} />}

      {/* Past Runs Modal */}
      <RunHistoryModal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        historyRuns={historyRuns}
        isLoading={historyLoading}
        onSelectRun={handleSelectPastRun}
      />

      {/* Drill-down Modal */}
      <FindingDrillDownModal
        open={drilldownOpen}
        onClose={() => setDrilldownOpen(false)}
        period={drilldownPeriod}
        findings={drilldownFindings}
        isLoading={drilldownLoading}
        totalCount={drilldownTotal}
      />
    </Box>
  );
}

