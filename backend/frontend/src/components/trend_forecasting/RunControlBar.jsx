import React, { useState } from 'react';
import {
  Box, Card, CardContent, Grid, FormControl, InputLabel, Select, MenuItem,
  Button, Typography, LinearProgress, Chip, TextField, IconButton, Tooltip
} from '@mui/material';
import {
  PlayArrow, History, Tune, CalendarToday, Timeline, FilterList, Refresh
} from '@mui/icons-material';

export default function RunControlBar({
  params,
  onChangeParams,
  onTriggerRun,
  onOpenHistory,
  isRunning,
  activeRun,
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleFrequencyChange = (e) => {
    const freq = e.target.value;
    const defaultHorizon = freq === 'W' ? 12 : 6;
    onChangeParams({ ...params, frequency: freq, horizon: defaultHorizon });
  };

  return (
    <Card sx={{ mb: 3, border: '1px solid rgba(255, 255, 255, 0.08)', background: 'rgba(10, 14, 23, 0.85)' }}>
      <CardContent>
        {/* Main Controls Row */}
        <Grid container spacing={2} alignItems="center">
          {/* Date Basis */}
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel id="date-basis-label">Observation Date Basis</InputLabel>
              <Select
                labelId="date-basis-label"
                value={params.date_basis || 'effective'}
                label="Observation Date Basis"
                onChange={(e) => onChangeParams({ ...params, date_basis: e.target.value })}
                disabled={isRunning}
              >
                <MenuItem value="effective">
                  Audit Assessment Date (Recommended: 90% coverage)
                </MenuItem>
                <MenuItem value="strict">
                  Strict Finding Date (9% coverage)
                </MenuItem>
              </Select>
            </FormControl>
          </Grid>

          {/* Aggregation Frequency */}
          <Grid item xs={6} sm={3} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel id="frequency-label">Aggregation</InputLabel>
              <Select
                labelId="frequency-label"
                value={params.frequency || 'M'}
                label="Aggregation"
                onChange={handleFrequencyChange}
                disabled={isRunning}
              >
                <MenuItem value="M">Monthly Buckets</MenuItem>
                <MenuItem value="W">Weekly Buckets</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          {/* Forecast Horizon */}
          <Grid item xs={6} sm={3} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel id="horizon-label">Forecast Horizon</InputLabel>
              <Select
                labelId="horizon-label"
                value={params.horizon || 6}
                label="Forecast Horizon"
                onChange={(e) => onChangeParams({ ...params, horizon: Number(e.target.value) })}
                disabled={isRunning}
              >
                {params.frequency === 'W' ? (
                  <>
                    <MenuItem value={4}>4 Weeks</MenuItem>
                    <MenuItem value={8}>8 Weeks</MenuItem>
                    <MenuItem value={12}>12 Weeks</MenuItem>
                    <MenuItem value={26}>26 Weeks (6 Mos)</MenuItem>
                  </>
                ) : (
                  <>
                    <MenuItem value={3}>3 Months</MenuItem>
                    <MenuItem value={6}>6 Months</MenuItem>
                    <MenuItem value={9}>9 Months</MenuItem>
                    <MenuItem value={12}>12 Months (1 Year)</MenuItem>
                  </>
                )}
              </Select>
            </FormControl>
          </Grid>

          {/* Action Buttons */}
          <Grid item xs={12} md={5} sx={{ display: 'flex', gap: 1.5, justifyContent: { xs: 'flex-start', md: 'flex-end' } }}>
            <Button
              variant="outlined"
              size="medium"
              startIcon={<Tune />}
              onClick={() => setShowAdvanced(!showAdvanced)}
              sx={{ borderColor: 'rgba(255,255,255,0.2)', color: '#94A3B8' }}
            >
              Filters
            </Button>

            <Button
              variant="outlined"
              size="medium"
              startIcon={<History />}
              onClick={onOpenHistory}
              sx={{ borderColor: 'rgba(0, 212, 255, 0.3)', color: '#00D4FF' }}
            >
              Past Runs
            </Button>

            <Button
              variant="contained"
              size="medium"
              startIcon={<PlayArrow />}
              onClick={onTriggerRun}
              disabled={isRunning}
              sx={{
                background: 'linear-gradient(135deg, #00D4FF 0%, #00E676 100%)',
                color: '#0A0E17',
                fontWeight: 700,
                px: 2.5,
                '&:hover': {
                  background: 'linear-gradient(135deg, #00B8D4 0%, #00C853 100%)',
                },
              }}
            >
              {isRunning ? 'Analyzing...' : 'Run Trend Analysis & Forecast'}
            </Button>
          </Grid>
        </Grid>

        {/* Advanced Filters Drawer/Row */}
        {showAdvanced && (
          <Box sx={{ mt: 2.5, pt: 2, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 600, display: 'block', mb: 1.5 }}>
              OPTIONAL DATA FILTERS & TIMEFRAME
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel id="sev-label">Severity Level</InputLabel>
                  <Select
                    labelId="sev-label"
                    value={params.severity || 'ALL'}
                    label="Severity Level"
                    onChange={(e) => onChangeParams({ ...params, severity: e.target.value })}
                  >
                    <MenuItem value="ALL">All Severities</MenuItem>
                    <MenuItem value="Critical">Critical Only</MenuItem>
                    <MenuItem value="High">High Only</MenuItem>
                    <MenuItem value="Medium">Medium Only</MenuItem>
                    <MenuItem value="Low">Low Only</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel id="stat-label">Remediation Status</InputLabel>
                  <Select
                    labelId="stat-label"
                    value={params.status || 'ALL'}
                    label="Remediation Status"
                    onChange={(e) => onChangeParams({ ...params, status: e.target.value })}
                  >
                    <MenuItem value="ALL">All Statuses</MenuItem>
                    <MenuItem value="Open">Open Findings</MenuItem>
                    <MenuItem value="Closed">Closed Findings</MenuItem>
                    <MenuItem value="Partially Remediated">Partially Remediated</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  size="small"
                  label="Start Date (YYYY-MM-DD)"
                  value={params.start_date || ''}
                  onChange={(e) => onChangeParams({ ...params, start_date: e.target.value })}
                  placeholder="e.g. 2023-01-01"
                />
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  size="small"
                  label="End Date (YYYY-MM-DD)"
                  value={params.end_date || ''}
                  onChange={(e) => onChangeParams({ ...params, end_date: e.target.value })}
                  placeholder="e.g. 2026-12-31"
                />
              </Grid>
            </Grid>
          </Box>
        )}

        {/* Active Run Live Progress Bar */}
        {isRunning && activeRun && (
          <Box sx={{ mt: 2.5, p: 2, borderRadius: 2, background: 'rgba(0, 212, 255, 0.08)', border: '1px solid rgba(0, 212, 255, 0.3)' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="body2" sx={{ color: '#00D4FF', fontWeight: 700 }}>
                Run in Progress (Run ID: {activeRun.run_id ? String(activeRun.run_id).substring(0, 8) : '...'})
              </Typography>
              <Typography variant="body2" sx={{ color: '#E2E8F0', fontWeight: 600 }}>
                {activeRun.progress_percent || 0}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={activeRun.progress_percent || 0}
              sx={{ height: 6, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.1)', '& .MuiLinearProgress-bar': { bgcolor: '#00D4FF' } }}
            />
            <Typography variant="caption" sx={{ color: '#94A3B8', mt: 0.8, display: 'block' }}>
              Current Stage: {activeRun.current_stage || 'Processing...'}
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

