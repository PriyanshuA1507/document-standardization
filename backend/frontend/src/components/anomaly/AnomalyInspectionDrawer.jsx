import React from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Chip,
  Divider,
  Grid,
  Paper,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  useTheme
} from '@mui/material';
import {
  Close,
  Security,
  Warning,
  ErrorOutline,
  AutoAwesome,
  Speed,
  Functions,
  Psychology,
  ArrowUpward,
  ArrowDownward,
  OpenInNew,
  Description
} from '@mui/icons-material';

const TIER_COLORS = {
  CRITICAL_OUTLIER: '#FF1744',
  ELEVATED_OUTLIER: '#FF9100',
  SEMANTIC_ANOMALY: '#D500F9',
  METRIC_ANOMALY: '#FFD600',
  NOMINAL_COMPLIANT: '#00E676',
};

export default function AnomalyInspectionDrawer({ open, onClose, record }) {
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';
  if (!record) return null;

  const meta = record.metadata || {};
  const tierColor = TIER_COLORS[record.anomaly_tier] || '#00D4FF';
  const attributions = record.ecod_attributions || {};
  const deviations = record.feature_deviations || {};
  const semantic = record.semantic_profile || {};
  const nearestPeers = semantic.nearest_neighbors || [];

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 540, md: 640 },
          bgcolor: isLight ? '#FFFFFF' : '#0B1120',
          borderLeft: isLight ? '1px solid rgba(15, 23, 42, 0.1)' : '1px solid rgba(255, 255, 255, 0.1)',
          backgroundImage: 'none',
          p: 0
        }
      }}
    >
      {/* Header */}
      <Box sx={{ p: 2.5, bgcolor: isLight ? '#F8FAFC' : '#0F172A', borderBottom: isLight ? '1px solid rgba(15, 23, 42, 0.08)' : '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box sx={{ pr: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
            <Chip
              label={record.anomaly_tier?.replace('_', ' ')}
              sx={{ bgcolor: `${tierColor}25`, color: tierColor, fontWeight: 800, fontSize: '0.72rem', height: 22 }}
            />
            {meta.cert_in_empanelled && (
              <Chip
                label="CERT-In Empanelled"
                icon={<Security sx={{ fontSize: 14 }} />}
                sx={{ bgcolor: 'rgba(0, 212, 255, 0.15)', color: '#00D4FF', fontWeight: 700, fontSize: '0.7rem', height: 22 }}
              />
            )}
          </Box>
          <Typography variant="h6" fontWeight={800} color={isLight ? '#0F172A' : '#F1F5F9'} sx={{ fontSize: '1.1rem', lineHeight: 1.3 }}>
            {meta.report_title}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Audited by {meta.agency_name} ({meta.agency_code}) &bull; {meta.page_count} Pages
          </Typography>
        </Box>
        <IconButton onClick={onClose} sx={{ color: isLight ? '#475569' : '#94A3B8', '&:hover': { color: isLight ? '#0F172A' : '#FFF' } }}>
          <Close />
        </IconButton>
      </Box>

      {/* Drawer Body */}
      <Box sx={{ p: 2.5, overflowY: 'auto', flex: 1 }}>
        {/* 1. Score Gauge Strip */}
        <Typography variant="caption" fontWeight={800} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', mb: 1 }}>
          Multi-Detector Scoring Breakdown
        </Typography>
        <Grid container spacing={1.5} sx={{ mb: 3 }}>
          <Grid item xs={3}>
            <Paper sx={{ p: 1.5, textAlign: 'center', bgcolor: 'rgba(0, 212, 255, 0.06)', border: '1px solid rgba(0, 212, 255, 0.2)', borderRadius: 2 }}>
              <AutoAwesome sx={{ color: '#00D4FF', fontSize: 20 }} />
              <Typography variant="h5" fontWeight={900} color="#00D4FF">
                {Math.round(record.ensemble_score * 100)}%
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem', fontWeight: 700 }}>
                Consensus Rank
              </Typography>
            </Paper>
          </Grid>

          <Grid item xs={3}>
            <Paper sx={{ p: 1.5, textAlign: 'center', bgcolor: 'rgba(0, 230, 118, 0.06)', border: '1px solid rgba(0, 230, 118, 0.2)', borderRadius: 2 }}>
              <Speed sx={{ color: '#00E676', fontSize: 20 }} />
              <Typography variant="h5" fontWeight={900} color="#00E676">
                {Math.round((record.iforest_score || 0) * 100)}%
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem', fontWeight: 700 }}>
                Isolation Forest
              </Typography>
            </Paper>
          </Grid>

          <Grid item xs={3}>
            <Paper sx={{ p: 1.5, textAlign: 'center', bgcolor: 'rgba(255, 214, 0, 0.06)', border: '1px solid rgba(255, 214, 0, 0.2)', borderRadius: 2 }}>
              <Functions sx={{ color: '#FFD600', fontSize: 20 }} />
              <Typography variant="h5" fontWeight={900} color="#FFD600">
                {Math.round((record.ecod_score || 0) * 100)}%
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem', fontWeight: 700 }}>
                ECOD Tail Rank
              </Typography>
            </Paper>
          </Grid>

          <Grid item xs={3}>
            <Paper sx={{ p: 1.5, textAlign: 'center', bgcolor: 'rgba(213, 0, 249, 0.06)', border: '1px solid rgba(213, 0, 249, 0.2)', borderRadius: 2 }}>
              <Psychology sx={{ color: '#D500F9', fontSize: 20 }} />
              <Typography variant="h5" fontWeight={900} color="#D500F9">
                {Math.round((record.embedding_score || 0) * 100)}%
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem', fontWeight: 700 }}>
                SBERT Vector
              </Typography>
            </Paper>
          </Grid>
        </Grid>

        {/* 2. Primary Drivers */}
        <Typography variant="caption" fontWeight={800} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', mb: 1 }}>
          Primary Anomaly Drivers & Root Causes
        </Typography>
        <Box sx={{ mb: 3 }}>
          {record.primary_drivers?.map((driver, idx) => (
            <Paper
              key={idx}
              sx={{
                p: 1.2,
                mb: 1,
                bgcolor: 'rgba(255, 23, 68, 0.08)',
                border: '1px solid rgba(255, 23, 68, 0.2)',
                borderRadius: 1.5,
                display: 'flex',
                alignItems: 'center',
                gap: 1.2
              }}
            >
              <ErrorOutline sx={{ color: '#FF1744', fontSize: 18 }} />
              <Typography variant="body2" color="#F1F5F9" fontWeight={600} sx={{ fontSize: '0.82rem' }}>
                {driver}
              </Typography>
            </Paper>
          ))}
        </Box>

        {/* 3. ECOD Dimensional Attributions */}
        <Typography variant="caption" fontWeight={800} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', mb: 1 }}>
          ECOD Feature Attribution Breakdown (%)
        </Typography>
        <Paper sx={{ p: 2, bgcolor: isLight ? '#F8FAFC' : '#0F172A', border: isLight ? '1px solid rgba(15, 23, 42, 0.08)' : '1px solid rgba(255,255,255,0.06)', borderRadius: 2, mb: 3 }}>
          {Object.entries(attributions)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6)
            .map(([feat, pct]) => (
              <Box key={feat} sx={{ mb: 1.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.4 }}>
                  <Typography variant="caption" fontWeight={700} color={isLight ? '#0F172A' : '#E2E8F0'}>
                    {feat.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </Typography>
                  <Typography variant="caption" fontWeight={800} color={pct > 25 ? '#FF1744' : pct > 15 ? '#FF9100' : '#00D4FF'}>
                    {pct}%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(pct * 2.5, 100)}
                  sx={{
                    height: 5,
                    borderRadius: 2,
                    bgcolor: isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255,255,255,0.06)',
                    '& .MuiLinearProgress-bar': {
                      bgcolor: pct > 25 ? '#FF1744' : pct > 15 ? '#FF9100' : '#00D4FF'
                    }
                  }}
                />
              </Box>
            ))}
        </Paper>

        {/* 4. Robust Deviations from Fleet Baseline */}
        <Typography variant="caption" fontWeight={800} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', mb: 1 }}>
          Deviations from Fleet Median (MAD Units)
        </Typography>
        <TableContainer component={Paper} sx={{ bgcolor: isLight ? '#F8FAFC' : '#0F172A', border: isLight ? '1px solid rgba(15, 23, 42, 0.08)' : '1px solid rgba(255,255,255,0.06)', borderRadius: 2, mb: 3 }}>
          <Table size="small">
            <TableHead sx={{ bgcolor: isLight ? '#F1F5F9' : 'transparent' }}>
              <TableRow>
                <TableCell sx={{ color: isLight ? '#334155' : 'text.secondary', fontWeight: 800 }}>Metric</TableCell>
                <TableCell sx={{ color: isLight ? '#334155' : 'text.secondary', fontWeight: 800 }}>Report Value</TableCell>
                <TableCell sx={{ color: isLight ? '#334155' : 'text.secondary', fontWeight: 800 }}>Deviation (MAD)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {Object.entries(deviations).slice(0, 6).map(([feat, z]) => {
                const isElev = z > 1.8;
                const isSupp = z < -1.8;
                return (
                  <TableRow key={feat}>
                    <TableCell sx={{ color: isLight ? '#0F172A' : '#E2E8F0', fontWeight: 600 }}>
                      {feat.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </TableCell>
                    <TableCell sx={{ color: isLight ? '#475569' : '#94A3B8' }}>
                      {meta[feat] !== undefined ? String(meta[feat]) : '-'}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {isElev ? <ArrowUpward sx={{ color: '#FF1744', fontSize: 14 }} /> : isSupp ? <ArrowDownward sx={{ color: '#00D4FF', fontSize: 14 }} /> : null}
                        <Typography variant="caption" fontWeight={800} sx={{ color: isElev ? '#FF1744' : isSupp ? '#00D4FF' : '#94A3B8' }}>
                          {z > 0 ? `+${z}` : z} MAD
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>

        {/* 5. Semantic Profile & Nearest Peers */}
        <Typography variant="caption" fontWeight={800} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', mb: 1 }}>
          Sentence-BERT Semantic Narrative & Nearest Peer Audits
        </Typography>
        <Paper sx={{ p: 2, bgcolor: isLight ? '#F8FAFC' : '#0F172A', border: isLight ? '1px solid rgba(15, 23, 42, 0.08)' : '1px solid rgba(255,255,255,0.06)', borderRadius: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, fontStyle: 'italic' }}>
            "{semantic.narrative_preview || 'Narrative synthesis profile generated from document scope and findings portfolio.'}"
          </Typography>

          <Typography variant="caption" fontWeight={700} color="#00D4FF" sx={{ display: 'block', mt: 1.5, mb: 0.8 }}>
            Nearest Peer Reports in 768-dim Vector Space:
          </Typography>
          {nearestPeers.map((peer, idx) => (
            <Box key={idx} sx={{
              p: 1,
              mb: 0.8,
              borderRadius: 1.5,
              bgcolor: isLight ? '#FFFFFF' : 'rgba(255,255,255,0.03)',
              border: isLight ? '1px solid rgba(15, 23, 42, 0.08)' : 'none',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <Box sx={{ maxWidth: '75%' }}>
                <Typography variant="body2" color={isLight ? '#0F172A' : '#F1F5F9'} fontWeight={600} noWrap sx={{ fontSize: '0.78rem' }}>
                  {peer.report_title}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {peer.agency_name}
                </Typography>
              </Box>
              <Chip
                size="small"
                label={`${Math.round(peer.cosine_similarity * 100)}% Sim`}
                sx={{ bgcolor: 'rgba(213, 0, 249, 0.15)', color: '#D500F9', fontWeight: 800, fontSize: '0.68rem', height: 20 }}
              />
            </Box>
          ))}
        </Paper>
      </Box>
    </Drawer>
  );
}
