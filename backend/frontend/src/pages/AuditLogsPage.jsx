import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Chip,
  Button,
  IconButton,
  TextField,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Drawer,
  Divider,
  Tooltip,
  CircularProgress,
  Tabs,
  Tab,
  Badge,
  Avatar,
  Switch,
  FormControlLabel,
  LinearProgress,
} from '@mui/material';
import {
  Security,
  Search,
  Clear,
  Refresh,
  FileDownload,
  Code,
  CheckCircle,
  Warning,
  Error as ErrorIcon,
  Info,
  Lock,
  VpnKey,
  CloudUpload,
  DeleteOutline,
  Download,
  Memory,
  PersonAdd,
  ManageAccounts,
  PersonRemove,
  Layers,
  AutoAwesome,
  Visibility,
  ContentCopy,
  Check,
  Close,
  Shield,
  FilterList,
  Schedule,
  Lan,
  BugReport,
  ArrowForward,
  Sync,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import api from '../api/axios';

/* ───────────────────────────────────────────────────────────
   Action Badge Configurations & Color Enums
─────────────────────────────────────────────────────────── */
const ACTION_CONFIG = {
  // Authentication
  USER_LOGIN: { color: '#00E676', bg: 'rgba(0, 230, 118, 0.12)', border: 'rgba(0, 230, 118, 0.3)', icon: <VpnKey sx={{ fontSize: 14 }} />, label: 'User Login' },
  USER_LOGOUT: { color: '#94A3B8', bg: 'rgba(148, 163, 184, 0.12)', border: 'rgba(148, 163, 184, 0.3)', icon: <Lock sx={{ fontSize: 14 }} />, label: 'User Logout' },
  USER_LOGIN_FAILED: { color: '#FF1744', bg: 'rgba(255, 23, 68, 0.15)', border: 'rgba(255, 23, 68, 0.4)', icon: <Warning sx={{ fontSize: 14 }} />, label: 'Login Failed' },

  // Files & Reports
  FILE_UPLOAD: { color: '#00D4FF', bg: 'rgba(0, 212, 255, 0.12)', border: 'rgba(0, 212, 255, 0.3)', icon: <CloudUpload sx={{ fontSize: 14 }} />, label: 'File Upload' },
  FILE_DELETE: { color: '#FF1744', bg: 'rgba(255, 23, 68, 0.12)', border: 'rgba(255, 23, 68, 0.3)', icon: <DeleteOutline sx={{ fontSize: 14 }} />, label: 'File Delete' },
  REPORT_DOWNLOAD: { color: '#00E676', bg: 'rgba(0, 230, 118, 0.12)', border: 'rgba(0, 230, 118, 0.3)', icon: <Download sx={{ fontSize: 14 }} />, label: 'Report Download' },
  REPORT_REPROCESS: { color: '#FF9100', bg: 'rgba(255, 145, 0, 0.12)', border: 'rgba(255, 145, 0, 0.3)', icon: <Sync sx={{ fontSize: 14 }} />, label: 'Reprocess' },
  PARTIAL_DUPLICATE_DETECTED: { color: '#FF9100', bg: 'rgba(255, 145, 0, 0.12)', border: 'rgba(255, 145, 0, 0.3)', icon: <Warning sx={{ fontSize: 14 }} />, label: 'Duplicate Flag' },

  // AI Pipeline
  PIPELINE_START: { color: '#7C4DFF', bg: 'rgba(124, 77, 255, 0.12)', border: 'rgba(124, 77, 255, 0.3)', icon: <Memory sx={{ fontSize: 14 }} />, label: 'Pipeline Start' },
  PIPELINE_SUCCESS: { color: '#00E676', bg: 'rgba(0, 230, 118, 0.12)', border: 'rgba(0, 230, 118, 0.3)', icon: <CheckCircle sx={{ fontSize: 14 }} />, label: 'Pipeline Success' },
  PIPELINE_FAILED: { color: '#FF1744', bg: 'rgba(255, 23, 68, 0.15)', border: 'rgba(255, 23, 68, 0.4)', icon: <ErrorIcon sx={{ fontSize: 14 }} />, label: 'Pipeline Failed' },

  // User Management
  USER_CREATE: { color: '#00D4FF', bg: 'rgba(0, 212, 255, 0.12)', border: 'rgba(0, 212, 255, 0.3)', icon: <PersonAdd sx={{ fontSize: 14 }} />, label: 'User Created' },
  USER_UPDATE: { color: '#FF9100', bg: 'rgba(255, 145, 0, 0.12)', border: 'rgba(255, 145, 0, 0.3)', icon: <ManageAccounts sx={{ fontSize: 14 }} />, label: 'User Updated' },
  USER_DELETE: { color: '#FF1744', bg: 'rgba(255, 23, 68, 0.12)', border: 'rgba(255, 23, 68, 0.3)', icon: <PersonRemove sx={{ fontSize: 14 }} />, label: 'User Deactivated' },
  PROFILE_UPDATE: { color: '#7C4DFF', bg: 'rgba(124, 77, 255, 0.12)', border: 'rgba(124, 77, 255, 0.3)', icon: <ManageAccounts sx={{ fontSize: 14 }} />, label: 'Profile Update' },

  // Batches
  BATCH_CREATE: { color: '#00D4FF', bg: 'rgba(0, 212, 255, 0.12)', border: 'rgba(0, 212, 255, 0.3)', icon: <Layers sx={{ fontSize: 14 }} />, label: 'Batch Created' },
  BATCH_CANCEL: { color: '#FF9100', bg: 'rgba(255, 145, 0, 0.12)', border: 'rgba(255, 145, 0, 0.3)', icon: <Close sx={{ fontSize: 14 }} />, label: 'Batch Cancelled' },
  BATCH_DELETE: { color: '#FF1744', bg: 'rgba(255, 23, 68, 0.12)', border: 'rgba(255, 23, 68, 0.3)', icon: <DeleteOutline sx={{ fontSize: 14 }} />, label: 'Batch Deleted' },

  // ML Analysis
  ANOMALY_RUN: { color: '#FF9100', bg: 'rgba(255, 145, 0, 0.12)', border: 'rgba(255, 145, 0, 0.3)', icon: <BugReport sx={{ fontSize: 14 }} />, label: 'Anomaly Run' },
  CLUSTERING_RUN: { color: '#7C4DFF', bg: 'rgba(124, 77, 255, 0.12)', border: 'rgba(124, 77, 255, 0.3)', icon: <AutoAwesome sx={{ fontSize: 14 }} />, label: 'Clustering Run' },
};

const getActionConfig = (action) => {
  if (ACTION_CONFIG[action]) return ACTION_CONFIG[action];
  return {
    color: '#94A3B8',
    bg: 'rgba(148, 163, 184, 0.1)',
    border: 'rgba(148, 163, 184, 0.25)',
    icon: <Security sx={{ fontSize: 14 }} />,
    label: action?.replace(/_/g, ' ') || 'Action',
  };
};

/* Format relative time string */
const formatRelativeTime = (timestamp) => {
  if (!timestamp) return '—';
  const now = new Date();
  const date = new Date(timestamp);
  const diffSec = Math.floor((now - date) / 1000);
  if (diffSec < 60) return `${Math.max(1, diffSec)}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

/* ───────────────────────────────────────────────────────────
   Top KPI Metric Card
─────────────────────────────────────────────────────────── */
function AuditStatCard({ title, value, subtitle, icon, color, progress }) {
  return (
    <Card
      className="fade-in-up"
      sx={{
        backgroundColor: 'rgba(13, 21, 39, 0.75)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 3,
        position: 'relative',
        overflow: 'hidden',
        transition: 'all 0.25s ease',
        '&:hover': {
          borderColor: `${color}60`,
          boxShadow: `0 8px 24px ${color}20`,
          transform: 'translateY(-2px)',
        },
      }}
    >
      <CardContent sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
          <Box>
            <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {title}
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 800, color: '#FFFFFF', fontVariantNumeric: 'tabular-nums', mt: 0.5 }}>
              {value}
            </Typography>
          </Box>
          <Box
            sx={{
              p: 1.25,
              borderRadius: 2,
              backgroundColor: `${color}15`,
              border: `1px solid ${color}35`,
              color: color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {icon}
          </Box>
        </Box>

        {progress !== undefined && (
          <Box sx={{ mb: 1 }}>
            <LinearProgress
              variant="determinate"
              value={Math.min(100, Math.max(0, progress))}
              sx={{
                height: 5,
                borderRadius: 2.5,
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                '& .MuiLinearProgress-bar': {
                  backgroundColor: color,
                  borderRadius: 2.5,
                },
              }}
            />
          </Box>
        )}

        <Typography variant="caption" sx={{ color: '#64748B', fontSize: '0.72rem' }}>
          {subtitle}
        </Typography>

        {/* Subtle accent corner bar */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '2px',
            background: `linear-gradient(90deg, ${color}, transparent 80%)`,
          }}
        />
      </CardContent>
    </Card>
  );
}

/* ───────────────────────────────────────────────────────────
   Main Component: AuditLogsPage
─────────────────────────────────────────────────────────── */
function AuditLogsPage() {
  const [activeTab, setActiveTab] = useState(0); // 0 = Audit Logs, 1 = Security Alerts
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedLog, setSelectedLog] = useState(null);
  const [copiedPayload, setCopiedPayload] = useState(false);

  // 1. Fetch Audit KPI Statistics
  const { data: statsData, refetch: refetchStats } = useQuery({
    queryKey: ['audit-stats'],
    queryFn: async () => {
      const res = await api.get('/api/audit-logs/stats');
      return res.data;
    },
    refetchInterval: autoRefresh ? 10000 : false,
  });

  // 2. Fetch Paginated Audit Logs
  const {
    data: logsData,
    isLoading: isLoadingLogs,
    isFetching: isFetchingLogs,
    refetch: refetchLogs,
  } = useQuery({
    queryKey: ['audit-logs', page, rowsPerPage, categoryFilter, statusFilter, searchQuery],
    queryFn: async () => {
      const params = {
        skip: page * rowsPerPage,
        limit: rowsPerPage,
      };
      if (categoryFilter !== 'ALL') params.category = categoryFilter;
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (searchQuery.trim()) params.search = searchQuery.trim();
      const res = await api.get('/api/audit-logs', { params });
      return res.data;
    },
    refetchInterval: autoRefresh ? 10000 : false,
  });

  // 3. Fetch Security Incidents Feed
  const {
    data: securityData,
    isLoading: isLoadingSecurity,
    refetch: refetchSecurity,
  } = useQuery({
    queryKey: ['security-events'],
    queryFn: async () => {
      const res = await api.get('/api/audit-logs/security-events?limit=50');
      return res.data;
    },
    refetchInterval: autoRefresh ? 10000 : false,
  });

  const logs = logsData?.logs || [];
  const totalLogs = logsData?.total || 0;
  const securityEvents = securityData?.events || [];
  const totalSecurityEvents = securityData?.total || 0;

  const handleManualRefresh = () => {
    refetchStats();
    refetchLogs();
    refetchSecurity();
  };

  const handleCopyJson = (payload) => {
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopiedPayload(true);
    setTimeout(() => setCopiedPayload(false), 2000);
  };

  // Export filtered logs to CSV
  const handleExportCsv = () => {
    if (!logs.length) return;
    const headers = ['Log ID', 'Timestamp', 'Action', 'Status', 'User', 'Report ID', 'Details'];
    const rows = logs.map((l) => [
      l.log_id,
      l.created_at,
      l.action,
      l.status,
      l.username || 'System',
      l.report_id || '',
      JSON.stringify(l.details || {}).replace(/"/g, '""'),
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.map((val) => `"${val}"`).join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `audit_trail_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export filtered logs to JSON
  const handleExportJson = () => {
    if (!logs.length) return;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(logs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `audit_logs_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const categories = [
    { key: 'ALL', label: 'All Operations' },
    { key: 'AUTH', label: 'Authentication & Access' },
    { key: 'FILES', label: 'File Ingest & Deletes' },
    { key: 'PIPELINE', label: 'AI Processing' },
    { key: 'USERS', label: 'User Admin' },
    { key: 'SECURITY', label: 'Security & Warnings' },
    { key: 'BATCHES', label: 'Batch Processing' },
  ];

  return (
    <Box sx={{ pb: 6 }}>
      {/* ── 1. Hero Header & Live Bar ── */}
      <Box
        sx={{
          mb: 3.5,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', md: 'flex-end' },
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.75 }}>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 800,
                background: 'linear-gradient(135deg, #00D4FF 0%, #00E676 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                letterSpacing: '-0.02em',
              }}
            >
              Audit & Compliance Operations Center
            </Typography>
            <Chip
              label="Forensic Audit Trail v2.4"
              size="small"
              sx={{
                height: 22,
                fontSize: '0.65rem',
                fontWeight: 600,
                backgroundColor: 'rgba(0, 212, 255, 0.1)',
                color: '#00D4FF',
                border: '1px solid rgba(0, 212, 255, 0.3)',
              }}
            />
          </Box>
          <Typography variant="body2" sx={{ color: '#94A3B8', maxWidth: 750 }}>
            Tamper-evident activity logging, RBAC operation records, malware quarantine alerts, and ISO 27001 compliance audit trails.
          </Typography>
        </Box>

        {/* Header Action Controls */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          {/* Live Polling Switch */}
          <FormControlLabel
            control={
              <Switch
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                size="small"
                sx={{
                  '& .MuiSwitch-switchBase.Mui-checked': {
                    color: '#00E676',
                  },
                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                    backgroundColor: '#00E676',
                  },
                }}
              />
            }
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Box
                  sx={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    backgroundColor: autoRefresh ? '#00E676' : '#64748B',
                    boxShadow: autoRefresh ? '0 0 8px #00E676' : 'none',
                    animation: autoRefresh ? 'pulse 2s infinite' : 'none',
                  }}
                />
                <Typography variant="caption" sx={{ color: autoRefresh ? '#E2E8F0' : '#64748B', fontWeight: 600 }}>
                  Live Poll (10s)
                </Typography>
              </Box>
            }
          />

          {/* Refresh Button */}
          <Tooltip title="Refresh log feed now" arrow>
            <IconButton
              size="small"
              onClick={handleManualRefresh}
              disabled={isFetchingLogs}
              sx={{
                color: '#00D4FF',
                backgroundColor: 'rgba(0, 212, 255, 0.08)',
                border: '1px solid rgba(0, 212, 255, 0.25)',
                p: 0.9,
                borderRadius: 2,
                '&:hover': { backgroundColor: 'rgba(0, 212, 255, 0.18)' },
              }}
            >
              <Refresh sx={{ fontSize: 18, animation: isFetchingLogs ? 'spin 1s linear infinite' : 'none' }} />
            </IconButton>
          </Tooltip>

          {/* Export CSV */}
          <Button
            size="small"
            variant="outlined"
            startIcon={<FileDownload sx={{ fontSize: 16 }} />}
            onClick={handleExportCsv}
            disabled={!logs.length}
            sx={{
              color: '#00E676',
              borderColor: 'rgba(0, 230, 118, 0.35)',
              backgroundColor: 'rgba(0, 230, 118, 0.06)',
              fontSize: '0.78rem',
              fontWeight: 600,
              borderRadius: 2,
              px: 1.5,
              py: 0.75,
              '&:hover': {
                borderColor: '#00E676',
                backgroundColor: 'rgba(0, 230, 118, 0.15)',
              },
            }}
          >
            Export CSV
          </Button>

          {/* Export JSON */}
          <Button
            size="small"
            variant="outlined"
            startIcon={<Code sx={{ fontSize: 16 }} />}
            onClick={handleExportJson}
            disabled={!logs.length}
            sx={{
              color: '#7C4DFF',
              borderColor: 'rgba(124, 77, 255, 0.35)',
              backgroundColor: 'rgba(124, 77, 255, 0.06)',
              fontSize: '0.78rem',
              fontWeight: 600,
              borderRadius: 2,
              px: 1.5,
              py: 0.75,
              '&:hover': {
                borderColor: '#7C4DFF',
                backgroundColor: 'rgba(124, 77, 255, 0.15)',
              },
            }}
          >
            Export JSON
          </Button>
        </Box>
      </Box>

      {/* ── 2. Top 4 Cyber KPI Metric Cards ── */}
      <Grid container spacing={2.5} sx={{ mb: 3.5 }}>
        <Grid item xs={12} sm={6} md={3}>
          <AuditStatCard
            title="Total System Events"
            value={statsData?.total_logs ?? '—'}
            subtitle={`${statsData?.activity_today ?? 0} operations in last 24h`}
            icon={<Security sx={{ fontSize: 22 }} />}
            color="#00D4FF"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <AuditStatCard
            title="Operational Success Rate"
            value={statsData ? `${statsData.success_rate}%` : '—'}
            subtitle={`${statsData?.success_count ?? 0} completed successfully`}
            icon={<CheckCircle sx={{ fontSize: 22 }} />}
            color="#00E676"
            progress={statsData?.success_rate ?? 100}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <AuditStatCard
            title="Security Alerts & Failures"
            value={statsData?.security_alerts_count ?? '—'}
            subtitle={`${statsData?.failed_count ?? 0} rejected / failed executions`}
            icon={<Warning sx={{ fontSize: 22 }} />}
            color="#FF1744"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <AuditStatCard
            title="Tracked Active Operators"
            value={statsData?.distinct_operators ?? '—'}
            subtitle="Verified system and auditor accounts"
            icon={<Lan sx={{ fontSize: 22 }} />}
            color="#7C4DFF"
          />
        </Grid>
      </Grid>

      {/* ── 3. Tabs Navigation: Audit Log Registry vs Security Incidents ── */}
      <Box sx={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(_, newVal) => setActiveTab(newVal)}
          textColor="inherit"
          TabIndicatorProps={{
            style: { backgroundColor: activeTab === 0 ? '#00D4FF' : '#FF1744', height: 3, borderRadius: 3 },
          }}
          sx={{
            minHeight: 44,
            '& .MuiTab-root': {
              minHeight: 44,
              fontSize: '0.85rem',
              fontWeight: 700,
              textTransform: 'none',
              color: '#94A3B8',
              px: 2.5,
              '&.Mui-selected': {
                color: activeTab === 0 ? '#00D4FF' : '#FF1744',
              },
            },
          }}
        >
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Shield sx={{ fontSize: 16 }} />
                <span>Forensic Activity Audit Trail</span>
                <Chip
                  label={totalLogs}
                  size="small"
                  sx={{
                    height: 18,
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    bgcolor: 'rgba(0, 212, 255, 0.15)',
                    color: '#00D4FF',
                  }}
                />
              </Box>
            }
          />
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Warning sx={{ fontSize: 16 }} />
                <span>Security Alert Incidents</span>
                <Chip
                  label={totalSecurityEvents}
                  size="small"
                  sx={{
                    height: 18,
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    bgcolor: 'rgba(255, 23, 68, 0.15)',
                    color: '#FF1744',
                  }}
                />
              </Box>
            }
          />
        </Tabs>
      </Box>

      {activeTab === 0 ? (
        /* ── TAB 1: ALL AUDIT LOGS ── */
        <Box>
          {/* Controls: Search & Category Filter Pills */}
          <Card
            sx={{
              mb: 3,
              backgroundColor: 'rgba(13, 21, 39, 0.7)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 2.5,
            }}
          >
            <CardContent sx={{ p: 2 }}>
              <Grid container spacing={2} alignItems="center">
                {/* Search input */}
                <Grid item xs={12} md={5}>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Search by action, user, filename, IP, or details..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setPage(0);
                    }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Search sx={{ color: '#00D4FF', fontSize: 20 }} />
                        </InputAdornment>
                      ),
                      endAdornment: searchQuery ? (
                        <InputAdornment position="end">
                          <IconButton size="small" onClick={() => setSearchQuery('')}>
                            <Clear sx={{ fontSize: 16, color: '#94A3B8' }} />
                          </IconButton>
                        </InputAdornment>
                      ) : null,
                      sx: {
                        borderRadius: 2,
                        backgroundColor: 'rgba(0, 0, 0, 0.3)',
                        fontSize: '0.85rem',
                        '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.1)' },
                        '&:hover fieldset': { borderColor: 'rgba(0, 212, 255, 0.4)' },
                        '&.Mui-focused fieldset': { borderColor: '#00D4FF' },
                      },
                    }}
                  />
                </Grid>

                {/* Status Toggle (All / Success / Failed) */}
                <Grid item xs={12} md={7}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: { xs: 'flex-start', md: 'flex-end' }, gap: 1, flexWrap: 'wrap' }}>
                    <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 600 }}>
                      Status:
                    </Typography>
                    {[
                      { key: 'ALL', label: 'All Statuses' },
                      { key: 'SUCCESS', label: 'Success Only' },
                      { key: 'FAILED', label: 'Failures Only' },
                    ].map((st) => {
                      const isActive = statusFilter === st.key;
                      return (
                        <Chip
                          key={st.key}
                          label={st.label}
                          size="small"
                          onClick={() => {
                            setStatusFilter(st.key);
                            setPage(0);
                          }}
                          sx={{
                            cursor: 'pointer',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            backgroundColor: isActive
                              ? st.key === 'FAILED'
                                ? 'rgba(255, 23, 68, 0.2)'
                                : 'rgba(0, 212, 255, 0.2)'
                              : 'rgba(255, 255, 255, 0.03)',
                            color: isActive
                              ? st.key === 'FAILED'
                                ? '#FF1744'
                                : '#00D4FF'
                              : '#94A3B8',
                            border: isActive
                              ? `1px solid ${st.key === 'FAILED' ? '#FF1744' : '#00D4FF'}`
                              : '1px solid rgba(255, 255, 255, 0.06)',
                          }}
                        />
                      );
                    })}
                  </Box>
                </Grid>

                {/* Category Pills */}
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
                    <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600, mr: 0.5 }}>
                      Category:
                    </Typography>
                    {categories.map((cat) => {
                      const isActive = categoryFilter === cat.key;
                      return (
                        <Chip
                          key={cat.key}
                          label={cat.label}
                          size="small"
                          onClick={() => {
                            setCategoryFilter(cat.key);
                            setPage(0);
                          }}
                          sx={{
                            cursor: 'pointer',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            borderRadius: 1.5,
                            backgroundColor: isActive ? 'rgba(0, 212, 255, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                            color: isActive ? '#00D4FF' : '#94A3B8',
                            border: isActive ? '1px solid rgba(0, 212, 255, 0.4)' : '1px solid rgba(255, 255, 255, 0.05)',
                            '&:hover': {
                              backgroundColor: 'rgba(0, 212, 255, 0.08)',
                              color: '#F1F5F9',
                            },
                          }}
                        />
                      );
                    })}
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Interactive Logs Table */}
          <Card
            sx={{
              backgroundColor: 'rgba(13, 21, 39, 0.7)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 3,
              overflow: 'hidden',
            }}
          >
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}>
                    <TableCell sx={{ color: '#94A3B8', fontWeight: 700, fontSize: '0.72rem', py: 1.5, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                      ACTION & EVENT
                    </TableCell>
                    <TableCell sx={{ color: '#94A3B8', fontWeight: 700, fontSize: '0.72rem', py: 1.5, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                      OPERATOR / ACTOR
                    </TableCell>
                    <TableCell sx={{ color: '#94A3B8', fontWeight: 700, fontSize: '0.72rem', py: 1.5, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                      STATUS
                    </TableCell>
                    <TableCell sx={{ color: '#94A3B8', fontWeight: 700, fontSize: '0.72rem', py: 1.5, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                      RESOURCE / DETAILS
                    </TableCell>
                    <TableCell sx={{ color: '#94A3B8', fontWeight: 700, fontSize: '0.72rem', py: 1.5, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                      TIMESTAMP
                    </TableCell>
                    <TableCell align="right" sx={{ color: '#94A3B8', fontWeight: 700, fontSize: '0.72rem', py: 1.5, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                      FORENSICS
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {isLoadingLogs ? (
                    <TableRow>
                      <TableCell colSpan={6} sx={{ py: 8, textAlign: 'center' }}>
                        <CircularProgress size={36} sx={{ color: '#00D4FF', mb: 2 }} />
                        <Typography variant="body2" sx={{ color: '#94A3B8' }}>
                          Loading forensic audit logs...
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} sx={{ py: 8, textAlign: 'center' }}>
                        <Security sx={{ fontSize: 44, color: '#64748B', mb: 1.5 }} />
                        <Typography variant="subtitle1" fontWeight={700} sx={{ color: '#E2E8F0', mb: 0.5 }}>
                          No audit events found
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#94A3B8' }}>
                          Try clearing search filters or selecting another action category.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((log) => {
                      const cfg = getActionConfig(log.action);
                      const isSuccess = log.status === 'SUCCESS';
                      const ipAddress = log.details?.ip_address || log.details?.ip || '—';
                      const resourceName =
                        log.details?.filename ||
                        log.details?.resource ||
                        log.details?.name ||
                        log.details?.created_username ||
                        log.details?.target_username ||
                        (log.report_id ? `Report: ${log.report_id.substring(0, 8)}...` : null);

                      return (
                        <TableRow
                          key={log.log_id}
                          hover
                          onClick={() => setSelectedLog(log)}
                          sx={{
                            cursor: 'pointer',
                            '&:hover': {
                              backgroundColor: 'rgba(0, 212, 255, 0.04)',
                            },
                            borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                          }}
                        >
                          {/* Action with Icon */}
                          <TableCell sx={{ py: 1.5 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Box
                                sx={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 0.75,
                                  px: 1,
                                  py: 0.4,
                                  borderRadius: 1.5,
                                  backgroundColor: cfg.bg,
                                  border: `1px solid ${cfg.border}`,
                                  color: cfg.color,
                                  fontWeight: 700,
                                  fontSize: '0.72rem',
                                }}
                              >
                                {cfg.icon}
                                <span>{cfg.label}</span>
                              </Box>
                            </Box>
                          </TableCell>

                          {/* Operator */}
                          <TableCell sx={{ py: 1.5 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Avatar
                                sx={{
                                  width: 24,
                                  height: 24,
                                  fontSize: '0.7rem',
                                  fontWeight: 700,
                                  bgcolor: log.username === 'admin' ? 'rgba(0, 212, 255, 0.2)' : 'rgba(124, 77, 255, 0.2)',
                                  color: log.username === 'admin' ? '#00D4FF' : '#7C4DFF',
                                  border: '1px solid rgba(255, 255, 255, 0.1)',
                                }}
                              >
                                {(log.username || 'S')[0].toUpperCase()}
                              </Avatar>
                              <Typography variant="body2" sx={{ fontWeight: 600, color: '#F1F5F9', fontSize: '0.8rem' }}>
                                {log.username || 'System Service'}
                              </Typography>
                            </Box>
                          </TableCell>

                          {/* Status */}
                          <TableCell sx={{ py: 1.5 }}>
                            <Chip
                              icon={isSuccess ? <CheckCircle sx={{ fontSize: '13px !important' }} /> : <Warning sx={{ fontSize: '13px !important' }} />}
                              label={log.status}
                              size="small"
                              sx={{
                                height: 22,
                                fontWeight: 700,
                                fontSize: '0.68rem',
                                backgroundColor: isSuccess ? 'rgba(0, 230, 118, 0.1)' : 'rgba(255, 23, 68, 0.12)',
                                color: isSuccess ? '#00E676' : '#FF1744',
                                border: `1px solid ${isSuccess ? 'rgba(0, 230, 118, 0.3)' : 'rgba(255, 23, 68, 0.35)'}`,
                              }}
                            />
                          </TableCell>

                          {/* Resource / Details Preview */}
                          <TableCell sx={{ py: 1.5, maxWidth: 320 }}>
                            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                              {resourceName ? (
                                <Typography
                                  variant="body2"
                                  noWrap
                                  sx={{ color: '#E2E8F0', fontWeight: 600, fontSize: '0.78rem' }}
                                >
                                  {resourceName}
                                </Typography>
                              ) : null}
                              <Typography
                                variant="caption"
                                noWrap
                                sx={{
                                  color: '#64748B',
                                  fontFamily: 'monospace',
                                  fontSize: '0.72rem',
                                }}
                              >
                                {ipAddress !== '—' ? `IP: ${ipAddress} • ` : ''}
                                {log.details?.reason || JSON.stringify(log.details || {}).substring(0, 65)}
                              </Typography>
                            </Box>
                          </TableCell>

                          {/* Timestamp */}
                          <TableCell sx={{ py: 1.5 }}>
                            <Tooltip title={new Date(log.created_at).toUTCString()} arrow>
                              <Box>
                                <Typography variant="body2" sx={{ color: '#E2E8F0', fontSize: '0.78rem', fontWeight: 600 }}>
                                  {formatRelativeTime(log.created_at)}
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#64748B', fontSize: '0.68rem' }}>
                                  {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                </Typography>
                              </Box>
                            </Tooltip>
                          </TableCell>

                          {/* Action Button */}
                          <TableCell align="right" sx={{ py: 1.5 }}>
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<Visibility sx={{ fontSize: 13 }} />}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedLog(log);
                              }}
                              sx={{
                                color: '#00D4FF',
                                borderColor: 'rgba(0, 212, 255, 0.3)',
                                bgcolor: 'rgba(0, 212, 255, 0.05)',
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                py: 0.3,
                                px: 1,
                                borderRadius: 1.5,
                                '&:hover': {
                                  bgcolor: 'rgba(0, 212, 255, 0.15)',
                                  borderColor: '#00D4FF',
                                },
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

            {/* Pagination */}
            <TablePagination
              component="div"
              count={totalLogs}
              page={page}
              onPageChange={(_, newPage) => setPage(newPage)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
              rowsPerPageOptions={[10, 25, 50, 100]}
              sx={{
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                color: '#94A3B8',
                '& .MuiTablePagination-select': {
                  color: '#FFFFFF',
                },
                '& .MuiTablePagination-actions': {
                  color: '#00D4FF',
                },
              }}
            />
          </Card>
        </Box>
      ) : (
        /* ── TAB 2: SECURITY ALERTS & INCIDENTS ── */
        <Box>
          <Card
            sx={{
              backgroundColor: 'rgba(13, 21, 39, 0.7)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 3,
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                <Warning sx={{ color: '#FF1744', fontSize: 24 }} />
                <Box>
                  <Typography variant="h6" fontWeight={700} sx={{ color: '#F1F5F9', fontSize: '1rem' }}>
                    Forensic Security Incidents Feed
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#94A3B8' }}>
                    High-severity alerts, unauthorized API access attempts, malware detections, and failed logins.
                  </Typography>
                </Box>
              </Box>

              {isLoadingSecurity ? (
                <Box sx={{ py: 6, textAlign: 'center' }}>
                  <CircularProgress size={32} sx={{ color: '#FF1744' }} />
                </Box>
              ) : securityEvents.length === 0 ? (
                <Box sx={{ py: 6, textAlign: 'center' }}>
                  <CheckCircle sx={{ fontSize: 44, color: '#00E676', mb: 1.5 }} />
                  <Typography variant="subtitle1" fontWeight={700} sx={{ color: '#E2E8F0' }}>
                    Zero Security Incidents Detected
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#94A3B8' }}>
                    All perimeter defenses, access controls, and malware scans are operating nominally.
                  </Typography>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {securityEvents.map((ev) => {
                    const isCrit = ev.severity === 'CRITICAL';
                    const isHigh = ev.severity === 'HIGH';
                    const sevColor = isCrit ? '#FF1744' : isHigh ? '#FF9100' : '#00D4FF';

                    return (
                      <Box
                        key={ev.event_id}
                        sx={{
                          p: 2,
                          borderRadius: 2,
                          backgroundColor: 'rgba(255, 255, 255, 0.02)',
                          border: `1px solid ${sevColor}35`,
                          display: 'flex',
                          flexDirection: { xs: 'column', md: 'row' },
                          justifyContent: 'space-between',
                          alignItems: { xs: 'flex-start', md: 'center' },
                          gap: 1.5,
                          transition: 'all 0.2s',
                          '&:hover': {
                            backgroundColor: `${sevColor}08`,
                            borderColor: `${sevColor}70`,
                          },
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                          <Chip
                            label={ev.severity}
                            size="small"
                            sx={{
                              height: 22,
                              fontWeight: 800,
                              fontSize: '0.65rem',
                              backgroundColor: `${sevColor}20`,
                              color: sevColor,
                              border: `1px solid ${sevColor}`,
                            }}
                          />
                          <Box>
                            <Typography variant="body2" fontWeight={700} sx={{ color: '#F1F5F9', fontSize: '0.85rem' }}>
                              {ev.event_type}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block', mt: 0.25 }}>
                              {ev.description || 'Automated security alert trigger.'}
                            </Typography>
                            {ev.event_metadata?.source_ip && (
                              <Typography variant="caption" sx={{ color: '#64748B', fontFamily: 'monospace', display: 'block', mt: 0.25 }}>
                                Source IP: {ev.event_metadata.source_ip} • Action: {ev.event_metadata.action_taken || 'BLOCKED'}
                              </Typography>
                            )}
                          </Box>
                        </Box>

                        <Box sx={{ textAlign: { xs: 'left', md: 'right' } }}>
                          <Typography variant="caption" sx={{ color: '#94A3B8', fontVariantNumeric: 'tabular-nums' }}>
                            {new Date(ev.created_at).toLocaleString()}
                          </Typography>
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              )}
            </CardContent>
          </Card>
        </Box>
      )}

      {/* ── 4. Forensic Event Inspector Drawer ── */}
      <Drawer
        anchor="right"
        open={Boolean(selectedLog)}
        onClose={() => setSelectedLog(null)}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: 540 },
            backgroundColor: '#070B12',
            borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
            p: 3,
            boxShadow: '-10px 0 40px rgba(0, 0, 0, 0.7)',
          },
        }}
      >
        {selectedLog && (
          <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Drawer Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Chip
                    label={selectedLog.status}
                    size="small"
                    color={selectedLog.status === 'SUCCESS' ? 'success' : 'error'}
                    sx={{ fontWeight: 800, fontSize: '0.68rem', height: 22 }}
                  />
                  <Typography variant="caption" sx={{ color: '#94A3B8', fontFamily: 'monospace' }}>
                    {selectedLog.log_id}
                  </Typography>
                </Box>
                <Typography variant="h5" fontWeight={800} sx={{ color: '#FFFFFF' }}>
                  {selectedLog.action}
                </Typography>
              </Box>
              <IconButton size="small" onClick={() => setSelectedLog(null)} sx={{ color: '#94A3B8' }}>
                <Close sx={{ fontSize: 20 }} />
              </IconButton>
            </Box>

            <Divider sx={{ mb: 2.5, borderColor: 'rgba(255, 255, 255, 0.08)' }} />

            {/* Event Metadata Cards */}
            <Box sx={{ flexGrow: 1, overflowY: 'auto', pr: 0.5, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              {/* Actor & Execution Context */}
              <Box sx={{ p: 2, borderRadius: 2, backgroundColor: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <Typography variant="caption" sx={{ color: '#00D4FF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', mb: 1.5 }}>
                  Actor & Network Context
                </Typography>
                <Grid container spacing={1.5}>
                  <Grid item xs={6}>
                    <Typography variant="caption" sx={{ color: '#64748B' }}>User / Account:</Typography>
                    <Typography variant="body2" fontWeight={600} sx={{ color: '#F1F5F9' }}>
                      {selectedLog.username || 'System Worker'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" sx={{ color: '#64748B' }}>Client IP Address:</Typography>
                    <Typography variant="body2" sx={{ color: '#00E676', fontFamily: 'monospace' }}>
                      {selectedLog.details?.ip_address || selectedLog.details?.ip || 'Internal / Proxy'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="caption" sx={{ color: '#64748B' }}>Timestamp (UTC):</Typography>
                    <Typography variant="body2" sx={{ color: '#E2E8F0', fontVariantNumeric: 'tabular-nums' }}>
                      {new Date(selectedLog.created_at).toUTCString()}
                    </Typography>
                  </Grid>
                  {selectedLog.report_id && (
                    <Grid item xs={12}>
                      <Typography variant="caption" sx={{ color: '#64748B' }}>Associated Report ID:</Typography>
                      <Typography variant="body2" sx={{ color: '#00D4FF', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                        {selectedLog.report_id}
                      </Typography>
                    </Grid>
                  )}
                </Grid>
              </Box>

              {/* Raw Forensic Payload */}
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="caption" sx={{ color: '#00D4FF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Forensic Payload (JSON)
                  </Typography>
                  <Button
                    size="small"
                    startIcon={copiedPayload ? <Check sx={{ fontSize: 14 }} /> : <ContentCopy sx={{ fontSize: 14 }} />}
                    onClick={() => handleCopyJson(selectedLog.details)}
                    sx={{
                      color: copiedPayload ? '#00E676' : '#94A3B8',
                      fontSize: '0.7rem',
                      textTransform: 'none',
                      py: 0.2,
                    }}
                  >
                    {copiedPayload ? 'Copied' : 'Copy JSON'}
                  </Button>
                </Box>

                <Box
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    backgroundColor: '#030712',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    fontFamily: 'monospace',
                    fontSize: '0.78rem',
                    color: '#00E676',
                    overflowX: 'auto',
                    maxHeight: 280,
                  }}
                >
                  <pre style={{ margin: 0 }}>
                    {JSON.stringify(selectedLog.details || {}, null, 2)}
                  </pre>
                </Box>
              </Box>
            </Box>

            {/* Drawer Footer */}
            <Box sx={{ pt: 2, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <Button
                fullWidth
                variant="outlined"
                onClick={() => setSelectedLog(null)}
                sx={{
                  color: '#94A3B8',
                  borderColor: 'rgba(255, 255, 255, 0.15)',
                  borderRadius: 2,
                }}
              >
                Close Inspector
              </Button>
            </Box>
          </Box>
        )}
      </Drawer>
    </Box>
  );
}

export default AuditLogsPage;
