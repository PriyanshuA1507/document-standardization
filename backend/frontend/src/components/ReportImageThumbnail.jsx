import React, { useEffect, useState } from 'react';
import { Box, Skeleton, Typography, IconButton, Dialog } from '@mui/material';
import { BrokenImage, ZoomIn, Close } from '@mui/icons-material';
import api from '../api/axios';

export default function ReportImageThumbnail({ reportId, imageId, tag, alt, width, height, sx = {} }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    let active = true;
    let url = null;

    const fetchImage = async () => {
      if (!reportId || !imageId) return;
      try {
        setLoading(true);
        setError(false);
        const res = await api.get(`/api/reports/${reportId}/images/${imageId}/download`, {
          responseType: 'blob',
        });
        if (active) {
          url = URL.createObjectURL(res.data);
          setBlobUrl(url);
        }
      } catch (err) {
        if (active) {
          setError(true);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchImage();

    return () => {
      active = false;
      if (url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [reportId, imageId]);

  if (loading) {
    return <Skeleton variant="rounded" width="100%" height={160} sx={{ borderRadius: 2 }} />;
  }

  if (error || !blobUrl) {
    return (
      <Box
        sx={{
          height: 160,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'rgba(255,255,255,0.02)',
          borderRadius: 2,
          border: '1px dashed rgba(255,255,255,0.1)',
          color: 'text.secondary',
          p: 2,
          ...sx,
        }}
      >
        <BrokenImage sx={{ fontSize: 32, opacity: 0.5, mb: 1 }} />
        <Typography variant="caption" color="text.secondary">
          Image preview unavailable
        </Typography>
      </Box>
    );
  }

  return (
    <>
      <Box
        onClick={() => setModalOpen(true)}
        sx={{
          position: 'relative',
          height: 160,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'rgba(0, 0, 0, 0.4)',
          borderRadius: 2,
          border: '1px solid rgba(255, 255, 255, 0.08)',
          overflow: 'hidden',
          cursor: 'pointer',
          transition: 'all 0.25s ease',
          '&:hover': {
            borderColor: '#00D4FF',
            boxShadow: '0 4px 20px rgba(0, 212, 255, 0.2)',
            '& .zoom-overlay': { opacity: 1 },
            '& img': { transform: 'scale(1.05)' },
          },
          ...sx,
        }}
      >
        <img
          src={blobUrl}
          alt={alt || tag || 'Report Figure'}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            transition: 'transform 0.25s ease',
          }}
        />
        <Box
          className="zoom-overlay"
          sx={{
            position: 'absolute',
            inset: 0,
            bgcolor: 'rgba(0, 0, 0, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0,
            transition: 'opacity 0.2s ease',
          }}
        >
          <ZoomIn sx={{ color: '#00D4FF', fontSize: 32 }} />
        </Box>
      </Box>

      {/* Lightbox Modal */}
      <Dialog
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        maxWidth="lg"
        PaperProps={{
          sx: {
            bgcolor: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(0, 212, 255, 0.2)',
            borderRadius: 3,
            p: 2,
          },
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ color: '#00D4FF' }}>
            {tag || 'Image Preview'} {width && height ? `(${width} × ${height} px)` : ''}
          </Typography>
          <IconButton onClick={() => setModalOpen(false)} sx={{ color: 'text.secondary' }}>
            <Close />
          </IconButton>
        </Box>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            maxHeight: '80vh',
            overflow: 'auto',
            p: 1,
            bgcolor: '#0a0f1d',
            borderRadius: 2,
          }}
        >
          <img
            src={blobUrl}
            alt={alt || tag}
            style={{ maxWidth: '100%', maxHeight: '75vh', objectFit: 'contain', borderRadius: 8 }}
          />
        </Box>
      </Dialog>
    </>
  );
}
