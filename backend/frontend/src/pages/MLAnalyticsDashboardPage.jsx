import { useQuery } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import {
  Box, Backdrop, CircularProgress, Card, CardContent, Grid, Typography, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Chip, Skeleton, Tooltip, Alert,
  IconButton, Dialog, DialogTitle, DialogContent, Tabs, Tab
} from '@mui/material';
import {
  Assessment, ReportProblem, ErrorOutline,
  DragIndicator, OpenInFull, Close, BugReport, Description, History, Dashboard as DashboardIcon
} from '@mui/icons-material';
import api from '../api/axios';
import VulnerabilityClusteringModule from '../components/clustering/VulnerabilityClusteringModule';
import ReportClusteringModule from '../components/clustering/ReportClusteringModule';
import ClusteringHistoryModule from '../components/clustering/ClusteringHistoryModule';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function ChartCard({ title, icon, children, delay = 0, sx: sxProp = {}, onExpand, dragHandleProps = {} }) {
  return (
    <Card className="fade-in-up" sx={{ animationDelay: `${delay}ms`, minHeight: 380, height: '100%', display: 'flex', flexDirection: 'column', ...sxProp }}>
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
        {onExpand && (
          <IconButton size="small" onClick={onExpand} sx={{ color: 'text.secondary', '&:hover': { color: '#00D4FF', bgcolor: 'rgba(0,212,255,0.1)' } }}>
            <OpenInFull sx={{ fontSize: 18 }} />
          </IconButton>
        )}
      </CardContent>
      <Box sx={{ p: 2, flex: 1, position: 'relative', minHeight: 300, width: '100%' }}>
        <Box sx={{ position: 'absolute', top: 16, left: 16, right: 16, bottom: 16 }}>
          {children}
        </Box>
      </Box>
    </Card>
  );
}

function SortableWidget({ id, children, md }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    height: '100%', minHeight: 380, zIndex: transform ? 1 : 0,
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
        <Typography variant="h4" fontWeight={800} sx={{ mb: 4 , background: '-webkit-linear-gradient(45deg, #00D4FF, #00E676)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'}}>AI Risk Analytics</Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}><Skeleton variant="rounded" height={380} sx={{ borderRadius: 3 }} /></Grid>
          <Grid item xs={12} md={6}><Skeleton variant="rounded" height={380} sx={{ borderRadius: 3 }} /></Grid>
        </Grid>
      </Box>
    );
  }

  const renderWidget = (key) => {
    switch(key) {
    case 'prioritize':
      return (
        <ChartCard title="Prioritized Action Queue (TOPSIS)" icon={<ReportProblem />} delay={300} onExpand={() => setExpandedWidget('prioritize')}>
            <Box sx={{ flex: 1, overflowY: 'auto' }}>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Vulnerability</TableCell>
                      <TableCell>CVSS</TableCell>
                      <TableCell>Days Open</TableCell>
                      <TableCell>Priority Score</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {prioritize?.data?.length === 0 ? (
                      <TableRow><TableCell colSpan={4} align="center">No open tasks</TableCell></TableRow>
                    ) : (
                      prioritize?.data?.map((task) => (
                        <TableRow key={task.finding_id}>
                          <TableCell sx={{ maxWidth: 200 }}><Typography noWrap variant="body2">{task.title}</Typography></TableCell>
                          <TableCell>{task.cvss}</TableCell>
                          <TableCell>{task.days_open}</TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Box sx={{ width: '100%', height: 6, bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 3 }}>
                                <Box sx={{ width: `${task.priority_score}%`, height: '100%', bgcolor: task.priority_score > 70 ? '#FF1744' : task.priority_score > 40 ? '#FF9100' : '#00E676', borderRadius: 3 }} />
                              </Box>
                              <Typography variant="caption">{task.priority_score}</Typography>
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          </ChartCard>
      );
    case 'anomalies':
      return (
        <ChartCard title="Anomalous Agencies (Isolation Forest)" icon={<ErrorOutline />} delay={400} onExpand={() => setExpandedWidget('anomalies')}>
            {anomalies?.status === 'insufficient_data' ? (
              <Alert severity="info">{anomalies.message}</Alert>
            ) : (
              <Box sx={{ flex: 1, overflowY: 'auto' }}>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Agency</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Score</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {anomalies?.data?.map((agency) => (
                        <TableRow key={agency.agency_id}>
                          <TableCell><Typography noWrap variant="body2">{agency.agency_name}</Typography></TableCell>
                          <TableCell>
                            {agency.is_anomaly ? (
                              <Chip size="small" label="Outlier" color="error" />
                            ) : (
                              <Chip size="small" label="Normal" color="success" />
                            )}
                          </TableCell>
                          <TableCell>{agency.anomaly_score.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}
          </ChartCard>
      );

      default: return null;
    }
  };

  return (
    <Box>
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Assessment sx={{ fontSize: 40, color: '#00D4FF' }} />
        <Box>
          <Typography variant="h4" fontWeight={800}>AI Risk Analytics (Air-Gapped)</Typography>
          <Typography variant="body2" color="text.secondary">
            Mathematical Forecasting, Clustering, and Task Prioritization without external models
          </Typography>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {/* ═══════ CLUSTERING & ANALYTICS TABS ═══════ */}
      <Box sx={{ borderBottom: 1, borderColor: 'rgba(255, 255, 255, 0.08)', mb: 3 }}>
        <Tabs
          value={currentTab}
          onChange={(e, val) => setCurrentTab(val)}
          sx={{
            '& .MuiTabs-indicator': { backgroundColor: '#00D4FF', height: 3 },
            '& .MuiTab-root': {
              color: 'text.secondary',
              fontWeight: 700,
              fontSize: '0.9rem',
              textTransform: 'none',
              minHeight: 48,
              '&.Mui-selected': { color: '#00D4FF' },
              '&:hover': { color: '#E2E8F0' },
            },
          }}
        >
          <Tab icon={<DashboardIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Risk Overview & Analytics" />
          <Tab icon={<BugReport sx={{ fontSize: 18 }} />} iconPosition="start" label="Vulnerability Clustering" />
          <Tab icon={<Description sx={{ fontSize: 18 }} />} iconPosition="start" label="Report Clustering" />
          <Tab icon={<History sx={{ fontSize: 18 }} />} iconPosition="start" label="Clustering History" />
        </Tabs>
      </Box>

      {currentTab === 0 && (
        <>
          {/* ═══════ DRAGGABLE WIDGETS ═══════ */}
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
                    <TableCell>CVSS</TableCell>
                    <TableCell>Days Open</TableCell>
                    <TableCell>Priority Score</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {prioritize?.data?.map((task) => (
                    <TableRow key={task.finding_id}>
                      <TableCell>{task.title}</TableCell>
                      <TableCell>{task.cvss}</TableCell>
                      <TableCell>{task.days_open}</TableCell>
                      <TableCell>{task.priority_score}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          {expandedWidget === 'anomalies' && (
            <TableContainer sx={{ height: '100%' }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Agency</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Score</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {anomalies?.data?.map((agency) => (
                    <TableRow key={agency.agency_id}>
                      <TableCell>{agency.agency_name}</TableCell>
                      <TableCell>{agency.is_anomaly ? 'Outlier' : 'Normal'}</TableCell>
                      <TableCell>{agency.anomaly_score.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
      </Dialog>
        </>
      )}

      {currentTab === 1 && (
        <VulnerabilityClusteringModule />
      )}

      {currentTab === 2 && (
        <ReportClusteringModule />
      )}

      {currentTab === 3 && (
        <ClusteringHistoryModule onSelectRun={(run) => {
          if (run.clustering_type === 'VULNERABILITY') setCurrentTab(1);
          else setCurrentTab(2);
        }} />
      )}
    </Box>
  );
}
