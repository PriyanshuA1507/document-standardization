import React from 'react';
import { Box, Typography, useTheme } from '@mui/material';

export default function CyberChartTooltip({ active, payload, label, unit = '', formatter }) {
  const theme = useTheme();
  const isLight = theme.palette.mode === 'light';

  if (!active || !payload || !payload.length) return null;

  return (
    <Box
      sx={{
        backgroundColor: isLight ? 'rgba(255, 255, 255, 0.98)' : 'rgba(11, 19, 43, 0.94)',
        backdropFilter: 'blur(16px)',
        border: isLight ? '1px solid rgba(2, 132, 199, 0.3)' : '1px solid rgba(0, 212, 255, 0.25)',
        borderRadius: 2,
        p: 1.5,
        boxShadow: isLight
          ? '0 12px 30px rgba(15, 23, 42, 0.15), 0 0 15px rgba(2, 132, 199, 0.08)'
          : '0 12px 30px rgba(0, 0, 0, 0.6), 0 0 15px rgba(0, 212, 255, 0.1)',
        minWidth: 140,
        pointerEvents: 'none',
      }}
    >
      {label && (
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            color: isLight ? '#475569' : '#94A3B8',
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            mb: 0.75,
            borderBottom: isLight ? '1px solid rgba(15, 23, 42, 0.08)' : '1px solid rgba(255, 255, 255, 0.08)',
            pb: 0.5,
          }}
        >
          {label}
        </Typography>
      )}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {payload.map((entry, index) => {
          const color = entry.color || entry.fill || (isLight ? '#0284C7' : '#00D4FF');
          const value = formatter ? formatter(entry.value, entry.name) : entry.value;

          return (
            <Box
              key={`item-${index}`}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 2,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: color,
                    boxShadow: `0 0 8px ${color}`,
                  }}
                />
                <Typography variant="body2" sx={{ color: isLight ? '#334155' : '#E2E8F0', fontSize: '0.8rem', fontWeight: 600 }}>
                  {entry.name || 'Value'}
                </Typography>
              </Box>
              <Typography
                variant="body2"
                sx={{
                  color: isLight ? '#0F172A' : '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {value} {unit}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
