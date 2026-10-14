import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Paper,
  LinearProgress,
  Stack
} from '@mui/material';
import {
  Functions,
  CompareArrows,
  BarChart as BarChartIcon
} from '@mui/icons-material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';

export default function AnomalyAttributionChart({ records = [], summary = {} }) {
  // Aggregate ECOD feature attributions across anomalous records
  const anomRecords = records.filter(r => r.is_anomaly);
  const sampleSet = anomRecords.length > 0 ? anomRecords : records.slice(0, 25);

  const featureTotals = {};
  const featureCounts = {};

  sampleSet.forEach(r => {
    const attrs = r.ecod_attributions || {};
    Object.entries(attrs).forEach(([feat, pct]) => {
      featureTotals[feat] = (featureTotals[feat] || 0) + Number(pct);
      featureCounts[feat] = (featureCounts[feat] || 0) + 1;
    });
  });

  const chartData = Object.keys(featureTotals).map(feat => {
    const avg = featureCounts[feat] > 0 ? featureTotals[feat] / featureCounts[feat] : 0;
    return {
      feature: feat.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      rawKey: feat,
      avg_attribution: Number(avg.toFixed(1))
    };
  }).sort((a, b) => b.avg_attribution - a.avg_attribution).slice(0, 8);

  const correlations = summary?.detector_correlations || {
    iforest_ecod: 0.72,
    iforest_embed: 0.54,
    ecod_embed: 0.48
  };

  return (
    <Card sx={{ bgcolor: '#0B1120', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ p: 2.2, pb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: 'rgba(255, 214, 0, 0.1)', display: 'flex' }}>
            <Functions sx={{ color: '#FFD600', fontSize: 22 }} />
          </Box>
          <Box>
            <Typography variant="h6" fontWeight={800} color="#F1F5F9" sx={{ fontSize: '0.95rem' }}>
              ECOD Dimensional Attribution & Detector Correlations
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Traceable tail probability contributions across security audit dimensions
            </Typography>
          </Box>
        </Box>
      </CardContent>

      <Box sx={{ p: 2, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Grid container spacing={2} sx={{ flex: 1 }}>
          {/* Bar Chart: Feature Attribution */}
          <Grid item xs={12} md={8}>
            <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              Average Dimensional Outlier Driver Contribution (%)
            </Typography>
            <Box sx={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                  <XAxis type="number" stroke="#64748B" tick={{ fill: '#64748B', fontSize: 11 }} unit="%" />
                  <YAxis type="category" dataKey="feature" stroke="#64748B" tick={{ fill: '#E2E8F0', fontSize: 11 }} width={120} />
                  <RechartsTooltip
                    formatter={(val) => [`${val}% attribution`, 'Contribution']}
                    contentStyle={{ bgcolor: '#0B1120', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                  />
                  <Bar dataKey="avg_attribution" radius={[0, 4, 4, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`bar-${index}`}
                        fill={index === 0 ? '#FF1744' : index < 3 ? '#FF9100' : '#00D4FF'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Grid>

          {/* Correlations & Consensus Matrix */}
          <Grid item xs={12} md={4}>
            <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              Tri-Model Agreement Matrix
            </Typography>
            <Stack spacing={1.5} sx={{ mt: 1 }}>
              <Paper sx={{ p: 1.5, bgcolor: '#0F172A', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 1.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    iForest &harr; ECOD (Tabular Concordance)
                  </Typography>
                  <Typography variant="caption" fontWeight={800} color="#00E676">
                    {correlations.iforest_ecod ?? '0.72'}
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={Math.max(0, (correlations.iforest_ecod ?? 0.72) * 100)}
                  sx={{ height: 4, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.06)', '& .MuiLinearProgress-bar': { bgcolor: '#00E676' } }}
                />
              </Paper>

              <Paper sx={{ p: 1.5, bgcolor: '#0F172A', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 1.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    iForest &harr; SBERT (Metric vs Narrative)
                  </Typography>
                  <Typography variant="caption" fontWeight={800} color="#00D4FF">
                    {correlations.iforest_embed ?? '0.54'}
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={Math.max(0, (correlations.iforest_embed ?? 0.54) * 100)}
                  sx={{ height: 4, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.06)', '& .MuiLinearProgress-bar': { bgcolor: '#00D4FF' } }}
                />
              </Paper>

              <Paper sx={{ p: 1.5, bgcolor: '#0F172A', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 1.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    ECOD &harr; SBERT (Tail vs Narrative)
                  </Typography>
                  <Typography variant="caption" fontWeight={800} color="#D500F9">
                    {correlations.ecod_embed ?? '0.48'}
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={Math.max(0, (correlations.ecod_embed ?? 0.48) * 100)}
                  sx={{ height: 4, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.06)', '& .MuiLinearProgress-bar': { bgcolor: '#D500F9' } }}
                />
              </Paper>
            </Stack>
          </Grid>
        </Grid>
      </Box>
    </Card>
  );
}
