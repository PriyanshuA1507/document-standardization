import React from 'react';
import {
  Grid, Card, CardContent, Typography, Box, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Chip, Alert, useTheme
} from '@mui/material';
import {
  Replay, Security, Warning, Devices, CompareArrows
} from '@mui/icons-material';

export default function RecurringWeaknessModule({ recurringData }) {
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';

  if (!recurringData) return null;

  const {
    top_cwes = [],
    top_cves = [],
    persistent_assets = [],
    repeat_by_audit_type = [],
    repeat_by_severity = [],
    source_reported_repeat_count = 0,
    independently_verified_recurrent_count = 0,
    recurrence_rate_pct = 0,
  } = recurringData;

  const cardStyle = {
    height: '100%',
    background: isLight ? '#FFFFFF' : 'rgba(10, 14, 23, 0.8)',
    border: isLight ? '1px solid rgba(15, 23, 42, 0.08)' : '1px solid rgba(255, 255, 255, 0.08)',
    boxShadow: isLight ? '0 4px 16px -2px rgba(15, 23, 42, 0.05)' : 'none',
  };

  return (
    <Box sx={{ mb: 4 }}>
      <Typography variant="h6" sx={{ fontWeight: 800, color: isLight ? '#0F172A' : '#E2E8F0', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Replay sx={{ color: isLight ? '#D97706' : '#FFD600' }} /> Recurring Weakness & Vulnerability Persistence Analysis
      </Typography>

      {/* Recurrence Distinction Disclosure Card */}
      <Alert severity="info" icon={<CompareArrows />} sx={{ mb: 2.5, background: isLight ? 'rgba(2, 132, 199, 0.08)' : 'rgba(0, 212, 255, 0.08)', border: isLight ? '1px solid rgba(2, 132, 199, 0.25)' : '1px solid rgba(0, 212, 255, 0.25)', color: isLight ? '#0369A1' : '#E2E8F0' }}>
        <strong>Verification Provenance:</strong> Distinguishing findings marked <strong>Repeat ({source_reported_repeat_count})</strong> by auditor classification in source reports from independently verified cross-report recurrences <strong>({independently_verified_recurrent_count})</strong> based on normalized fingerprint identity matching.
      </Alert>

      <Grid container spacing={3}>
        {/* Top CWE Categories */}
        <Grid item xs={12} md={6}>
          <Card sx={cardStyle}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: isLight ? '#0F172A' : '#E2E8F0', mb: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Security sx={{ color: isLight ? '#0284C7' : '#00D4FF', fontSize: 18 }} /> Top Recurring CWE Weakness Classes
              </Typography>
              <Typography variant="caption" sx={{ color: isLight ? '#64748B' : '#94A3B8', display: 'block', mb: 1.5, fontSize: '0.73rem' }}>
                💡 <strong>Plain English:</strong> Identifies underlying software coding defects (e.g. Broken Access Control, Data Leaks) that recur most often across audits.
              </Typography>
              <TableContainer sx={{ maxHeight: 300 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ '& th': { borderColor: isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255,255,255,0.06)', color: isLight ? '#475569' : '#94A3B8', fontWeight: 600 } }}>
                      <TableCell>CWE Identifier</TableCell>
                      <TableCell align="right">Frequency</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {top_cwes.map((item, idx) => (
                      <TableRow key={idx} sx={{ '& td': { borderColor: isLight ? 'rgba(15, 23, 42, 0.06)' : 'rgba(255,255,255,0.04)', color: isLight ? '#0F172A' : '#E2E8F0' } }}>
                        <TableCell>
                          <Chip label={item.cwe} size="small" sx={{ bgcolor: isLight ? 'rgba(2, 132, 199, 0.1)' : 'rgba(0, 212, 255, 0.1)', color: isLight ? '#0284C7' : '#00D4FF', fontWeight: 600 }} />
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>{item.count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Persistent Assets with Recurring Findings */}
        <Grid item xs={12} md={6}>
          <Card sx={cardStyle}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: isLight ? '#0F172A' : '#E2E8F0', mb: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Devices sx={{ color: '#7C4DFF', fontSize: 18 }} /> Asset Endpoints with Highest Finding Density
              </Typography>
              <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block', mb: 1.5, fontSize: '0.73rem' }}>
                💡 <strong>Plain English:</strong> Pinpoints the critical servers, APIs, and portals carrying the greatest concentration of security flaws.
              </Typography>
              <TableContainer sx={{ maxHeight: 300 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ '& th': { borderColor: 'rgba(255,255,255,0.06)', color: '#94A3B8', fontWeight: 600 } }}>
                      <TableCell>Asset Identifier / Target</TableCell>
                      <TableCell align="right">Finding Count</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {persistent_assets.map((item, idx) => (
                      <TableRow key={idx} sx={{ '& td': { borderColor: 'rgba(255,255,255,0.04)', color: '#E2E8F0' } }}>
                        <TableCell sx={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <Typography variant="caption" sx={{ color: '#E2E8F0', fontFamily: 'monospace' }}>
                            {item.asset}
                          </Typography>
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, color: '#7C4DFF' }}>{item.count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Repeat Findings by Severity Breakdown */}
        <Grid item xs={12} md={6}>
          <Card sx={cardStyle}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: isLight ? '#0F172A' : '#E2E8F0', mb: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Warning sx={{ color: '#FF9100', fontSize: 18 }} /> Repeat Findings by Severity Distribution
              </Typography>
              <Typography variant="caption" sx={{ color: isLight ? '#64748B' : '#94A3B8', display: 'block', mb: 1.5, fontSize: '0.73rem' }}>
                💡 <strong>Plain English:</strong> Vulnerabilities flagged in earlier audits that reappeared unpatched in later audits, categorized by threat level.
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mt: 1 }}>
                {repeat_by_severity.map((item, idx) => {
                  const colors = {
                    Critical: '#FF1744',
                    High: '#FF9100',
                    Medium: '#FFD600',
                    Low: '#00E676',
                  };
                  const col = colors[item.severity] || '#94A3B8';
                  return (
                    <Box key={idx} sx={{
                      p: 1.5, minWidth: 120, flex: 1, borderRadius: 2,
                      background: isLight ? '#F8FAFC' : 'rgba(255,255,255,0.03)', border: `1px solid ${col}44`
                    }}>
                      <Typography variant="caption" sx={{ color: col, fontWeight: 700 }}>{item.severity}</Typography>
                      <Typography variant="h5" sx={{ fontWeight: 800, color: isLight ? '#0F172A' : '#E2E8F0', mt: 0.5 }}>{item.count}</Typography>
                    </Box>
                  );
                })}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Top CVE Associates */}
        <Grid item xs={12} md={6}>
          <Card sx={cardStyle}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: isLight ? '#0F172A' : '#E2E8F0', mb: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Security sx={{ color: isLight ? '#059669' : '#00E676', fontSize: 18 }} /> Top Observed CVE Identifiers
              </Typography>
              <Typography variant="caption" sx={{ color: isLight ? '#64748B' : '#94A3B8', display: 'block', mb: 1.5, fontSize: '0.73rem' }}>
                💡 <strong>Plain English:</strong> Catalogs publicly known vulnerabilities in third-party packages, web frameworks, or operating system components.
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {top_cves.length > 0 ? (
                  top_cves.slice(0, 8).map((cve, idx) => (
                    <Chip
                      key={idx}
                      label={`${cve.cve} (${cve.count})`}
                      size="small"
                      sx={{ bgcolor: 'rgba(0, 230, 118, 0.1)', color: '#00E676', border: '1px solid rgba(0, 230, 118, 0.3)', fontWeight: 600 }}
                    />
                  ))
                ) : (
                  <Typography variant="caption" sx={{ color: '#94A3B8' }}>No explicit CVE identifiers recorded in selected audit scope.</Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

