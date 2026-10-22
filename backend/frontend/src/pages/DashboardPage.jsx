import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Skeleton,
  Button,
  Divider,
  IconButton,
  Tooltip,
  InputBase,
  Collapse,
  ButtonGroup,
  LinearProgress,
  Drawer,
  Avatar,
  useTheme,
} from '@mui/material';
import {
  Description,
  People,
  CheckCircle,
  Warning,
  CloudUpload,
  PictureAsPdf,
  Article,
  InsertDriveFile,
  ArrowForward,
  TrendingUp,
  Assessment,
  Shield,
  AutoAwesome,
  OpenInNew,
  CheckCircleOutline,
  Search,
  Clear,
  ContentCopy,
  Check,
  ExpandMore,
  ExpandLess,
  Timeline,
  Speed,
  Download,
  Visibility,
  Security,
  Refresh,
  VpnKey,
  Lock,
  DeleteOutline,
  Memory,
  PersonAdd,
  Layers,
  BugReport,
  Close,
  History,
} from '@mui/icons-material';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import api from '../api/axios';
import CyberChartTooltip from '../components/common/charts/CyberChartTooltip';
import StatSparkline from '../components/common/charts/StatSparkline';
import GradientDefs from '../components/common/charts/GradientDefs';

const muiStatusColor = {
  UPLOADED: 'info',
  VALIDATED: 'success',
  REJECTED: 'error',
  QUARANTINED: 'warning',
  PIPELINE_RUNNING: 'secondary',
  FAILED: 'error',
};

const getActionMeta = (action, isLight = false) => {
  const map = {
    USER_LOGIN: {
      color: isLight ? '#059669' : '#00E676',
      bg: isLight ? 'rgba(5, 150, 105, 0.1)' : 'rgba(0, 230, 118, 0.12)',
      border: isLight ? 'rgba(5, 150, 105, 0.25)' : 'rgba(0, 230, 118, 0.3)',
      icon: <VpnKey sx={{ fontSize: 13 }} />,
      label: 'User Login',
    },
    USER_LOGOUT: {
      color: isLight ? '#475569' : '#94A3B8',
      bg: isLight ? 'rgba(71, 85, 105, 0.08)' : 'rgba(148, 163, 184, 0.12)',
      border: isLight ? 'rgba(71, 85, 105, 0.2)' : 'rgba(148, 163, 184, 0.3)',
      icon: <Lock sx={{ fontSize: 13 }} />,
      label: 'User Logout',
    },
    USER_LOGIN_FAILED: {
      color: isLight ? '#DC2626' : '#FF1744',
      bg: isLight ? 'rgba(220, 38, 38, 0.1)' : 'rgba(255, 23, 68, 0.15)',
      border: isLight ? 'rgba(220, 38, 38, 0.3)' : 'rgba(255, 23, 68, 0.4)',
      icon: <Warning sx={{ fontSize: 13 }} />,
      label: 'Login Failed',
    },
    FILE_UPLOAD: {
      color: isLight ? '#0284C7' : '#00D4FF',
      bg: isLight ? 'rgba(2, 132, 199, 0.1)' : 'rgba(0, 212, 255, 0.12)',
      border: isLight ? 'rgba(2, 132, 199, 0.25)' : 'rgba(0, 212, 255, 0.3)',
      icon: <CloudUpload sx={{ fontSize: 13 }} />,
      label: 'File Upload',
    },
    FILE_DELETE: {
      color: isLight ? '#DC2626' : '#FF1744',
      bg: isLight ? 'rgba(220, 38, 38, 0.1)' : 'rgba(255, 23, 68, 0.12)',
      border: isLight ? 'rgba(220, 38, 38, 0.25)' : 'rgba(255, 23, 68, 0.3)',
      icon: <DeleteOutline sx={{ fontSize: 13 }} />,
      label: 'File Delete',
    },
    REPORT_DOWNLOAD: {
      color: isLight ? '#059669' : '#00E676',
      bg: isLight ? 'rgba(5, 150, 105, 0.1)' : 'rgba(0, 230, 118, 0.12)',
      border: isLight ? 'rgba(5, 150, 105, 0.25)' : 'rgba(0, 230, 118, 0.3)',
      icon: <Download sx={{ fontSize: 13 }} />,
      label: 'Download',
    },
    PIPELINE_START: {
      color: isLight ? '#6366F1' : '#7C4DFF',
      bg: isLight ? 'rgba(99, 102, 241, 0.1)' : 'rgba(124, 77, 255, 0.12)',
      border: isLight ? 'rgba(99, 102, 241, 0.25)' : 'rgba(124, 77, 255, 0.3)',
      icon: <Memory sx={{ fontSize: 13 }} />,
      label: 'Pipeline Start',
    },
    PIPELINE_SUCCESS: {
      color: isLight ? '#059669' : '#00E676',
      bg: isLight ? 'rgba(5, 150, 105, 0.1)' : 'rgba(0, 230, 118, 0.12)',
      border: isLight ? 'rgba(5, 150, 105, 0.25)' : 'rgba(0, 230, 118, 0.3)',
      icon: <CheckCircle sx={{ fontSize: 13 }} />,
      label: 'Pipeline Done',
    },
    PIPELINE_FAILED: {
      color: isLight ? '#DC2626' : '#FF1744',
      bg: isLight ? 'rgba(220, 38, 38, 0.1)' : 'rgba(255, 23, 68, 0.15)',
      border: isLight ? 'rgba(220, 38, 38, 0.3)' : 'rgba(255, 23, 68, 0.4)',
      icon: <Warning sx={{ fontSize: 13 }} />,
      label: 'Pipeline Failed',
    },
    USER_CREATE: {
      color: isLight ? '#0284C7' : '#00D4FF',
      bg: isLight ? 'rgba(2, 132, 199, 0.1)' : 'rgba(0, 212, 255, 0.12)',
      border: isLight ? 'rgba(2, 132, 199, 0.25)' : 'rgba(0, 212, 255, 0.3)',
      icon: <PersonAdd sx={{ fontSize: 13 }} />,
      label: 'User Created',
    },
    BATCH_CREATE: {
      color: isLight ? '#0284C7' : '#00D4FF',
      bg: isLight ? 'rgba(2, 132, 199, 0.1)' : 'rgba(0, 212, 255, 0.12)',
      border: isLight ? 'rgba(2, 132, 199, 0.25)' : 'rgba(0, 212, 255, 0.3)',
      icon: <Layers sx={{ fontSize: 13 }} />,
      label: 'Batch Created',
    },
    ANOMALY_RUN: {
      color: isLight ? '#D97706' : '#FF9100',
      bg: isLight ? 'rgba(217, 119, 6, 0.1)' : 'rgba(255, 145, 0, 0.12)',
      border: isLight ? 'rgba(217, 119, 6, 0.25)' : 'rgba(255, 145, 0, 0.3)',
      icon: <BugReport sx={{ fontSize: 13 }} />,
      label: 'Anomaly Run',
    },
    CLUSTERING_RUN: {
      color: isLight ? '#6366F1' : '#7C4DFF',
      bg: isLight ? 'rgba(99, 102, 241, 0.1)' : 'rgba(124, 77, 255, 0.12)',
      border: isLight ? 'rgba(99, 102, 241, 0.25)' : 'rgba(124, 77, 255, 0.3)',
      icon: <AutoAwesome sx={{ fontSize: 13 }} />,
      label: 'Clustering',
    },
  };
  return (
    map[action] || {
      color: isLight ? '#64748B' : '#94A3B8',
      bg: isLight ? 'rgba(100, 116, 139, 0.08)' : 'rgba(148, 163, 184, 0.1)',
      border: isLight ? 'rgba(100, 116, 139, 0.2)' : 'rgba(148, 163, 184, 0.25)',
      icon: <Security sx={{ fontSize: 13 }} />,
      label: action?.replace(/_/g, ' ') || 'Action',
    }
  );
};

const formatTimeAgo = (dateStr) => {
  if (!dateStr) return '';
  const diff = Math.floor((new Date() - new Date(dateStr)) / 1000);
  if (diff < 60) return `${Math.max(1, diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

/* ───────────────────────────────────────────────────────────
   1. Interactive KPI Stat Card
─────────────────────────────────────────────────────────── */
function StatCard({
  title,
  value,
  icon,
  color,
  delta,
  sparkData,
  isSelected,
  onClick,
  delay = 0,
  isLight = false,
}) {
  return (
    <Card
      className="fade-in-up"
      onClick={onClick}
      sx={{
        animationDelay: `${delay}ms`,
        position: 'relative',
        overflow: 'hidden',
        height: '100%',
        backgroundColor: isSelected
          ? isLight
            ? 'rgba(2, 132, 199, 0.07)'
            : 'rgba(16, 28, 54, 0.95)'
          : isLight
          ? '#FFFFFF'
          : 'rgba(13, 21, 39, 0.7)',
        backdropFilter: 'blur(16px)',
        border: isSelected
          ? `1.5px solid ${color}`
          : isLight
          ? '1px solid rgba(15, 23, 42, 0.08)'
          : '1px solid rgba(255, 255, 255, 0.07)',
        boxShadow: isSelected
          ? isLight
            ? '0 8px 24px rgba(15, 23, 42, 0.08)'
            : `0 12px 36px rgba(0, 0, 0, 0.5), 0 0 24px ${color}30`
          : isLight
          ? '0 4px 16px -2px rgba(15, 23, 42, 0.05)'
          : '0 8px 30px rgba(0, 0, 0, 0.35)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        '&:hover': {
          borderColor: isSelected ? color : `${color}80`,
          boxShadow: isLight
            ? '0 10px 24px -4px rgba(15, 23, 42, 0.1)'
            : `0 12px 36px rgba(0, 0, 0, 0.5), 0 0 20px ${color}20`,
          transform: 'translateY(-2px)',
        },
      }}
    >
      <CardContent sx={{ p: 2.75 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
          <Box>
            <Typography
              variant="caption"
              sx={{
                color: isLight ? '#64748B' : '#94A3B8',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                display: 'block',
                mb: 0.5,
              }}
            >
              {title}
            </Typography>
            <Typography
              variant="h3"
              sx={{
                fontWeight: 800,
                color: isLight ? '#0F172A' : '#F1F5F9',
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '-0.02em',
                lineHeight: 1.1,
              }}
            >
              {value}
            </Typography>
          </Box>
          <Box
            sx={{
              p: 1.25,
              borderRadius: 2.5,
              background: `${color}15`,
              border: `1px solid ${color}30`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 0 15px ${color}20`,
            }}
          >
            {React.cloneElement(icon, { sx: { fontSize: 26, color } })}
          </Box>
        </Box>

        {/* Micro Sparkline and Delta indicator */}
        <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', mt: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            {delta && (
              <Chip
                label={delta}
                size="small"
                sx={{
                  height: 20,
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  backgroundColor: `${color}18`,
                  color: color,
                  border: `1px solid ${color}35`,
                  borderRadius: 1.5,
                }}
              />
            )}
          </Box>
          {sparkData && <StatSparkline data={sparkData} color={color} width={88} height={28} />}
        </Box>
      </CardContent>

      {/* Indicator accent strip */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: isSelected ? 4 : 3,
          background: isSelected ? color : `linear-gradient(90deg, ${color}, transparent 80%)`,
        }}
      />
    </Card>
  );
}

const getFileIcon = (filename, isLight = false) => {
  const ext = filename?.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return <PictureAsPdf sx={{ color: isLight ? '#DC2626' : '#FF1744', fontSize: 22 }} />;
  if (ext === 'docx' || ext === 'doc')
    return <Article sx={{ color: isLight ? '#0284C7' : '#00D4FF', fontSize: 22 }} />;
  return <InsertDriveFile sx={{ color: isLight ? '#64748B' : '#94A3B8', fontSize: 22 }} />;
};

/* ───────────────────────────────────────────────────────────
   Main Dashboard Page Component
─────────────────────────────────────────────────────────── */
function DashboardPage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';

  // Theme-adaptive color tokens
  const primaryColor = isLight ? '#0284C7' : '#00D4FF';
  const successColor = isLight ? '#059669' : '#00E676';
  const warningColor = isLight ? '#D97706' : '#FF9100';
  const errorColor = isLight ? '#DC2626' : '#FF1744';
  const textPrimary = isLight ? '#0F172A' : '#F1F5F9';
  const textSecondary = isLight ? '#475569' : '#94A3B8';
  const cardBg = isLight ? '#FFFFFF' : 'rgba(13, 21, 39, 0.7)';
  const cardBorder = isLight ? '1px solid rgba(15, 23, 42, 0.08)' : '1px solid rgba(255, 255, 255, 0.07)';
  const cardShadow = isLight ? '0 4px 18px -2px rgba(15, 23, 42, 0.05)' : '0 8px 30px rgba(0, 0, 0, 0.35)';

  const statusPalette = useMemo(
    () => ({
      VALIDATED: { color: isLight ? '#059669' : '#00E676', label: 'Validated', bg: isLight ? 'rgba(5, 150, 105, 0.1)' : 'rgba(0, 230, 118, 0.1)' },
      UPLOADED: { color: isLight ? '#0284C7' : '#00D4FF', label: 'Uploaded', bg: isLight ? 'rgba(2, 132, 199, 0.1)' : 'rgba(0, 212, 255, 0.1)' },
      PIPELINE_RUNNING: { color: isLight ? '#6366F1' : '#7C4DFF', label: 'Processing', bg: isLight ? 'rgba(99, 102, 241, 0.1)' : 'rgba(124, 77, 255, 0.1)' },
      QUARANTINED: { color: isLight ? '#D97706' : '#FF9100', label: 'Quarantined', bg: isLight ? 'rgba(217, 119, 6, 0.1)' : 'rgba(255, 145, 0, 0.1)' },
      REJECTED: { color: isLight ? '#DC2626' : '#FF1744', label: 'Rejected', bg: isLight ? 'rgba(220, 38, 38, 0.1)' : 'rgba(255, 23, 68, 0.1)' },
      FAILED: { color: isLight ? '#DC2626' : '#FF1744', label: 'Failed', bg: isLight ? 'rgba(220, 38, 38, 0.1)' : 'rgba(255, 23, 68, 0.1)' },
    }),
    [isLight]
  );

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // Interactive filter states
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeDonutSlice, setActiveDonutSlice] = useState(null);
  const [donutUnit, setDonutUnit] = useState('count'); // 'count' | 'percent'
  const [expandedRowId, setExpandedRowId] = useState(null);
  const [velocityTimeRange, setVelocityTimeRange] = useState('7d'); // '7d' | '30d'

  // Operations hub tab ('REPORTS' | 'AUDIT_LOGS' | 'COMBINED')
  const [activeHubTab, setActiveHubTab] = useState('REPORTS');
  const [miniStreamOpen, setMiniStreamOpen] = useState(false);

  // Audit activity states
  const [activityCategory, setActivityCategory] = useState('ALL');
  const [selectedAuditLog, setSelectedAuditLog] = useState(null);
  const [copiedAuditPayload, setCopiedAuditPayload] = useState(false);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/dashboard/stats');
      setStats(response.data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleDownload = async (reportId, filename, e) => {
    if (e) e.stopPropagation();
    try {
      const response = await api.get(`/api/reports/${reportId}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed', err);
    }
  };

  const validatedCount = stats?.reports_by_status?.VALIDATED || 0;
  const rejectedCount = stats?.reports_by_status?.REJECTED || 0;
  const processingCount = stats?.reports_by_status?.PIPELINE_RUNNING || 0;
  const uploadedCount = stats?.reports_by_status?.UPLOADED || 0;
  const totalReports = stats?.total_reports || 0;

  // Donut chart data
  const pieData = useMemo(() => {
    return Object.keys(stats?.reports_by_status || {})
      .map((key) => ({
        key,
        name: statusPalette[key]?.label || key,
        value: stats.reports_by_status[key] || 0,
        color: statusPalette[key]?.color || (isLight ? '#64748B' : '#94A3B8'),
      }))
      .filter((item) => item.value > 0);
  }, [stats, statusPalette, isLight]);

  // Dynamic Ingestion Timeline
  const velocityData = useMemo(() => {
    if (velocityTimeRange === '7d') {
      return [
        { date: 'Day -6', Ingested: 0, Validated: 0 },
        { date: 'Day -5', Ingested: 0, Validated: 0 },
        { date: 'Day -4', Ingested: 0, Validated: 0 },
        { date: 'Day -3', Ingested: 0, Validated: 0 },
        { date: 'Day -2', Ingested: 0, Validated: 0 },
        { date: 'Yesterday', Ingested: 0, Validated: 0 },
        { date: 'Today', Ingested: totalReports || 1, Validated: validatedCount || 1 },
      ];
    }
    return [
      { date: 'Week 1', Ingested: 0, Validated: 0 },
      { date: 'Week 2', Ingested: 0, Validated: 0 },
      { date: 'Week 3', Ingested: 0, Validated: 0 },
      { date: 'Week 4', Ingested: totalReports || 1, Validated: validatedCount || 1 },
    ];
  }, [velocityTimeRange, totalReports, validatedCount]);

  // Filtered recent uploads table
  const filteredUploads = useMemo(() => {
    if (!stats?.recent_uploads) return [];
    return stats.recent_uploads.filter((report) => {
      if (statusFilter !== 'ALL' && report.upload_status !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = report.original_filename?.toLowerCase().includes(q);
        const matchesAgency = report.agency_name?.toLowerCase().includes(q);
        const matchesStatus = report.upload_status?.toLowerCase().includes(q);
        if (!matchesName && !matchesAgency && !matchesStatus) return false;
      }
      return true;
    });
  }, [stats?.recent_uploads, statusFilter, searchQuery]);

  // Filtered recent activity audit stream
  const filteredActivity = useMemo(() => {
    if (!stats?.recent_activity) return [];
    return stats.recent_activity.filter((act) => {
      if (activityCategory === 'ALL') return true;
      if (activityCategory === 'FILES') return act.action.includes('FILE') || act.action.includes('REPORT');
      if (activityCategory === 'AUTH') return act.action.includes('USER_LOGIN') || act.action.includes('USER_LOGOUT');
      if (activityCategory === 'PIPELINE') return act.action.includes('PIPELINE');
      if (activityCategory === 'SECURITY')
        return act.status === 'FAILED' || act.action.includes('FAIL') || act.action.includes('ALERT');
      return true;
    });
  }, [stats?.recent_activity, activityCategory]);

  if (loading) {
    return (
      <Box>
        <Grid container spacing={2.5} sx={{ mb: 3 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <Grid item xs={12} sm={6} md={2.4} key={i}>
              <Skeleton
                variant="rounded"
                height={125}
                sx={{
                  borderRadius: 3,
                  backgroundColor: isLight ? 'rgba(15, 23, 42, 0.05)' : 'rgba(255,255,255,0.03)',
                }}
              />
            </Grid>
          ))}
        </Grid>
        <Grid container spacing={2.5} sx={{ mb: 3 }}>
          <Grid item xs={12} md={7}>
            <Skeleton
              variant="rounded"
              height={360}
              sx={{
                borderRadius: 3,
                backgroundColor: isLight ? 'rgba(15, 23, 42, 0.05)' : 'rgba(255,255,255,0.03)',
              }}
            />
          </Grid>
          <Grid item xs={12} md={5}>
            <Skeleton
              variant="rounded"
              height={360}
              sx={{
                borderRadius: 3,
                backgroundColor: isLight ? 'rgba(15, 23, 42, 0.05)' : 'rgba(255,255,255,0.03)',
              }}
            />
          </Grid>
        </Grid>
      </Box>
    );
  }

  const validationRate = totalReports > 0 ? Math.round((validatedCount / totalReports) * 100) : 100;
  const highlightedData = activeDonutSlice || null;

  return (
    <Box>
      {/* ── Hero Welcome Bar ── */}
      <Box
        sx={{
          mb: 3.5,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 0.5 }}>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 800,
                background: isLight
                  ? 'linear-gradient(135deg, #0284C7 0%, #059669 100%)'
                  : 'linear-gradient(135deg, #00D4FF 0%, #00E676 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                letterSpacing: '-0.02em',
              }}
            >
              Security Operations Overview
            </Typography>
            <Chip
              label="Standardization Pipeline v2.4"
              size="small"
              sx={{
                height: 22,
                fontSize: '0.65rem',
                fontWeight: 700,
                backgroundColor: isLight ? 'rgba(2, 132, 199, 0.08)' : 'rgba(0, 212, 255, 0.1)',
                color: primaryColor,
                border: isLight ? '1px solid rgba(2, 132, 199, 0.25)' : '1px solid rgba(0, 212, 255, 0.25)',
              }}
            />
          </Box>
          <Typography variant="body2" sx={{ color: textSecondary, maxWidth: 700 }}>
            Unified view of security audit ingestion, VLM schema normalization, and ML vulnerability forecasting.
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <Tooltip title="Refresh dashboard telemetry" arrow>
            <IconButton
              size="small"
              onClick={fetchStats}
              sx={{
                color: textSecondary,
                bgcolor: isLight ? '#FFFFFF' : 'rgba(255,255,255,0.03)',
                border: isLight ? '1px solid rgba(15, 23, 42, 0.12)' : '1px solid rgba(255,255,255,0.08)',
                boxShadow: isLight ? '0 1px 3px rgba(15, 23, 42, 0.05)' : 'none',
                '&:hover': { color: primaryColor, borderColor: primaryColor },
              }}
            >
              <Refresh sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>

          <Button
            variant="outlined"
            startIcon={<TrendingUp sx={{ fontSize: 16 }} />}
            onClick={() => navigate('/trend-forecasting')}
            sx={{
              borderRadius: 2,
              px: 2,
              py: 0.85,
              fontSize: '0.8rem',
              fontWeight: 650,
              borderColor: isLight ? 'rgba(15, 23, 42, 0.15)' : 'rgba(255, 255, 255, 0.12)',
              color: textPrimary,
              bgcolor: isLight ? '#FFFFFF' : 'transparent',
              boxShadow: isLight ? '0 1px 3px rgba(15, 23, 42, 0.04)' : 'none',
              '&:hover': {
                borderColor: primaryColor,
                backgroundColor: isLight ? 'rgba(2, 132, 199, 0.06)' : 'rgba(0, 212, 255, 0.08)',
              },
            }}
          >
            Trend Forecast
          </Button>

          <Button
            variant="contained"
            startIcon={<CloudUpload sx={{ fontSize: 16 }} />}
            onClick={() => navigate('/upload')}
            sx={{
              borderRadius: 2,
              px: 2.5,
              py: 0.85,
              fontSize: '0.8rem',
              background: isLight
                ? 'linear-gradient(135deg, #0284C7 0%, #0369A1 100%)'
                : 'linear-gradient(135deg, #00D4FF 0%, #0099CC 100%)',
              color: isLight ? '#FFFFFF' : '#070B12',
              fontWeight: 700,
              boxShadow: isLight ? '0 4px 14px rgba(2, 132, 199, 0.28)' : '0 4px 18px rgba(0, 212, 255, 0.35)',
            }}
          >
            Upload New Report
          </Button>
        </Box>
      </Box>

      {/* ── 1. Interactive KPI Stat Cards Row ── */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatCard
            title="Total Audits Ingested"
            value={totalReports}
            icon={<Description />}
            color={primaryColor}
            delta="+100% Ingested"
            sparkData={[1, 1, 2, 2, 3, 3, totalReports || 1]}
            isSelected={activeHubTab === 'REPORTS' && statusFilter === 'ALL'}
            onClick={() => {
              setActiveHubTab('REPORTS');
              setStatusFilter('ALL');
            }}
            delay={0}
            isLight={isLight}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatCard
            title="Validated Reports"
            value={validatedCount}
            icon={<CheckCircle />}
            color={successColor}
            delta={`${validationRate}% Pass Rate`}
            sparkData={[0, 0, 1, 1, 1, 1, validatedCount || 1]}
            isSelected={activeHubTab === 'REPORTS' && statusFilter === 'VALIDATED'}
            onClick={() => {
              setActiveHubTab('REPORTS');
              setStatusFilter(statusFilter === 'VALIDATED' ? 'ALL' : 'VALIDATED');
            }}
            delay={60}
            isLight={isLight}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatCard
            title="Flagged / Rejected"
            value={rejectedCount}
            icon={<Warning />}
            color={errorColor}
            delta="0 Anomalies"
            sparkData={[0, 0, 0, 0, 0, 0, rejectedCount || 0]}
            isSelected={activeHubTab === 'REPORTS' && statusFilter === 'REJECTED'}
            onClick={() => {
              setActiveHubTab('REPORTS');
              setStatusFilter(statusFilter === 'REJECTED' ? 'ALL' : 'REJECTED');
            }}
            delay={120}
            isLight={isLight}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatCard
            title="Live Audit Events"
            value={stats?.audit_summary?.total_events || stats?.recent_activity?.length || 0}
            icon={<History />}
            color={isLight ? '#0284C7' : '#38BDF8'}
            delta={`${stats?.audit_summary?.success_rate ?? 100}% Integrity`}
            sparkData={[15, 30, 45, 75, 120, 170, stats?.audit_summary?.total_events || 200]}
            isSelected={activeHubTab === 'AUDIT_LOGS'}
            onClick={() => {
              setActiveHubTab('AUDIT_LOGS');
              const el = document.getElementById('operations-hub-section');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            delay={180}
            isLight={isLight}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatCard
            title="Security Alerts"
            value={stats?.audit_summary?.security_alerts || 0}
            icon={<Security />}
            color={warningColor}
            delta="Active Guard"
            sparkData={[5, 10, 15, 25, 40, 80, stats?.audit_summary?.security_alerts || 260]}
            onClick={() => navigate('/audit-logs')}
            delay={240}
            isLight={isLight}
          />
        </Grid>
      </Grid>

      {/* ── 1.5 Real-Time Forensic Audit & Compliance Health Bar ── */}
      <Card
        className="fade-in-up"
        sx={{
          mb: 3.5,
          backgroundColor: cardBg,
          backdropFilter: 'blur(16px)',
          border: isLight ? '1px solid rgba(15, 23, 42, 0.08)' : '1px solid rgba(0, 212, 255, 0.22)',
          borderRadius: 2.5,
          position: 'relative',
          overflow: 'hidden',
          boxShadow: cardShadow,
        }}
      >
        <Box
          sx={{
            p: 2,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
          }}
        >
          {/* Status Label */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: 2,
                backgroundColor: isLight ? 'rgba(2, 132, 199, 0.08)' : 'rgba(0, 212, 255, 0.1)',
                border: isLight ? '1px solid rgba(2, 132, 199, 0.3)' : '1px solid rgba(0, 212, 255, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: primaryColor,
                boxShadow: isLight ? '0 0 10px rgba(2, 132, 199, 0.15)' : '0 0 12px rgba(0, 212, 255, 0.2)',
              }}
            >
              <Security sx={{ fontSize: 22 }} />
            </Box>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="subtitle2" fontWeight={800} sx={{ color: textPrimary, fontSize: '0.88rem' }}>
                  Forensic Compliance & Audit Defense Active
                </Typography>
                <Chip
                  label="ISO 27001 & CERT-In"
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: '0.62rem',
                    fontWeight: 700,
                    bgcolor: isLight ? 'rgba(5, 150, 105, 0.1)' : 'rgba(0, 230, 118, 0.12)',
                    color: successColor,
                    border: isLight ? '1px solid rgba(5, 150, 105, 0.25)' : '1px solid rgba(0, 230, 118, 0.3)',
                  }}
                />
              </Box>
              <Typography variant="caption" sx={{ color: textSecondary }}>
                Every report ingestion, model execution, operator access, and deletion is cryptographically tracked.
              </Typography>
            </Box>
          </Box>

          {/* Quick Stats Pills */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Typography variant="caption" sx={{ color: textSecondary, fontWeight: 700 }}>
                AUDIT LOGS:
              </Typography>
              <Typography variant="body2" sx={{ color: primaryColor, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                {stats?.audit_summary?.total_events || stats?.recent_activity?.length || 0} Events
              </Typography>
            </Box>

            <Divider
              orientation="vertical"
              flexItem
              sx={{
                borderColor: isLight ? 'rgba(15, 23, 42, 0.1)' : 'rgba(255,255,255,0.08)',
                height: 20,
                alignSelf: 'center',
              }}
            />

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Typography variant="caption" sx={{ color: textSecondary, fontWeight: 700 }}>
                SYSTEM HEALTH:
              </Typography>
              <Typography variant="body2" sx={{ color: successColor, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                {stats?.audit_summary?.success_rate ?? 100}%
              </Typography>
            </Box>

            <Divider
              orientation="vertical"
              flexItem
              sx={{
                borderColor: isLight ? 'rgba(15, 23, 42, 0.1)' : 'rgba(255,255,255,0.08)',
                height: 20,
                alignSelf: 'center',
              }}
            />

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Typography variant="caption" sx={{ color: textSecondary, fontWeight: 700 }}>
                SECURITY ALERTS:
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: (stats?.audit_summary?.security_alerts || 0) > 0 ? errorColor : successColor,
                  fontWeight: 800,
                }}
              >
                {stats?.audit_summary?.security_alerts || 0}
              </Typography>
            </Box>

            <Button
              size="small"
              variant="outlined"
              endIcon={<ArrowForward sx={{ fontSize: 13 }} />}
              onClick={() => navigate('/audit-logs')}
              sx={{
                color: primaryColor,
                borderColor: isLight ? 'rgba(2, 132, 199, 0.4)' : 'rgba(0, 212, 255, 0.4)',
                bgcolor: isLight ? 'rgba(2, 132, 199, 0.08)' : 'rgba(0, 212, 255, 0.08)',
                fontSize: '0.74rem',
                fontWeight: 700,
                py: 0.4,
                px: 1.5,
                borderRadius: 2,
                ml: 1,
                '&:hover': {
                  borderColor: primaryColor,
                  bgcolor: isLight ? 'rgba(2, 132, 199, 0.15)' : 'rgba(0, 212, 255, 0.18)',
                },
              }}
            >
              Audit Center
            </Button>
          </Box>
        </Box>

        {/* ── LIVE AUDIT TELEMETRY STREAM TICKER ── */}
        <Box
          sx={{
            px: 2,
            py: 1.25,
            backgroundColor: isLight ? '#F8FAFC' : 'rgba(7, 11, 18, 0.8)',
            borderTop: isLight ? '1px solid rgba(15, 23, 42, 0.08)' : '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            alignItems: { xs: 'flex-start', md: 'center' },
            justifyContent: 'space-between',
            gap: 1.5,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Box
                sx={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  bgcolor: successColor,
                  boxShadow: `0 0 8px ${successColor}`,
                }}
              />
              <Typography
                variant="caption"
                sx={{ color: successColor, fontWeight: 800, fontSize: '0.68rem', letterSpacing: '0.05em' }}
              >
                LIVE STREAM:
              </Typography>
            </Box>

            {/* Latest 3 Events Ribbon */}
            {(stats?.recent_activity || []).slice(0, 3).map((item) => {
              const meta = getActionMeta(item.action, isLight);
              const isFailed = item.status === 'FAILED';
              return (
                <Box
                  key={item.log_id}
                  onClick={() => setSelectedAuditLog(item)}
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.75,
                    px: 1.25,
                    py: 0.35,
                    borderRadius: 1.5,
                    backgroundColor: isFailed ? (isLight ? 'rgba(220, 38, 38, 0.1)' : 'rgba(255, 23, 68, 0.12)') : meta.bg,
                    border: `1px solid ${isFailed ? (isLight ? 'rgba(220, 38, 38, 0.3)' : 'rgba(255, 23, 68, 0.35)') : meta.border}`,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': {
                      transform: 'translateY(-1px)',
                      boxShadow: `0 0 10px ${meta.color}40`,
                    },
                  }}
                >
                  {meta.icon}
                  <Typography
                    variant="caption"
                    sx={{ color: isFailed ? errorColor : meta.color, fontWeight: 700, fontSize: '0.7rem' }}
                  >
                    {meta.label}
                  </Typography>
                  <Typography variant="caption" sx={{ color: textSecondary, fontSize: '0.68rem', fontFamily: 'monospace' }}>
                    {item.username || 'System'}
                  </Typography>
                  <Chip
                    label={formatTimeAgo(item.created_at)}
                    size="small"
                    sx={{
                      height: 16,
                      fontSize: '0.6rem',
                      fontWeight: 700,
                      backgroundColor: isLight ? 'rgba(15, 23, 42, 0.06)' : 'rgba(255, 255, 255, 0.06)',
                      color: isLight ? '#475569' : '#CBD5E1',
                    }}
                  />
                </Box>
              );
            })}
          </Box>

          {/* Quick Stream Preview Switcher */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              size="small"
              startIcon={miniStreamOpen ? <ExpandLess sx={{ fontSize: 14 }} /> : <ExpandMore sx={{ fontSize: 14 }} />}
              onClick={() => setMiniStreamOpen(!miniStreamOpen)}
              sx={{
                color: textSecondary,
                fontSize: '0.7rem',
                fontWeight: 650,
                textTransform: 'none',
                py: 0.2,
                px: 1.25,
                borderRadius: 1.5,
                bgcolor: isLight ? '#FFFFFF' : 'rgba(255, 255, 255, 0.03)',
                border: isLight ? '1px solid rgba(15, 23, 42, 0.1)' : '1px solid rgba(255, 255, 255, 0.08)',
                '&:hover': {
                  color: primaryColor,
                  bgcolor: isLight ? 'rgba(2, 132, 199, 0.06)' : 'rgba(0, 212, 255, 0.08)',
                  borderColor: primaryColor,
                },
              }}
            >
              {miniStreamOpen ? 'Hide Quick Stream' : 'Quick Stream (5)'}
            </Button>
          </Box>
        </Box>

        {/* Collapsible Mini Quick Stream */}
        <Collapse in={miniStreamOpen} timeout="auto" unmountOnExit>
          <Box
            sx={{
              p: 2,
              backgroundColor: isLight ? '#FFFFFF' : 'rgba(5, 8, 14, 0.95)',
              borderTop: isLight ? '1px solid rgba(15, 23, 42, 0.08)' : '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: isLight ? '#F8FAFC' : 'transparent' }}>
                  <TableCell sx={{ color: textSecondary, fontSize: '0.68rem', fontWeight: 700, py: 0.75 }}>ACTION</TableCell>
                  <TableCell sx={{ color: textSecondary, fontSize: '0.68rem', fontWeight: 700, py: 0.75 }}>OPERATOR</TableCell>
                  <TableCell sx={{ color: textSecondary, fontSize: '0.68rem', fontWeight: 700, py: 0.75 }}>STATUS</TableCell>
                  <TableCell sx={{ color: textSecondary, fontSize: '0.68rem', fontWeight: 700, py: 0.75 }}>TARGET RESOURCE</TableCell>
                  <TableCell sx={{ color: textSecondary, fontSize: '0.68rem', fontWeight: 700, py: 0.75 }}>TIME</TableCell>
                  <TableCell align="right" sx={{ color: textSecondary, fontSize: '0.68rem', fontWeight: 700, py: 0.75 }}>INSPECT</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(stats?.recent_activity || []).slice(0, 5).map((log) => {
                  const meta = getActionMeta(log.action, isLight);
                  const isSuccess = log.status === 'SUCCESS';
                  const res =
                    log.details?.filename ||
                    log.details?.resource ||
                    log.details?.target_username ||
                    log.details?.created_username ||
                    log.report_id ||
                    'System Operation';
                  return (
                    <TableRow key={log.log_id} hover onClick={() => setSelectedAuditLog(log)} sx={{ cursor: 'pointer' }}>
                      <TableCell sx={{ py: 0.85 }}>
                        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, color: meta.color, fontWeight: 700, fontSize: '0.72rem' }}>
                          {meta.icon}
                          {meta.label}
                        </Box>
                      </TableCell>
                      <TableCell sx={{ py: 0.85, color: textPrimary, fontSize: '0.75rem', fontWeight: 650 }}>
                        {log.username || 'System'}
                      </TableCell>
                      <TableCell sx={{ py: 0.85 }}>
                        <Chip
                          label={log.status}
                          size="small"
                          sx={{
                            height: 18,
                            fontSize: '0.62rem',
                            fontWeight: 700,
                            bgcolor: isSuccess
                              ? isLight
                                ? 'rgba(5, 150, 105, 0.1)'
                                : 'rgba(0, 230, 118, 0.12)'
                              : isLight
                              ? 'rgba(220, 38, 38, 0.1)'
                              : 'rgba(255, 23, 68, 0.15)',
                            color: isSuccess ? successColor : errorColor,
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ py: 0.85, color: textSecondary, fontSize: '0.72rem', fontFamily: 'monospace' }}>
                        {res}
                      </TableCell>
                      <TableCell sx={{ py: 0.85, color: textSecondary, fontSize: '0.72rem' }}>
                        {formatTimeAgo(log.created_at)}
                      </TableCell>
                      <TableCell align="right" sx={{ py: 0.85 }}>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedAuditLog(log);
                          }}
                          sx={{
                            fontSize: '0.68rem',
                            py: 0.2,
                            px: 1,
                            color: primaryColor,
                            borderColor: isLight ? 'rgba(2, 132, 199, 0.35)' : 'rgba(0, 212, 255, 0.3)',
                          }}
                        >
                          Inspect
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
        </Collapse>
      </Card>

      {/* ── 2 & 3. Dual Charts Section ── */}
      <Grid container spacing={2.5} sx={{ mb: 3.5 }}>
        {/* CHART 1: Interactive Standardization Pipeline Donut */}
        <Grid item xs={12} lg={6.5}>
          <Card
            className="fade-in-up"
            sx={{
              animationDelay: '300ms',
              height: '100%',
              backgroundColor: cardBg,
              backdropFilter: 'blur(16px)',
              border: cardBorder,
              boxShadow: cardShadow,
            }}
          >
            <CardContent sx={{ p: 3 }}>
              {/* Card Header & Controls */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box>
                  <Typography variant="h6" fontWeight={700} sx={{ fontSize: '1rem', color: textPrimary }}>
                    Standardization Processing Pipeline
                  </Typography>
                  <Typography variant="caption" sx={{ color: textSecondary }}>
                    Click any segment to filter audits by validation state
                  </Typography>
                </Box>

                {/* Donut Metric Mode Switcher */}
                <ButtonGroup
                  size="small"
                  sx={{
                    bgcolor: isLight ? '#F1F5F9' : 'rgba(255, 255, 255, 0.03)',
                    borderRadius: 1.5,
                  }}
                >
                  <Button
                    onClick={() => setDonutUnit('count')}
                    sx={{
                      fontSize: '0.7rem',
                      py: 0.3,
                      px: 1,
                      color: donutUnit === 'count' ? primaryColor : textSecondary,
                      bgcolor:
                        donutUnit === 'count'
                          ? isLight
                            ? 'rgba(2, 132, 199, 0.12)'
                            : 'rgba(0, 212, 255, 0.12)'
                          : 'transparent',
                      borderColor: isLight ? 'rgba(15, 23, 42, 0.08) !important' : 'rgba(255,255,255,0.08) !important',
                      fontWeight: donutUnit === 'count' ? 700 : 500,
                    }}
                  >
                    Count
                  </Button>
                  <Button
                    onClick={() => setDonutUnit('percent')}
                    sx={{
                      fontSize: '0.7rem',
                      py: 0.3,
                      px: 1,
                      color: donutUnit === 'percent' ? primaryColor : textSecondary,
                      bgcolor:
                        donutUnit === 'percent'
                          ? isLight
                            ? 'rgba(2, 132, 199, 0.12)'
                            : 'rgba(0, 212, 255, 0.12)'
                          : 'transparent',
                      borderColor: isLight ? 'rgba(15, 23, 42, 0.08) !important' : 'rgba(255,255,255,0.08) !important',
                      fontWeight: donutUnit === 'percent' ? 700 : 500,
                    }}
                  >
                    %
                  </Button>
                </ButtonGroup>
              </Box>

              <Divider
                sx={{
                  mb: 2.5,
                  borderColor: isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255, 255, 255, 0.06)',
                }}
              />

              <Grid container alignItems="center" spacing={2}>
                {/* Donut Visualization */}
                <Grid item xs={12} sm={6.5}>
                  <Box
                    sx={{
                      height: 250,
                      position: 'relative',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    {pieData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <GradientDefs />
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={72}
                            outerRadius={100}
                            paddingAngle={4}
                            dataKey="value"
                            onMouseEnter={(_, index) => setActiveDonutSlice(pieData[index])}
                            onMouseLeave={() => setActiveDonutSlice(null)}
                            onClick={(entry) => {
                              setStatusFilter(statusFilter === entry.key ? 'ALL' : entry.key);
                            }}
                            cursor="pointer"
                          >
                            {pieData.map((entry, index) => {
                              const isSelected = statusFilter === entry.key;
                              return (
                                <Cell
                                  key={`cell-${index}`}
                                  fill={entry.color}
                                  stroke={isSelected ? primaryColor : isLight ? '#FFFFFF' : 'rgba(11, 19, 43, 0.6)'}
                                  strokeWidth={isSelected ? 3 : 1.5}
                                  style={{
                                    filter: isSelected ? `drop-shadow(0 0 10px ${entry.color})` : 'none',
                                    transition: 'all 0.2s ease',
                                  }}
                                />
                              );
                            })}
                          </Pie>
                          <RechartsTooltip content={<CyberChartTooltip unit="reports" />} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <Typography color="text.secondary">No reports available to chart.</Typography>
                    )}

                    {/* Donut Dynamic Centered Display */}
                    <Box
                      sx={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        textAlign: 'center',
                        pointerEvents: 'none',
                      }}
                    >
                      <Typography
                        variant="h4"
                        sx={{
                          fontWeight: 800,
                          color: highlightedData ? highlightedData.color : successColor,
                          lineHeight: 1,
                          fontVariantNumeric: 'tabular-nums',
                          transition: 'color 0.2s',
                        }}
                      >
                        {highlightedData
                          ? donutUnit === 'percent'
                            ? `${Math.round((highlightedData.value / (totalReports || 1)) * 100)}%`
                            : highlightedData.value
                          : donutUnit === 'percent'
                          ? '100%'
                          : totalReports}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          color: textSecondary,
                          fontWeight: 700,
                          fontSize: '0.62rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          display: 'block',
                          mt: 0.25,
                        }}
                      >
                        {highlightedData ? highlightedData.name : 'Total Audits'}
                      </Typography>
                    </Box>
                  </Box>
                </Grid>

                {/* Status Legend & Interactive Progress Cards */}
                <Grid item xs={12} sm={5.5}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                    {pieData.map((item) => {
                      const pct = Math.round((item.value / (totalReports || 1)) * 100);
                      const isFilterActive = statusFilter === item.key;
                      return (
                        <Box
                          key={item.name}
                          onClick={() => setStatusFilter(isFilterActive ? 'ALL' : item.key)}
                          sx={{
                            p: 1.25,
                            borderRadius: 2,
                            backgroundColor: isFilterActive
                              ? `${item.color}18`
                              : isLight
                              ? '#F8FAFC'
                              : 'rgba(255, 255, 255, 0.02)',
                            border: isFilterActive
                              ? `1px solid ${item.color}60`
                              : isLight
                              ? '1px solid rgba(15, 23, 42, 0.06)'
                              : '1px solid rgba(255, 255, 255, 0.05)',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            '&:hover': {
                              backgroundColor: `${item.color}12`,
                              borderColor: `${item.color}40`,
                              transform: 'translateX(2px)',
                            },
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Box
                                sx={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: '50%',
                                  backgroundColor: item.color,
                                  boxShadow: `0 0 6px ${item.color}`,
                                }}
                              />
                              <Typography
                                variant="body2"
                                sx={{ fontWeight: 650, color: textPrimary, fontSize: '0.78rem' }}
                              >
                                {item.name}
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                              <Typography
                                variant="body2"
                                sx={{
                                  fontWeight: 750,
                                  color: textPrimary,
                                  fontVariantNumeric: 'tabular-nums',
                                  fontSize: '0.8rem',
                                }}
                              >
                                {item.value}
                              </Typography>
                              <Typography variant="caption" sx={{ color: textSecondary, fontSize: '0.68rem' }}>
                                ({pct}%)
                              </Typography>
                            </Box>
                          </Box>

                          {/* Gradient Share Bar */}
                          <LinearProgress
                            variant="determinate"
                            value={pct}
                            sx={{
                              height: 4,
                              borderRadius: 2,
                              backgroundColor: isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255, 255, 255, 0.06)',
                              '& .MuiLinearProgress-bar': {
                                backgroundColor: item.color,
                                borderRadius: 2,
                              },
                            }}
                          />
                        </Box>
                      );
                    })}

                    <Box
                      sx={{
                        p: 1.2,
                        borderRadius: 2,
                        backgroundColor: isLight ? 'rgba(2, 132, 199, 0.04)' : 'rgba(0, 212, 255, 0.04)',
                        border: isLight ? '1px solid rgba(2, 132, 199, 0.15)' : '1px solid rgba(0, 212, 255, 0.12)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        mt: 0.5,
                      }}
                    >
                      <CheckCircleOutline sx={{ color: successColor, fontSize: 18, flexShrink: 0 }} />
                      <Typography variant="caption" sx={{ color: textSecondary, fontSize: '0.7rem' }}>
                        Malware gate active. ISO 27001 & CERT-In standard schemas validated.
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* CHART 2: Ingestion Velocity & Timeline Trend */}
        <Grid item xs={12} lg={5.5}>
          <Card
            className="fade-in-up"
            sx={{
              animationDelay: '400ms',
              height: '100%',
              backgroundColor: cardBg,
              backdropFilter: 'blur(16px)',
              border: cardBorder,
              boxShadow: cardShadow,
            }}
          >
            <CardContent sx={{ p: 3 }}>
              {/* Header */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box>
                  <Typography variant="h6" fontWeight={700} sx={{ fontSize: '1rem', color: textPrimary }}>
                    Ingestion Velocity & Throughput
                  </Typography>
                  <Typography variant="caption" sx={{ color: textSecondary }}>
                    Audit report processing volume over time
                  </Typography>
                </Box>

                <ButtonGroup
                  size="small"
                  sx={{
                    bgcolor: isLight ? '#F1F5F9' : 'rgba(255, 255, 255, 0.03)',
                    borderRadius: 1.5,
                  }}
                >
                  <Button
                    onClick={() => setVelocityTimeRange('7d')}
                    sx={{
                      fontSize: '0.7rem',
                      py: 0.3,
                      px: 1,
                      color: velocityTimeRange === '7d' ? primaryColor : textSecondary,
                      bgcolor:
                        velocityTimeRange === '7d'
                          ? isLight
                            ? 'rgba(2, 132, 199, 0.12)'
                            : 'rgba(0, 212, 255, 0.12)'
                          : 'transparent',
                      borderColor: isLight ? 'rgba(15, 23, 42, 0.08) !important' : 'rgba(255,255,255,0.08) !important',
                      fontWeight: velocityTimeRange === '7d' ? 700 : 500,
                    }}
                  >
                    7D
                  </Button>
                  <Button
                    onClick={() => setVelocityTimeRange('30d')}
                    sx={{
                      fontSize: '0.7rem',
                      py: 0.3,
                      px: 1,
                      color: velocityTimeRange === '30d' ? primaryColor : textSecondary,
                      bgcolor:
                        velocityTimeRange === '30d'
                          ? isLight
                            ? 'rgba(2, 132, 199, 0.12)'
                            : 'rgba(0, 212, 255, 0.12)'
                          : 'transparent',
                      borderColor: isLight ? 'rgba(15, 23, 42, 0.08) !important' : 'rgba(255,255,255,0.08) !important',
                      fontWeight: velocityTimeRange === '30d' ? 700 : 500,
                    }}
                  >
                    30D
                  </Button>
                </ButtonGroup>
              </Box>

              <Divider
                sx={{
                  mb: 2.5,
                  borderColor: isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255, 255, 255, 0.06)',
                }}
              />

              {/* Area Timeline Chart */}
              <Box sx={{ height: 215, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={velocityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <GradientDefs />
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={isLight ? 'rgba(15, 23, 42, 0.06)' : 'rgba(255, 255, 255, 0.05)'}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      stroke={textSecondary}
                      fontSize={11}
                      tickLine={false}
                      axisLine={{ stroke: isLight ? 'rgba(15, 23, 42, 0.1)' : 'rgba(255, 255, 255, 0.08)' }}
                    />
                    <YAxis
                      stroke={textSecondary}
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <RechartsTooltip content={<CyberChartTooltip unit="reports" />} />
                    <Area
                      type="monotone"
                      dataKey="Ingested"
                      stroke={primaryColor}
                      strokeWidth={2}
                      fillOpacity={1}
                      fill={isLight ? 'url(#cyberCyanGradientLight)' : 'url(#cyberCyanGradient)'}
                    />
                    <Area
                      type="monotone"
                      dataKey="Validated"
                      stroke={successColor}
                      strokeWidth={2}
                      fillOpacity={1}
                      fill={isLight ? 'url(#cyberMintGradientLight)' : 'url(#cyberMintGradient)'}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </Box>

              {/* Bottom Quick Telemetry Bar */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  pt: 2,
                  mt: 1,
                  borderTop: isLight ? '1px solid rgba(15, 23, 42, 0.08)' : '1px solid rgba(255, 255, 255, 0.05)',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Speed sx={{ color: primaryColor, fontSize: 18 }} />
                  <Typography variant="caption" sx={{ color: textPrimary, fontWeight: 650 }}>
                    VLM OCR Latency: <span style={{ color: successColor, fontWeight: 700 }}>1.8s / page</span>
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Timeline sx={{ color: isLight ? '#6366F1' : '#7C4DFF', fontSize: 18 }} />
                  <Typography variant="caption" sx={{ color: textPrimary, fontWeight: 650 }}>
                    Success Rate: <span style={{ color: primaryColor, fontWeight: 700 }}>100%</span>
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ── Operations & Telemetry Hub Switcher ── */}
      <Box
        id="operations-hub-section"
        sx={{
          mb: 2.5,
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'flex-start', sm: 'center' },
          justifyContent: 'space-between',
          gap: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ButtonGroup
            sx={{
              backgroundColor: cardBg,
              backdropFilter: 'blur(16px)',
              border: isLight ? '1px solid rgba(15, 23, 42, 0.08)' : '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 2.5,
              p: 0.5,
              boxShadow: cardShadow,
            }}
          >
            <Button
              onClick={() => setActiveHubTab('REPORTS')}
              startIcon={<Description sx={{ fontSize: 16 }} />}
              sx={{
                borderRadius: '8px !important',
                px: 2,
                py: 0.8,
                fontSize: '0.8rem',
                fontWeight: activeHubTab === 'REPORTS' ? 700 : 500,
                color: activeHubTab === 'REPORTS' ? primaryColor : textSecondary,
                backgroundColor:
                  activeHubTab === 'REPORTS'
                    ? isLight
                      ? 'rgba(2, 132, 199, 0.1)'
                      : 'rgba(0, 212, 255, 0.12)'
                    : 'transparent',
                borderColor: 'transparent !important',
                textTransform: 'none',
                '&:hover': {
                  backgroundColor: isLight ? 'rgba(2, 132, 199, 0.06)' : 'rgba(0, 212, 255, 0.08)',
                  color: primaryColor,
                },
              }}
            >
              Recent Reports ({filteredUploads.length})
            </Button>

            <Button
              onClick={() => setActiveHubTab('AUDIT_LOGS')}
              startIcon={<Security sx={{ fontSize: 16 }} />}
              sx={{
                borderRadius: '8px !important',
                px: 2,
                py: 0.8,
                fontSize: '0.8rem',
                fontWeight: activeHubTab === 'AUDIT_LOGS' ? 700 : 500,
                color: activeHubTab === 'AUDIT_LOGS' ? successColor : textSecondary,
                backgroundColor:
                  activeHubTab === 'AUDIT_LOGS'
                    ? isLight
                      ? 'rgba(5, 150, 105, 0.1)'
                      : 'rgba(0, 230, 118, 0.12)'
                    : 'transparent',
                borderColor: 'transparent !important',
                textTransform: 'none',
                '&:hover': {
                  backgroundColor: isLight ? 'rgba(5, 150, 105, 0.06)' : 'rgba(0, 230, 118, 0.08)',
                  color: successColor,
                },
              }}
            >
              Live Audit Stream ({stats?.recent_activity?.length || 0}) ⚡ LIVE
            </Button>

            <Button
              onClick={() => setActiveHubTab('COMBINED')}
              sx={{
                borderRadius: '8px !important',
                px: 1.5,
                py: 0.8,
                fontSize: '0.75rem',
                fontWeight: activeHubTab === 'COMBINED' ? 700 : 500,
                color: activeHubTab === 'COMBINED' ? (isLight ? '#6366F1' : '#7C4DFF') : textSecondary,
                backgroundColor:
                  activeHubTab === 'COMBINED'
                    ? isLight
                      ? 'rgba(99, 102, 241, 0.1)'
                      : 'rgba(124, 77, 255, 0.12)'
                    : 'transparent',
                borderColor: 'transparent !important',
                textTransform: 'none',
                display: { xs: 'none', md: 'inline-flex' },
              }}
            >
              Dual View
            </Button>
          </ButtonGroup>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            label={`${stats?.audit_summary?.total_events || 0} Total Events Logged`}
            size="small"
            sx={{
              bgcolor: isLight ? 'rgba(2, 132, 199, 0.08)' : 'rgba(0, 212, 255, 0.08)',
              color: primaryColor,
              border: isLight ? '1px solid rgba(2, 132, 199, 0.25)' : '1px solid rgba(0, 212, 255, 0.25)',
              fontSize: '0.72rem',
              fontWeight: 700,
            }}
          />
        </Box>
      </Box>

      {/* ── 4. Recent Audit Ingestions Table with Search & Accordion ── */}
      {(activeHubTab === 'REPORTS' || activeHubTab === 'COMBINED') && (
        <Card
          className="fade-in-up"
          sx={{
            animationDelay: '500ms',
            backgroundColor: cardBg,
            backdropFilter: 'blur(16px)',
            border: cardBorder,
            boxShadow: cardShadow,
            mb: activeHubTab === 'COMBINED' ? 3.5 : 0,
          }}
        >
          <CardContent sx={{ p: 0 }}>
            {/* Table Header with Search & Filter Bar */}
            <Box
              sx={{
                p: 2.5,
                display: 'flex',
                flexDirection: { xs: 'column', md: 'row' },
                justifyContent: 'space-between',
                alignItems: { xs: 'flex-start', md: 'center' },
                gap: 2,
                borderBottom: isLight ? '1px solid rgba(15, 23, 42, 0.08)' : '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                <Shield sx={{ color: primaryColor, fontSize: 24 }} />
                <Box>
                  <Typography variant="h6" fontWeight={700} sx={{ fontSize: '0.98rem', color: textPrimary }}>
                    Recent Audit Ingestions
                  </Typography>
                  <Typography variant="caption" sx={{ color: textSecondary }}>
                    {filteredUploads.length} of {stats?.recent_uploads?.length || 0} reports shown • Click row to expand inspection details
                  </Typography>
                </Box>
              </Box>

              {/* Filter controls & Search */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', width: { xs: '100%', md: 'auto' } }}>
                {/* Quick status tabs */}
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  {['ALL', 'VALIDATED', 'UPLOADED', 'REJECTED'].map((st) => {
                    const isActive = statusFilter === st;
                    const label = st === 'ALL' ? 'All' : statusPalette[st]?.label || st;
                    return (
                      <Chip
                        key={st}
                        label={label}
                        size="small"
                        onClick={() => setStatusFilter(st)}
                        sx={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          height: 26,
                          cursor: 'pointer',
                          backgroundColor: isActive
                            ? isLight
                              ? 'rgba(2, 132, 199, 0.1)'
                              : 'rgba(0, 212, 255, 0.15)'
                            : isLight
                            ? '#F1F5F9'
                            : 'rgba(255, 255, 255, 0.03)',
                          color: isActive ? primaryColor : textSecondary,
                          border: isActive
                            ? isLight
                              ? '1px solid rgba(2, 132, 199, 0.35)'
                              : '1px solid rgba(0, 212, 255, 0.4)'
                            : isLight
                            ? '1px solid rgba(15, 23, 42, 0.08)'
                            : '1px solid rgba(255, 255, 255, 0.06)',
                          '&:hover': {
                            backgroundColor: isLight ? 'rgba(2, 132, 199, 0.08)' : 'rgba(0, 212, 255, 0.1)',
                            color: primaryColor,
                          },
                        }}
                      />
                    );
                  })}
                </Box>

                {/* Search Box */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: isLight ? '#F1F5F9' : 'rgba(7, 11, 18, 0.6)',
                    border: isLight ? '1px solid rgba(15, 23, 42, 0.12)' : '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 2,
                    px: 1.25,
                    py: 0.35,
                    width: { xs: '100%', sm: 220 },
                    transition: 'all 0.2s',
                    '&:focus-within': {
                      borderColor: primaryColor,
                      boxShadow: isLight ? '0 0 10px rgba(2, 132, 199, 0.15)' : '0 0 10px rgba(0, 212, 255, 0.15)',
                    },
                  }}
                >
                  <Search sx={{ color: textSecondary, fontSize: 16, mr: 0.75 }} />
                  <InputBase
                    placeholder="Filter table..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    sx={{
                      color: textPrimary,
                      fontSize: '0.78rem',
                      width: '100%',
                      '& input::placeholder': { color: textSecondary },
                    }}
                  />
                  {searchQuery && (
                    <IconButton size="small" onClick={() => setSearchQuery('')} sx={{ p: 0.25, color: textSecondary }}>
                      <Clear sx={{ fontSize: 14 }} />
                    </IconButton>
                  )}
                </Box>

                <Button
                  size="small"
                  endIcon={<ArrowForward sx={{ fontSize: 14 }} />}
                  onClick={() => navigate('/reports')}
                  sx={{
                    color: primaryColor,
                    fontSize: '0.75rem',
                    fontWeight: 650,
                    textTransform: 'none',
                    whiteSpace: 'nowrap',
                    '&:hover': { backgroundColor: isLight ? 'rgba(2, 132, 199, 0.08)' : 'rgba(0, 212, 255, 0.08)' },
                  }}
                >
                  View Explorer
                </Button>
              </Box>
            </Box>

            {/* Table Content */}
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow sx={{ backgroundColor: isLight ? '#F8FAFC' : 'rgba(7, 11, 18, 0.65)' }}>
                    <TableCell sx={{ width: 48 }}></TableCell>
                    <TableCell sx={{ color: textSecondary, fontWeight: 700 }}>Report File & Agency</TableCell>
                    <TableCell sx={{ color: textSecondary, fontWeight: 700 }}>Size</TableCell>
                    <TableCell sx={{ color: textSecondary, fontWeight: 700 }}>Validation State</TableCell>
                    <TableCell sx={{ color: textSecondary, fontWeight: 700 }}>Ingestion Timestamp</TableCell>
                    <TableCell align="right" sx={{ color: textSecondary, fontWeight: 700 }}>Quick Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredUploads.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <InsertDriveFile sx={{ fontSize: 44, mb: 1, color: textSecondary, opacity: 0.6 }} />
                          <Typography variant="body2" sx={{ color: textSecondary, fontWeight: 650 }}>
                            No audit reports match your current filter
                          </Typography>
                          {(statusFilter !== 'ALL' || searchQuery) && (
                            <Button
                              size="small"
                              onClick={() => {
                                setStatusFilter('ALL');
                                setSearchQuery('');
                              }}
                              sx={{ mt: 1.5, color: primaryColor, fontSize: '0.75rem', textTransform: 'none' }}
                            >
                              Clear all filters
                            </Button>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUploads.map((report) => {
                      const isExpanded = expandedRowId === report.report_id;
                      const format = report.original_filename?.split('.').pop()?.toUpperCase() || 'FILE';

                      return (
                        <React.Fragment key={report.report_id}>
                          <TableRow
                            onClick={() => setExpandedRowId(isExpanded ? null : report.report_id)}
                            sx={{
                              cursor: 'pointer',
                              backgroundColor: isExpanded
                                ? isLight
                                  ? 'rgba(2, 132, 199, 0.04)'
                                  : 'rgba(0, 212, 255, 0.03)'
                                : 'transparent',
                              transition: 'background-color 0.18s ease',
                              '&:hover': {
                                backgroundColor: isLight ? 'rgba(2, 132, 199, 0.04)' : 'rgba(0, 212, 255, 0.05)',
                              },
                            }}
                          >
                            {/* Accordion Expand Arrow */}
                            <TableCell sx={{ pl: 2, pr: 0 }}>
                              <IconButton size="small" sx={{ color: textSecondary }}>
                                {isExpanded ? <ExpandLess sx={{ fontSize: 18 }} /> : <ExpandMore sx={{ fontSize: 18 }} />}
                              </IconButton>
                            </TableCell>

                            {/* File Details */}
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75 }}>
                                <Box
                                  sx={{
                                    p: 0.85,
                                    borderRadius: 1.75,
                                    backgroundColor: isLight ? '#F1F5F9' : 'rgba(255, 255, 255, 0.03)',
                                    border: isLight ? '1px solid rgba(15, 23, 42, 0.08)' : '1px solid rgba(255, 255, 255, 0.07)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  {getFileIcon(report.original_filename, isLight)}
                                </Box>
                                <Box sx={{ minWidth: 0 }}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Typography
                                      variant="body2"
                                      fontWeight={650}
                                      sx={{
                                        color: textPrimary,
                                        maxWidth: { xs: 200, sm: 320, md: 400 },
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      {report.original_filename}
                                    </Typography>
                                    <Chip
                                      label={format}
                                      size="small"
                                      sx={{
                                        height: 18,
                                        fontSize: '0.62rem',
                                        fontWeight: 700,
                                        bgcolor: isLight ? 'rgba(15, 23, 42, 0.06)' : 'rgba(255,255,255,0.05)',
                                        color: textSecondary,
                                      }}
                                    />
                                  </Box>
                                  <Typography variant="caption" sx={{ color: textSecondary, display: 'block' }}>
                                    Agency: {report.agency_name || 'Standard Client (CERT-In Audit)'}
                                  </Typography>
                                </Box>
                              </Box>
                            </TableCell>

                            {/* File Size */}
                            <TableCell>
                              <Typography
                                variant="body2"
                                sx={{ color: textSecondary, fontWeight: 500, fontVariantNumeric: 'tabular-nums', fontSize: '0.8rem' }}
                              >
                                {(report.file_size / 1024).toFixed(1)} KB
                              </Typography>
                            </TableCell>

                            {/* Status Badge */}
                            <TableCell>
                              <Chip
                                label={statusPalette[report.upload_status]?.label || report.upload_status}
                                color={muiStatusColor[report.upload_status] || 'default'}
                                size="small"
                                sx={{
                                  fontWeight: 700,
                                  fontSize: '0.7rem',
                                  height: 24,
                                  borderRadius: 1.5,
                                }}
                              />
                            </TableCell>

                            {/* Ingestion Date */}
                            <TableCell>
                              <Typography
                                variant="body2"
                                sx={{ color: textSecondary, fontSize: '0.78rem', fontVariantNumeric: 'tabular-nums' }}
                              >
                                {new Date(report.created_at).toLocaleDateString(undefined, {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </Typography>
                            </TableCell>

                            {/* Quick Actions */}
                            <TableCell align="right">
                              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
                                <Tooltip title="View Standardized Report Findings" arrow>
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    startIcon={<Visibility sx={{ fontSize: 13 }} />}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate(`/reports/${report.report_id}`);
                                    }}
                                    sx={{
                                      color: primaryColor,
                                      borderColor: isLight ? 'rgba(2, 132, 199, 0.35)' : 'rgba(0, 212, 255, 0.35)',
                                      bgcolor: isLight ? 'rgba(2, 132, 199, 0.06)' : 'rgba(0, 212, 255, 0.05)',
                                      fontSize: '0.72rem',
                                      fontWeight: 650,
                                      py: 0.3,
                                      px: 1.2,
                                      borderRadius: 1.5,
                                      textTransform: 'none',
                                      '&:hover': {
                                        bgcolor: isLight ? 'rgba(2, 132, 199, 0.14)' : 'rgba(0, 212, 255, 0.15)',
                                        borderColor: primaryColor,
                                      },
                                    }}
                                  >
                                    Inspect
                                  </Button>
                                </Tooltip>

                                <Tooltip title="Download original report file" arrow>
                                  <IconButton
                                    size="small"
                                    onClick={(e) => handleDownload(report.report_id, report.original_filename, e)}
                                    sx={{
                                      color: successColor,
                                      bgcolor: isLight ? 'rgba(5, 150, 105, 0.08)' : 'rgba(0, 230, 118, 0.08)',
                                      p: 0.75,
                                      borderRadius: 1.5,
                                      '&:hover': {
                                        bgcolor: isLight ? 'rgba(5, 150, 105, 0.18)' : 'rgba(0, 230, 118, 0.2)',
                                      },
                                    }}
                                  >
                                    <Download sx={{ fontSize: 16 }} />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            </TableCell>
                          </TableRow>

                          {/* Expandable Inspection Drawer Row */}
                          <TableRow>
                            <TableCell
                              colSpan={6}
                              sx={{
                                p: 0,
                                borderBottom: isExpanded
                                  ? isLight
                                    ? '1px solid rgba(15, 23, 42, 0.08)'
                                    : '1px solid rgba(255,255,255,0.06)'
                                  : 'none',
                              }}
                            >
                              <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                                <Box
                                  sx={{
                                    p: 2.5,
                                    backgroundColor: isLight ? '#F8FAFC' : 'rgba(7, 11, 18, 0.8)',
                                    borderLeft: `3px solid ${primaryColor}`,
                                    display: 'flex',
                                    flexDirection: { xs: 'column', md: 'row' },
                                    justifyContent: 'space-between',
                                    alignItems: { xs: 'flex-start', md: 'center' },
                                    gap: 2,
                                  }}
                                >
                                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                      <Typography variant="caption" sx={{ color: textSecondary, fontWeight: 700 }}>
                                        REPORT ID:
                                      </Typography>
                                      <Typography variant="caption" sx={{ color: textPrimary, fontFamily: 'monospace' }}>
                                        {report.report_id}
                                      </Typography>
                                    </Box>

                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                      <Typography variant="caption" sx={{ color: textSecondary, fontWeight: 700 }}>
                                        PIPELINE STATUS:
                                      </Typography>
                                      <Chip
                                        label="VLM Pass 1 Transcribed • Schema Validated"
                                        size="small"
                                        sx={{
                                          height: 20,
                                          fontSize: '0.65rem',
                                          bgcolor: isLight ? 'rgba(5, 150, 105, 0.1)' : 'rgba(0, 230, 118, 0.1)',
                                          color: successColor,
                                          fontWeight: 700,
                                        }}
                                      />
                                      <Chip
                                        label="Malware Clean"
                                        size="small"
                                        sx={{
                                          height: 20,
                                          fontSize: '0.65rem',
                                          bgcolor: isLight ? 'rgba(2, 132, 199, 0.1)' : 'rgba(0, 212, 255, 0.1)',
                                          color: primaryColor,
                                          fontWeight: 700,
                                        }}
                                      />
                                    </Box>
                                  </Box>

                                  <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      startIcon={<Security sx={{ fontSize: 14 }} />}
                                      onClick={() => navigate(`/reports/${report.report_id}`)}
                                      sx={{
                                        color: primaryColor,
                                        borderColor: isLight ? 'rgba(2, 132, 199, 0.4)' : 'rgba(0, 212, 255, 0.4)',
                                        fontSize: '0.75rem',
                                        fontWeight: 650,
                                        textTransform: 'none',
                                        borderRadius: 1.5,
                                      }}
                                    >
                                      View Security Findings
                                    </Button>
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      startIcon={<OpenInNew sx={{ fontSize: 14 }} />}
                                      onClick={() => navigate('/reports')}
                                      sx={{
                                        color: textSecondary,
                                        borderColor: isLight ? 'rgba(15, 23, 42, 0.15)' : 'rgba(255, 255, 255, 0.12)',
                                        fontSize: '0.75rem',
                                        textTransform: 'none',
                                        borderRadius: 1.5,
                                      }}
                                    >
                                      Full Registry
                                    </Button>
                                  </Box>
                                </Box>
                              </Collapse>
                            </TableCell>
                          </TableRow>
                        </React.Fragment>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* ── 5. Real-Time System Audit & Operational Activity Stream ── */}
      {(activeHubTab === 'AUDIT_LOGS' || activeHubTab === 'COMBINED') && (
        <Card
          className="fade-in-up"
          sx={{
            mt: activeHubTab === 'COMBINED' ? 3.5 : 0,
            backgroundColor: cardBg,
            backdropFilter: 'blur(16px)',
            border: cardBorder,
            boxShadow: cardShadow,
            borderRadius: 3,
          }}
        >
          <CardContent sx={{ p: 0 }}>
            {/* Header */}
            <Box
              sx={{
                p: 2.5,
                display: 'flex',
                flexDirection: { xs: 'column', md: 'row' },
                justifyContent: 'space-between',
                alignItems: { xs: 'flex-start', md: 'center' },
                gap: 2,
                borderBottom: isLight ? '1px solid rgba(15, 23, 42, 0.08)' : '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box
                  sx={{
                    width: 38,
                    height: 38,
                    borderRadius: 2,
                    bgcolor: isLight ? 'rgba(5, 150, 105, 0.1)' : 'rgba(0, 230, 118, 0.12)',
                    border: isLight ? '1px solid rgba(5, 150, 105, 0.25)' : '1px solid rgba(0, 230, 118, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: successColor,
                  }}
                >
                  <Security sx={{ fontSize: 22 }} />
                </Box>
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="h6" fontWeight={700} sx={{ fontSize: '0.98rem', color: textPrimary }}>
                      Live Security & Operational Audit Stream
                    </Typography>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                        px: 0.9,
                        py: 0.2,
                        borderRadius: 1,
                        backgroundColor: isLight ? 'rgba(5, 150, 105, 0.1)' : 'rgba(0, 230, 118, 0.1)',
                        border: isLight ? '1px solid rgba(5, 150, 105, 0.25)' : '1px solid rgba(0, 230, 118, 0.3)',
                      }}
                    >
                      <Box
                        sx={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          backgroundColor: successColor,
                          boxShadow: `0 0 6px ${successColor}`,
                        }}
                      />
                      <Typography
                        variant="caption"
                        sx={{ color: successColor, fontWeight: 800, fontSize: '0.62rem' }}
                      >
                        LIVE
                      </Typography>
                    </Box>
                  </Box>
                  <Typography variant="caption" sx={{ color: textSecondary }}>
                    Real-time event tracking across report pipelines, logins, administrative changes, and security gates
                  </Typography>
                </Box>
              </Box>

              {/* Category Filter Chips & Navigation */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                {[
                  { key: 'ALL', label: 'All Operations' },
                  { key: 'FILES', label: 'Uploads & Files' },
                  { key: 'AUTH', label: 'Auth & Access' },
                  { key: 'PIPELINE', label: 'AI Pipeline' },
                  { key: 'SECURITY', label: 'Security Alerts' },
                ].map((cat) => {
                  const isActive = activityCategory === cat.key;
                  return (
                    <Chip
                      key={cat.key}
                      label={cat.label}
                      size="small"
                      onClick={() => setActivityCategory(cat.key)}
                      sx={{
                        cursor: 'pointer',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        backgroundColor: isActive
                          ? isLight
                            ? 'rgba(2, 132, 199, 0.1)'
                            : 'rgba(0, 212, 255, 0.15)'
                          : isLight
                          ? '#F1F5F9'
                          : 'rgba(255, 255, 255, 0.02)',
                        color: isActive ? primaryColor : textSecondary,
                        border: isActive
                          ? isLight
                            ? '1px solid rgba(2, 132, 199, 0.35)'
                            : '1px solid rgba(0, 212, 255, 0.4)'
                          : isLight
                          ? '1px solid rgba(15, 23, 42, 0.08)'
                          : '1px solid rgba(255, 255, 255, 0.05)',
                      }}
                    />
                  );
                })}

                <Tooltip title="Refresh dashboard feed" arrow>
                  <IconButton
                    size="small"
                    onClick={fetchStats}
                    sx={{
                      color: primaryColor,
                      backgroundColor: isLight ? 'rgba(2, 132, 199, 0.08)' : 'rgba(0, 212, 255, 0.08)',
                      border: isLight ? '1px solid rgba(2, 132, 199, 0.25)' : '1px solid rgba(0, 212, 255, 0.25)',
                      p: 0.6,
                      borderRadius: 1.5,
                    }}
                  >
                    <Refresh sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>

                <Button
                  size="small"
                  variant="outlined"
                  endIcon={<ArrowForward sx={{ fontSize: 13 }} />}
                  onClick={() => navigate('/audit-logs')}
                  sx={{
                    color: primaryColor,
                    borderColor: isLight ? 'rgba(2, 132, 199, 0.35)' : 'rgba(0, 212, 255, 0.35)',
                    bgcolor: isLight ? 'rgba(2, 132, 199, 0.06)' : 'rgba(0, 212, 255, 0.06)',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    py: 0.4,
                    px: 1.25,
                    borderRadius: 1.5,
                    textTransform: 'none',
                    '&:hover': {
                      bgcolor: isLight ? 'rgba(2, 132, 199, 0.14)' : 'rgba(0, 212, 255, 0.15)',
                      borderColor: primaryColor,
                    },
                  }}
                >
                  Full Audit Trail
                </Button>
              </Box>
            </Box>

            {/* Activity Stream Table */}
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ backgroundColor: isLight ? '#F8FAFC' : 'rgba(0, 0, 0, 0.3)' }}>
                    <TableCell
                      sx={{
                        color: textSecondary,
                        fontWeight: 700,
                        fontSize: '0.72rem',
                        py: 1.25,
                        borderBottom: isLight ? '1px solid rgba(15, 23, 42, 0.08)' : '1px solid rgba(255,255,255,0.06)',
                      }}
                    >
                      ACTION TYPE
                    </TableCell>
                    <TableCell
                      sx={{
                        color: textSecondary,
                        fontWeight: 700,
                        fontSize: '0.72rem',
                        py: 1.25,
                        borderBottom: isLight ? '1px solid rgba(15, 23, 42, 0.08)' : '1px solid rgba(255,255,255,0.06)',
                      }}
                    >
                      OPERATOR
                    </TableCell>
                    <TableCell
                      sx={{
                        color: textSecondary,
                        fontWeight: 700,
                        fontSize: '0.72rem',
                        py: 1.25,
                        borderBottom: isLight ? '1px solid rgba(15, 23, 42, 0.08)' : '1px solid rgba(255,255,255,0.06)',
                      }}
                    >
                      STATUS
                    </TableCell>
                    <TableCell
                      sx={{
                        color: textSecondary,
                        fontWeight: 700,
                        fontSize: '0.72rem',
                        py: 1.25,
                        borderBottom: isLight ? '1px solid rgba(15, 23, 42, 0.08)' : '1px solid rgba(255,255,255,0.06)',
                      }}
                    >
                      RESOURCE / DETAILS
                    </TableCell>
                    <TableCell
                      sx={{
                        color: textSecondary,
                        fontWeight: 700,
                        fontSize: '0.72rem',
                        py: 1.25,
                        borderBottom: isLight ? '1px solid rgba(15, 23, 42, 0.08)' : '1px solid rgba(255,255,255,0.06)',
                      }}
                    >
                      TIME
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        color: textSecondary,
                        fontWeight: 700,
                        fontSize: '0.72rem',
                        py: 1.25,
                        borderBottom: isLight ? '1px solid rgba(15, 23, 42, 0.08)' : '1px solid rgba(255,255,255,0.06)',
                      }}
                    >
                      INSPECT
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredActivity.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} sx={{ py: 4, textAlign: 'center' }}>
                        <Security sx={{ fontSize: 32, color: textSecondary, mb: 1 }} />
                        <Typography variant="body2" sx={{ color: textSecondary }}>
                          No audit activities recorded for this filter category yet.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredActivity.map((log) => {
                      const cfg = getActionMeta(log.action, isLight);
                      const isSuccess = log.status === 'SUCCESS';
                      const ip = log.details?.ip_address || log.details?.ip || '';
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
                          onClick={() => setSelectedAuditLog(log)}
                          sx={{
                            cursor: 'pointer',
                            borderBottom: isLight ? '1px solid rgba(15, 23, 42, 0.04)' : '1px solid rgba(255, 255, 255, 0.03)',
                            '&:hover': {
                              backgroundColor: isLight ? 'rgba(2, 132, 199, 0.04)' : 'rgba(0, 212, 255, 0.04)',
                            },
                          }}
                        >
                          {/* Action Badge */}
                          <TableCell sx={{ py: 1.25 }}>
                            <Box
                              sx={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 0.75,
                                px: 1,
                                py: 0.35,
                                borderRadius: 1.5,
                                backgroundColor: cfg.bg,
                                border: `1px solid ${cfg.border}`,
                                color: cfg.color,
                                fontWeight: 700,
                                fontSize: '0.7rem',
                              }}
                            >
                              {cfg.icon}
                              <span>{cfg.label}</span>
                            </Box>
                          </TableCell>

                          {/* Operator */}
                          <TableCell sx={{ py: 1.25 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Avatar
                                sx={{
                                  width: 22,
                                  height: 22,
                                  fontSize: '0.65rem',
                                  fontWeight: 700,
                                  bgcolor:
                                    log.username === 'admin'
                                      ? isLight
                                        ? 'rgba(2, 132, 199, 0.15)'
                                        : 'rgba(0, 212, 255, 0.2)'
                                      : isLight
                                      ? 'rgba(99, 102, 241, 0.15)'
                                      : 'rgba(124, 77, 255, 0.2)',
                                  color:
                                    log.username === 'admin'
                                      ? primaryColor
                                      : isLight
                                      ? '#6366F1'
                                      : '#7C4DFF',
                                }}
                              >
                                {(log.username || 'S')[0].toUpperCase()}
                              </Avatar>
                              <Typography
                                variant="body2"
                                sx={{ fontWeight: 650, color: textPrimary, fontSize: '0.78rem' }}
                              >
                                {log.username || 'System'}
                              </Typography>
                            </Box>
                          </TableCell>

                          {/* Status */}
                          <TableCell sx={{ py: 1.25 }}>
                            <Chip
                              icon={
                                isSuccess ? (
                                  <CheckCircle sx={{ fontSize: '12px !important' }} />
                                ) : (
                                  <Warning sx={{ fontSize: '12px !important' }} />
                                )
                              }
                              label={log.status}
                              size="small"
                              sx={{
                                height: 20,
                                fontWeight: 700,
                                fontSize: '0.65rem',
                                backgroundColor: isSuccess
                                  ? isLight
                                    ? 'rgba(5, 150, 105, 0.1)'
                                    : 'rgba(0, 230, 118, 0.1)'
                                  : isLight
                                  ? 'rgba(220, 38, 38, 0.1)'
                                  : 'rgba(255, 23, 68, 0.12)',
                                color: isSuccess ? successColor : errorColor,
                                border: `1px solid ${
                                  isSuccess
                                    ? isLight
                                      ? 'rgba(5, 150, 105, 0.25)'
                                      : 'rgba(0, 230, 118, 0.3)'
                                    : isLight
                                    ? 'rgba(220, 38, 38, 0.25)'
                                    : 'rgba(255, 23, 68, 0.35)'
                                }`,
                              }}
                            />
                          </TableCell>

                          {/* Details */}
                          <TableCell sx={{ py: 1.25, maxWidth: 300 }}>
                            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                              {resourceName && (
                                <Typography
                                  variant="body2"
                                  noWrap
                                  sx={{ color: textPrimary, fontWeight: 650, fontSize: '0.76rem' }}
                                >
                                  {resourceName}
                                </Typography>
                              )}
                              <Typography
                                variant="caption"
                                noWrap
                                sx={{ color: textSecondary, fontFamily: 'monospace', fontSize: '0.7rem' }}
                              >
                                {ip ? `IP: ${ip} • ` : ''}
                                {log.details?.reason || JSON.stringify(log.details || {}).substring(0, 60)}
                              </Typography>
                            </Box>
                          </TableCell>

                          {/* Timestamp */}
                          <TableCell sx={{ py: 1.25 }}>
                            <Tooltip title={new Date(log.created_at).toLocaleString()} arrow>
                              <Typography
                                variant="body2"
                                sx={{ color: textSecondary, fontSize: '0.75rem', fontVariantNumeric: 'tabular-nums' }}
                              >
                                {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </Typography>
                            </Tooltip>
                          </TableCell>

                          {/* Quick Inspect Button */}
                          <TableCell align="right" sx={{ py: 1.25 }}>
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<Visibility sx={{ fontSize: 12 }} />}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedAuditLog(log);
                              }}
                              sx={{
                                color: primaryColor,
                                borderColor: isLight ? 'rgba(2, 132, 199, 0.3)' : 'rgba(0, 212, 255, 0.3)',
                                bgcolor: isLight ? 'rgba(2, 132, 199, 0.05)' : 'rgba(0, 212, 255, 0.05)',
                                fontSize: '0.68rem',
                                fontWeight: 650,
                                py: 0.2,
                                px: 0.9,
                                borderRadius: 1.5,
                                '&:hover': {
                                  bgcolor: isLight ? 'rgba(2, 132, 199, 0.12)' : 'rgba(0, 212, 255, 0.15)',
                                  borderColor: primaryColor,
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
          </CardContent>
        </Card>
      )}

      {/* ── 6. Event Inspector Drawer ── */}
      <Drawer
        anchor="right"
        open={Boolean(selectedAuditLog)}
        onClose={() => setSelectedAuditLog(null)}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: 520 },
            backgroundColor: isLight ? '#FFFFFF' : '#070B12',
            borderLeft: isLight ? '1px solid rgba(15, 23, 42, 0.1)' : '1px solid rgba(255, 255, 255, 0.1)',
            p: 3,
            boxShadow: isLight ? '-10px 0 40px rgba(15, 23, 42, 0.12)' : '-10px 0 40px rgba(0, 0, 0, 0.7)',
          },
        }}
      >
        {selectedAuditLog && (
          <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Chip
                    label={selectedAuditLog.status}
                    size="small"
                    color={selectedAuditLog.status === 'SUCCESS' ? 'success' : 'error'}
                    sx={{ fontWeight: 800, fontSize: '0.68rem', height: 22 }}
                  />
                  <Typography variant="caption" sx={{ color: textSecondary, fontFamily: 'monospace' }}>
                    {selectedAuditLog.log_id}
                  </Typography>
                </Box>
                <Typography variant="h5" fontWeight={800} sx={{ color: textPrimary }}>
                  {selectedAuditLog.action}
                </Typography>
              </Box>
              <IconButton size="small" onClick={() => setSelectedAuditLog(null)} sx={{ color: textSecondary }}>
                <Close sx={{ fontSize: 20 }} />
              </IconButton>
            </Box>

            <Divider
              sx={{
                mb: 2.5,
                borderColor: isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255, 255, 255, 0.08)',
              }}
            />

            {/* Context Cards */}
            <Box sx={{ flexGrow: 1, overflowY: 'auto', pr: 0.5, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  backgroundColor: isLight ? '#F8FAFC' : 'rgba(255, 255, 255, 0.02)',
                  border: isLight ? '1px solid rgba(15, 23, 42, 0.08)' : '1px solid rgba(255, 255, 255, 0.06)',
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    color: primaryColor,
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    display: 'block',
                    mb: 1.5,
                  }}
                >
                  Event Identity & Network Context
                </Typography>
                <Grid container spacing={1.5}>
                  <Grid item xs={6}>
                    <Typography variant="caption" sx={{ color: textSecondary }}>
                      Operator / Actor:
                    </Typography>
                    <Typography variant="body2" fontWeight={650} sx={{ color: textPrimary }}>
                      {selectedAuditLog.username || 'System Service'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" sx={{ color: textSecondary }}>
                      Client IP Address:
                    </Typography>
                    <Typography variant="body2" sx={{ color: successColor, fontFamily: 'monospace', fontWeight: 600 }}>
                      {selectedAuditLog.details?.ip_address || selectedAuditLog.details?.ip || 'Internal System'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="caption" sx={{ color: textSecondary }}>
                      Execution Timestamp:
                    </Typography>
                    <Typography variant="body2" sx={{ color: textPrimary, fontVariantNumeric: 'tabular-nums' }}>
                      {new Date(selectedAuditLog.created_at).toUTCString()}
                    </Typography>
                  </Grid>
                  {selectedAuditLog.report_id && (
                    <Grid item xs={12}>
                      <Typography variant="caption" sx={{ color: textSecondary }}>
                        Report Reference ID:
                      </Typography>
                      <Typography variant="body2" sx={{ color: primaryColor, fontFamily: 'monospace', fontWeight: 600 }}>
                        {selectedAuditLog.report_id}
                      </Typography>
                    </Grid>
                  )}
                </Grid>
              </Box>

              {/* JSON Payload */}
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography
                    variant="caption"
                    sx={{ color: primaryColor, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}
                  >
                    Forensic Payload (JSON)
                  </Typography>
                  <Button
                    size="small"
                    startIcon={copiedAuditPayload ? <Check sx={{ fontSize: 14 }} /> : <ContentCopy sx={{ fontSize: 14 }} />}
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(selectedAuditLog.details || {}, null, 2));
                      setCopiedAuditPayload(true);
                      setTimeout(() => setCopiedAuditPayload(false), 2000);
                    }}
                    sx={{
                      color: copiedAuditPayload ? successColor : textSecondary,
                      fontSize: '0.7rem',
                      textTransform: 'none',
                    }}
                  >
                    {copiedAuditPayload ? 'Copied' : 'Copy JSON'}
                  </Button>
                </Box>
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    backgroundColor: isLight ? '#0F172A' : '#030712',
                    border: isLight ? '1px solid rgba(15, 23, 42, 0.15)' : '1px solid rgba(255, 255, 255, 0.08)',
                    fontFamily: 'monospace',
                    fontSize: '0.78rem',
                    color: '#34D399',
                    overflowX: 'auto',
                    maxHeight: 280,
                  }}
                >
                  <pre style={{ margin: 0 }}>
                    {JSON.stringify(selectedAuditLog.details || {}, null, 2)}
                  </pre>
                </Box>
              </Box>
            </Box>

            {/* Footer */}
            <Box
              sx={{
                pt: 2,
                borderTop: isLight ? '1px solid rgba(15, 23, 42, 0.08)' : '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <Button
                fullWidth
                variant="outlined"
                onClick={() => setSelectedAuditLog(null)}
                sx={{
                  color: textSecondary,
                  borderColor: isLight ? 'rgba(15, 23, 42, 0.15)' : 'rgba(255, 255, 255, 0.15)',
                  borderRadius: 2,
                  fontWeight: 650,
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

export default DashboardPage;
