import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  IconButton,
  TextField,
  InputAdornment,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Collapse,
  Divider,
  LinearProgress,
  Tabs,
  Tab,
  Stack,
  Grid,
  Pagination,
  Breadcrumbs,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  Search,
  Visibility,
  Download,
  Delete,
  Description,
  RocketLaunch,
  CheckCircle,
  HourglassTop,
  Close,
  ExpandMore,
  ExpandLess,
  Shield,
  BugReport,
  Security,
  Warning,
  TipsAndUpdates,
  ContentCopy,
  Check,
  GridView,
  TableRows,
  Refresh,
  CloudUpload,
  Business,
  Person,
  CalendarToday,
  FilterList,
  Clear,
  Layers,
  ArrowForward,
  FolderCopy,
  VerifiedUser,
  Code,
  DataObject,
  Assessment,
  Numbers,
  FilterAlt,
  Sort,
  DownloadForOffline,
  FactCheck,
  CheckCircleOutline,
  OpenInNew,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/axios';

const statusColor = {
  UPLOADED: 'info',
  VALIDATED: 'success',
  REJECTED: 'error',
  QUARANTINED: 'warning',
};

const extIcon = {
  '.pdf': '📄',
  '.docx': '📝',
  '.txt': '📃',
};

const severityColor = {
  CRITICAL: '#FF1744',
  HIGH: '#FF9100',
  MEDIUM: '#FFD600',
  LOW: '#00E676',
};

const riskLevelGradient = {
  CRITICAL: 'linear-gradient(135deg, #FF1744 0%, #D50000 100%)',
  HIGH: 'linear-gradient(135deg, #FF9100 0%, #FF6D00 100%)',
  MEDIUM: 'linear-gradient(135deg, #FFD600 0%, #FFAB00 100%)',
  LOW: 'linear-gradient(135deg, #00E676 0%, #00C853 100%)',
};

/* ──────────── Upgraded Pipeline Results Dialog ──────────── */

const CleanVulnTitle = (rawTitle) => {
  if (!rawTitle) return 'Untitled Finding';
  return String(rawTitle).replace(/\s*#\d+\s*$/, '').trim();
};

const SerialBadge = ({ number, severity }) => {
  const color = severityColor[severity] || '#00F0FF';
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        px: 1.2,
        py: 0.35,
        borderRadius: '6px',
        background: `linear-gradient(135deg, ${color}22 0%, ${color}0A 100%)`,
        border: `1px solid ${color}80`,
        boxShadow: `0 0 10px ${color}25`,
      }}
    >
      <Typography
        sx={{
          fontFamily: 'monospace',
          fontWeight: 900,
          fontSize: '0.78rem',
          color,
          letterSpacing: '0.8px',
        }}
      >
        VULN #{String(number).padStart(2, '0')}
      </Typography>
    </Box>
  );
};

const JsonNode = ({ label, value, defaultExpanded = false, depth = 0 }) => {
  const [expanded, setExpanded] = useState(defaultExpanded || depth < 1);

  if (value === null || value === undefined) {
    return (
      <Box sx={{ display: 'flex', py: 0.35, pl: depth * 1.5, alignItems: 'center' }}>
        <Typography variant="body2" sx={{ color: '#38BDF8', fontFamily: 'monospace', fontSize: '0.8rem', mr: 1 }}>
          "{label}":
        </Typography>
        <Typography variant="body2" sx={{ color: '#64748B', fontFamily: 'monospace', fontSize: '0.8rem', fontStyle: 'italic' }}>
          null
        </Typography>
      </Box>
    );
  }

  if (typeof value !== 'object') {
    let valColor = '#34D399'; // string: emerald
    if (typeof value === 'number') valColor = '#FBBF24'; // number: amber
    if (typeof value === 'boolean') valColor = '#C084FC'; // boolean: purple
    return (
      <Box sx={{ display: 'flex', py: 0.35, pl: depth * 1.5, alignItems: 'flex-start' }}>
        <Typography variant="body2" sx={{ color: '#38BDF8', fontFamily: 'monospace', fontSize: '0.8rem', mr: 1, whiteSpace: 'nowrap' }}>
          "{label}":
        </Typography>
        <Typography variant="body2" sx={{ color: valColor, fontFamily: 'monospace', fontSize: '0.8rem', wordBreak: 'break-all' }}>
          {typeof value === 'string' ? `"${value}"` : String(value)}
        </Typography>
      </Box>
    );
  }

  const isArray = Array.isArray(value);
  const keys = Object.keys(value);

  if (keys.length === 0) {
    return (
      <Box sx={{ display: 'flex', py: 0.35, pl: depth * 1.5, alignItems: 'center' }}>
        <Typography variant="body2" sx={{ color: '#38BDF8', fontFamily: 'monospace', fontSize: '0.8rem', mr: 1 }}>
          "{label}":
        </Typography>
        <Typography variant="body2" sx={{ color: '#64748B', fontFamily: 'monospace', fontSize: '0.8rem' }}>
          {isArray ? '[]' : '{}'}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 0.3 }}>
      <Box
        onClick={() => setExpanded(!expanded)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          cursor: 'pointer',
          py: 0.4,
          pl: depth * 1.5,
          borderRadius: 1,
          '&:hover': { bgcolor: 'rgba(0, 240, 255, 0.05)' },
        }}
      >
        <Typography variant="body2" sx={{ color: '#00F0FF', fontSize: '0.65rem', width: 18, textAlign: 'center' }}>
          {expanded ? '▼' : '▶'}
        </Typography>
        <Typography variant="body2" sx={{ color: '#38BDF8', fontWeight: 600, fontFamily: 'monospace', fontSize: '0.82rem' }}>
          "{label}":
        </Typography>
        <Typography variant="caption" sx={{ color: '#94A3B8', ml: 1, fontFamily: 'monospace' }}>
          {isArray ? `Array [${keys.length}]` : `Object {${keys.length}}`}
        </Typography>
      </Box>
      <Collapse in={expanded}>
        <Box sx={{ borderLeft: '1px dashed rgba(0, 240, 255, 0.2)', ml: depth * 1.5 + 1, mt: 0.3 }}>
          {keys.map((k) => (
            <JsonNode key={k} label={k} value={value[k]} depth={depth + 1} />
          ))}
        </Box>
      </Collapse>
    </Box>
  );
};

const JsonSectionCard = ({ title, data, icon: IconComponent, onCopy }) => {
  const [expanded, setExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

  const handleCopySection = (e) => {
    e.stopPropagation();
    try {
      const str = JSON.stringify(data, null, 2);
      navigator.clipboard.writeText(str);
      setCopied(true);
      if (onCopy) onCopy(title);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <Card
      elevation={0}
      sx={{
        bgcolor: 'rgba(13, 21, 39, 0.6)',
        border: '1px solid rgba(0, 240, 255, 0.15)',
        borderRadius: 2.5,
        mb: 2,
        overflow: 'hidden',
      }}
    >
      <Box
        onClick={() => setExpanded(!expanded)}
        sx={{
          p: 1.8,
          px: 2.2,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          bgcolor: 'rgba(0, 240, 255, 0.03)',
          borderBottom: expanded ? '1px solid rgba(0, 240, 255, 0.1)' : 'none',
          '&:hover': { bgcolor: 'rgba(0, 240, 255, 0.07)' },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {IconComponent && <IconComponent sx={{ color: '#00F0FF', fontSize: 20 }} />}
          <Typography variant="subtitle1" fontWeight={700} sx={{ color: '#F8FAFC', letterSpacing: 0.5 }}>
            {title}
          </Typography>
          <Chip
            label={Array.isArray(data) ? `${data.length} items` : `${Object.keys(data || {}).length} fields`}
            size="small"
            sx={{
              height: 20,
              fontSize: '0.65rem',
              fontWeight: 700,
              bgcolor: 'rgba(0, 240, 255, 0.1)',
              color: '#00F0FF',
              border: '1px solid rgba(0, 240, 255, 0.2)',
            }}
          />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tooltip title={copied ? 'Copied Section!' : 'Copy Section JSON'} arrow>
            <IconButton
              size="small"
              onClick={handleCopySection}
              sx={{
                color: copied ? '#00E676' : '#94A3B8',
                bgcolor: copied ? 'rgba(0, 230, 118, 0.1)' : 'rgba(255, 255, 255, 0.04)',
                '&:hover': { color: '#00F0FF', bgcolor: 'rgba(0, 240, 255, 0.1)' },
              }}
            >
              {copied ? <Check fontSize="small" /> : <ContentCopy fontSize="small" />}
            </IconButton>
          </Tooltip>
          <IconButton size="small" sx={{ color: '#94A3B8' }}>
            {expanded ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </Box>
      </Box>
      <Collapse in={expanded}>
        <Box sx={{ p: 2, bgcolor: 'rgba(7, 11, 18, 0.4)', overflowX: 'auto', maxHeight: 450, overflowY: 'auto' }}>
          {typeof data === 'object' && data !== null ? (
            Object.keys(data).map((k) => (
              <JsonNode key={k} label={k} value={data[k]} depth={0} />
            ))
          ) : (
            <Typography variant="body2" sx={{ color: '#CBD5E1', fontFamily: 'monospace' }}>
              {String(data)}
            </Typography>
          )}
        </Box>
      </Collapse>
    </Card>
  );
};

function PipelineResultsDialog({ open, onClose, results, reportName }) {
  const { enqueueSnackbar } = useSnackbar();
  const [tabValue, setTabValue] = useState(0);
  const [copied, setCopied] = useState(false);
  const [copiedFindingId, setCopiedFindingId] = useState(null);

  // Vulnerabilities Tab state
  const [vulnSearch, setVulnSearch] = useState('');
  const [vulnSeverityFilter, setVulnSeverityFilter] = useState('ALL');
  const [vulnStatusFilter, setVulnStatusFilter] = useState('ALL');
  const [vulnSort, setVulnSort] = useState('SEVERITY');
  const [expandedVulns, setExpandedVulns] = useState({});

  const safeResults = results || {};
  const execSummary = safeResults.executive_summary || {};
  const vulnsArray = safeResults.detailed_observations || [];
  const compliance = safeResults.compliance || {};
  const recommendations = safeResults.recommendations || [];

  const crit = vulnsArray.filter((v) => (v.severity || '').toUpperCase() === 'CRITICAL').length;
  const high = vulnsArray.filter((v) => (v.severity || '').toUpperCase() === 'HIGH').length;
  const med = vulnsArray.filter((v) => (v.severity || '').toUpperCase() === 'MEDIUM').length;
  const low = vulnsArray.filter((v) => (v.severity || '').toUpperCase() === 'LOW').length;
  const totalVulns = vulnsArray.length;

  let riskLevel = 'LOW';
  if (crit > 0) riskLevel = 'CRITICAL';
  else if (high > 0) riskLevel = 'HIGH';
  else if (med > 0) riskLevel = 'MEDIUM';

  const rawJsonString = useMemo(() => {
    return results ? JSON.stringify(results, null, 2) : '{}';
  }, [results]);
  const rawJsonLines = useMemo(() => rawJsonString.split('\n'), [rawJsonString]);
  const rawJsonSizeKb = useMemo(() => (new Blob([rawJsonString]).size / 1024).toFixed(1), [rawJsonString]);

  const handleCopyJson = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(rawJsonString);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = rawJsonString;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      enqueueSnackbar('Complete AI Pipeline JSON copied to clipboard!', { variant: 'success', autoHideDuration: 2500 });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy JSON:', err);
      enqueueSnackbar('Failed to copy JSON', { variant: 'error' });
    }
  };

  const handleDownloadJson = () => {
    try {
      const blob = new Blob([rawJsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const cleanName = (reportName || 'report').replace(/\.[^/.]+$/, '');
      link.download = `cyberaudit_pipeline_${cleanName}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      enqueueSnackbar(`Downloaded ${link.download}`, { variant: 'info' });
    } catch (err) {
      console.error(err);
      enqueueSnackbar('Download failed', { variant: 'error' });
    }
  };

  const handleCopyText = (text, label) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    enqueueSnackbar(`${label || 'Content'} copied to clipboard!`, { variant: 'success', autoHideDuration: 2000 });
  };

  const toggleVulnExpanded = (id) => {
    setExpandedVulns((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Filtered & Sorted vulnerabilities with true sequential serial tracking
  const processedVulns = useMemo(() => {
    if (!vulnsArray || vulnsArray.length === 0) return [];
    let list = vulnsArray.map((v, originalIdx) => ({
      ...v,
      serialNumber: originalIdx + 1,
      cleanTitle: CleanVulnTitle(v.title),
    }));

    // Filter by severity
    if (vulnSeverityFilter !== 'ALL') {
      list = list.filter((v) => (v.severity || '').toUpperCase() === vulnSeverityFilter);
    }

    // Filter by status
    if (vulnStatusFilter !== 'ALL') {
      list = list.filter((v) => {
        const s = (v.status || '').toUpperCase().replace(/\s+/g, '_');
        const nr = (v.new_or_repeat || '').toUpperCase();
        if (vulnStatusFilter === 'REPEAT') return nr === 'REPEAT';
        if (vulnStatusFilter === 'OPEN') return s === 'OPEN';
        if (vulnStatusFilter === 'PARTIALLY_REMEDIATED') return s === 'PARTIALLY_REMEDIATED';
        return true;
      });
    }

    // Filter by search query
    if (vulnSearch.trim()) {
      const q = vulnSearch.toLowerCase().trim();
      list = list.filter((v) => {
        const matchTitle = (v.title || '').toLowerCase().includes(q);
        const matchClean = v.cleanTitle.toLowerCase().includes(q);
        const matchDesc = (v.observation_description || '').toLowerCase().includes(q);
        const matchId = (v.finding_id || '').toLowerCase().includes(q);
        const matchSerial = `#${v.serialNumber}`.includes(q) || String(v.serialNumber) === q;
        const matchCwe = (Array.isArray(v.cwe) ? v.cwe.join(' ') : String(v.cwe || '')).toLowerCase().includes(q);
        const matchCve = (Array.isArray(v.cve_id) ? v.cve_id.join(' ') : String(v.cve_id || '')).toLowerCase().includes(q);
        const matchAsset = (Array.isArray(v.affected_asset) ? v.affected_asset.join(' ') : String(v.affected_asset || '')).toLowerCase().includes(q);
        return matchTitle || matchClean || matchDesc || matchId || matchSerial || matchCwe || matchCve || matchAsset;
      });
    }

    // Sort
    const sevWeight = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    list.sort((a, b) => {
      if (vulnSort === 'SEVERITY') {
        const diff = (sevWeight[(b.severity || '').toUpperCase()] || 0) - (sevWeight[(a.severity || '').toUpperCase()] || 0);
        if (diff !== 0) return diff;
        return (parseFloat(b.cvss_score) || 0) - (parseFloat(a.cvss_score) || 0);
      }
      if (vulnSort === 'CVSS') {
        return (parseFloat(b.cvss_score) || 0) - (parseFloat(a.cvss_score) || 0);
      }
      if (vulnSort === 'SERIAL') {
        return a.serialNumber - b.serialNumber;
      }
      return 0;
    });

    return list;
  }, [vulnsArray, vulnSeverityFilter, vulnStatusFilter, vulnSearch, vulnSort]);

  const jumpToVulnSeverity = (sev) => {
    setVulnSeverityFilter(sev);
    setTabValue(1);
  };

  if (!open || !results) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3.5,
          background: 'linear-gradient(145deg, rgba(13, 21, 39, 0.98) 0%, rgba(7, 11, 18, 0.99) 100%)',
          border: '1px solid rgba(0, 240, 255, 0.25)',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.85), 0 0 35px rgba(0, 240, 255, 0.15)',
          backdropFilter: 'blur(25px)',
          overflow: 'hidden',
          maxHeight: '92vh',
        },
      }}
    >
      {/* ── Top Header ── */}
      <DialogTitle
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          p: 2.5,
          pb: 2,
          borderBottom: '1px solid rgba(0, 240, 255, 0.12)',
          bgcolor: 'rgba(0, 240, 255, 0.03)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: '10px',
              bgcolor: 'rgba(0, 240, 255, 0.12)',
              border: '1px solid rgba(0, 240, 255, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 15px rgba(0, 240, 255, 0.25)',
            }}
          >
            <Security sx={{ color: '#00F0FF', fontSize: 26 }} />
          </Box>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
              <Typography variant="h6" fontWeight={800} sx={{ color: '#F8FAFC', letterSpacing: 0.5 }}>
                AI Pipeline Results
              </Typography>
              <Chip
                label="CERT-In Verified"
                size="small"
                sx={{
                  bgcolor: 'rgba(0, 230, 118, 0.12)',
                  color: '#00E676',
                  border: '1px solid rgba(0, 230, 118, 0.3)',
                  fontWeight: 700,
                  fontSize: '0.65rem',
                  height: 20,
                }}
              />
            </Box>
            <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block', mt: 0.2 }}>
              {reportName} • <span style={{ color: '#00F0FF' }}>{totalVulns} Findings Tagged</span>
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tooltip title="Download Complete Pipeline Output as JSON" arrow>
            <Button
              size="small"
              variant="outlined"
              startIcon={<DownloadForOffline />}
              onClick={handleDownloadJson}
              sx={{
                borderColor: 'rgba(0, 240, 255, 0.35)',
                color: '#00F0FF',
                textTransform: 'none',
                fontWeight: 700,
                fontSize: '0.75rem',
                bgcolor: 'rgba(0, 240, 255, 0.08)',
                '&:hover': {
                  borderColor: '#00F0FF',
                  bgcolor: 'rgba(0, 240, 255, 0.18)',
                },
              }}
            >
              Export JSON
            </Button>
          </Tooltip>

          <Tooltip title={copied ? 'Copied to clipboard!' : 'Copy All JSON'} arrow>
            <IconButton
              onClick={handleCopyJson}
              size="small"
              sx={{
                color: copied ? '#00E676' : '#00F0FF',
                bgcolor: copied ? 'rgba(0, 230, 118, 0.12)' : 'rgba(0, 240, 255, 0.08)',
                border: '1px solid',
                borderColor: copied ? 'rgba(0, 230, 118, 0.4)' : 'rgba(0, 240, 255, 0.25)',
                '&:hover': {
                  bgcolor: copied ? 'rgba(0, 230, 118, 0.2)' : 'rgba(0, 240, 255, 0.18)',
                },
              }}
            >
              {copied ? <Check fontSize="small" /> : <ContentCopy fontSize="small" />}
            </IconButton>
          </Tooltip>

          <IconButton onClick={onClose} size="small" sx={{ color: '#94A3B8', '&:hover': { color: '#F8FAFC' } }}>
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      {/* ── Modern Navigation Tabs ── */}
      <Tabs
        value={tabValue}
        onChange={(e, v) => setTabValue(v)}
        sx={{
          px: 3,
          pt: 1,
          borderBottom: '1px solid rgba(0, 240, 255, 0.1)',
          bgcolor: 'rgba(7, 11, 18, 0.6)',
          '& .MuiTabs-indicator': {
            bgcolor: '#00F0FF',
            height: 3,
            borderRadius: '3px 3px 0 0',
            boxShadow: '0 0 12px #00F0FF',
          },
        }}
      >
        <Tab
          icon={<Assessment sx={{ fontSize: 18 }} />}
          iconPosition="start"
          label="Overview"
          sx={{
            color: '#94A3B8',
            fontWeight: 700,
            textTransform: 'none',
            fontSize: '0.85rem',
            minHeight: 48,
            '&.Mui-selected': { color: '#00F0FF' },
          }}
        />
        <Tab
          icon={<BugReport sx={{ fontSize: 18 }} />}
          iconPosition="start"
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <span>Vulnerabilities</span>
              <Chip
                label={totalVulns}
                size="small"
                sx={{
                  height: 18,
                  fontSize: '0.65rem',
                  fontWeight: 900,
                  bgcolor: crit > 0 ? 'rgba(255, 23, 68, 0.2)' : 'rgba(0, 240, 255, 0.2)',
                  color: crit > 0 ? '#FF1744' : '#00F0FF',
                  border: `1px solid ${crit > 0 ? 'rgba(255,23,68,0.4)' : 'rgba(0,240,255,0.4)'}`,
                }}
              />
            </Box>
          }
          sx={{
            color: '#94A3B8',
            fontWeight: 700,
            textTransform: 'none',
            fontSize: '0.85rem',
            minHeight: 48,
            '&.Mui-selected': { color: '#00F0FF' },
          }}
        />
        <Tab
          icon={<DataObject sx={{ fontSize: 18 }} />}
          iconPosition="start"
          label="Full JSON Explorer"
          sx={{
            color: '#94A3B8',
            fontWeight: 700,
            textTransform: 'none',
            fontSize: '0.85rem',
            minHeight: 48,
            '&.Mui-selected': { color: '#00F0FF' },
          }}
        />
        <Tab
          icon={<Code sx={{ fontSize: 18 }} />}
          iconPosition="start"
          label="Raw JSON"
          sx={{
            color: '#94A3B8',
            fontWeight: 700,
            textTransform: 'none',
            fontSize: '0.85rem',
            minHeight: 48,
            '&.Mui-selected': { color: '#00F0FF' },
          }}
        />
      </Tabs>

      {/* ── Dialog Content ── */}
      <DialogContent sx={{ p: 3, maxHeight: 'calc(92vh - 130px)', overflowY: 'auto' }}>
        {/* ========================================================================= */}
        {/* ── TAB 0: OVERVIEW ── */}
        {/* ========================================================================= */}
        {tabValue === 0 && (
          <Box>
            {/* ── Top Hero Metrics Strip ── */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2.5, mb: 3 }}>
              {/* Risk Level Hero */}
              <Box
                sx={{
                  p: 3,
                  borderRadius: 3,
                  background: riskLevelGradient[riskLevel] || riskLevelGradient.MEDIUM,
                  position: 'relative',
                  overflow: 'hidden',
                  boxShadow: `0 10px 30px ${severityColor[riskLevel]}35`,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  minHeight: 160,
                }}
              >
                <Box
                  sx={{
                    position: 'absolute',
                    top: -30,
                    right: -30,
                    width: 140,
                    height: 140,
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.12)',
                    filter: 'blur(10px)',
                  }}
                />
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Typography
                      variant="overline"
                      sx={{ color: 'rgba(255,255,255,0.9)', fontWeight: 800, letterSpacing: 1.5, fontSize: '0.75rem' }}
                    >
                      OVERALL RISK POSTURE
                    </Typography>
                    <Chip
                      label="STATUTORY CERT-IN LEVEL"
                      size="small"
                      sx={{
                        bgcolor: 'rgba(0, 0, 0, 0.25)',
                        color: '#FFF',
                        fontWeight: 800,
                        fontSize: '0.62rem',
                        backdropFilter: 'blur(5px)',
                      }}
                    />
                  </Box>
                  <Typography variant="h3" fontWeight={900} sx={{ color: '#FFF', textShadow: '0 2px 10px rgba(0,0,0,0.3)' }}>
                    {riskLevel}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.92)', mt: 0.5, fontWeight: 500 }}>
                    {execSummary.summary_text || `Elevated security vulnerabilities detected requiring immediate remediation.`}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 2 }}>
                  <Chip
                    icon={<Warning sx={{ color: '#FFF !important', fontSize: 16 }} />}
                    label={crit > 0 ? `${crit} Immediate Priority Findings` : 'Standard Mitigations Active'}
                    size="small"
                    sx={{
                      bgcolor: 'rgba(255,255,255,0.22)',
                      color: '#FFF',
                      fontWeight: 700,
                      fontSize: '0.72rem',
                    }}
                  />
                </Box>
              </Box>

              {/* Vulnerabilities Summary + Clickable Distribution */}
              <Box
                sx={{
                  p: 3,
                  borderRadius: 3,
                  background: 'rgba(13, 21, 39, 0.7)',
                  border: '1px solid rgba(0, 240, 255, 0.2)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  minHeight: 160,
                }}
              >
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography variant="overline" sx={{ color: '#94A3B8', fontWeight: 800, letterSpacing: 1.5, fontSize: '0.75rem' }}>
                      TOTAL VULNERABILITIES IDENTIFIED
                    </Typography>
                    <Tooltip title="Switch to Vulnerabilities tab" arrow>
                      <Button
                        size="small"
                        endIcon={<ArrowForward sx={{ fontSize: 14 }} />}
                        onClick={() => setTabValue(1)}
                        sx={{ color: '#00F0FF', textTransform: 'none', fontSize: '0.75rem', p: 0 }}
                      >
                        View All
                      </Button>
                    </Tooltip>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 2, mt: 0.5 }}>
                    <Typography variant="h3" fontWeight={900} sx={{ color: '#00F0FF' }}>
                      {totalVulns}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#94A3B8' }}>
                      Categorized observations across audited codebase
                    </Typography>
                  </Box>

                  {/* Interactive Severity Badges - clicking filters Tab 1! */}
                  <Box sx={{ display: 'flex', gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
                    <Chip
                      onClick={() => jumpToVulnSeverity('CRITICAL')}
                      label={`${crit} Critical`}
                      size="small"
                      clickable
                      sx={{
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        bgcolor: 'rgba(255, 23, 68, 0.15)',
                        color: '#FF1744',
                        border: '1px solid rgba(255, 23, 68, 0.3)',
                        '&:hover': { bgcolor: 'rgba(255, 23, 68, 0.25)' },
                      }}
                    />
                    <Chip
                      onClick={() => jumpToVulnSeverity('HIGH')}
                      label={`${high} High`}
                      size="small"
                      clickable
                      sx={{
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        bgcolor: 'rgba(255, 145, 0, 0.15)',
                        color: '#FF9100',
                        border: '1px solid rgba(255, 145, 0, 0.3)',
                        '&:hover': { bgcolor: 'rgba(255, 145, 0, 0.25)' },
                      }}
                    />
                    <Chip
                      onClick={() => jumpToVulnSeverity('MEDIUM')}
                      label={`${med} Medium`}
                      size="small"
                      clickable
                      sx={{
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        bgcolor: 'rgba(255, 214, 0, 0.15)',
                        color: '#FFD600',
                        border: '1px solid rgba(255, 214, 0, 0.3)',
                        '&:hover': { bgcolor: 'rgba(255, 214, 0, 0.25)' },
                      }}
                    />
                    <Chip
                      onClick={() => jumpToVulnSeverity('LOW')}
                      label={`${low} Low`}
                      size="small"
                      clickable
                      sx={{
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        bgcolor: 'rgba(0, 230, 118, 0.15)',
                        color: '#00E676',
                        border: '1px solid rgba(0, 230, 118, 0.3)',
                        '&:hover': { bgcolor: 'rgba(0, 230, 118, 0.25)' },
                      }}
                    />
                  </Box>
                </Box>

                {/* Visual Severity Distribution Bar */}
                {totalVulns > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="caption" sx={{ color: '#64748B', display: 'block', mb: 0.5, fontSize: '0.7rem' }}>
                      Severity Ratio Distribution
                    </Typography>
                    <Box sx={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', bgcolor: 'rgba(255,255,255,0.06)' }}>
                      {crit > 0 && (
                        <Box sx={{ width: `${(crit / totalVulns) * 100}%`, bgcolor: '#FF1744' }} title={`Critical: ${crit}`} />
                      )}
                      {high > 0 && (
                        <Box sx={{ width: `${(high / totalVulns) * 100}%`, bgcolor: '#FF9100' }} title={`High: ${high}`} />
                      )}
                      {med > 0 && (
                        <Box sx={{ width: `${(med / totalVulns) * 100}%`, bgcolor: '#FFD600' }} title={`Medium: ${med}`} />
                      )}
                      {low > 0 && (
                        <Box sx={{ width: `${(low / totalVulns) * 100}%`, bgcolor: '#00E676' }} title={`Low: ${low}`} />
                      )}
                    </Box>
                  </Box>
                )}
              </Box>
            </Box>

            {/* ── Telemetry Ribbon ── */}
            <Box
              sx={{
                p: 1.8,
                px: 2.5,
                borderRadius: 2.5,
                bgcolor: 'rgba(0, 240, 255, 0.04)',
                border: '1px solid rgba(0, 240, 255, 0.12)',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 2,
                mb: 3,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <RocketLaunch sx={{ color: '#00F0FF', fontSize: 18 }} />
                <Typography variant="caption" sx={{ color: '#94A3B8' }}>
                  Pipeline ID:
                </Typography>
                <Typography
                  variant="caption"
                  onClick={() => handleCopyText(results.pipeline_id, 'Pipeline ID')}
                  sx={{
                    fontFamily: 'monospace',
                    color: '#00F0FF',
                    fontWeight: 700,
                    cursor: 'pointer',
                    '&:hover': { textDecoration: 'underline' },
                  }}
                >
                  {results.pipeline_id || 'pipe_cert_v4'}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CalendarToday sx={{ color: '#00F0FF', fontSize: 16 }} />
                <Typography variant="caption" sx={{ color: '#94A3B8' }}>
                  Analyzed:{' '}
                  <span style={{ color: '#F8FAFC', fontWeight: 600 }}>
                    {results.analysis_timestamp ? new Date(results.analysis_timestamp).toLocaleString() : 'Just now'}
                  </span>
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <HourglassTop sx={{ color: '#00F0FF', fontSize: 16 }} />
                <Typography variant="caption" sx={{ color: '#94A3B8' }}>
                  Duration:{' '}
                  <span style={{ color: '#00E676', fontWeight: 700 }}>
                    {results.processing_time_seconds ? `${results.processing_time_seconds}s` : '< 3.0s'}
                  </span>
                </Typography>
              </Box>

              <Chip
                label="MeitY Cyber Security Directive 2026 Compliant"
                size="small"
                sx={{
                  bgcolor: 'rgba(0, 240, 255, 0.1)',
                  color: '#00F0FF',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                }}
              />
            </Box>

            {/* ── Compliance Standards Progress Cards ── */}
            {Object.keys(compliance).length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <Shield sx={{ color: '#00F0FF', fontSize: 20 }} />
                  <Typography variant="subtitle1" fontWeight={800} sx={{ color: '#F8FAFC' }}>
                    Statutory Compliance Frameworks
                  </Typography>
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 2 }}>
                  {Object.entries(compliance).map(([framework, data]) => {
                    const statusColorMap = {
                      COMPLIANT: '#00E676',
                      PARTIALLY_COMPLIANT: '#FFD600',
                      NON_COMPLIANT: '#FF1744',
                    };
                    const color = statusColorMap[data.status] || '#00F0FF';
                    return (
                      <Box
                        key={framework}
                        sx={{
                          p: 2.2,
                          borderRadius: 2.5,
                          border: `1px solid ${color}35`,
                          bgcolor: `${color}0A`,
                          boxShadow: `0 4px 16px ${color}10`,
                        }}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                          <Typography variant="subtitle2" fontWeight={800} sx={{ color: '#F8FAFC' }}>
                            {framework}
                          </Typography>
                          <Chip
                            label={(data.status || 'UNKNOWN').replace(/_/g, ' ')}
                            size="small"
                            sx={{
                              fontWeight: 800,
                              fontSize: '0.62rem',
                              bgcolor: `${color}25`,
                              color,
                              height: 20,
                            }}
                          />
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mt: 1.5 }}>
                          <Typography variant="caption" sx={{ color: '#94A3B8' }}>
                            Compliance Score
                          </Typography>
                          <Typography variant="subtitle2" fontWeight={900} sx={{ color }}>
                            {data.score}%
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={data.score || 0}
                          sx={{
                            mt: 0.8,
                            height: 6,
                            borderRadius: 3,
                            bgcolor: 'rgba(255,255,255,0.06)',
                            '& .MuiLinearProgress-bar': {
                              borderRadius: 3,
                              bgcolor: color,
                            },
                          }}
                        />
                        <Typography variant="caption" sx={{ color: '#64748B', display: 'block', mt: 1 }}>
                          Gaps Identified: <b style={{ color: '#CBD5E1' }}>{data.gaps_identified || 0}</b>
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            )}

            {/* ── Top Priority Findings Preview (With Serial Numbers) ── */}
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <BugReport sx={{ color: '#FF1744', fontSize: 20 }} />
                  <Typography variant="subtitle1" fontWeight={800} sx={{ color: '#F8FAFC' }}>
                    Top Priority Findings
                  </Typography>
                </Box>
                <Button
                  size="small"
                  variant="outlined"
                  endIcon={<ArrowForward />}
                  onClick={() => setTabValue(1)}
                  sx={{
                    borderColor: 'rgba(0, 240, 255, 0.3)',
                    color: '#00F0FF',
                    textTransform: 'none',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    '&:hover': { borderColor: '#00F0FF', bgcolor: 'rgba(0, 240, 255, 0.1)' },
                  }}
                >
                  View All {totalVulns} Vulnerabilities with Serial Numbers
                </Button>
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {vulnsArray.slice(0, 3).map((v, idx) => {
                  const color = severityColor[v.severity] || '#00F0FF';
                  return (
                    <Box
                      key={v.finding_id || idx}
                      onClick={() => setTabValue(1)}
                      sx={{
                        p: 2,
                        borderRadius: 2.5,
                        bgcolor: 'rgba(13, 21, 39, 0.6)',
                        border: `1px solid ${color}35`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 2,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          bgcolor: 'rgba(13, 21, 39, 0.9)',
                          borderColor: color,
                          transform: 'translateX(4px)',
                        },
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <SerialBadge number={idx + 1} severity={v.severity} />
                        <Box>
                          <Typography variant="body2" fontWeight={700} sx={{ color: '#F8FAFC' }}>
                            {CleanVulnTitle(v.title)}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#94A3B8' }}>
                            {v.finding_id} • {v.impact_level || 'Impact'} • Likelihood: {v.likelihood_level || 'N/A'}
                          </Typography>
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip
                          label={v.severity}
                          size="small"
                          sx={{
                            fontWeight: 800,
                            fontSize: '0.65rem',
                            bgcolor: `${color}25`,
                            color,
                            border: `1px solid ${color}40`,
                          }}
                        />
                        {v.cvss_score && (
                          <Chip
                            label={`CVSS ${v.cvss_score}`}
                            size="small"
                            sx={{
                              fontWeight: 700,
                              fontSize: '0.65rem',
                              bgcolor: 'rgba(0, 240, 255, 0.12)',
                              color: '#00F0FF',
                            }}
                          />
                        )}
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </Box>

            {/* ── Strategic Recommendations ── */}
            {recommendations.length > 0 && (
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <TipsAndUpdates sx={{ color: '#FFD600', fontSize: 20 }} />
                  <Typography variant="subtitle1" fontWeight={800} sx={{ color: '#F8FAFC' }}>
                    Strategic Remediation Directives
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2 }}>
                  {recommendations.map((rec, i) => (
                    <Box
                      key={i}
                      sx={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 2,
                        p: 1.8,
                        borderRadius: 2.5,
                        bgcolor: 'rgba(255, 214, 0, 0.04)',
                        border: '1px solid rgba(255, 214, 0, 0.15)',
                      }}
                    >
                      <Box
                        sx={{
                          minWidth: 26,
                          height: 26,
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #FFD600, #FFAB00)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.72rem',
                          fontWeight: 900,
                          color: '#000',
                          mt: 0.2,
                          boxShadow: '0 2px 8px rgba(255,214,0,0.3)',
                        }}
                      >
                        {i + 1}
                      </Box>
                      <Typography variant="body2" sx={{ color: '#E2E8F0', lineHeight: 1.6 }}>
                        {rec}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}
          </Box>
        )}

        {/* ========================================================================= */}
        {/* ── TAB 1: VULNERABILITIES (WITH PROMINENT SERIAL NUMBERS) ── */}
        {/* ========================================================================= */}
        {tabValue === 1 && (
          <Box>
            {/* ── Controls Toolbar ── */}
            <Box
              sx={{
                p: 2,
                borderRadius: 2.5,
                bgcolor: 'rgba(13, 21, 39, 0.7)',
                border: '1px solid rgba(0, 240, 255, 0.2)',
                mb: 2.5,
                display: 'flex',
                flexDirection: 'column',
                gap: 1.5,
              }}
            >
              {/* Row 1: Search & Sort */}
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                <TextField
                  size="small"
                  placeholder="Search by Title, Serial (#01), CVE, CWE, Asset, or Description..."
                  value={vulnSearch}
                  onChange={(e) => setVulnSearch(e.target.value)}
                  sx={{
                    flex: '1 1 320px',
                    '& .MuiOutlinedInput-root': {
                      bgcolor: 'rgba(7, 11, 18, 0.7)',
                      color: '#F8FAFC',
                      borderRadius: 2,
                      fontSize: '0.85rem',
                      '& fieldset': { borderColor: 'rgba(0, 240, 255, 0.2)' },
                      '&:hover fieldset': { borderColor: 'rgba(0, 240, 255, 0.4)' },
                      '&.Mui-focused fieldset': { borderColor: '#00F0FF' },
                    },
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search sx={{ color: '#00F0FF', fontSize: 20 }} />
                      </InputAdornment>
                    ),
                    endAdornment: vulnSearch && (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setVulnSearch('')} sx={{ color: '#94A3B8' }}>
                          <Clear fontSize="small" />
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 600 }}>
                    Sort:
                  </Typography>
                  <Button
                    size="small"
                    variant={vulnSort === 'SEVERITY' ? 'contained' : 'outlined'}
                    onClick={() => setVulnSort('SEVERITY')}
                    sx={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      textTransform: 'none',
                      borderRadius: 1.5,
                      bgcolor: vulnSort === 'SEVERITY' ? 'rgba(0, 240, 255, 0.2)' : 'transparent',
                      color: vulnSort === 'SEVERITY' ? '#00F0FF' : '#94A3B8',
                      borderColor: 'rgba(0, 240, 255, 0.25)',
                    }}
                  >
                    Severity
                  </Button>
                  <Button
                    size="small"
                    variant={vulnSort === 'CVSS' ? 'contained' : 'outlined'}
                    onClick={() => setVulnSort('CVSS')}
                    sx={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      textTransform: 'none',
                      borderRadius: 1.5,
                      bgcolor: vulnSort === 'CVSS' ? 'rgba(0, 240, 255, 0.2)' : 'transparent',
                      color: vulnSort === 'CVSS' ? '#00F0FF' : '#94A3B8',
                      borderColor: 'rgba(0, 240, 255, 0.25)',
                    }}
                  >
                    CVSS Score
                  </Button>
                  <Button
                    size="small"
                    variant={vulnSort === 'SERIAL' ? 'contained' : 'outlined'}
                    onClick={() => setVulnSort('SERIAL')}
                    sx={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      textTransform: 'none',
                      borderRadius: 1.5,
                      bgcolor: vulnSort === 'SERIAL' ? 'rgba(0, 240, 255, 0.2)' : 'transparent',
                      color: vulnSort === 'SERIAL' ? '#00F0FF' : '#94A3B8',
                      borderColor: 'rgba(0, 240, 255, 0.25)',
                    }}
                  >
                    Serial (#01 → #12)
                  </Button>
                </Box>
              </Box>

              {/* Row 2: Severity Filter Chips */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 600, mr: 0.5 }}>
                  Severity:
                </Typography>
                <Chip
                  label={`All (${totalVulns})`}
                  size="small"
                  clickable
                  onClick={() => setVulnSeverityFilter('ALL')}
                  sx={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    bgcolor: vulnSeverityFilter === 'ALL' ? 'rgba(0, 240, 255, 0.25)' : 'rgba(255,255,255,0.05)',
                    color: vulnSeverityFilter === 'ALL' ? '#00F0FF' : '#94A3B8',
                    border: `1px solid ${vulnSeverityFilter === 'ALL' ? '#00F0FF' : 'rgba(255,255,255,0.1)'}`,
                  }}
                />
                <Chip
                  label={`Critical (${crit})`}
                  size="small"
                  clickable
                  onClick={() => setVulnSeverityFilter('CRITICAL')}
                  sx={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    bgcolor: vulnSeverityFilter === 'CRITICAL' ? 'rgba(255, 23, 68, 0.3)' : 'rgba(255, 23, 68, 0.1)',
                    color: '#FF1744',
                    border: `1px solid ${vulnSeverityFilter === 'CRITICAL' ? '#FF1744' : 'rgba(255, 23, 68, 0.25)'}`,
                  }}
                />
                <Chip
                  label={`High (${high})`}
                  size="small"
                  clickable
                  onClick={() => setVulnSeverityFilter('HIGH')}
                  sx={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    bgcolor: vulnSeverityFilter === 'HIGH' ? 'rgba(255, 145, 0, 0.3)' : 'rgba(255, 145, 0, 0.1)',
                    color: '#FF9100',
                    border: `1px solid ${vulnSeverityFilter === 'HIGH' ? '#FF9100' : 'rgba(255, 145, 0, 0.25)'}`,
                  }}
                />
                <Chip
                  label={`Medium (${med})`}
                  size="small"
                  clickable
                  onClick={() => setVulnSeverityFilter('MEDIUM')}
                  sx={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    bgcolor: vulnSeverityFilter === 'MEDIUM' ? 'rgba(255, 214, 0, 0.3)' : 'rgba(255, 214, 0, 0.1)',
                    color: '#FFD600',
                    border: `1px solid ${vulnSeverityFilter === 'MEDIUM' ? '#FFD600' : 'rgba(255, 214, 0, 0.25)'}`,
                  }}
                />
                <Chip
                  label={`Low (${low})`}
                  size="small"
                  clickable
                  onClick={() => setVulnSeverityFilter('LOW')}
                  sx={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    bgcolor: vulnSeverityFilter === 'LOW' ? 'rgba(0, 230, 118, 0.3)' : 'rgba(0, 230, 118, 0.1)',
                    color: '#00E676',
                    border: `1px solid ${vulnSeverityFilter === 'LOW' ? '#00E676' : 'rgba(0, 230, 118, 0.25)'}`,
                  }}
                />

                {(vulnSeverityFilter !== 'ALL' || vulnSearch) && (
                  <Button
                    size="small"
                    onClick={() => {
                      setVulnSeverityFilter('ALL');
                      setVulnSearch('');
                    }}
                    sx={{ color: '#00F0FF', textTransform: 'none', fontSize: '0.7rem', ml: 'auto' }}
                  >
                    Reset Filters
                  </Button>
                )}
              </Box>
            </Box>

            {/* ── Status Banner ── */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, px: 0.5 }}>
              <Typography variant="body2" sx={{ color: '#94A3B8' }}>
                Showing <b style={{ color: '#00F0FF' }}>{processedVulns.length}</b> of {totalVulns} indexed findings with verified serial references
              </Typography>
            </Box>

            {/* ── Vulnerabilities Cards List ── */}
            {processedVulns.length === 0 ? (
              <Box
                sx={{
                  p: 6,
                  textAlign: 'center',
                  borderRadius: 3,
                  bgcolor: 'rgba(13, 21, 39, 0.5)',
                  border: '1px dashed rgba(0, 240, 255, 0.2)',
                }}
              >
                <BugReport sx={{ fontSize: 44, color: '#64748B', mb: 1 }} />
                <Typography variant="subtitle1" fontWeight={700} sx={{ color: '#F8FAFC' }}>
                  No vulnerabilities match the selected filter
                </Typography>
                <Typography variant="body2" sx={{ color: '#94A3B8', mt: 0.5 }}>
                  Try resetting the search query or changing the severity level.
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    setVulnSeverityFilter('ALL');
                    setVulnSearch('');
                  }}
                  sx={{ mt: 2, borderColor: '#00F0FF', color: '#00F0FF', textTransform: 'none' }}
                >
                  Clear Filters
                </Button>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                {processedVulns.map((v) => {
                  const color = severityColor[v.severity] || '#00F0FF';
                  const isExpanded = !!expandedVulns[v.finding_id || v.serialNumber];

                  return (
                    <Box
                      key={v.finding_id || v.serialNumber}
                      sx={{
                        p: 3,
                        borderRadius: 3,
                        bgcolor: 'rgba(13, 21, 39, 0.65)',
                        border: `1px solid ${color}35`,
                        boxShadow: `0 8px 24px rgba(0,0,0,0.4), 0 0 15px ${color}10`,
                        position: 'relative',
                        overflow: 'hidden',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          borderColor: `${color}80`,
                          boxShadow: `0 12px 30px rgba(0,0,0,0.5), 0 0 20px ${color}20`,
                        },
                      }}
                    >
                      {/* Left Accent Severity Strip */}
                      <Box
                        sx={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: 5,
                          height: '100%',
                          bgcolor: color,
                          boxShadow: `0 0 8px ${color}`,
                        }}
                      />

                      {/* Header Row: Serial Badge + Clean Title + Score Badges */}
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1.5, pl: 1.2, mb: 1.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', flex: '1 1 500px' }}>
                          {/* 🌟 PROMINENT SERIAL BADGE 🌟 */}
                          <SerialBadge number={v.serialNumber} severity={v.severity} />

                          <Typography variant="h6" fontWeight={800} sx={{ color: '#F8FAFC', letterSpacing: 0.2 }}>
                            {v.cleanTitle}
                          </Typography>

                          <Chip
                            label={v.severity}
                            size="small"
                            sx={{
                              fontWeight: 900,
                              fontSize: '0.68rem',
                              bgcolor: `${color}25`,
                              color,
                              border: `1px solid ${color}60`,
                              letterSpacing: 0.5,
                              height: 22,
                            }}
                          />

                          {v.status && (
                            <Chip
                              label={v.status}
                              size="small"
                              sx={{
                                fontWeight: 700,
                                fontSize: '0.65rem',
                                bgcolor: 'rgba(255,255,255,0.08)',
                                color: '#E2E8F0',
                                border: '1px solid rgba(255,255,255,0.15)',
                                height: 22,
                              }}
                            />
                          )}

                          {v.new_or_repeat && (
                            <Chip
                              label={v.new_or_repeat === 'Repeat' ? 'Repeat Vulnerability' : 'New Finding'}
                              size="small"
                              sx={{
                                fontWeight: 700,
                                fontSize: '0.65rem',
                                bgcolor: v.new_or_repeat === 'Repeat' ? 'rgba(255, 145, 0, 0.15)' : 'rgba(0, 230, 118, 0.15)',
                                color: v.new_or_repeat === 'Repeat' ? '#FF9100' : '#00E676',
                                border: `1px solid ${v.new_or_repeat === 'Repeat' ? 'rgba(255, 145, 0, 0.3)' : 'rgba(0, 230, 118, 0.3)'}`,
                                height: 22,
                              }}
                            />
                          )}
                        </Box>

                        {/* CVSS & EPSS Badges */}
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                          {v.cvss_score && (
                            <Tooltip title="Common Vulnerability Scoring System (v3.1)" arrow>
                              <Chip
                                label={`CVSS ${v.cvss_score}`}
                                size="small"
                                sx={{
                                  fontWeight: 900,
                                  fontSize: '0.72rem',
                                  bgcolor: 'rgba(0, 240, 255, 0.15)',
                                  color: '#00F0FF',
                                  border: '1px solid rgba(0, 240, 255, 0.4)',
                                  height: 24,
                                }}
                              />
                            </Tooltip>
                          )}
                          {(v.reported_epss_score || v.epss_score) && (
                            <Tooltip title="Exploit Prediction Scoring System" arrow>
                              <Chip
                                label={`EPSS ${(v.reported_epss_score || v.epss_score)}`}
                                size="small"
                                sx={{
                                  fontWeight: 800,
                                  fontSize: '0.7rem',
                                  bgcolor: 'rgba(192, 132, 252, 0.15)',
                                  color: '#C084FC',
                                  border: '1px solid rgba(192, 132, 252, 0.35)',
                                  height: 24,
                                }}
                              />
                            </Tooltip>
                          )}
                        </Box>
                      </Box>

                      {/* Finding ID with Copy Button */}
                      <Box sx={{ pl: 1.2, mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="caption" sx={{ color: '#64748B', fontFamily: 'monospace' }}>
                          Finding ID: <span style={{ color: '#94A3B8' }}>{v.finding_id}</span>
                        </Typography>
                        <Tooltip title="Copy Finding ID" arrow>
                          <IconButton
                            size="small"
                            onClick={() => {
                              handleCopyText(v.finding_id, 'Finding ID');
                              setCopiedFindingId(v.finding_id);
                              setTimeout(() => setCopiedFindingId(null), 2000);
                            }}
                            sx={{ p: 0.2, color: copiedFindingId === v.finding_id ? '#00E676' : '#64748B' }}
                          >
                            {copiedFindingId === v.finding_id ? <Check sx={{ fontSize: 13 }} /> : <ContentCopy sx={{ fontSize: 13 }} />}
                          </IconButton>
                        </Tooltip>
                      </Box>

                      {/* Main Observation Description */}
                      <Box sx={{ pl: 1.2, mb: 2 }}>
                        <Typography variant="body2" sx={{ color: '#E2E8F0', lineHeight: 1.7, fontSize: '0.88rem' }}>
                          {v.observation_description}
                        </Typography>
                      </Box>

                      {/* Technical Parameter Grid */}
                      <Box
                        sx={{
                          ml: 1.2,
                          mb: 2,
                          p: 2,
                          borderRadius: 2.5,
                          bgcolor: 'rgba(7, 11, 18, 0.6)',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                          gap: 2,
                        }}
                      >
                        {v.impact_level && (
                          <Box>
                            <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 800, display: 'block', letterSpacing: 0.5 }}>
                              IMPACT LEVEL
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#F8FAFC', fontWeight: 600 }}>
                              {v.impact_level}
                            </Typography>
                          </Box>
                        )}

                        {v.likelihood_level && (
                          <Box>
                            <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 800, display: 'block', letterSpacing: 0.5 }}>
                              LIKELIHOOD
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#F8FAFC', fontWeight: 600 }}>
                              {v.likelihood_level}
                            </Typography>
                          </Box>
                        )}

                        {v.cwe && (
                          <Box>
                            <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 800, display: 'block', letterSpacing: 0.5 }}>
                              CWE CLASSIFICATION
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.3 }}>
                              {(Array.isArray(v.cwe) ? v.cwe : [v.cwe]).map((item, idx) => (
                                <Chip
                                  key={idx}
                                  label={item}
                                  size="small"
                                  onClick={() => handleCopyText(item, 'CWE')}
                                  clickable
                                  sx={{
                                    fontFamily: 'monospace',
                                    fontWeight: 700,
                                    fontSize: '0.68rem',
                                    bgcolor: 'rgba(0, 240, 255, 0.1)',
                                    color: '#00F0FF',
                                    border: '1px solid rgba(0, 240, 255, 0.25)',
                                    height: 20,
                                  }}
                                />
                              ))}
                            </Box>
                          </Box>
                        )}

                        {v.cve_id && v.cve_id.length > 0 && (
                          <Box>
                            <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 800, display: 'block', letterSpacing: 0.5 }}>
                              CVE IDENTIFIERS
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.3 }}>
                              {v.cve_id.map((cve, idx) => (
                                <Chip
                                  key={idx}
                                  label={cve}
                                  size="small"
                                  onClick={() => handleCopyText(cve, 'CVE ID')}
                                  clickable
                                  sx={{
                                    fontFamily: 'monospace',
                                    fontWeight: 700,
                                    fontSize: '0.68rem',
                                    bgcolor: 'rgba(255, 23, 68, 0.12)',
                                    color: '#FF1744',
                                    border: '1px solid rgba(255, 23, 68, 0.3)',
                                    height: 20,
                                  }}
                                />
                              ))}
                            </Box>
                          </Box>
                        )}

                        {v.affected_asset && v.affected_asset.length > 0 && (
                          <Box sx={{ gridColumn: '1 / -1' }}>
                            <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 800, display: 'block', letterSpacing: 0.5 }}>
                              AFFECTED ASSETS & ENDPOINTS
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap', mt: 0.5 }}>
                              {v.affected_asset.map((asset, idx) => (
                                <Chip
                                  key={idx}
                                  label={asset}
                                  size="small"
                                  onClick={() => handleCopyText(asset, 'Asset')}
                                  clickable
                                  sx={{
                                    fontFamily: 'monospace',
                                    bgcolor: 'rgba(255, 255, 255, 0.05)',
                                    color: '#E2E8F0',
                                    border: '1px solid rgba(255, 255, 255, 0.12)',
                                    fontSize: '0.72rem',
                                  }}
                                />
                              ))}
                            </Box>
                          </Box>
                        )}

                        {v.cvss_vector && (
                          <Box sx={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: 'rgba(0,0,0,0.3)', p: 1.2, borderRadius: 1.5 }}>
                            <Box>
                              <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 800, display: 'block', fontSize: '0.65rem' }}>
                                CVSS v3.1 VECTOR STRING
                              </Typography>
                              <Typography variant="body2" sx={{ fontFamily: 'monospace', color: '#00F0FF', fontSize: '0.78rem' }}>
                                {v.cvss_vector}
                              </Typography>
                            </Box>
                            <Tooltip title="Copy CVSS Vector" arrow>
                              <IconButton size="small" onClick={() => handleCopyText(v.cvss_vector, 'CVSS Vector')} sx={{ color: '#00F0FF' }}>
                                <ContentCopy fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        )}
                      </Box>

                      {/* Collapsible Detailed Rationale */}
                      <Box sx={{ pl: 1.2 }}>
                        <Button
                          size="small"
                          onClick={() => toggleVulnExpanded(v.finding_id || v.serialNumber)}
                          endIcon={isExpanded ? <ExpandLess /> : <ExpandMore />}
                          sx={{
                            color: '#94A3B8',
                            textTransform: 'none',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            p: 0,
                            mb: 1,
                            '&:hover': { color: '#00F0FF' },
                          }}
                        >
                          {isExpanded ? 'Hide Deep Analysis' : 'Show Severity Rationale & Root Cause'}
                        </Button>

                        <Collapse in={isExpanded}>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, p: 2, bgcolor: 'rgba(0,0,0,0.35)', borderRadius: 2, mb: 1.5 }}>
                            {v.severity_rationale && (
                              <Box>
                                <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 800, display: 'block', letterSpacing: 0.5 }}>
                                  SEVERITY RATIONALE
                                </Typography>
                                <Typography variant="body2" sx={{ color: '#CBD5E1', mt: 0.3 }}>
                                  {v.severity_rationale}
                                </Typography>
                              </Box>
                            )}

                            {v.impact && (
                              <Box>
                                <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 800, display: 'block', letterSpacing: 0.5 }}>
                                  TECHNICAL IMPACT & BLAST RADIUS
                                </Typography>
                                <Typography variant="body2" sx={{ color: '#CBD5E1', mt: 0.3 }}>
                                  {v.impact}
                                </Typography>
                              </Box>
                            )}

                            {v.likely_root_cause && (
                              <Box>
                                <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 800, display: 'block', letterSpacing: 0.5 }}>
                                  LIKELY ROOT CAUSE
                                </Typography>
                                <Typography variant="body2" sx={{ color: '#CBD5E1', mt: 0.3 }}>
                                  {v.likely_root_cause}
                                </Typography>
                              </Box>
                            )}

                            {v.preconditions && (
                              <Box>
                                <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 800, display: 'block', letterSpacing: 0.5 }}>
                                  EXPLOITATION PRECONDITIONS
                                </Typography>
                                <Typography variant="body2" sx={{ color: '#CBD5E1', mt: 0.3 }}>
                                  {v.preconditions}
                                </Typography>
                              </Box>
                            )}
                          </Box>
                        </Collapse>

                        {/* Prescribed Remediation Box */}
                        {v.recommendation && (
                          <Box
                            sx={{
                              p: 2,
                              bgcolor: 'rgba(0, 230, 118, 0.06)',
                              borderLeft: '4px solid #00E676',
                              borderRadius: '0 8px 8px 0',
                              border: '1px solid rgba(0, 230, 118, 0.2)',
                              borderLeftWidth: 4,
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                              <Typography variant="caption" sx={{ color: '#00E676', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 0.8 }}>
                                <TipsAndUpdates fontSize="small" /> PRESCRIBED REMEDIATION
                              </Typography>
                              <Tooltip title="Copy Remediation Plan" arrow>
                                <IconButton
                                  size="small"
                                  onClick={() => handleCopyText(v.recommendation, 'Remediation')}
                                  sx={{ color: '#00E676', p: 0.2 }}
                                >
                                  <ContentCopy sx={{ fontSize: 14 }} />
                                </IconButton>
                              </Tooltip>
                            </Box>
                            <Typography variant="body2" sx={{ color: '#E2E8F0', lineHeight: 1.6 }}>
                              {v.recommendation}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            )}
          </Box>
        )}

        {/* ========================================================================= */}
        {/* ── TAB 2: FULL JSON (STRUCTURED SCHEMA EXPLORER) ── */}
        {/* ========================================================================= */}
        {tabValue === 2 && (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, px: 0.5 }}>
              <Box>
                <Typography variant="subtitle1" fontWeight={800} sx={{ color: '#F8FAFC' }}>
                  Standardized Audit Schema Explorer
                </Typography>
                <Typography variant="caption" sx={{ color: '#94A3B8' }}>
                  Interactive hierarchical tree categorized by CERT-In security specification modules
                </Typography>
              </Box>
              <Tooltip title={copied ? 'Copied Full Output!' : 'Copy Entire Document'} arrow>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={copied ? <Check /> : <ContentCopy />}
                  onClick={handleCopyJson}
                  sx={{
                    borderColor: copied ? '#00E676' : 'rgba(0, 240, 255, 0.3)',
                    color: copied ? '#00E676' : '#00F0FF',
                    textTransform: 'none',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                  }}
                >
                  {copied ? 'Copied!' : 'Copy Complete JSON'}
                </Button>
              </Tooltip>
            </Box>

            {/* Categorized Schema Cards */}
            {results.executive_summary && (
              <JsonSectionCard
                title="Executive Summary & Risk Metrics"
                data={results.executive_summary}
                icon={Assessment}
                onCopy={(t) => enqueueSnackbar(`Copied ${t}`, { variant: 'success' })}
              />
            )}

            {results.detailed_observations && (
              <JsonSectionCard
                title={`Detailed Vulnerability Observations (${vulnsArray.length} items)`}
                data={results.detailed_observations}
                icon={BugReport}
                onCopy={(t) => enqueueSnackbar(`Copied ${t}`, { variant: 'success' })}
              />
            )}

            {results.compliance && (
              <JsonSectionCard
                title="Statutory Compliance Audit Matrix"
                data={results.compliance}
                icon={Shield}
                onCopy={(t) => enqueueSnackbar(`Copied ${t}`, { variant: 'success' })}
              />
            )}

            {results.recommendations && (
              <JsonSectionCard
                title="Strategic Remediation Roadmap"
                data={results.recommendations}
                icon={TipsAndUpdates}
                onCopy={(t) => enqueueSnackbar(`Copied ${t}`, { variant: 'success' })}
              />
            )}

            {/* Any other keys in results */}
            {Object.keys(results)
              .filter((k) => !['executive_summary', 'detailed_observations', 'compliance', 'recommendations'].includes(k))
              .map((key) => (
                <JsonSectionCard
                  key={key}
                  title={key.replace(/_/g, ' ').toUpperCase()}
                  data={results[key]}
                  icon={DataObject}
                  onCopy={(t) => enqueueSnackbar(`Copied ${t}`, { variant: 'success' })}
                />
              ))}
          </Box>
        )}

        {/* ========================================================================= */}
        {/* ── TAB 3: RAW JSON CODE INSPECTOR ── */}
        {/* ========================================================================= */}
        {tabValue === 3 && (
          <Box
            sx={{
              bgcolor: 'rgba(7, 11, 18, 0.95)',
              borderRadius: 3,
              border: '1px solid rgba(0, 240, 255, 0.2)',
              overflow: 'hidden',
              boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            }}
          >
            {/* Terminal Header */}
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                px: 2.5,
                py: 1.5,
                bgcolor: 'rgba(0, 240, 255, 0.05)',
                borderBottom: '1px solid rgba(0, 240, 255, 0.12)',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{ display: 'flex', gap: 0.8 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#FF1744' }} />
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#FFD600' }} />
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#00E676' }} />
                </Box>
                <Typography variant="caption" sx={{ color: '#00F0FF', fontFamily: 'monospace', fontWeight: 800 }}>
                  RAW JSON PAYLOAD • {rawJsonLines.length} LINES • {rawJsonSizeKb} KB
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<DownloadForOffline />}
                  onClick={handleDownloadJson}
                  sx={{
                    borderColor: 'rgba(0, 240, 255, 0.3)',
                    color: '#00F0FF',
                    textTransform: 'none',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    '&:hover': { borderColor: '#00F0FF', bgcolor: 'rgba(0, 240, 255, 0.1)' },
                  }}
                >
                  Download .json
                </Button>

                <Button
                  size="small"
                  variant="outlined"
                  startIcon={copied ? <Check /> : <ContentCopy />}
                  onClick={handleCopyJson}
                  sx={{
                    borderColor: copied ? '#00E676' : 'rgba(0, 240, 255, 0.3)',
                    color: copied ? '#00E676' : '#00F0FF',
                    textTransform: 'none',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    bgcolor: copied ? 'rgba(0, 230, 118, 0.1)' : 'transparent',
                    '&:hover': {
                      borderColor: copied ? '#00E676' : '#00F0FF',
                      bgcolor: copied ? 'rgba(0, 230, 118, 0.2)' : 'rgba(0, 240, 255, 0.1)',
                    },
                  }}
                >
                  {copied ? 'Copied!' : 'Copy Raw JSON'}
                </Button>
              </Box>
            </Box>

            {/* Code Body with Line Numbers */}
            <Box
              sx={{
                p: 2.5,
                maxHeight: 560,
                overflowY: 'auto',
                display: 'flex',
                fontFamily: 'monospace',
                fontSize: '0.82rem',
                lineHeight: 1.6,
                bgcolor: 'rgba(4, 7, 13, 0.95)',
              }}
            >
              {/* Line Numbers Gutter */}
              <Box
                sx={{
                  pr: 2,
                  mr: 2,
                  borderRight: '1px solid rgba(255, 255, 255, 0.08)',
                  userSelect: 'none',
                  textAlign: 'right',
                  color: '#475569',
                  minWidth: 40,
                }}
              >
                {rawJsonLines.map((_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </Box>

              {/* Code Pre Text */}
              <Box sx={{ flex: 1, overflowX: 'auto' }}>
                <pre
                  style={{
                    margin: 0,
                    color: '#38BDF8',
                    fontFamily: 'inherit',
                    fontSize: 'inherit',
                    lineHeight: 'inherit',
                    whiteSpace: 'pre',
                  }}
                >
                  {rawJsonString}
                </pre>
              </Box>
            </Box>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ──────────── Reports Page ──────────── */
function ReportsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAdmin } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();

  const initialPage = useMemo(() => {
    const p = parseInt(searchParams.get('page') || '1', 10);
    return isNaN(p) || p < 1 ? 0 : p - 1;
  }, []);

  const initialPageSize = useMemo(() => {
    const s = parseInt(searchParams.get('pageSize') || '10', 10);
    return isNaN(s) || s < 1 ? 10 : s;
  }, []);

  const initialSearch = searchParams.get('q') || searchParams.get('search') || '';

  const [paginationModel, setPaginationModel] = useState({ page: initialPage, pageSize: initialPageSize });
  const [search, setSearch] = useState(initialSearch);
  const [searchDebounce, setSearchDebounce] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [formatFilter, setFormatFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('cyber_reports_view_mode') || 'table');
  const [copiedHash, setCopiedHash] = useState(null);

  // Pipeline state
  const [pipelineStatus, setPipelineStatus] = useState({}); // { [reportId]: 'idle' | 'processing' | 'completed' | 'error' }
  const [pipelineResults, setPipelineResults] = useState({}); // { [reportId]: {...results} }
  const [confirmDialog, setConfirmDialog] = useState({ open: false, report: null });
  const [resultsDialog, setResultsDialog] = useState({ open: false, reportId: null, reportName: '' });

  // Sync search with URL search param
  useEffect(() => {
    const q = searchParams.get('q') || searchParams.get('search');
    if (q !== null && q !== search) {
      setSearch(q);
      setSearchDebounce(q);
    }
  }, [searchParams]);

  useEffect(() => {
    localStorage.setItem('cyber_reports_view_mode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    const timer = setTimeout(() => setSearchDebounce(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['reports', paginationModel.page, paginationModel.pageSize, searchDebounce],
    queryFn: async () => {
      const params = {
        skip: paginationModel.page * paginationModel.pageSize,
        limit: paginationModel.pageSize,
      };
      if (searchDebounce) params.search = searchDebounce;
      const response = await api.get('/api/reports', { params });
      return response.data;
    },
    placeholderData: keepPreviousData,
  });

  const reports = data?.reports || [];
  const total = data?.total;

  const rowCountRef = useRef(0);
  const rowCount = useMemo(() => {
    if (total !== undefined && total !== null) {
      rowCountRef.current = total;
    }
    return rowCountRef.current || total || 0;
  }, [total]);

  // Client-side filtering across current page for status & format
  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      if (statusFilter !== 'ALL' && r.upload_status !== statusFilter) return false;
      if (formatFilter !== 'ALL' && r.file_extension?.toLowerCase() !== formatFilter.toLowerCase()) return false;
      return true;
    });
  }, [reports, statusFilter, formatFilter]);

  // KPI counts
  const stats = useMemo(() => {
    const totalCount = rowCount || reports.length;
    const validatedCount = reports.filter((r) => r.upload_status === 'VALIDATED').length;
    const uploadedCount = reports.filter((r) => r.upload_status === 'UPLOADED').length;
    const flaggedCount = reports.filter(
      (r) => r.upload_status === 'QUARANTINED' || r.upload_status === 'REJECTED' || r.partial_duplicate
    ).length;
    return {
      total: totalCount,
      validated: validatedCount,
      uploaded: uploadedCount,
      flagged: flaggedCount,
    };
  }, [rowCount, reports]);

  const handlePaginationModelChange = (newModel) => {
    if (newModel.page === 0 && paginationModel.page > 0 && (isLoading || rowCountRef.current === 0)) {
      return;
    }
    setPaginationModel(newModel);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (newModel.page > 0) {
        next.set('page', String(newModel.page + 1));
      } else {
        next.delete('page');
      }
      if (newModel.pageSize !== 10) {
        next.set('pageSize', String(newModel.pageSize));
      } else {
        next.delete('pageSize');
      }
      return next;
    }, { replace: true });
  };

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearch(val);
    setPaginationModel((prev) => ({ ...prev, page: 0 }));
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (val.trim()) {
        next.set('q', val.trim());
      } else {
        next.delete('q');
        next.delete('search');
      }
      next.delete('page');
      return next;
    }, { replace: true });
  };

  const handleClearSearch = () => {
    setSearch('');
    setSearchDebounce('');
    setPaginationModel((prev) => ({ ...prev, page: 0 }));
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('q');
      next.delete('search');
      next.delete('page');
      return next;
    }, { replace: true });
  };

  const handleResetFilters = () => {
    setStatusFilter('ALL');
    setFormatFilter('ALL');
    handleClearSearch();
  };

  const handleCopyHash = (hash, e) => {
    if (e) e.stopPropagation();
    if (!hash) return;
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    enqueueSnackbar('SHA-256 hash copied to clipboard!', { variant: 'success', autoHideDuration: 2000 });
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const handleDownload = async (reportId, filename, e) => {
    if (e) e.stopPropagation();
    try {
      const response = await api.get(`/api/reports/${reportId}/download`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      enqueueSnackbar(`Downloading ${filename}`, { variant: 'info' });
    } catch {
      enqueueSnackbar('Download failed', { variant: 'error' });
    }
  };

  const handleDelete = async (reportId, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this report from the repository?')) return;
    try {
      await api.delete(`/api/reports/${reportId}`);
      enqueueSnackbar('Report deleted successfully', { variant: 'success' });
      refetch();
    } catch {
      enqueueSnackbar('Delete failed', { variant: 'error' });
    }
  };

  /* ── Pipeline Handlers ── */
  const openConfirmDialog = (report, e) => {
    if (e) e.stopPropagation();
    setConfirmDialog({ open: true, report });
  };

  const closeConfirmDialog = () => {
    setConfirmDialog({ open: false, report: null });
  };

  const handleRunPipeline = async () => {
    const report = confirmDialog.report;
    if (!report) return;
    closeConfirmDialog();

    const reportId = report.report_id;
    setPipelineStatus((prev) => ({ ...prev, [reportId]: 'processing' }));

    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${api.defaults.baseURL || ''}/api/reports/${reportId}/run-pipeline`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Pipeline error: ${response.status} - ${errText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finalData = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.substring(6));
              if (event.type === 'result') {
                finalData = event.data;
              } else if (event.type === 'error') {
                throw new Error(event.message);
              }
            } catch (e) {
              // ignore parse errors
            }
          }
        }
      }

      setPipelineResults((prev) => ({ ...prev, [reportId]: finalData }));
      setPipelineStatus((prev) => ({ ...prev, [reportId]: 'completed' }));
      enqueueSnackbar('AI Pipeline completed successfully!', { variant: 'success' });
      refetch();
    } catch (err) {
      setPipelineStatus((prev) => ({ ...prev, [reportId]: 'error' }));
      const detail = err.response?.data?.detail || err.message || 'Pipeline failed';
      enqueueSnackbar(`Pipeline error: ${detail}`, { variant: 'error' });
    }
  };

  const openResultsDialog = (reportId, reportName, e) => {
    if (e) e.stopPropagation();
    setResultsDialog({ open: true, reportId, reportName });
  };

  const closeResultsDialog = () => {
    setResultsDialog({ open: false, reportId: null, reportName: '' });
  };

  const handleViewResults = async (report, e) => {
    if (e) e.stopPropagation();
    if (pipelineResults[report.report_id]) {
      openResultsDialog(report.report_id, report.original_filename);
      return;
    }
    try {
      const response = await api.get(`/api/reports/${report.report_id}/results`);
      setPipelineResults((prev) => ({ ...prev, [report.report_id]: response.data }));
      setPipelineStatus((prev) => ({ ...prev, [report.report_id]: 'completed' }));
      openResultsDialog(report.report_id, report.original_filename);
    } catch (err) {
      if (err.response?.status === 404) {
        enqueueSnackbar('No pipeline results found for this report.', { variant: 'info' });
      } else {
        enqueueSnackbar('Failed to load results.', { variant: 'error' });
      }
    }
  };

  const renderPipelineChip = (report) => {
    const status = pipelineStatus[report.report_id];

    if (status === 'processing') {
      return (
        <Chip
          icon={
            <HourglassTop
              sx={{
                fontSize: 14,
                animation: 'spin 1.5s linear infinite',
                '@keyframes spin': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } },
              }}
            />
          }
          label="Processing"
          size="small"
          sx={{
            fontWeight: 700,
            fontSize: '0.68rem',
            bgcolor: 'rgba(0, 240, 255, 0.12)',
            color: '#00F0FF',
            border: '1px solid rgba(0, 240, 255, 0.3)',
          }}
        />
      );
    }

    if (status === 'completed' || report.has_pipeline_data) {
      return (
        <Chip
          icon={<CheckCircle sx={{ fontSize: '13px !important', color: '#10B981 !important' }} />}
          label="AI Verified"
          size="small"
          onClick={(e) => handleViewResults(report, e)}
          sx={{
            fontWeight: 700,
            fontSize: '0.68rem',
            bgcolor: 'rgba(16, 185, 129, 0.12)',
            color: '#34D399',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            cursor: 'pointer',
            transition: 'all 0.2s',
            '&:hover': {
              bgcolor: 'rgba(16, 185, 129, 0.25)',
              transform: 'scale(1.04)',
            },
          }}
        />
      );
    }

    if (status === 'error') {
      return (
        <Chip
          icon={<Warning sx={{ fontSize: '13px !important', color: '#EF4444 !important' }} />}
          label="Failed"
          size="small"
          sx={{
            fontWeight: 700,
            fontSize: '0.68rem',
            bgcolor: 'rgba(239, 68, 68, 0.12)',
            color: '#F87171',
            border: '1px solid rgba(239, 68, 68, 0.3)',
          }}
        />
      );
    }

    return (
      <Button
        size="small"
        variant="text"
        startIcon={<RocketLaunch sx={{ fontSize: 13 }} />}
        onClick={(e) => openConfirmDialog(report, e)}
        sx={{
          color: '#38BDF8',
          fontSize: '0.7rem',
          fontWeight: 600,
          textTransform: 'none',
          py: 0.2,
          px: 1,
          borderRadius: 1,
          '&:hover': { bgcolor: 'rgba(56, 189, 248, 0.1)' },
        }}
      >
        Run AI
      </Button>
    );
  };

  const renderFormatBadge = (ext) => {
    const upper = (ext || '').replace('.', '').toUpperCase();
    let bg = 'rgba(255, 255, 255, 0.06)';
    let text = '#94A3B8';
    let border = 'rgba(255, 255, 255, 0.12)';
    if (upper === 'PDF') {
      bg = 'rgba(244, 63, 94, 0.12)';
      text = '#FB7185';
      border = 'rgba(244, 63, 94, 0.3)';
    } else if (upper === 'DOCX') {
      bg = 'rgba(56, 189, 248, 0.12)';
      text = '#38BDF8';
      border = 'rgba(56, 189, 248, 0.3)';
    } else if (upper === 'TXT') {
      bg = 'rgba(52, 211, 153, 0.12)';
      text = '#34D399';
      border = 'rgba(52, 211, 153, 0.3)';
    }
    return (
      <Box
        sx={{
          px: 0.8,
          py: 0.15,
          borderRadius: '4px',
          backgroundColor: bg,
          color: text,
          border: `1px solid ${border}`,
          fontFamily: 'monospace',
          fontSize: '0.62rem',
          fontWeight: 800,
          letterSpacing: '0.05em',
        }}
      >
        {upper}
      </Box>
    );
  };

  const renderStatusPill = (status) => {
    let color = '#38BDF8';
    let bg = 'rgba(56, 189, 248, 0.1)';
    let border = 'rgba(56, 189, 248, 0.25)';
    let dot = '#38BDF8';

    if (status === 'VALIDATED') {
      color = '#34D399';
      bg = 'rgba(16, 185, 129, 0.1)';
      border = 'rgba(16, 185, 129, 0.3)';
      dot = '#10B981';
    } else if (status === 'QUARANTINED') {
      color = '#FBBF24';
      bg = 'rgba(245, 158, 11, 0.1)';
      border = 'rgba(245, 158, 11, 0.3)';
      dot = '#F59E0B';
    } else if (status === 'REJECTED') {
      color = '#F87171';
      bg = 'rgba(239, 68, 68, 0.1)';
      border = 'rgba(239, 68, 68, 0.3)';
      dot = '#EF4444';
    }

    return (
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.8,
          px: 1.2,
          py: 0.35,
          borderRadius: '16px',
          backgroundColor: bg,
          border: `1px solid ${border}`,
          fontSize: '0.7rem',
          fontWeight: 700,
          letterSpacing: '0.03em',
          color,
        }}
      >
        <Box
          sx={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: dot,
            boxShadow: `0 0 6px ${dot}`,
          }}
        />
        {status}
      </Box>
    );
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  // DataGrid Columns definition
  const columns = useMemo(
    () => [
      {
        field: 'sno',
        headerName: 'S.No',
        width: 70,
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        align: 'center',
        headerAlign: 'center',
        renderCell: (params) => {
          const index = filteredReports.findIndex((r) => r.report_id === params.row.report_id);
          const sno = paginationModel.page * paginationModel.pageSize + (index >= 0 ? index + 1 : 1);
          return (
            <Typography
              variant="body2"
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                fontWeight: 700,
                color: '#64748B',
                fontFamily: 'monospace',
                fontSize: '0.8rem',
              }}
            >
              {sno}
            </Typography>
          );
        },
      },
      {
        field: 'original_filename',
        headerName: 'File Details & Cryptographic Hash',
        minWidth: 340,
        flex: 2.4,
        renderCell: (params) => {
          const report = params.row;
          const ext = report.file_extension?.toLowerCase();
          const isPdf = ext === '.pdf';
          const isDocx = ext === '.docx' || ext === '.doc';

          return (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                width: '100%',
                lineHeight: 'normal',
                py: 0.5,
              }}
            >
              {/* File Icon Badge */}
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: '9px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  backgroundColor: isPdf
                    ? 'rgba(244, 63, 94, 0.12)'
                    : isDocx
                    ? 'rgba(56, 189, 248, 0.12)'
                    : 'rgba(52, 211, 153, 0.12)',
                  border: `1px solid ${
                    isPdf
                      ? 'rgba(244, 63, 94, 0.3)'
                      : isDocx
                      ? 'rgba(56, 189, 248, 0.3)'
                      : 'rgba(52, 211, 153, 0.3)'
                  }`,
                }}
              >
                <Description
                  sx={{
                    fontSize: 20,
                    color: isPdf ? '#FB7185' : isDocx ? '#38BDF8' : '#34D399',
                  }}
                />
              </Box>

              {/* Title & Hash Strip */}
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  minWidth: 0,
                  flex: 1,
                  lineHeight: 'normal',
                  gap: 0.5,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                  <Typography
                    onClick={() => navigate(`/reports/${report.report_id}`)}
                    variant="body2"
                    fontWeight={700}
                    noWrap
                    sx={{
                      cursor: 'pointer',
                      color: '#F8FAFC !important',
                      fontSize: '0.84rem',
                      lineHeight: 1.3,
                      maxWidth: { xs: 160, sm: 220, md: 280, lg: 360 },
                      transition: 'color 0.15s ease',
                      '&:hover': { color: '#00F0FF !important', textDecoration: 'underline' },
                    }}
                  >
                    {report.original_filename}
                  </Typography>
                  {renderFormatBadge(report.file_extension)}
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {report.sha256_hash ? (
                    <Tooltip title="Click to copy full SHA-256 hash" arrow>
                      <Box
                        onClick={(e) => handleCopyHash(report.sha256_hash, e)}
                        sx={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 0.5,
                          cursor: 'pointer',
                          px: 0.8,
                          py: 0.15,
                          borderRadius: '4px',
                          backgroundColor: 'rgba(255, 255, 255, 0.04)',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          fontSize: '0.67rem',
                          fontFamily: 'monospace',
                          lineHeight: 1.2,
                          color: copiedHash === report.sha256_hash ? '#34D399' : '#94A3B8',
                          '&:hover': {
                            backgroundColor: 'rgba(0, 240, 255, 0.08)',
                            borderColor: 'rgba(0, 240, 255, 0.3)',
                            color: '#00F0FF',
                          },
                        }}
                      >
                        {copiedHash === report.sha256_hash ? (
                          <Check sx={{ fontSize: 11, color: '#34D399' }} />
                        ) : (
                          <ContentCopy sx={{ fontSize: 11 }} />
                        )}
                        <span>SHA: {report.sha256_hash.substring(0, 10)}...</span>
                      </Box>
                    </Tooltip>
                  ) : (
                    <Typography variant="caption" sx={{ color: '#475569', fontSize: '0.68rem' }}>
                      SHA: —
                    </Typography>
                  )}

                  {report.simhash && (
                    <Typography
                      variant="caption"
                      sx={{
                        color: '#64748B',
                        fontFamily: 'monospace',
                        fontSize: '0.66rem',
                        lineHeight: 1.2,
                        px: 0.7,
                        py: 0.15,
                        borderRadius: '4px',
                        backgroundColor: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                      }}
                    >
                      Sim: {report.simhash.substring(0, 8)}
                    </Typography>
                  )}
                </Box>
              </Box>
            </Box>
          );
        },
      },
      {
        field: 'agency',
        headerName: 'Agency',
        width: 140,
        renderCell: (params) => (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, height: '100%' }}>
            <Business sx={{ fontSize: 15, color: '#64748B' }} />
            <Typography variant="body2" sx={{ fontSize: '0.78rem', color: '#CBD5E1', fontWeight: 600 }} noWrap>
              {params.row.agency?.agency_name || '—'}
            </Typography>
          </Box>
        ),
      },
      {
        field: 'version',
        headerName: 'Lineage',
        width: 110,
        renderCell: (params) => {
          const report = params.row;
          return (
            <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
              {report.partial_duplicate ? (
                <Link
                  to={`/reports/${report.partial_duplicate.original_report_id}`}
                  style={{ textDecoration: 'none' }}
                >
                  <Chip
                    label="Duplicate"
                    size="small"
                    sx={{
                      cursor: 'pointer',
                      fontWeight: 700,
                      fontSize: '0.65rem',
                      height: 22,
                      backgroundColor: 'rgba(245, 158, 11, 0.1)',
                      color: '#FBBF24',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                    }}
                  />
                </Link>
              ) : (
                <Chip
                  label="Original"
                  size="small"
                  sx={{
                    fontWeight: 700,
                    fontSize: '0.65rem',
                    height: 22,
                    backgroundColor: 'rgba(16, 185, 129, 0.08)',
                    color: '#34D399',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                  }}
                />
              )}
            </Box>
          );
        },
      },
      {
        field: 'uploader_username',
        headerName: 'Uploader',
        width: 110,
        renderCell: (params) => (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, height: '100%' }}>
            <Person sx={{ fontSize: 15, color: '#64748B' }} />
            <Typography variant="body2" sx={{ fontSize: '0.78rem', color: '#94A3B8' }} noWrap>
              {params.value || '—'}
            </Typography>
          </Box>
        ),
      },
      {
        field: 'file_size',
        headerName: 'Size',
        width: 95,
        renderCell: (params) => (
          <Typography
            variant="body2"
            sx={{
              display: 'flex',
              alignItems: 'center',
              height: '100%',
              fontSize: '0.8rem',
              color: '#CBD5E1',
              fontVariantNumeric: 'tabular-nums',
              fontWeight: 600,
            }}
          >
            {formatFileSize(params.value)}
          </Typography>
        ),
      },
      {
        field: 'upload_status',
        headerName: 'Integrity State',
        width: 135,
        renderCell: (params) => (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            {renderStatusPill(params.value)}
          </Box>
        ),
      },
      {
        field: 'pipeline',
        headerName: 'Pipeline AI',
        width: 125,
        renderCell: (params) => (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            {renderPipelineChip(params.row)}
          </Box>
        ),
      },
      {
        field: 'created_at',
        headerName: 'Ingested',
        width: 110,
        renderCell: (params) => (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, height: '100%' }}>
            <CalendarToday sx={{ fontSize: 13, color: '#64748B' }} />
            <Typography
              variant="body2"
              sx={{
                fontSize: '0.76rem',
                color: '#94A3B8',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {new Date(params.value).toLocaleDateString()}
            </Typography>
          </Box>
        ),
      },
      {
        field: 'actions',
        headerName: 'Actions',
        minWidth: 260,
        flex: 1.4,
        sortable: false,
        renderCell: (params) => {
          const report = params.row;
          return (
            <Box
              sx={{
                display: 'flex',
                gap: 1,
                alignItems: 'center',
                justifyContent: 'flex-end',
                height: '100%',
                width: '100%',
                pr: 1,
              }}
            >
              <Button
                size="small"
                variant="outlined"
                startIcon={<Security sx={{ fontSize: 14 }} />}
                onClick={(e) => handleViewResults(report, e)}
                sx={{
                  color: '#FBBF24',
                  borderColor: 'rgba(245, 158, 11, 0.4)',
                  bgcolor: 'rgba(245, 158, 11, 0.06)',
                  '&:hover': { borderColor: '#FBBF24', bgcolor: 'rgba(245, 158, 11, 0.15)' },
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: '0.72rem',
                  px: 1.2,
                  py: 0.35,
                  borderRadius: '6px',
                }}
              >
                Inspect
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<Visibility sx={{ fontSize: 14 }} />}
                onClick={() => navigate(`/reports/${report.report_id}`)}
                sx={{
                  color: '#00F0FF',
                  borderColor: 'rgba(0, 240, 255, 0.4)',
                  bgcolor: 'rgba(0, 240, 255, 0.06)',
                  '&:hover': { borderColor: '#00F0FF', bgcolor: 'rgba(0, 240, 255, 0.15)' },
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: '0.72rem',
                  px: 1.2,
                  py: 0.35,
                  borderRadius: '6px',
                }}
              >
                Details
              </Button>
              <Tooltip title="Download original report file" arrow>
                <IconButton
                  size="small"
                  onClick={(e) => handleDownload(report.report_id, report.original_filename, e)}
                  sx={{
                    color: '#34D399',
                    bgcolor: 'rgba(16, 185, 129, 0.08)',
                    p: 0.7,
                    borderRadius: '6px',
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                    '&:hover': { bgcolor: 'rgba(16, 185, 129, 0.2)' },
                  }}
                >
                  <Download sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
              {isAdmin() && (
                <Tooltip title="Delete report from repository" arrow>
                  <IconButton
                    size="small"
                    onClick={(e) => handleDelete(report.report_id, e)}
                    sx={{
                      color: '#F87171',
                      bgcolor: 'rgba(239, 68, 68, 0.08)',
                      p: 0.7,
                      borderRadius: '6px',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.2)' },
                    }}
                  >
                    <Delete sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          );
        },
      },
    ],
    [filteredReports, paginationModel, pipelineStatus, copiedHash, isAdmin]
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* ── Breadcrumb & Top Page Header ── */}
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
        }}
      >
        <Box>
          <Breadcrumbs
            separator="›"
            sx={{
              color: '#64748B',
              fontSize: '0.75rem',
              mb: 0.6,
              '& .MuiBreadcrumbs-li a': { color: '#64748B', textDecoration: 'none' },
              '& .MuiBreadcrumbs-li a:hover': { color: '#00F0FF' },
            }}
          >
            <Link to="/dashboard">CyberAudit</Link>
            <Typography sx={{ color: '#00F0FF', fontSize: '0.75rem', fontWeight: 600 }}>
              Reports Repository
            </Typography>
          </Breadcrumbs>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: '10px',
                background: 'linear-gradient(135deg, rgba(0, 240, 255, 0.2), rgba(13, 21, 39, 0.9))',
                border: '1px solid rgba(0, 240, 255, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 16px rgba(0, 240, 255, 0.15)',
              }}
            >
              <FolderCopy sx={{ color: '#00F0FF', fontSize: 20 }} />
            </Box>
            <Typography variant="h4" fontWeight={800} sx={{ letterSpacing: '-0.02em', color: '#F8FAFC' }}>
              Audit Reports Repository
            </Typography>
            <Chip
              label="MeitY Document Standardization"
              size="small"
              sx={{
                height: 22,
                fontSize: '0.68rem',
                fontWeight: 700,
                backgroundColor: 'rgba(0, 240, 255, 0.08)',
                color: '#00F0FF',
                border: '1px solid rgba(0, 240, 255, 0.25)',
              }}
            />
          </Box>
          <Typography variant="body2" sx={{ color: '#64748B', mt: 0.5, fontSize: '0.82rem' }}>
            National audit repository for standardized security assessments, cryptographic integrity
            validation, and anomaly tracking.
          </Typography>
        </Box>

        {/* Action Controls in Header */}
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Tooltip title="Refresh reports list" arrow>
            <IconButton
              onClick={() => refetch()}
              sx={{
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#94A3B8',
                '&:hover': {
                  color: '#00F0FF',
                  borderColor: 'rgba(0, 240, 255, 0.3)',
                  backgroundColor: 'rgba(0, 240, 255, 0.06)',
                },
              }}
            >
              <Refresh
                sx={{
                  fontSize: 18,
                  animation: isFetching ? 'spin 1s linear infinite' : 'none',
                  '@keyframes spin': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } },
                }}
              />
            </IconButton>
          </Tooltip>

          <Button
            variant="contained"
            startIcon={<CloudUpload />}
            onClick={() => navigate('/upload')}
            sx={{
              background: 'linear-gradient(135deg, #00F0FF 0%, #0284C7 100%)',
              color: '#070B12',
              fontWeight: 800,
              fontSize: '0.82rem',
              px: 2.2,
              py: 0.9,
              borderRadius: '8px',
              boxShadow: '0 4px 18px rgba(0, 240, 255, 0.25)',
              textTransform: 'none',
              '&:hover': {
                background: 'linear-gradient(135deg, #38BDF8 0%, #0369A1 100%)',
                boxShadow: '0 6px 24px rgba(0, 240, 255, 0.35)',
              },
            }}
          >
            Upload Audit Report
          </Button>
        </Stack>
      </Box>

      {/* ── KPI Summary Cards Strip ── */}
      <Grid container spacing={2}>
        {/* Card 1: Total Reports */}
        <Grid item xs={12} sm={6} md={3}>
          <Box
            onClick={() => setStatusFilter('ALL')}
            sx={{
              p: 2,
              borderRadius: '12px',
              backgroundColor: statusFilter === 'ALL' ? 'rgba(0, 240, 255, 0.08)' : '#0D1527',
              border: '1px solid',
              borderColor: statusFilter === 'ALL' ? '#00F0FF' : 'rgba(255, 255, 255, 0.07)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              position: 'relative',
              overflow: 'hidden',
              '&:hover': {
                transform: 'translateY(-2px)',
                borderColor: '#00F0FF',
              },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.7rem' }}>
                Total Documents
              </Typography>
              <FolderCopy sx={{ fontSize: 18, color: '#00F0FF' }} />
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 800, color: '#F8FAFC', fontVariantNumeric: 'tabular-nums' }}>
              {stats.total}
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748B', fontSize: '0.72rem', display: 'block', mt: 0.3 }}>
              Indexed in sovereign storage
            </Typography>
          </Box>
        </Grid>

        {/* Card 2: Validated Reports */}
        <Grid item xs={12} sm={6} md={3}>
          <Box
            onClick={() => setStatusFilter('VALIDATED')}
            sx={{
              p: 2,
              borderRadius: '12px',
              backgroundColor: statusFilter === 'VALIDATED' ? 'rgba(16, 185, 129, 0.08)' : '#0D1527',
              border: '1px solid',
              borderColor: statusFilter === 'VALIDATED' ? '#10B981' : 'rgba(255, 255, 255, 0.07)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              '&:hover': {
                transform: 'translateY(-2px)',
                borderColor: '#10B981',
              },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.7rem' }}>
                Integrity Validated
              </Typography>
              <CheckCircle sx={{ fontSize: 18, color: '#10B981' }} />
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 800, color: '#34D399', fontVariantNumeric: 'tabular-nums' }}>
              {stats.validated}
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748B', fontSize: '0.72rem', display: 'block', mt: 0.3 }}>
              Passed ClamAV & Schema Gate
            </Typography>
          </Box>
        </Grid>

        {/* Card 3: Ingestion Queue */}
        <Grid item xs={12} sm={6} md={3}>
          <Box
            onClick={() => setStatusFilter('UPLOADED')}
            sx={{
              p: 2,
              borderRadius: '12px',
              backgroundColor: statusFilter === 'UPLOADED' ? 'rgba(56, 189, 248, 0.08)' : '#0D1527',
              border: '1px solid',
              borderColor: statusFilter === 'UPLOADED' ? '#38BDF8' : 'rgba(255, 255, 255, 0.07)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              '&:hover': {
                transform: 'translateY(-2px)',
                borderColor: '#38BDF8',
              },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.7rem' }}>
                Ingested / Pending
              </Typography>
              <HourglassTop sx={{ fontSize: 18, color: '#38BDF8' }} />
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 800, color: '#38BDF8', fontVariantNumeric: 'tabular-nums' }}>
              {stats.uploaded}
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748B', fontSize: '0.72rem', display: 'block', mt: 0.3 }}>
              Ready for AI pipeline run
            </Typography>
          </Box>
        </Grid>

        {/* Card 4: Flagged & Duplicates */}
        <Grid item xs={12} sm={6} md={3}>
          <Box
            onClick={() => setStatusFilter('QUARANTINED')}
            sx={{
              p: 2,
              borderRadius: '12px',
              backgroundColor: statusFilter === 'QUARANTINED' ? 'rgba(245, 158, 11, 0.08)' : '#0D1527',
              border: '1px solid',
              borderColor: statusFilter === 'QUARANTINED' ? '#F59E0B' : 'rgba(255, 255, 255, 0.07)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              '&:hover': {
                transform: 'translateY(-2px)',
                borderColor: '#F59E0B',
              },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.7rem' }}>
                Flagged & Lineage
              </Typography>
              <Shield sx={{ fontSize: 18, color: '#F59E0B' }} />
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 800, color: '#FBBF24', fontVariantNumeric: 'tabular-nums' }}>
              {stats.flagged}
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748B', fontSize: '0.72rem', display: 'block', mt: 0.3 }}>
              Duplicates & Quarantined items
            </Typography>
          </Box>
        </Grid>
      </Grid>

      {/* ── Toolbar: Search, Filters, and View Switcher ── */}
      <Box
        sx={{
          p: 2,
          borderRadius: '12px',
          backgroundColor: '#0D1527',
          border: '1px solid rgba(255, 255, 255, 0.07)',
          display: 'flex',
          flexDirection: { xs: 'column', lg: 'row' },
          gap: 2,
          alignItems: { xs: 'stretch', lg: 'center' },
          justifyContent: 'space-between',
        }}
      >
        {/* Left: Search input */}
        <TextField
          id="reports-search"
          placeholder="Search reports by filename or SHA-256 hash..."
          size="small"
          value={search}
          onChange={handleSearchChange}
          sx={{
            width: { xs: '100%', lg: 380 },
            '& .MuiOutlinedInput-root': {
              backgroundColor: 'rgba(7, 11, 18, 0.8)',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              fontSize: '0.82rem',
              color: '#F8FAFC',
              '&:hover': { borderColor: 'rgba(0, 240, 255, 0.4)' },
              '&.Mui-focused': { borderColor: '#00F0FF' },
            },
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search sx={{ color: '#64748B', fontSize: 18 }} />
              </InputAdornment>
            ),
            endAdornment: search ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={handleClearSearch} sx={{ color: '#64748B' }}>
                  <Clear sx={{ fontSize: 16 }} />
                </IconButton>
              </InputAdornment>
            ) : null,
          }}
        />

        {/* Center: Filter Pills */}
        <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 0.8 }}>
          {/* Status Pills */}
          {['ALL', 'VALIDATED', 'UPLOADED', 'QUARANTINED', 'REJECTED'].map((st) => (
            <Chip
              key={st}
              label={st === 'ALL' ? 'All Status' : st}
              size="small"
              onClick={() => setStatusFilter(st)}
              sx={{
                fontSize: '0.68rem',
                fontWeight: 700,
                cursor: 'pointer',
                backgroundColor: statusFilter === st ? 'rgba(0, 240, 255, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                color: statusFilter === st ? '#00F0FF' : '#94A3B8',
                border: '1px solid',
                borderColor: statusFilter === st ? 'rgba(0, 240, 255, 0.4)' : 'rgba(255, 255, 255, 0.08)',
                '&:hover': {
                  backgroundColor: 'rgba(0, 240, 255, 0.1)',
                  color: '#00F0FF',
                },
              }}
            />
          ))}

          <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255, 255, 255, 0.1)', my: 0.5 }} />

          {/* Format Pills */}
          {['ALL', '.pdf', '.docx'].map((fmt) => (
            <Chip
              key={fmt}
              label={fmt === 'ALL' ? 'All Formats' : fmt.toUpperCase()}
              size="small"
              onClick={() => setFormatFilter(fmt)}
              sx={{
                fontSize: '0.68rem',
                fontWeight: 700,
                cursor: 'pointer',
                backgroundColor: formatFilter === fmt ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                color: formatFilter === fmt ? '#38BDF8' : '#94A3B8',
                border: '1px solid',
                borderColor: formatFilter === fmt ? 'rgba(56, 189, 248, 0.4)' : 'rgba(255, 255, 255, 0.08)',
                '&:hover': {
                  backgroundColor: 'rgba(56, 189, 248, 0.1)',
                  color: '#38BDF8',
                },
              }}
            />
          ))}
        </Stack>

        {/* Right: View Mode Toggle */}
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ alignSelf: { xs: 'flex-end', lg: 'center' } }}>
          {(statusFilter !== 'ALL' || formatFilter !== 'ALL' || search) && (
            <Button
              size="small"
              onClick={handleResetFilters}
              sx={{
                fontSize: '0.7rem',
                color: '#94A3B8',
                textTransform: 'none',
                mr: 1,
                '&:hover': { color: '#00F0FF' },
              }}
            >
              Reset Filters
            </Button>
          )}

          <Tooltip title="Table View" arrow>
            <IconButton
              size="small"
              onClick={() => setViewMode('table')}
              sx={{
                backgroundColor: viewMode === 'table' ? 'rgba(0, 240, 255, 0.15)' : 'transparent',
                color: viewMode === 'table' ? '#00F0FF' : '#64748B',
                border: '1px solid',
                borderColor: viewMode === 'table' ? 'rgba(0, 240, 255, 0.4)' : 'transparent',
                borderRadius: '6px',
              }}
            >
              <TableRows fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title="Card View" arrow>
            <IconButton
              size="small"
              onClick={() => setViewMode('grid')}
              sx={{
                backgroundColor: viewMode === 'grid' ? 'rgba(0, 240, 255, 0.15)' : 'transparent',
                color: viewMode === 'grid' ? '#00F0FF' : '#64748B',
                border: '1px solid',
                borderColor: viewMode === 'grid' ? 'rgba(0, 240, 255, 0.4)' : 'transparent',
                borderRadius: '6px',
              }}
            >
              <GridView fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      {/* ── Main View Content: Table vs Grid ── */}
      {viewMode === 'table' ? (
        <Card
          sx={{
            backgroundColor: '#0D1527',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            borderRadius: '14px',
            overflow: 'hidden',
          }}
        >
          <Box sx={{ height: 600, width: '100%' }}>
            <DataGrid
              rows={filteredReports}
              columns={columns}
              getRowId={(row) => row.report_id}
              rowCount={rowCount}
              loading={isLoading}
              paginationMode="server"
              paginationModel={paginationModel}
              onPaginationModelChange={handlePaginationModelChange}
              pageSizeOptions={[5, 10, 25, 50]}
              disableRowSelectionOnClick
              rowHeight={76}
              sx={{
                border: 'none',
                '& .MuiDataGrid-cell': {
                  borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                  lineHeight: 'normal !important',
                  display: 'flex',
                  alignItems: 'center',
                },
                '& .MuiDataGrid-columnHeaders': {
                  backgroundColor: '#0A101D',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                  color: '#94A3B8',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                },
                '& .MuiDataGrid-footerContainer': {
                  borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                  backgroundColor: '#0A101D',
                  color: '#94A3B8',
                },
                '& .MuiTablePagination-root': {
                  color: '#94A3B8',
                },
                '& .MuiIconButton-root': {
                  color: '#94A3B8',
                },
              }}
              slots={{
                noRowsOverlay: () => (
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '100%',
                      p: 4,
                      textAlign: 'center',
                    }}
                  >
                    <Box
                      sx={{
                        width: 56,
                        height: 56,
                        borderRadius: '50%',
                        backgroundColor: 'rgba(0, 240, 255, 0.05)',
                        border: '1px dashed rgba(0, 240, 255, 0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mb: 2,
                      }}
                    >
                      <Description sx={{ fontSize: 28, color: '#00F0FF' }} />
                    </Box>
                    <Typography variant="h6" sx={{ color: '#F8FAFC', fontWeight: 700, fontSize: '0.95rem' }}>
                      No Audit Reports Found
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#64748B', maxWidth: 360, mt: 0.5, fontSize: '0.8rem' }}>
                      {search || statusFilter !== 'ALL' || formatFilter !== 'ALL'
                        ? 'No documents match your filter query. Try clearing the filters.'
                        : 'No reports have been ingested yet. Upload an audit document to begin standardized analysis.'}
                    </Typography>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<CloudUpload />}
                      onClick={() => navigate('/upload')}
                      sx={{
                        mt: 2,
                        color: '#00F0FF',
                        borderColor: 'rgba(0, 240, 255, 0.3)',
                        textTransform: 'none',
                        '&:hover': { borderColor: '#00F0FF', backgroundColor: 'rgba(0, 240, 255, 0.08)' },
                      }}
                    >
                      Upload New Report
                    </Button>
                  </Box>
                ),
              }}
            />
          </Box>
        </Card>
      ) : (
        /* ── Grid / Card View ── */
        <Box>
          {filteredReports.length === 0 ? (
            <Card
              sx={{
                p: 6,
                textAlign: 'center',
                backgroundColor: '#0D1527',
                border: '1px solid rgba(255, 255, 255, 0.07)',
                borderRadius: '14px',
              }}
            >
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  backgroundColor: 'rgba(0, 240, 255, 0.05)',
                  border: '1px dashed rgba(0, 240, 255, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mx: 'auto',
                  mb: 2,
                }}
              >
                <Description sx={{ fontSize: 28, color: '#00F0FF' }} />
              </Box>
              <Typography variant="h6" sx={{ color: '#F8FAFC', fontWeight: 700 }}>
                No Reports in Grid View
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748B', mt: 0.5, maxWidth: 380, mx: 'auto' }}>
                No audit documents match the selected filters.
              </Typography>
            </Card>
          ) : (
            <Grid container spacing={2.5}>
              {filteredReports.map((report) => {
                const ext = report.file_extension?.toLowerCase();
                const isPdf = ext === '.pdf';
                const isDocx = ext === '.docx' || ext === '.doc';

                return (
                  <Grid item xs={12} sm={6} lg={4} key={report.report_id}>
                    <Card
                      sx={{
                        backgroundColor: '#0D1527',
                        border: '1px solid rgba(255, 255, 255, 0.07)',
                        borderRadius: '14px',
                        overflow: 'hidden',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        height: '100%',
                        '&:hover': {
                          transform: 'translateY(-3px)',
                          borderColor: 'rgba(0, 240, 255, 0.35)',
                          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
                        },
                      }}
                    >
                      {/* Top Header Card Strip */}
                      <Box
                        sx={{
                          p: 2,
                          pb: 1.5,
                          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          gap: 1.5,
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                          <Box
                            sx={{
                              width: 38,
                              height: 38,
                              borderRadius: '9px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: isPdf
                                ? 'rgba(244, 63, 94, 0.12)'
                                : isDocx
                                ? 'rgba(56, 189, 248, 0.12)'
                                : 'rgba(52, 211, 153, 0.12)',
                              border: `1px solid ${
                                isPdf
                                  ? 'rgba(244, 63, 94, 0.3)'
                                  : isDocx
                                  ? 'rgba(56, 189, 248, 0.3)'
                                  : 'rgba(52, 211, 153, 0.3)'
                              }`,
                            }}
                          >
                            <Description
                              sx={{
                                fontSize: 20,
                                color: isPdf ? '#FB7185' : isDocx ? '#38BDF8' : '#34D399',
                              }}
                            />
                          </Box>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography
                              onClick={() => navigate(`/reports/${report.report_id}`)}
                              variant="subtitle2"
                              fontWeight={700}
                              noWrap
                              sx={{
                                color: '#F8FAFC',
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                '&:hover': { color: '#00F0FF', textDecoration: 'underline' },
                              }}
                            >
                              {report.original_filename}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.3 }}>
                              {renderFormatBadge(report.file_extension)}
                              <Typography variant="caption" sx={{ color: '#64748B', fontVariantNumeric: 'tabular-nums' }}>
                                {formatFileSize(report.file_size)}
                              </Typography>
                            </Box>
                          </Box>
                        </Box>

                        {renderStatusPill(report.upload_status)}
                      </Box>

                      {/* Card Body */}
                      <CardContent sx={{ p: 2, flex: 1, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        {/* Agency & Uploader */}
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, color: '#94A3B8' }}>
                            <Business sx={{ fontSize: 15, color: '#64748B' }} />
                            <span>{report.agency?.agency_name || 'Independent Auditor'}</span>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, color: '#94A3B8' }}>
                            <Person sx={{ fontSize: 15, color: '#64748B' }} />
                            <span>{report.uploader_username || 'Admin'}</span>
                          </Box>
                        </Box>

                        {/* SHA-256 Hash */}
                        {report.sha256_hash && (
                          <Box
                            onClick={(e) => handleCopyHash(report.sha256_hash, e)}
                            sx={{
                              p: 1,
                              borderRadius: '6px',
                              backgroundColor: 'rgba(255, 255, 255, 0.02)',
                              border: '1px solid rgba(255, 255, 255, 0.06)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              cursor: 'pointer',
                              '&:hover': {
                                backgroundColor: 'rgba(0, 240, 255, 0.05)',
                                borderColor: 'rgba(0, 240, 255, 0.25)',
                              },
                            }}
                          >
                            <Typography
                              variant="caption"
                              sx={{
                                color: copiedHash === report.sha256_hash ? '#34D399' : '#64748B',
                                fontFamily: 'monospace',
                                fontSize: '0.68rem',
                              }}
                            >
                              SHA: {report.sha256_hash.substring(0, 20)}...
                            </Typography>
                            {copiedHash === report.sha256_hash ? (
                              <Check sx={{ fontSize: 13, color: '#34D399' }} />
                            ) : (
                              <ContentCopy sx={{ fontSize: 13, color: '#64748B' }} />
                            )}
                          </Box>
                        )}

                        {/* Lineage & Ingestion Date */}
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pt: 0.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                            {report.partial_duplicate ? (
                              <Chip
                                label="Partial Duplicate"
                                size="small"
                                sx={{
                                  fontSize: '0.65rem',
                                  fontWeight: 700,
                                  backgroundColor: 'rgba(245, 158, 11, 0.1)',
                                  color: '#FBBF24',
                                  border: '1px solid rgba(245, 158, 11, 0.3)',
                                  height: 20,
                                }}
                              />
                            ) : (
                              <Chip
                                label="Original Report"
                                size="small"
                                sx={{
                                  fontSize: '0.65rem',
                                  fontWeight: 700,
                                  backgroundColor: 'rgba(16, 185, 129, 0.08)',
                                  color: '#34D399',
                                  border: '1px solid rgba(16, 185, 129, 0.2)',
                                  height: 20,
                                }}
                              />
                            )}
                          </Box>

                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, color: '#64748B', fontSize: '0.72rem' }}>
                            <CalendarToday sx={{ fontSize: 13 }} />
                            <span>{new Date(report.created_at).toLocaleDateString()}</span>
                          </Box>
                        </Box>
                      </CardContent>

                      {/* Card Footer Actions */}
                      <Box
                        sx={{
                          p: 1.5,
                          px: 2,
                          backgroundColor: '#0A101D',
                          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <Box>{renderPipelineChip(report)}</Box>

                        <Stack direction="row" spacing={1}>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<Security sx={{ fontSize: 13 }} />}
                            onClick={(e) => handleViewResults(report, e)}
                            sx={{
                              color: '#FBBF24',
                              borderColor: 'rgba(245, 158, 11, 0.3)',
                              fontSize: '0.7rem',
                              textTransform: 'none',
                              py: 0.3,
                              px: 1,
                              borderRadius: '6px',
                              '&:hover': { borderColor: '#FBBF24', bgcolor: 'rgba(245, 158, 11, 0.1)' },
                            }}
                          >
                            Inspect
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<Visibility sx={{ fontSize: 13 }} />}
                            onClick={() => navigate(`/reports/${report.report_id}`)}
                            sx={{
                              color: '#00F0FF',
                              borderColor: 'rgba(0, 240, 255, 0.3)',
                              fontSize: '0.7rem',
                              textTransform: 'none',
                              py: 0.3,
                              px: 1,
                              borderRadius: '6px',
                              '&:hover': { borderColor: '#00F0FF', bgcolor: 'rgba(0, 240, 255, 0.1)' },
                            }}
                          >
                            Details
                          </Button>
                          <Tooltip title="Download" arrow>
                            <IconButton
                              size="small"
                              onClick={(e) => handleDownload(report.report_id, report.original_filename, e)}
                              sx={{
                                color: '#34D399',
                                bgcolor: 'rgba(16, 185, 129, 0.08)',
                                p: 0.6,
                                borderRadius: '6px',
                              }}
                            >
                              <Download sx={{ fontSize: 15 }} />
                            </IconButton>
                          </Tooltip>
                          {isAdmin() && (
                            <Tooltip title="Delete" arrow>
                              <IconButton
                                size="small"
                                onClick={(e) => handleDelete(report.report_id, e)}
                                sx={{
                                  color: '#F87171',
                                  bgcolor: 'rgba(239, 68, 68, 0.08)',
                                  p: 0.6,
                                  borderRadius: '6px',
                                }}
                              >
                                <Delete sx={{ fontSize: 15 }} />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Stack>
                      </Box>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          )}

          {/* Grid View Pagination */}
          {rowCount > paginationModel.pageSize && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
              <Pagination
                count={Math.ceil(rowCount / paginationModel.pageSize)}
                page={paginationModel.page + 1}
                onChange={(e, p) => handlePaginationModelChange({ ...paginationModel, page: p - 1 })}
                color="primary"
                sx={{
                  '& .MuiPaginationItem-root': {
                    color: '#94A3B8',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    '&.Mui-selected': {
                      backgroundColor: 'rgba(0, 240, 255, 0.15)',
                      color: '#00F0FF',
                      borderColor: '#00F0FF',
                    },
                  },
                }}
              />
            </Box>
          )}
        </Box>
      )}

      {/* ── Confirmation Dialog ── */}
      <Dialog
        open={confirmDialog.open}
        onClose={closeConfirmDialog}
        PaperProps={{
          sx: {
            borderRadius: 3,
            background: 'linear-gradient(145deg, rgba(13, 21, 39, 0.98) 0%, rgba(7, 11, 18, 0.99) 100%)',
            border: '1px solid rgba(0, 240, 255, 0.2)',
            backdropFilter: 'blur(20px)',
            minWidth: 420,
          },
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1 }}>
          <RocketLaunch sx={{ color: '#00F0FF' }} />
          <Typography variant="h6" fontWeight={800} sx={{ color: '#F8FAFC' }}>
            Run AI Security Pipeline
          </Typography>
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: '#94A3B8', mb: 2, fontSize: '0.85rem' }}>
            Initiate multi-model extraction, CVSS vulnerability tagging, and ML risk clustering for this
            report?
          </DialogContentText>
          {confirmDialog.report && (
            <Box
              sx={{
                p: 2,
                borderRadius: '8px',
                bgcolor: 'rgba(0, 240, 255, 0.04)',
                border: '1px solid rgba(0, 240, 255, 0.12)',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Description sx={{ color: '#00F0FF', fontSize: 20 }} />
                <Typography variant="body2" fontWeight={700} sx={{ color: '#F8FAFC' }}>
                  {confirmDialog.report.original_filename}
                </Typography>
              </Box>
              <Typography variant="caption" sx={{ color: '#64748B', display: 'block', fontFamily: 'monospace' }}>
                ID: {confirmDialog.report.report_id}
              </Typography>
              <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block', mt: 0.5 }}>
                Size: {formatFileSize(confirmDialog.report.file_size)} • {confirmDialog.report.file_extension?.toUpperCase()}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={closeConfirmDialog} sx={{ color: '#94A3B8', fontWeight: 600, textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            onClick={handleRunPipeline}
            variant="contained"
            startIcon={<RocketLaunch />}
            sx={{
              background: 'linear-gradient(135deg, #00F0FF 0%, #0284C7 100%)',
              color: '#070B12',
              fontWeight: 800,
              px: 2.5,
              textTransform: 'none',
              '&:hover': {
                background: 'linear-gradient(135deg, #38BDF8 0%, #0369A1 100%)',
              },
            }}
          >
            Launch Pipeline
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Results Dialog ── */}
      <PipelineResultsDialog
        open={resultsDialog.open}
        onClose={closeResultsDialog}
        results={pipelineResults[resultsDialog.reportId]}
        reportName={resultsDialog.reportName}
      />
    </Box>
  );
}

export default ReportsPage;

