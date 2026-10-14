import React, { useState, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
  Chip,
  Paper
} from '@mui/material';
import {
  BubbleChart,
  Timeline,
  CenterFocusStrong,
  OpenInNew
} from '@mui/icons-material';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';

const TIER_COLORS = {
  CRITICAL_OUTLIER: '#FF1744',
  ELEVATED_OUTLIER: '#FF9100',
  SEMANTIC_ANOMALY: '#D500F9',
  METRIC_ANOMALY: '#FFD600',
  NOMINAL_COMPLIANT: '#00E676',
};

function CustomScatterTooltip({ active, payload }) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const color = TIER_COLORS[data.anomaly_tier] || '#00D4FF';

    return (
      <Paper
        sx={{
          p: 1.8,
          bgcolor: 'rgba(11, 17, 32, 0.95)',
          backdropFilter: 'blur(16px)',
          border: `1px solid ${color}`,
          borderRadius: 2,
          maxWidth: 320,
          boxShadow: `0 8px 32px rgba(0, 0, 0, 0.5), 0 0 12px ${color}30`
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
          <Chip
            size="small"
            label={data.anomaly_tier?.replace('_', ' ')}
            sx={{ bgcolor: `${color}25`, color, fontWeight: 800, fontSize: '0.68rem', height: 20 }}
          />
          <Typography variant="caption" fontWeight={800} sx={{ color }}>
            Score: {(data.ensemble_score * 100).toFixed(1)}
          </Typography>
        </Box>
        <Typography variant="body2" fontWeight={800} color="#F1F5F9" sx={{ my: 0.5 }}>
          {data.report_title}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          {data.agency_name}
        </Typography>
        <Box sx={{ pt: 1, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
          <Box>
            <Typography variant="caption" color="text.secondary">Findings:</Typography>
            <Typography variant="body2" fontWeight={700} color="#E2E8F0">{data.total_findings}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Mean CVSS:</Typography>
            <Typography variant="body2" fontWeight={700} color="#E2E8F0">{data.avg_cvss?.toFixed(1)}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">SLA Breaches:</Typography>
            <Typography variant="body2" fontWeight={700} color={data.sla_breach_count > 0 ? '#FF1744' : '#00E676'}>
              {data.sla_breach_count}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Action:</Typography>
            <Typography variant="caption" color="#00D4FF" fontWeight={700}>Click to inspect</Typography>
          </Box>
        </Box>
      </Paper>
    );
  }
  return null;
}

export default function AnomalyScatterPlot({ scatterPoints = [], onSelectPoint, pcaVariance = [] }) {
  const [viewMode, setViewMode] = useState('pca'); // 'pca' or 'density'

  const formattedData = useMemo(() => {
    return scatterPoints.map((pt) => {
      if (viewMode === 'pca') {
        return {
          ...pt,
          x: pt.pca_x ?? 0,
          y: pt.pca_y ?? 0,
          z: Math.max(pt.total_findings || 1, 1)
        };
      } else {
        return {
          ...pt,
          x: pt.total_findings ?? 0,
          y: pt.avg_cvss ?? 0,
          z: Math.max(pt.sla_breach_count * 5 + 10, 10)
        };
      }
    });
  }, [scatterPoints, viewMode]);

  const xLabel = viewMode === 'pca'
    ? `PCA Component 1 (${pcaVariance[0] || '32.4'}% Variance)`
    : 'Total Findings Count';

  const yLabel = viewMode === 'pca'
    ? `PCA Component 2 (${pcaVariance[1] || '18.6'}% Variance)`
    : 'Mean CVSS Severity Score';

  return (
    <Card sx={{ bgcolor: '#0B1120', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ p: 2.2, pb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: 'rgba(0, 212, 255, 0.1)', display: 'flex' }}>
            <BubbleChart sx={{ color: '#00D4FF', fontSize: 22 }} />
          </Box>
          <Box>
            <Typography variant="h6" fontWeight={800} color="#F1F5F9" sx={{ fontSize: '0.95rem' }}>
              Multi-Dimensional Outlier Projection Space
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {viewMode === 'pca' ? 'Hybrid Tabular + Sentence-BERT 768-dim PCA Projection' : 'Finding Density vs Mean CVSS Space'}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <ToggleButtonGroup
            size="small"
            value={viewMode}
            exclusive
            onChange={(e, val) => val && setViewMode(val)}
            sx={{
              bgcolor: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              '& .MuiToggleButton-root': {
                color: 'text.secondary',
                fontSize: '0.72rem',
                fontWeight: 700,
                textTransform: 'none',
                py: 0.4,
                px: 1.2,
                '&.Mui-selected': { color: '#00D4FF', bgcolor: 'rgba(0,212,255,0.15)' }
              }
            }}
          >
            <ToggleButton value="pca">2D PCA Vector Space</ToggleButton>
            <ToggleButton value="density">Density vs CVSS</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </CardContent>

      {/* Legend strip */}
      <Box sx={{ px: 2.5, py: 0.8, bgcolor: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        {Object.entries(TIER_COLORS).map(([tier, color]) => (
          <Box key={tier} sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color }} />
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', fontWeight: 600 }}>
              {tier.replace('_', ' ')}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Recharts container */}
      <Box sx={{ flex: 1, minHeight: 380, p: 2 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 25, bottom: 20, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
            <XAxis
              type="number"
              dataKey="x"
              name="X"
              stroke="#64748B"
              tick={{ fill: '#64748B', fontSize: 11 }}
              label={{ value: xLabel, position: 'insideBottom', offset: -10, fill: '#64748B', fontSize: 11 }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="Y"
              stroke="#64748B"
              tick={{ fill: '#64748B', fontSize: 11 }}
              label={{ value: yLabel, angle: -90, position: 'insideLeft', offset: 10, fill: '#64748B', fontSize: 11 }}
            />
            <ZAxis type="number" dataKey="z" range={[50, 400]} />
            <RechartsTooltip content={<CustomScatterTooltip />} cursor={{ strokeDasharray: '3 3' }} />
            <Scatter
              data={formattedData}
              onClick={(node) => onSelectPoint && onSelectPoint(node.payload?.report_id)}
              style={{ cursor: 'pointer' }}
            >
              {formattedData.map((entry, index) => {
                const color = TIER_COLORS[entry.anomaly_tier] || '#00D4FF';
                return (
                  <Cell
                    key={`cell-${index}`}
                    fill={color}
                    fillOpacity={entry.is_anomaly ? 0.9 : 0.6}
                    stroke={entry.is_anomaly ? '#FFF' : color}
                    strokeWidth={entry.is_anomaly ? 2 : 1}
                  />
                );
              })}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </Box>
    </Card>
  );
}
