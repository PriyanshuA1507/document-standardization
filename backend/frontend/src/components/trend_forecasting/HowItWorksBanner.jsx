import React, { useState } from 'react';
import {
  Box, Card, CardContent, Typography, Grid, Chip, IconButton, Collapse, Tooltip
} from '@mui/material';
import {
  UploadFile, Psychology, TrendingUp, HelpOutline, ExpandMore, ExpandLess,
  CheckCircle, ArrowForward, Shield, Speed, Layers
} from '@mui/icons-material';

export default function HowItWorksBanner() {
  const [expanded, setExpanded] = useState(true);

  return (
    <Card sx={{
      mb: 3,
      background: 'linear-gradient(135deg, rgba(10, 14, 23, 0.95) 0%, rgba(13, 27, 42, 0.92) 100%)',
      border: '1px solid rgba(0, 212, 255, 0.25)',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Decorative Top Accent Bar */}
      <Box sx={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: 'linear-gradient(90deg, #00D4FF 0%, #00E676 50%, #7C4DFF 100%)'
      }} />

      <CardContent sx={{ p: 2.5, pb: expanded ? 2.5 : 1.5, '&:last-child': { pb: expanded ? 2.5 : 1.5 } }}>
        {/* Banner Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: expanded ? 2 : 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <Box sx={{
              width: 36, height: 36, borderRadius: '50%',
              bgcolor: 'rgba(0, 212, 255, 0.15)', border: '1px solid rgba(0, 212, 255, 0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00D4FF'
            }}>
              <HelpOutline sx={{ fontSize: 20 }} />
            </Box>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#E2E8F0', letterSpacing: '-0.01em' }}>
                How This Trend Forecasting System Works
              </Typography>
              <Typography variant="caption" sx={{ color: '#94A3B8' }}>
                Simple 3-step breakdown: what data goes in, how the AI foundation model thinks, and what actionable predictions you receive.
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              label="Explain in 30 Seconds"
              size="small"
              sx={{ bgcolor: 'rgba(0, 230, 118, 0.12)', color: '#00E676', border: '1px solid rgba(0, 230, 118, 0.3)', fontWeight: 700, fontSize: '0.7rem' }}
            />
            <IconButton size="small" onClick={() => setExpanded(!expanded)} sx={{ color: '#94A3B8' }}>
              {expanded ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          </Box>
        </Box>

        {/* Collapsible 3-Step Pipeline */}
        <Collapse in={expanded} timeout="auto" unmountOnExit>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            {/* STEP 1: WHAT WE GIVE (INPUTS) */}
            <Grid item xs={12} md={4}>
              <Box sx={{
                p: 2, height: '100%', borderRadius: 2,
                background: 'rgba(0, 212, 255, 0.04)',
                border: '1px solid rgba(0, 212, 255, 0.2)',
                display: 'flex', flexDirection: 'column'
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <Box sx={{
                    px: 1, py: 0.2, borderRadius: 1,
                    bgcolor: 'rgba(0, 212, 255, 0.2)', color: '#00D4FF',
                    fontWeight: 800, fontSize: '0.75rem'
                  }}>
                    STEP 1
                  </Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#00D4FF', display: 'flex', alignItems: 'center', gap: 0.8 }}>
                    <UploadFile sx={{ fontSize: 18 }} /> What We Give (Inputs)
                  </Typography>
                </Box>

                <Typography variant="body2" sx={{ color: '#CBD5E1', fontSize: '0.82rem', mb: 1.5, lineHeight: 1.5 }}>
                  Raw audit evidence extracted from your uploaded CERT-In / MeitY audit reports:
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8, mt: 'auto' }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.8 }}>
                    <CheckCircle sx={{ color: '#00D4FF', fontSize: 15, mt: 0.3 }} />
                    <Typography variant="caption" sx={{ color: '#94A3B8' }}>
                      <strong>Audit Reports & Findings:</strong> Titles, CWEs, CVEs, and initial severity levels (Critical to Low).
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.8 }}>
                    <CheckCircle sx={{ color: '#00D4FF', fontSize: 15, mt: 0.3 }} />
                    <Typography variant="caption" sx={{ color: '#94A3B8' }}>
                      <strong>Verified Timelines:</strong> Assessment dates & observation timestamps mapped across continuous monthly periods.
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.8 }}>
                    <CheckCircle sx={{ color: '#00D4FF', fontSize: 15, mt: 0.3 }} />
                    <Typography variant="caption" sx={{ color: '#94A3B8' }}>
                      <strong>Retest Closures & Assets:</strong> Annexure III retest certificates proving patches + target server inventory counts.
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Grid>

            {/* STEP 2: HOW IT WORKS (AI ENGINE) */}
            <Grid item xs={12} md={4}>
              <Box sx={{
                p: 2, height: '100%', borderRadius: 2,
                background: 'rgba(124, 77, 255, 0.04)',
                border: '1px solid rgba(124, 77, 255, 0.25)',
                display: 'flex', flexDirection: 'column'
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <Box sx={{
                    px: 1, py: 0.2, borderRadius: 1,
                    bgcolor: 'rgba(124, 77, 255, 0.2)', color: '#B388FF',
                    fontWeight: 800, fontSize: '0.75rem'
                  }}>
                    STEP 2
                  </Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#B388FF', display: 'flex', alignItems: 'center', gap: 0.8 }}>
                    <Psychology sx={{ fontSize: 18 }} /> How It Works (AI Engine)
                  </Typography>
                </Box>

                <Typography variant="body2" sx={{ color: '#CBD5E1', fontSize: '0.82rem', mb: 1.5, lineHeight: 1.5 }}>
                  Tri-Model Foundation AI Ecosystem with Cross-Attention & Probabilistic Quantiles:
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8, mt: 'auto' }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.8 }}>
                    <CheckCircle sx={{ color: '#B388FF', fontSize: 15, mt: 0.3 }} />
                    <Typography variant="caption" sx={{ color: '#94A3B8' }}>
                      <strong>Tri-Model Architecture:</strong> Google TimesFM 3.0 (2D Grid Attention), Amazon Chronos-2 (Probabilistic Tokenizer), and Salesforce Moirai 2.0 (Decoder-Only Any-Variate).
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.8 }}>
                    <CheckCircle sx={{ color: '#B388FF', fontSize: 15, mt: 0.3 }} />
                    <Typography variant="caption" sx={{ color: '#94A3B8' }}>
                      <strong>Consensus Auto-Selection:</strong> Dynamic backtest competition that automatically identifies the most accurate model per vulnerability stream or produces an inverse-variance weighted blend.
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.8 }}>
                    <CheckCircle sx={{ color: '#B388FF', fontSize: 15, mt: 0.3 }} />
                    <Typography variant="caption" sx={{ color: '#94A3B8' }}>
                      <strong>Automated Backtesting:</strong> Rigorously validates predictions against historical audit quarters (WAPE, MASE, sharpness) before serving.
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Grid>

            {/* STEP 3: WHAT IT GIVES (OUTPUTS) */}
            <Grid item xs={12} md={4}>
              <Box sx={{
                p: 2, height: '100%', borderRadius: 2,
                background: 'rgba(0, 230, 118, 0.04)',
                border: '1px solid rgba(0, 230, 118, 0.25)',
                display: 'flex', flexDirection: 'column'
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <Box sx={{
                    px: 1, py: 0.2, borderRadius: 1,
                    bgcolor: 'rgba(0, 230, 118, 0.2)', color: '#00E676',
                    fontWeight: 800, fontSize: '0.75rem'
                  }}>
                    STEP 3
                  </Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#00E676', display: 'flex', alignItems: 'center', gap: 0.8 }}>
                    <TrendingUp sx={{ fontSize: 18 }} /> What It Gives (Outputs)
                  </Typography>
                </Box>

                <Typography variant="body2" sx={{ color: '#CBD5E1', fontSize: '0.82rem', mb: 1.5, lineHeight: 1.5 }}>
                  Concrete forecasts and risk metrics so management can plan security resources:
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8, mt: 'auto' }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.8 }}>
                    <CheckCircle sx={{ color: '#00E676', fontSize: 15, mt: 0.3 }} />
                    <Typography variant="caption" sx={{ color: '#94A3B8' }}>
                      <strong>Future Defect Forecasts:</strong> Expected finding volume for the next 3, 6, or 12 months with 80% & 95% safety confidence bands.
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.8 }}>
                    <CheckCircle sx={{ color: '#00E676', fontSize: 15, mt: 0.3 }} />
                    <Typography variant="caption" sx={{ color: '#94A3B8' }}>
                      <strong>Early Spike Warnings:</strong> Projects upcoming Critical and High flaw spikes before they hit production systems.
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.8 }}>
                    <CheckCircle sx={{ color: '#00E676', fontSize: 15, mt: 0.3 }} />
                    <Typography variant="caption" sx={{ color: '#94A3B8' }}>
                      <strong>Remediation Health:</strong> Compares closure velocity against incoming findings to prevent team overload.
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </Collapse>
      </CardContent>
    </Card>
  );
}
