import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  CircularProgress,
  Alert,
  Tooltip,
  IconButton,
  Button,
} from '@mui/material';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  BubbleChart,
  FilterList,
  Refresh,
  InfoOutlined,
  Fullscreen,
  FullscreenExit,
} from '@mui/icons-material';
import api from '../../api/axios';

const CLUSTER_COLORS = [
  '#00D4FF', '#00E676', '#B388FF', '#FF9100', '#F43F5E',
  '#10B981', '#38BDF8', '#E11D48', '#8B5CF6', '#F59E0B',
  '#06B6D4', '#EC4899', '#34D399', '#A78BFA', '#FB923C'
];

export default function ClusterScatterPlot({
  runId,
  initialData = null,
  clusteringType = 'VULNERABILITY',
  algorithm = 'HDBSCAN',
}) {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(!initialData && !!runId);
  const [error, setError] = useState(null);
  const [selectedCluster, setSelectedCluster] = useState('ALL');
  const [showNoise, setShowNoise] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const fetchProjection = async () => {
    if (!runId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/api/clustering/runs/${runId}/projection`);
      if (res.data?.status === 'success') {
        setData(res.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load 2D cluster projection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialData && initialData.length > 0) {
      setData(initialData);
      setLoading(false);
    } else if (runId) {
      fetchProjection();
    }
  }, [runId, initialData]);

  // Extract unique clusters
  const clusterOptions = useMemo(() => {
    if (!data || data.length === 0) return [];
    const ids = Array.from(new Set(data.map((d) => d.cluster_id))).sort((a, b) => a - b);
    return ids;
  }, [data]);

  // Filtered dataset
  const filteredData = useMemo(() => {
    if (!data) return [];
    return data.filter((d) => {
      if (!showNoise && d.cluster_id === -1) return false;
      if (selectedCluster !== 'ALL' && d.cluster_id !== Number(selectedCluster)) return false;
      return true;
    });
  }, [data, selectedCluster, showNoise]);

  const getColorForCluster = (clusterId) => {
    if (clusterId === -1) return '#64748B';
    return CLUSTER_COLORS[Math.abs(clusterId) % CLUSTER_COLORS.length];
  };

  if (loading) {
    return (
      <Card sx={{ bgcolor: '#0B1220', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 3, mb: 3 }}>
        <Box sx={{ p: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <CircularProgress size={36} sx={{ color: '#00D4FF' }} />
          <Typography variant="body2" color="text.secondary">
            Computing 2D PCA Semantic Projection...
          </Typography>
        </Box>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 3 }} action={<Button color="inherit" size="small" onClick={fetchProjection}>Retry</Button>}>
        {error}
      </Alert>
    );
  }

  if (!data || data.length === 0) {
    return null;
  }

  const nNoise = data.filter((d) => d.cluster_id === -1).length;
  const nClustered = data.length - nNoise;

  return (
    <Card
      sx={{
        bgcolor: '#0B1220',
        border: '1px solid rgba(0, 212, 255, 0.25)',
        borderRadius: 3,
        mb: 3,
        position: 'relative',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
      }}
    >
      <CardContent sx={{ p: { xs: 2, md: 3 } }}>
        {/* Header Controls */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2, mb: 2 }}>
          <Box>
            <Typography variant="h6" fontWeight={800} sx={{ color: '#E2E8F0', display: 'flex', alignItems: 'center', gap: 1 }}>
              <BubbleChart sx={{ color: '#00D4FF', fontSize: 24 }} />
              2D Semantic Cluster Projection Map
            </Typography>
            <Typography variant="caption" color="text.secondary">
              High-dimensional 768-D Sentence-BERT embedding hyperspace projected via PCA (Principal Component Analysis).
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel sx={{ color: 'text.secondary' }}>Cluster Focus</InputLabel>
              <Select
                value={selectedCluster}
                label="Cluster Focus"
                onChange={(e) => setSelectedCluster(e.target.value)}
                sx={{
                  color: '#fff',
                  fontSize: '0.8rem',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.1)' }
                }}
              >
                <MenuItem value="ALL">All Partitions ({clusterOptions.filter(c => c !== -1).length})</MenuItem>
                {clusterOptions.map((cid) => (
                  <MenuItem key={cid} value={cid}>
                    {cid === -1 ? 'Noise Outliers (-1)' : `Cluster #${cid}`}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={showNoise}
                  onChange={(e) => setShowNoise(e.target.checked)}
                  sx={{ '& .MuiSwitch-thumb': { bgcolor: showNoise ? '#00D4FF' : '#64748B' } }}
                />
              }
              label={<Typography variant="caption" sx={{ color: '#94A3B8' }}>Show Outliers</Typography>}
            />

            <Tooltip title="Expand / Minimize Map">
              <IconButton size="small" onClick={() => setExpanded(!expanded)} sx={{ color: '#94A3B8' }}>
                {expanded ? <FullscreenExit fontSize="small" /> : <Fullscreen fontSize="small" />}
              </IconButton>
            </Tooltip>

            <Tooltip title="Refresh Projection">
              <IconButton size="small" onClick={fetchProjection} sx={{ color: '#94A3B8' }}>
                <Refresh fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Quick Stats Badges */}
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 2 }}>
          <Chip
            size="small"
            label={`${filteredData.length} Points Displayed`}
            sx={{ bgcolor: 'rgba(255,255,255,0.05)', color: '#CBD5E1', fontSize: '0.72rem' }}
          />
          <Chip
            size="small"
            label={`Clustered: ${nClustered}`}
            sx={{ bgcolor: 'rgba(0, 230, 118, 0.1)', color: '#00E676', fontSize: '0.72rem', border: '1px solid rgba(0, 230, 118, 0.25)' }}
          />
          {nNoise > 0 && (
            <Chip
              size="small"
              label={`Noise: ${nNoise}`}
              sx={{ bgcolor: 'rgba(100, 116, 139, 0.15)', color: '#94A3B8', fontSize: '0.72rem', border: '1px solid rgba(100, 116, 139, 0.3)' }}
            />
          )}
          <Chip
            size="small"
            label={`Algorithm: ${algorithm}`}
            sx={{ bgcolor: 'rgba(0, 212, 255, 0.1)', color: '#00D4FF', fontSize: '0.72rem', border: '1px solid rgba(0, 212, 255, 0.25)' }}
          />
        </Box>

        {/* Interactive Scatter Plot */}
        <Box sx={{ height: expanded ? 600 : 380, width: '100%', mt: 1 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 15, right: 25, bottom: 25, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis
                type="number"
                dataKey="x"
                name="Principal Component 1"
                stroke="#64748B"
                fontSize={11}
                tickFormatter={(val) => Number(val).toFixed(1)}
                label={{ value: 'PCA Dimension 1 (Semantic Variance Axis)', position: 'insideBottom', offset: -12, fill: '#64748B', fontSize: 11 }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="Principal Component 2"
                stroke="#64748B"
                fontSize={11}
                tickFormatter={(val) => Number(val).toFixed(1)}
                label={{ value: 'PCA Dimension 2 (Orthogonal Separation)', angle: -90, position: 'insideLeft', fill: '#64748B', fontSize: 11 }}
              />
              <ZAxis
                type="number"
                dataKey="cvss_score"
                range={[50, 180]}
                name="CVSS Score"
              />
              <RechartsTooltip
                cursor={{ strokeDasharray: '3 3', stroke: 'rgba(255,255,255,0.2)' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload;
                    const isNoise = d.cluster_id === -1;
                    const dotColor = getColorForCluster(d.cluster_id);
                    return (
                      <Box
                        sx={{
                          bgcolor: 'rgba(11, 18, 32, 0.95)',
                          border: `1px solid ${dotColor}`,
                          borderRadius: 2,
                          p: 1.5,
                          maxWidth: 320,
                          boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
                          backdropFilter: 'blur(8px)',
                        }}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5, gap: 1 }}>
                          <Chip
                            size="small"
                            label={isNoise ? 'Noise Outlier' : `Cluster #${d.cluster_id}`}
                            sx={{
                              bgcolor: `${dotColor}22`,
                              color: dotColor,
                              fontWeight: 800,
                              fontSize: '0.7rem',
                              border: `1px solid ${dotColor}55`,
                            }}
                          />
                          {d.severity && (
                            <Chip
                              size="small"
                              label={d.severity}
                              sx={{
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                bgcolor: d.severity === 'CRITICAL' ? 'rgba(255,23,68,0.2)' : d.severity === 'HIGH' ? 'rgba(255,145,0,0.2)' : 'rgba(0,230,118,0.2)',
                                color: d.severity === 'CRITICAL' ? '#FF1744' : d.severity === 'HIGH' ? '#FF9100' : '#00E676',
                              }}
                            />
                          )}
                        </Box>
                        <Typography variant="body2" fontWeight={700} sx={{ color: '#E2E8F0', mb: 0.5, lineHeight: 1.3 }}>
                          {d.title}
                        </Typography>
                        {d.cvss_score !== undefined && d.cvss_score !== null && (
                          <Typography variant="caption" sx={{ color: '#38BDF8', display: 'block' }}>
                            CVSS: <strong>{d.cvss_score}</strong> &bull; Strength: <strong>{(d.strength * 100).toFixed(0)}%</strong>
                          </Typography>
                        )}
                        {d.cwe && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            CWE: {Array.isArray(d.cwe) ? d.cwe.join(', ') : d.cwe}
                          </Typography>
                        )}
                        <Typography variant="caption" sx={{ color: '#64748B', display: 'block', mt: 0.5 }}>
                          PCA: ({d.x.toFixed(2)}, {d.y.toFixed(2)})
                        </Typography>
                      </Box>
                    );
                  }
                  return null;
                }}
              />
              <Scatter data={filteredData}>
                {filteredData.map((entry, index) => {
                  const color = getColorForCluster(entry.cluster_id);
                  const isNoise = entry.cluster_id === -1;
                  return (
                    <Cell
                      key={`scatter-point-${index}`}
                      fill={color}
                      fillOpacity={isNoise ? 0.35 : 0.85}
                      stroke={color}
                      strokeWidth={isNoise ? 1 : 1.5}
                    />
                  );
                })}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </Box>
      </CardContent>
    </Card>
  );
}
