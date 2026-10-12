import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Typography, Alert, CircularProgress, Skeleton, Button, Chip
} from '@mui/material';
import {
  TrendingUp, Refresh, History, CheckCircle, WarningAmber
} from '@mui/icons-material';
import api from '../api/axios';

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
          // Fetch completed results
          const resultRes = await api.get(`/api/trend-analysis/runs/${runId}/results`);
          setCurrentRunData(resultRes.data?.data);
          // Refresh readiness
          fetchInitialSummary();
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
      setCurrentRunData(res.data?.data);
      if (res.data?.data?.data_readiness) {
        setReadiness(res.data?.data?.data_readiness);
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
            Historical vulnerability progression, multi-stage statistical forecasting, and retest closure analytics across normalized audit evidence.
          </Typography>
        </Box>

        {currentRunData && (
          <Chip
            label={`Showing Run: ${String(currentRunData.run_id || '').substring(0, 8)} (${currentRunData.parameters?.frequency === 'W' ? 'Weekly' : 'Monthly'})`}
            size="medium"
            sx={{ bgcolor: 'rgba(0, 212, 255, 0.1)', color: '#00D4FF', border: '1px solid rgba(0, 212, 255, 0.3)', fontWeight: 600 }}
          />
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

      {/* 1. Data Readiness Quality Panel */}
      <DataReadinessPanel readiness={readiness} />

      {/* 2. Interactive Run Control Bar */}
      <RunControlBar
        params={params}
        onChangeParams={setParams}
        onTriggerRun={handleTriggerRun}
        onOpenHistory={handleOpenHistory}
        isRunning={isRunning}
        activeRun={activeRun}
      />

      {/* No Run Executed Prompt */}
      {!currentRunData && !isRunning && (
        <Alert severity="info" sx={{ mb: 3, background: 'rgba(0, 212, 255, 0.08)', color: '#E2E8F0', border: '1px solid rgba(0, 212, 255, 0.25)' }}>
          No trend analysis has been executed yet for this scope. Select your desired timeframe and parameters above, then click <strong>"Run Trend Analysis & Forecast"</strong> to execute your first model run.
        </Alert>
      )}

      {/* 3. Section A: Trend Analysis Overview KPI Cards */}
      {overview && <TrendOverviewCards overview={overview} />}

      {/* 4. Section B: 12 Interactive Finding Trends Charts */}
      {metrics && (
        <FindingTrendsCharts
          metrics={metrics}
          forecastResults={forecastResults}
          onDrilldown={handleDrilldown}
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

