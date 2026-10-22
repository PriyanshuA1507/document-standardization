import React from 'react';
import { Box, Paper, Typography, LinearProgress, IconButton, Collapse, Button } from '@mui/material';
import { Close, Minimize, OpenInFull, CheckCircle, Visibility } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useBulkUpload } from '../contexts/BulkUploadContext';

const BulkProgressWidget = () => {
  const navigate = useNavigate();
  const {
    bulkProgress,
    bulkTotal,
    bulkRunning,
    bulkPaused,
    bulkFinished,
    isWidgetOpen,
    isWidgetMinimized,
    activeBatch,
    closeWidget,
    toggleMinimize,
  } = useBulkUpload();

  if (!isWidgetOpen) return null;

  const failedCount = activeBatch?.failed_files || 0;
  const completedCount = activeBatch?.completed_files || 0;

  return (
    <Paper
      elevation={8}
      sx={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        width: 360,
        zIndex: 9999,
        background: 'rgba(10, 14, 23, 0.95)',
        border: '1px solid rgba(0, 212, 255, 0.4)',
        borderRadius: 2.5,
        overflow: 'hidden',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 16px rgba(0, 212, 255, 0.15)',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1.2,
          background: 'rgba(0, 212, 255, 0.1)',
          borderBottom: '1px solid rgba(0, 212, 255, 0.2)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: bulkRunning ? '#00D4FF' : bulkPaused ? '#FFB300' : '#00E676',
              boxShadow: `0 0 8px ${bulkRunning ? '#00D4FF' : bulkPaused ? '#FFB300' : '#00E676'}`,
            }}
          />
          <Typography variant="subtitle2" fontWeight={600} color="#FFFFFF">
            {bulkRunning ? 'Batch Running' : bulkPaused ? 'Batch Paused' : bulkFinished ? 'Batch Completed' : 'Batch Processing'}
          </Typography>
        </Box>
        <Box>
          <IconButton size="small" onClick={toggleMinimize} sx={{ color: 'text.secondary' }}>
            {isWidgetMinimized ? <OpenInFull fontSize="small" /> : <Minimize fontSize="small" sx={{ mb: 1 }} />}
          </IconButton>
          {!bulkRunning && (
            <IconButton size="small" onClick={closeWidget} sx={{ color: 'text.secondary' }}>
              <Close fontSize="small" />
            </IconButton>
          )}
        </Box>
      </Box>

      {/* Body */}
      <Collapse in={!isWidgetMinimized}>
        <Box sx={{ p: 2 }}>
          {activeBatch?.name && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              {activeBatch.name}
            </Typography>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Processed {bulkProgress} of {bulkTotal} files
            </Typography>
            {bulkFinished && <CheckCircle color="success" fontSize="small" />}
          </Box>

          <LinearProgress
            variant="determinate"
            value={bulkTotal > 0 ? (bulkProgress / bulkTotal) * 100 : 0}
            sx={{
              height: 8,
              borderRadius: 4,
              mb: 1.5,
              backgroundColor: 'rgba(0, 212, 255, 0.1)',
              '& .MuiLinearProgress-bar': {
                background: failedCount > 0 && completedCount === 0
                  ? 'linear-gradient(90deg, #FF5252, #FF1744)'
                  : 'linear-gradient(90deg, #00D4FF, #00E676)',
              },
            }}
          />

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pt: 0.5 }}>
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Typography variant="caption" sx={{ color: '#00E676' }}>
                ✓ {completedCount}
              </Typography>
              {failedCount > 0 && (
                <Typography variant="caption" sx={{ color: '#FF5252' }}>
                  ✗ {failedCount}
                </Typography>
              )}
            </Box>
            <Button
              size="small"
              startIcon={<Visibility fontSize="small" />}
              onClick={() => navigate('/upload')}
              sx={{ color: '#00D4FF', textTransform: 'none', fontSize: '0.75rem', p: 0.5 }}
            >
              Monitor
            </Button>
          </Box>
        </Box>
      </Collapse>
    </Paper>
  );
};

export default BulkProgressWidget;
