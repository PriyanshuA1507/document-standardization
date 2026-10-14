import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  Button,
  Skeleton,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
} from '@mui/material';
import {
  ArrowBack,
  Download,
  Description,
  Fingerprint,
  Person,
  CalendarToday,
  Storage,
  CheckCircle,
  Info,
  Error as ErrorIcon,
  Image as ImageIcon,
  Layers,
  Collections,
  Close,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import api from '../api/axios';
import ReportImageThumbnail from '../components/ReportImageThumbnail';

const statusColor = {
  UPLOADED: 'info',
  VALIDATED: 'success',
  REJECTED: 'error',
  QUARANTINED: 'warning',
};

function InfoRow({ icon, label, value }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, py: 1.5 }}>
      {React.cloneElement(icon, { sx: { color: 'text.secondary', fontSize: 20, mt: 0.3 } })}
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
          {label}
        </Typography>
        <Typography variant="body2" fontWeight={500} sx={{ wordBreak: 'break-all' }}>
          {value || '—'}
        </Typography>
      </Box>
    </Box>
  );
}

function ReportDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const [report, setReport] = useState(null);
  const [assessments, setAssessments] = useState([]);
  const [imagesData, setImagesData] = useState({ total: 0, figure_count: 0, layout_count: 0, images: [] });
  const [loading, setLoading] = useState(true);
  const [figuresDialogOpen, setFiguresDialogOpen] = useState(false);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const [response, mlResponse, imgResponse] = await Promise.allSettled([
          api.get(`/api/reports/${id}`),
          api.get(`/api/ml/severity-assessment?report_id=${id}`),
          api.get(`/api/reports/${id}/images`),
        ]);

        if (response.status === 'fulfilled') {
          setReport(response.value.data);
        }
        if (mlResponse.status === 'fulfilled') {
          setAssessments(mlResponse.value.data.data);
        }
        if (imgResponse.status === 'fulfilled') {
          setImagesData(imgResponse.value.data);
        }
      } catch {
        enqueueSnackbar('Failed to load report', { variant: 'error' });
        navigate('/reports');
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [id, navigate, enqueueSnackbar]);

  const handleDownload = async () => {
    try {
      const response = await api.get(`/api/reports/${id}/download`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', report.original_filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      enqueueSnackbar('Download failed', { variant: 'error' });
    }
  };

  const handleDownloadImage = async (img) => {
    try {
      const res = await api.get(`/api/reports/${id}/images/${img.image_id}/download`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      const cleanTag = (img.tag || '').replace(/[\[\]]/g, '') || img.sha256.substring(0, 8);
      link.setAttribute('download', `${cleanTag}.${img.format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      enqueueSnackbar('Failed to download image', { variant: 'error' });
    }
  };

  if (loading) {
    return (
      <Box>
        <Skeleton variant="rounded" height={400} sx={{ borderRadius: 3 }} />
      </Box>
    );
  }

  if (!report) return null;

  const figuresList = (imagesData.images || []).filter((img) => img.is_figure);

  return (
    <Box>
      <Button
        startIcon={<ArrowBack />}
        onClick={() => navigate('/reports')}
        sx={{ mb: 3, color: 'text.secondary' }}
      >
        Back to Reports
      </Button>

      {/* Partial Duplicate Warning */}
      {report.partial_duplicate && (
        <Alert
          severity="warning"
          icon={<ErrorIcon />}
          sx={{ mb: 3, borderRadius: 2, alignItems: 'center' }}
          action={
            <Button
              component={Link}
              to={`/reports/${report.partial_duplicate.original_report_id}`}
              color="warning"
              size="small"
              variant="outlined"
            >
              View Original
            </Button>
          }
        >
          <Typography variant="body2" fontWeight={600}>
            Partial Duplicate Detected
          </Typography>
          <Typography variant="body2">
            This file has been flagged as a partial duplicate of an existing report
            {report.partial_duplicate.original_filename ? ` (${report.partial_duplicate.original_filename})` : ''}.
          </Typography>
        </Alert>
      )}

      {/* Header Bar */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Description sx={{ fontSize: 40, color: '#00D4FF' }} />
          <Box>
            <Typography variant="h5" fontWeight={700}>
              {report.original_filename}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
              <Chip
                label={report.upload_status}
                color={statusColor[report.upload_status] || 'default'}
                size="small"
                sx={{ fontWeight: 600 }}
              />
              <Chip
                label={report.file_extension.toUpperCase()}
                variant="outlined"
                size="small"
              />
            </Box>
          </Box>
        </Box>
        <Button
          variant="contained"
          startIcon={<Download />}
          onClick={handleDownload}
        >
          Download
        </Button>
      </Box>

      {/* ── Extracted Images & Layout Assets Card (Clean Minimal Summary) ── */}
      {imagesData.total > 0 && (
        <Card
          className="fade-in-up"
          sx={{
            mb: 3,
            borderRadius: 3,
            border: '1px solid rgba(0, 212, 255, 0.2)',
            background: 'linear-gradient(145deg, rgba(17, 25, 40, 0.95) 0%, rgba(12, 17, 29, 0.98) 100%)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          }}
        >
          <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: { xs: 'flex-start', sm: 'center' },
                flexWrap: 'wrap',
                gap: 2,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box
                  sx={{
                    p: 1.2,
                    borderRadius: 2,
                    bgcolor: 'rgba(0, 212, 255, 0.12)',
                    color: '#00D4FF',
                    display: 'flex',
                  }}
                >
                  <Collections sx={{ fontSize: 26 }} />
                </Box>
                <Box>
                  <Typography variant="h6" fontWeight={700}>
                    Extracted Images & Layout Assets
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    High-resolution visual assets stored in SeaweedFS Distributed Storage (<code>images/{id}/</code>)
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
                <Chip
                  icon={<ImageIcon sx={{ fontSize: 16 }} />}
                  label={`${imagesData.figure_count || 0} Figures`}
                  onClick={figuresList.length > 0 ? () => setFiguresDialogOpen(true) : undefined}
                  sx={{
                    bgcolor: 'rgba(0, 212, 255, 0.15)',
                    color: '#00D4FF',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    border: '1px solid rgba(0, 212, 255, 0.3)',
                    px: 0.5,
                    cursor: figuresList.length > 0 ? 'pointer' : 'default',
                    '&:hover': figuresList.length > 0 ? { bgcolor: 'rgba(0, 212, 255, 0.25)' } : {},
                  }}
                />
                <Chip
                  icon={<Layers sx={{ fontSize: 16 }} />}
                  label={`${imagesData.layout_count || 0} Layout Elements`}
                  sx={{
                    bgcolor: 'rgba(171, 71, 188, 0.15)',
                    color: '#CE93D8',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    border: '1px solid rgba(171, 71, 188, 0.3)',
                    px: 0.5,
                  }}
                />
                <Chip
                  icon={<Storage sx={{ fontSize: 16 }} />}
                  label={`${imagesData.total || 0} Total in SeaweedFS`}
                  sx={{
                    bgcolor: 'rgba(0, 230, 118, 0.15)',
                    color: '#00E676',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    border: '1px solid rgba(0, 230, 118, 0.3)',
                    px: 0.5,
                  }}
                />
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Grid: File Info & Metadata */}
      <Grid container spacing={3}>
        {/* File Info */}
        <Grid item xs={12} md={6}>
          <Card className="fade-in-up">
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
                File Information
              </Typography>
              <InfoRow icon={<Description />} label="Filename" value={report.original_filename} />
              <InfoRow icon={<Storage />} label="File Size" value={`${(report.file_size / 1024).toFixed(1)} KB`} />
              <InfoRow icon={<Info />} label="MIME Type" value={report.mime_type} />
              <InfoRow icon={<Fingerprint />} label="SHA256 Hash" value={report.sha256_hash} />
              {report.simhash && (
                <InfoRow icon={<Fingerprint />} label="SimHash Signature" value={report.simhash} />
              )}
              {report.page_count && (
                <InfoRow icon={<Description />} label="Page Count" value={report.page_count} />
              )}
              <InfoRow icon={<Person />} label="Uploaded By" value={report.uploader_username} />
              <InfoRow icon={<CalendarToday />} label="Upload Date" value={new Date(report.created_at).toLocaleString()} />
            </CardContent>
          </Card>
        </Grid>

        {/* Metadata */}
        <Grid item xs={12} md={6}>
          <Card className="fade-in-up" sx={{ animationDelay: '100ms' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
                Document Metadata
              </Typography>
              {report.metadata ? (
                <>
                  <InfoRow icon={<Info />} label="Title" value={report.metadata.title} />
                  <InfoRow icon={<Person />} label="Author" value={report.metadata.author} />
                  <InfoRow icon={<Info />} label="Producer" value={report.metadata.producer} />
                  <InfoRow icon={<Info />} label="Subject" value={report.metadata.subject} />
                  <InfoRow icon={<Info />} label="Keywords" value={report.metadata.keywords} />
                  {report.metadata.creation_date && (
                    <InfoRow
                      icon={<CalendarToday />}
                      label="Document Created"
                      value={new Date(report.metadata.creation_date).toLocaleString()}
                    />
                  )}
                </>
              ) : (
                <Typography color="text.secondary">No metadata available</Typography>
              )}
            </CardContent>
          </Card>

          {/* Validation */}
          {report.validation && (
            <Card className="fade-in-up" sx={{ animationDelay: '200ms', mt: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
                  Validation Results
                </Typography>
                <InfoRow
                  icon={<CheckCircle />}
                  label="File Type Valid"
                  value={report.validation.file_type_valid ? 'Yes' : 'No'}
                />
                <InfoRow
                  icon={<Info />}
                  label="Malware Scan"
                  value={report.validation.malware_scan_status}
                />
                <InfoRow
                  icon={<Info />}
                  label="Duplicate Status"
                  value={report.validation.duplicate_status}
                />
                {report.partial_duplicate && (
                  <InfoRow
                    icon={<Info />}
                    label="Original File Link"
                    value={
                      <Link to={`/reports/${report.partial_duplicate.original_report_id}`} style={{ color: '#00D4FF', textDecoration: 'none' }}>
                        {report.partial_duplicate.original_filename || 'View Original File'}
                      </Link>
                    }
                  />
                )}
                <InfoRow
                  icon={<CheckCircle />}
                  label="Validation Status"
                  value={report.validation.validation_status}
                />
                {report.validation.validation_notes && (
                  <InfoRow
                    icon={<Info />}
                    label="Notes"
                    value={report.validation.validation_notes}
                  />
                )}
                {report.storage && report.storage.encryption_algorithm && (
                  <InfoRow
                    icon={<CheckCircle />}
                    label="Storage Encryption"
                    value={`Encrypted (${report.storage.encryption_algorithm})`}
                  />
                )}
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>

      {/* AI Vulnerability Assessment */}
      {assessments && assessments.length > 0 && (
        <Card className="fade-in-up" sx={{ mt: 3, animationDelay: '300ms' }}>
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
              <CheckCircle sx={{ color: '#00E676' }} />
              <Typography variant="h6" fontWeight={700}>
                AI Severity Assessment (Expert System)
              </Typography>
            </Box>
            <Box sx={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <th style={{ padding: '12px' }}>Vulnerability Title</th>
                    <th style={{ padding: '12px' }}>CVSS Score</th>
                    <th style={{ padding: '12px' }}>Assigned Severity</th>
                    <th style={{ padding: '12px' }}>AI Suggested</th>
                    <th style={{ padding: '12px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {assessments.map((vuln) => (
                    <tr key={vuln.finding_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '12px' }}>
                        <Typography variant="body2">{vuln.title}</Typography>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <Typography variant="body2">{vuln.cvss_score}</Typography>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <Chip size="small" label={vuln.current_severity} variant="outlined" />
                      </td>
                      <td style={{ padding: '12px' }}>
                        <Chip
                          size="small"
                          label={vuln.suggested_severity}
                          color={
                            vuln.suggested_severity === 'CRITICAL' ? 'error' :
                            vuln.suggested_severity === 'HIGH' ? 'warning' :
                            vuln.suggested_severity === 'MEDIUM' ? 'info' : 'success'
                          }
                        />
                      </td>
                      <td style={{ padding: '12px' }}>
                        {vuln.match ? (
                          <Chip size="small" label="Match" color="success" />
                        ) : (
                          <Chip size="small" label="Mismatch" color="error" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Figures Preview Lightbox Dialog (Optional, on clicking figures chip) */}
      <Dialog
        open={figuresDialogOpen}
        onClose={() => setFiguresDialogOpen(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            bgcolor: 'rgba(15, 23, 42, 0.98)',
            border: '1px solid rgba(0, 212, 255, 0.2)',
            backdropFilter: 'blur(20px)',
            p: 1,
          },
        }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <ImageIcon sx={{ color: '#00D4FF' }} />
            <Typography variant="h6" fontWeight={700}>
              Extracted Figures ({figuresList.length})
            </Typography>
          </Box>
          <IconButton onClick={() => setFiguresDialogOpen(false)} sx={{ color: 'text.secondary' }}>
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Grid container spacing={2}>
            {figuresList.map((img) => (
              <Grid item xs={12} sm={6} md={4} key={img.image_id}>
                <Card sx={{ bgcolor: 'rgba(0, 0, 0, 0.4)', borderRadius: 2, border: '1px solid rgba(255, 255, 255, 0.08)', p: 1.5 }}>
                  <ReportImageThumbnail
                    reportId={id}
                    imageId={img.image_id}
                    tag={img.tag}
                    width={img.width}
                    height={img.height}
                  />
                  <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Chip label={img.tag || `Fig #${img.figure}`} size="small" sx={{ bgcolor: 'rgba(0, 212, 255, 0.1)', color: '#00D4FF', fontWeight: 700, fontSize: '0.72rem' }} />
                    <Chip label={`Page ${img.page}`} size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />
                  </Box>
                  <Box sx={{ mt: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="caption" color="text.secondary">
                      {img.width} × {img.height} px
                    </Typography>
                    <Button
                      size="small"
                      startIcon={<Download sx={{ fontSize: 14 }} />}
                      onClick={() => handleDownloadImage(img)}
                      sx={{ color: '#00D4FF', fontSize: '0.72rem', textTransform: 'none' }}
                    >
                      Download
                    </Button>
                  </Box>
                </Card>
              </Grid>
            ))}
          </Grid>
        </DialogContent>
      </Dialog>
    </Box>
  );
}

export default ReportDetailPage;
