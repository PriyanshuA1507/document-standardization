import { useQuery } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import {
  Box, Backdrop, CircularProgress, Card, CardContent, Grid, Typography, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Chip, Skeleton, Tooltip, Alert,
  IconButton, Dialog, DialogTitle, DialogContent, Tabs, Tab, Button
} from '@mui/material';
import {
  Assessment, ReportProblem, ErrorOutline,
  DragIndicator, OpenInFull, Close, BugReport, Description, History, Dashboard as DashboardIcon,
  ArrowForward, Shield, Speed, BubbleChart, Tune, AutoAwesome
} from '@mui/icons-material';
import api from '../api/axios';
import VulnerabilityPrioritizationModule from '../components/clustering/VulnerabilityPrioritizationModule';
import ReportAnomalyDetectionModule from '../components/clustering/ReportAnomalyDetectionModule';
import VulnerabilityClusteringModule from '../components/clustering/VulnerabilityClusteringModule';
import ReportClusteringModule from '../components/clustering/ReportClusteringModule';
import ClusteringHistoryModule from '../components/clustering/ClusteringHistoryModule';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function ChartCard({ title, icon, action, children, delay = 0, sx: sxProp = {}, onExpand, dragHandleProps = {} }) {
  return (
    <Card className="fade-in-up" sx={{ animationDelay: `${delay}ms`, minHeight: 440, height: '100%', display: 'flex', flexDirection: 'column', ...sxProp }}>
      <CardContent sx={{ p: 2, pb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box className="drag-handle" {...dragHandleProps} sx={{ cursor: 'grab', display: 'flex', alignItems: 'center', color: 'text.secondary', '&:active': { cursor: 'grabbing' } }}>
            <DragIndicator sx={{ fontSize: 20 }} />
          </Box>
          {icon && React.cloneElement(icon, { sx: { color: '#00D4FF', fontSize: 20 } })}
          <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '0.9rem' }}>
            {title}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {action}
          {onExpand && (
            <IconButton size="small" onClick={onExpand} sx={{ color: 'text.secondary', '&:hover': { color: '#00D4FF', bgcolor: 'rgba(0,212,255,0.1)' } }}>
              <OpenInFull sx={{ fontSize: 18 }} />
            </IconButton>
          )}
        </Box>
      </CardContent>
      <Box sx={{ p: 2, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 340, width: '100%' }}>
        {children}
      </Box>
    </Card>
  );
}

function SortableWidget({ id, children, md }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    height: '100%', minHeight: 440, zIndex: transform ? 1 : 0,
    position: 'relative'
  };
  return (
    <Grid item xs={12} md={md} ref={setNodeRef} style={style}>
      {React.cloneElement(children, { dragHandleProps: { ...attributes, ...listeners } })}
    </Grid>
  );
}

export default function MLAnalyticsDashboardPage() {
  const [anomalies, setAnomalies] = useState(null);
  const [prioritize, setPrioritize] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [expandedWidget, setExpandedWidget] = useState(null);
  const [currentTab, setCurrentTab] = useState(0);
  const initialWidgets = ['prioritize', 'anomalies'];
  const [widgets, setWidgets] = useState(initialWidgets);

  const widgetWidths = { prioritize: 6, anomalies: 6 };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      setWidgets((items) => {
        const oldIndex = items.indexOf(active.id);
        const newIndex = items.indexOf(over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const { data, isFetching } = useQuery({
    queryKey: ['mlAnalyticsData'],
    queryFn: async () => {
      const [aRes, pRes] = await Promise.allSettled([
        api.get('/api/ml/anomalies'),
        api.get('/api/ml/prioritize')
      ]);
      return {
        anomalies: aRes.status === 'fulfilled' ? aRes.value.data : null,
        prioritize: pRes.status === 'fulfilled' ? pRes.value.data : null
      };
    },
    staleTime: 5 * 60 * 1000
  });

  useEffect(() => {
    if (data) {
      if (data.anomalies) setAnomalies(data.anomalies);
      if (data.prioritize) setPrioritize(data.prioritize);
      setLoading(false);
    }
  }, [data]);

  if (loading) {
    return (
      <Box>
        <Typography variant="h4" fontWeight={800} sx={{ mb: 4, background: '-webkit-linear-gradient(45deg, #00D4FF, #00E676)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'}}>
          AI Risk Analytics
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}><Skeleton variant="rounded" height={420} sx={{ borderRadius: 3 }} /></Grid>
          <Grid item xs={12} md={6}><Skeleton variant="rounded" height={420} sx={{ borderRadius: 3 }} /></Grid>
        </Grid>
      </Box>
    );
  }

  const topTask = prioritize?.data?.[0];
  const outlierList = anomalies?.data?.filter(a => a.is_anomaly) || [];

  const renderWidget = (key) => {
    switch(key) {
    case 'prioritize':
      return (
        <ChartCard
          title="Prioritized Action Queue (TOPSIS)"
          icon={<ReportProblem />}
          delay={300}
          onExpand={() => setExpandedWidget('prioritize')}
          action={
            <Button
              size="small"
              variant="outlined"
              onClick={() => setCurrentTab(1)}
              endIcon={<ArrowForward sx={{ fontSize: 13 }} />}
              sx={{
                borderColor: 'rgba(0, 212, 255, 0.3)',
                bgcolor: 'rgba(0, 212, 255, 0.08)',
                color: '#00D4FF',
                fontWeight: 600,
                fontSize: '0.72rem',
                py: 0.3,
                px: 1.2,
                borderRadius: 1.5,
                whiteSpace: 'nowrap',
                '&:hover': { bgcolor: 'rgba(0, 212, 255, 0.16)', borderColor: '#00D4FF' }
              }}
            >
              Full View
            </Button>
          }
        >
          <Box sx={{ flex: 1, overflowY: 'auto', mb: 1 }}>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ color: 'text.secondary', fontWeight: 800 }}>Vulnerability</TableCell>
                    <TableCell sx={{ color: 'text.secondary', fontWeight: 800 }}>CVSS</TableCell>
                    <TableCell sx={{ color: 'text.secondary', fontWeight: 800 }}>Days Open</TableCell>
                    <TableCell sx={{ color: 'text.secondary', fontWeight: 800 }}>Priority Score</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(!prioritize?.data || prioritize.data.length === 0) ? (
                    <TableRow><TableCell colSpan={4} align="center" sx={{ color: 'text.secondary', py: 3 }}>No open tasks in queue</TableCell></TableRow>
                  ) : (
                    prioritize?.data?.slice(0, 10).map((task) => (
                      <TableRow key={task.finding_id} hover sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' } }}>
                        <TableCell sx={{ maxWidth: 220 }}>
                          <Typography noWrap variant="body2" fontWeight={700} color="#F1F5F9">{task.title}</Typography>
                          {task.agency_name && (
                            <Typography noWrap variant="caption" color="text.secondary">{task.agency_name}</Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={800} sx={{ color: task.cvss >= 9 ? '#FF1744' : task.cvss >= 7 ? '#FF9100' : '#00E676' }}>
                            {task.cvss}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Typography variant="body2">{task.days_open}d</Typography>
                            {task.sla_status === 'BREACHED' && (
                              <Chip size="small" label="SLA" sx={{ height: 16, fontSize: '0.6rem', bgcolor: 'rgba(255,23,68,0.2)', color: '#FF1744', fontWeight: 800 }} />
                            )}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ width: '100%', height: 6, bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                              <Box
                                sx={{
                                  width: `${Math.min(task.priority_score, 100)}%`,
                                  height: '100%',
                                  bgcolor: task.priority_score > 70 ? '#FF1744' : task.priority_score > 40 ? '#FF9100' : '#00E676',
                                  borderRadius: 3
                                }}
                              />
                            </Box>
                            <Typography variant="caption" fontWeight={800} sx={{ color: task.priority_score > 70 ? '#FF1744' : task.priority_score > 40 ? '#FF9100' : '#00E676' }}>
                              {task.priority_score}
                            </Typography>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
          <Box sx={{ pt: 1, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              Showing top 10 prioritized tasks &bull; {prioritize?.total || prioritize?.data?.length || 0} total tasks in queue
            </Typography>
            <Button
              size="small"
              onClick={() => setCurrentTab(1)}
              sx={{ color: '#00D4FF', fontSize: '0.75rem', fontWeight: 700, textTransform: 'none' }}
            >
              Configure Weights &gt;
            </Button>
          </Box>
        </ChartCard>
      );
    case 'anomalies':
      return (
        <ChartCard
          title="Anomalous Reports (Isolation Forest)"
          icon={<ErrorOutline />}
          delay={400}
          onExpand={() => setExpandedWidget('anomalies')}
          action={
            <Button
              size="small"
              variant="outlined"
              onClick={() => setCurrentTab(2)}
              endIcon={<ArrowForward sx={{ fontSize: 13 }} />}
              sx={{
                borderColor: 'rgba(255, 23, 68, 0.35)',
                bgcolor: 'rgba(255, 23, 68, 0.08)',
                color: '#FF1744',
                fontWeight: 600,
                fontSize: '0.72rem',
                py: 0.3,
                px: 1.2,
                borderRadius: 1.5,
                whiteSpace: 'nowrap',
                '&:hover': { bgcolor: 'rgba(255, 23, 68, 0.16)', borderColor: '#FF1744' }
              }}
            >
              Full View
            </Button>
          }
        >
          {anomalies?.status === 'insufficient_data' ? (
            <Alert severity="info">{anomalies.message}</Alert>
          ) : (
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ flex: 1, overflowY: 'auto', mb: 1 }}>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ color: 'text.secondary', fontWeight: 800 }}>Audit Report</TableCell>
                        <TableCell sx={{ color: 'text.secondary', fontWeight: 800 }}>Agency</TableCell>
                        <TableCell sx={{ color: 'text.secondary', fontWeight: 800 }}>Status</TableCell>
                        <TableCell sx={{ color: 'text.secondary', fontWeight: 800 }}>Score</TableCell>
                        <TableCell sx={{ color: 'text.secondary', fontWeight: 800 }}>Primary Anomaly Driver</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(!anomalies?.data || anomalies.data.length === 0) ? (
                        <TableRow><TableCell colSpan={5} align="center" sx={{ color: 'text.secondary', py: 3 }}>No report records evaluated</TableCell></TableRow>
                      ) : (
                        anomalies.data.slice(0, 10).map((report) => (
                        <TableRow key={report.report_id} hover sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' } }}>
                          <TableCell sx={{ maxWidth: 200 }}>
                            <Typography noWrap variant="body2" fontWeight={700} color="#F1F5F9" title={report.report_title}>
                              {report.report_title}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {report.total_findings} findings &bull; Mean {report.avg_cvss.toFixed(1)}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ maxWidth: 150 }}>
                            <Typography noWrap variant="body2" color="#E2E8F0">
                              {report.agency_name}
                            </Typography>
                            {report.cert_in_empanelled && (
                              <Chip size="small" label="CERT-In" sx={{ height: 16, fontSize: '0.6rem', bgcolor: 'rgba(0,212,255,0.15)', color: '#00D4FF', mt: 0.3 }} />
                            )}
                          </TableCell>
                          <TableCell>
                            {report.is_anomaly ? (
                              <Chip size="small" label="Outlier" color="error" sx={{ height: 20, fontSize: '0.7rem', fontWeight: 800 }} />
                            ) : (
                              <Chip size="small" label="Normal" color="success" sx={{ height: 20, fontSize: '0.7rem', fontWeight: 800 }} />
                            )}
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight={800} sx={{ color: report.is_anomaly ? '#FF1744' : '#00E676' }}>
                              {report.anomaly_score.toFixed(2)}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ maxWidth: 180 }}>
                            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }} title={report.primary_drivers?.[0]}>
                              {report.primary_drivers?.[0] || (report.is_anomaly ? 'Multivariate deviation' : 'Conforms to fleet baseline')}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
              <Box sx={{ pt: 1, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="caption" color="text.secondary">
                  Detected {anomalies?.anomalies_detected || 0} outliers across {anomalies?.total_reports || anomalies?.data?.length || 0} evaluated reports
                </Typography>
                <Button
                  size="small"
                  onClick={() => setCurrentTab(2)}
                  sx={{ color: '#FF1744', fontSize: '0.75rem', fontWeight: 700, textTransform: 'none' }}
                >
                  Deep Telemetry &gt;
                </Button>
              </Box>
            </Box>
          )}
        </ChartCard>
      );

      default: return null;
    }
  };

  return (
    <Box>
      {/* ═══════ PAGE TITLE ═══════ */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Assessment sx={{ fontSize: 40, color: '#00D4FF' }} />
          <Box>
            <Typography variant="h4" fontWeight={800}>AI Risk Analytics & Intelligence</Typography>
            <Typography variant="body2" color="text.secondary">
              Production-Grade MCDA Prioritization, Unsupervised Anomaly Detection, and Neural HDBSCAN Clustering
            </Typography>
          </Box>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {/* ═══════ SIX UNIFIED ML MODULE TABS ═══════ */}
      <Box sx={{ borderBottom: 1, borderColor: 'rgba(255, 255, 255, 0.08)', mb: 3 }}>
        <Tabs
          value={currentTab}
          onChange={(e, val) => setCurrentTab(val)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            '& .MuiTabs-indicator': { backgroundColor: '#00D4FF', height: 3 },
            '& .MuiTab-root': {
              color: 'text.secondary',
              fontWeight: 700,
              fontSize: '0.88rem',
              textTransform: 'none',
              minHeight: 48,
              '&.Mui-selected': { color: '#00D4FF' },
              '&:hover': { color: '#E2E8F0' },
            },
          }}
        >
          <Tab icon={<DashboardIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Risk Overview & Analytics" />
          <Tab icon={<ReportProblem sx={{ fontSize: 18 }} />} iconPosition="start" label="Action Prioritization (TOPSIS)" />
          <Tab icon={<AutoAwesome sx={{ fontSize: 18 }} />} iconPosition="start" label="Report Anomaly Detection (Tri-Model)" />
          <Tab icon={<BugReport sx={{ fontSize: 18 }} />} iconPosition="start" label="Vulnerability Clustering" />
          <Tab icon={<Description sx={{ fontSize: 18 }} />} iconPosition="start" label="Report Clustering" />
          <Tab icon={<History sx={{ fontSize: 18 }} />} iconPosition="start" label="Clustering History" />
        </Tabs>
      </Box>

      {/* ═══════ TAB 0: OVERVIEW & ANALYTICS ═══════ */}
      {currentTab === 0 && (
        <>
          {/* Surface KPI Strip */}
          <Grid container spacing={2.5} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ bgcolor: '#0B1120', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 2 }}>
                <CardContent sx={{ p: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary" fontWeight={700}>TOP ACTION SCORE</Typography>
                      <Typography variant="h5" fontWeight={900} sx={{ color: topTask ? '#FF1744' : 'text.secondary', my: 0.3 }}>
                        {topTask?.priority_score !== undefined ? topTask.priority_score : '0.00'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {topTask ? (topTask.sla_status === 'BREACHED' ? 'SLA Breached' : 'P1 Immediate Triage') : 'No actions pending'}
                      </Typography>
                    </Box>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => setCurrentTab(1)}
                      sx={{ borderColor: topTask ? 'rgba(255,23,68,0.3)' : 'rgba(255,255,255,0.1)', color: topTask ? '#FF1744' : 'text.secondary', fontSize: '0.7rem', fontWeight: 700 }}
                    >
                      View Queue
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ bgcolor: '#0B1120', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 2 }}>
                <CardContent sx={{ p: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary" fontWeight={700}>CRITICAL QUEUE</Typography>
                      <Typography variant="h5" fontWeight={900} sx={{ color: (prioritize?.summary?.p1_count ?? 0) > 0 ? '#FF9100' : 'text.secondary', my: 0.3 }}>
                        {prioritize?.summary?.p1_count ?? 0} Urgent
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {(prioritize?.summary?.p1_count ?? 0) > 0 ? 'SLA breach risk' : 'No SLA breach risk'}
                      </Typography>
                    </Box>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => setCurrentTab(1)}
                      sx={{ borderColor: (prioritize?.summary?.p1_count ?? 0) > 0 ? 'rgba(255,145,0,0.3)' : 'rgba(255,255,255,0.1)', color: (prioritize?.summary?.p1_count ?? 0) > 0 ? '#FF9100' : 'text.secondary', fontSize: '0.7rem', fontWeight: 700 }}
                    >
                      Configure
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ bgcolor: '#0B1120', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 2 }}>
                <CardContent sx={{ p: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary" fontWeight={700}>FLAGGED OUTLIERS</Typography>
                      <Typography variant="h5" fontWeight={900} sx={{ color: '#00D4FF', my: 0.3 }}>
                        {anomalies?.anomalies_detected ?? 0} Reports
                      </Typography>
                      <Typography variant="caption" color="text.secondary">Isolation Forest flags</Typography>
                    </Box>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => setCurrentTab(2)}
                      sx={{ borderColor: 'rgba(0,212,255,0.3)', color: '#00D4FF', fontSize: '0.7rem', fontWeight: 700 }}
                    >
                      Inspect
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ bgcolor: '#0B1120', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 2 }}>
                <CardContent sx={{ p: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary" fontWeight={700}>NEURAL CLUSTERING</Typography>
                      <Typography variant="h6" fontWeight={800} sx={{ color: '#00E676', my: 0.3 }}>
                        HDBSCAN SBERT
                      </Typography>
                      <Typography variant="caption" color="text.secondary">Semantic grouping</Typography>
                    </Box>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => setCurrentTab(3)}
                      sx={{ borderColor: 'rgba(0,230,118,0.3)', color: '#00E676', fontSize: '0.7rem', fontWeight: 700 }}
                    >
                      Clusters
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Draggable Widgets */}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={widgets} strategy={rectSortingStrategy}>
              <Grid container spacing={3}>
                {widgets.map(key => (
                  <SortableWidget key={key} id={key} md={widgetWidths[key]}>
                    {renderWidget(key)}
                  </SortableWidget>
                ))}
              </Grid>
            </SortableContext>
          </DndContext>

          {/* Expand Dialog */}
          <Dialog
            open={Boolean(expandedWidget)}
            onClose={() => setExpandedWidget(null)}
            maxWidth="lg"
            fullWidth
            PaperProps={{
              sx: {
                bgcolor: '#0B1120',
                border: '1px solid rgba(255,255,255,0.1)',
                backgroundImage: 'none',
                height: '80vh',
                display: 'flex',
                flexDirection: 'column'
              }
            }}
          >
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', p: 2 }}>
              <Typography variant="h6" fontWeight={700}>Expanded View</Typography>
              <IconButton onClick={() => setExpandedWidget(null)} sx={{ color: 'text.secondary' }}>
                <Close />
              </IconButton>
            </DialogTitle>
            <DialogContent sx={{ p: 3, flex: 1, minHeight: 0 }}>
              {expandedWidget === 'prioritize' && (
                <TableContainer sx={{ height: '100%' }}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Vulnerability</TableCell>
                        <TableCell>Agency</TableCell>
                        <TableCell>CVSS</TableCell>
                        <TableCell>Days Open</TableCell>
                        <TableCell>Priority Score</TableCell>
                        <TableCell>SLA Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(!prioritize?.data || prioritize.data.length === 0) ? (
                        <TableRow><TableCell colSpan={6} align="center" sx={{ color: 'text.secondary', py: 4 }}>No prioritized tasks found</TableCell></TableRow>
                      ) : (
                        prioritize.data.map((task) => (
                          <TableRow key={task.finding_id}>
                            <TableCell>{task.title}</TableCell>
                            <TableCell>{task.agency_name || 'Unassigned'}</TableCell>
                            <TableCell>{task.cvss}</TableCell>
                            <TableCell>{task.days_open}</TableCell>
                            <TableCell>{task.priority_score}</TableCell>
                            <TableCell>{task.sla_status || 'COMPLIANT'}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
              {expandedWidget === 'anomalies' && (
                <TableContainer sx={{ height: '100%' }}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Audit Report Document</TableCell>
                        <TableCell>Auditing Agency</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Score</TableCell>
                        <TableCell>Total Findings</TableCell>
                        <TableCell>Mean CVSS</TableCell>
                        <TableCell>Primary Driver</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(!anomalies?.data || anomalies.data.length === 0) ? (
                        <TableRow><TableCell colSpan={7} align="center" sx={{ color: 'text.secondary', py: 4 }}>No reports found</TableCell></TableRow>
                      ) : (
                        anomalies.data.map((report) => (
                          <TableRow key={report.report_id}>
                            <TableCell>{report.report_title}</TableCell>
                            <TableCell>{report.agency_name} {report.cert_in_empanelled ? '(CERT-In)' : ''}</TableCell>
                            <TableCell>{report.is_anomaly ? 'Outlier' : 'Normal'}</TableCell>
                            <TableCell>{report.anomaly_score.toFixed(2)}</TableCell>
                            <TableCell>{report.total_findings}</TableCell>
                            <TableCell>{report.avg_cvss.toFixed(2)}</TableCell>
                            <TableCell>{report.primary_drivers?.[0] || 'Conforms to baseline'}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </DialogContent>
          </Dialog>
        </>
      )}

      {/* ═══════ TAB 1: DEDICATED TOPSIS PRIORITIZATION MODULE ═══════ */}
      {currentTab === 1 && (
        <VulnerabilityPrioritizationModule />
      )}

      {/* ═══════ TAB 2: DEDICATED ISOLATION FOREST ANOMALY MODULE ═══════ */}
      {currentTab === 2 && (
        <ReportAnomalyDetectionModule />
      )}

      {/* ═══════ TAB 3: VULNERABILITY CLUSTERING ═══════ */}
      {currentTab === 3 && (
        <VulnerabilityClusteringModule />
      )}

      {/* ═══════ TAB 4: REPORT CLUSTERING ═══════ */}
      {currentTab === 4 && (
        <ReportClusteringModule />
      )}

      {/* ═══════ TAB 5: CLUSTERING HISTORY ═══════ */}
      {currentTab === 5 && (
        <ClusteringHistoryModule onSelectRun={(run) => {
          if (run.clustering_type === 'VULNERABILITY') setCurrentTab(3);
          else setCurrentTab(4);
        }} />
      )}
    </Box>
  );
}
