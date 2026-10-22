import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  InputAdornment,
  IconButton,
  CircularProgress,
  Chip,
  Tooltip,
  useTheme,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Shield,
  Lock,
  Person,
  DarkMode,
  LightMode,
  GppGood,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useColorMode } from '../contexts/ThemeModeContext';

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

function LoginPage() {
  const theme = useTheme();
  const { mode, toggleColorMode } = useColorMode();
  const isLight = theme.palette.mode === 'light';

  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: '',
      password: '',
    },
  });

  // Redirect if already logged in
  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true });
  }, [user, navigate]);

  const onSubmit = async (data) => {
    setError('');
    setLoading(true);
    try {
      await login(data.username, data.password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.response?.data?.detail || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        bgcolor: isLight ? '#F1F5F9' : '#070B12',
        backgroundImage: isLight
          ? 'radial-gradient(ellipse at 50% 0%, rgba(2, 132, 199, 0.12) 0%, transparent 60%), radial-gradient(ellipse at 80% 80%, rgba(99, 102, 241, 0.08) 0%, transparent 50%), radial-gradient(ellipse at 20% 80%, rgba(13, 148, 136, 0.08) 0%, transparent 50%)'
          : 'radial-gradient(ellipse at 50% 0%, rgba(0, 212, 255, 0.14) 0%, transparent 60%), radial-gradient(ellipse at 80% 80%, rgba(124, 77, 255, 0.09) 0%, transparent 50%), radial-gradient(ellipse at 20% 80%, rgba(0, 230, 118, 0.08) 0%, transparent 50%)',
        position: 'relative',
        transition: 'background-color 0.3s ease',
        p: { xs: 2, sm: 3, md: 4 },
      }}
    >
      {/* ── Top Header Navigation Bar ── */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%',
          maxWidth: 1280,
          mx: 'auto',
          zIndex: 10,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              p: 1,
              borderRadius: 2,
              bgcolor: isLight ? 'rgba(2, 132, 199, 0.1)' : 'rgba(0, 212, 255, 0.12)',
              border: isLight ? '1px solid rgba(2, 132, 199, 0.2)' : '1px solid rgba(0, 212, 255, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Shield sx={{ fontSize: 24, color: isLight ? '#0284C7' : '#00D4FF' }} />
          </Box>
          <Box>
            <Typography variant="subtitle1" fontWeight={800} sx={{ color: isLight ? '#0F172A' : '#F8FAFC', lineHeight: 1.2 }}>
              CyberAudit
            </Typography>
            <Typography variant="caption" sx={{ color: isLight ? '#64748B' : '#94A3B8', fontWeight: 600 }}>
              Sovereign Report Standardization Portal
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {/* Operational Status Pill */}
          <Box
            sx={{
              display: { xs: 'none', sm: 'flex' },
              alignItems: 'center',
              gap: 1,
              px: 1.5,
              py: 0.6,
              borderRadius: 2,
              bgcolor: isLight ? '#FFFFFF' : 'rgba(13, 21, 39, 0.7)',
              border: isLight ? '1px solid rgba(15, 23, 42, 0.08)' : '1px solid rgba(255, 255, 255, 0.08)',
              boxShadow: isLight ? '0 2px 8px rgba(15, 23, 42, 0.04)' : 'none',
            }}
          >
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: '#00E676',
                boxShadow: '0 0 8px #00E676',
              }}
            />
            <Typography variant="caption" sx={{ color: isLight ? '#334155' : '#E2E8F0', fontWeight: 700 }}>
              Gate Active &bull; TLS 1.3
            </Typography>
          </Box>

          {/* Theme Toggle Button */}
          <Tooltip title={isLight ? 'Switch to Cyber Dark Mode' : 'Switch to Clean Light Mode'} arrow>
            <IconButton
              onClick={toggleColorMode}
              id="login-theme-toggle"
              aria-label="Toggle theme mode"
              sx={{
                p: 1.1,
                borderRadius: 2,
                bgcolor: isLight ? '#FFFFFF' : 'rgba(13, 21, 39, 0.8)',
                border: isLight ? '1px solid rgba(15, 23, 42, 0.1)' : '1px solid rgba(0, 212, 255, 0.25)',
                color: isLight ? '#0F172A' : '#00D4FF',
                boxShadow: isLight ? '0 2px 8px rgba(15, 23, 42, 0.05)' : '0 0 14px rgba(0, 212, 255, 0.2)',
                transition: 'all 0.25s ease',
                '&:hover': {
                  bgcolor: isLight ? '#F8FAFC' : 'rgba(0, 212, 255, 0.12)',
                  transform: 'scale(1.05)',
                },
              }}
            >
              {isLight ? <DarkMode sx={{ fontSize: 20 }} /> : <LightMode sx={{ fontSize: 20 }} />}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* ── Central Authentication Card ── */}
      <Box sx={{ my: 'auto', py: 4, display: 'flex', justifyContent: 'center', width: '100%', zIndex: 5 }}>
        <Paper
          elevation={0}
          className="fade-in-up"
          sx={{
            width: '100%',
            maxWidth: 440,
            p: { xs: 3.5, sm: 4.5 },
            borderRadius: 4,
            bgcolor: isLight ? '#FFFFFF' : 'rgba(13, 21, 39, 0.85)',
            backdropFilter: 'blur(30px)',
            border: isLight
              ? '1px solid rgba(15, 23, 42, 0.08)'
              : '1px solid rgba(0, 212, 255, 0.25)',
            boxShadow: isLight
              ? '0 24px 60px -12px rgba(15, 23, 42, 0.12), 0 0 1px 1px rgba(15, 23, 42, 0.05)'
              : '0 24px 70px -10px rgba(0, 0, 0, 0.8), 0 0 36px -4px rgba(0, 212, 255, 0.22)',
            transition: 'all 0.3s ease',
          }}
        >
          {/* Logo & Header */}
          <Box sx={{ textAlign: 'center', mb: 3.5 }}>
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 76,
                height: 76,
                borderRadius: '50%',
                background: isLight
                  ? 'radial-gradient(circle, rgba(2, 132, 199, 0.15) 0%, rgba(2, 132, 199, 0.04) 70%)'
                  : 'radial-gradient(circle, rgba(0, 212, 255, 0.2) 0%, rgba(0, 212, 255, 0.05) 70%)',
                border: isLight
                  ? '1px solid rgba(2, 132, 199, 0.25)'
                  : '1px solid rgba(0, 212, 255, 0.4)',
                boxShadow: isLight
                  ? '0 0 20px rgba(2, 132, 199, 0.15)'
                  : '0 0 28px rgba(0, 212, 255, 0.35)',
                mb: 2,
              }}
            >
              <Shield
                sx={{
                  fontSize: 40,
                  color: isLight ? '#0284C7' : '#00D4FF',
                  filter: isLight
                    ? 'drop-shadow(0 2px 6px rgba(2, 132, 199, 0.3))'
                    : 'drop-shadow(0 0 12px rgba(0, 212, 255, 0.6))',
                }}
              />
            </Box>

            <Typography
              variant="h4"
              sx={{
                fontWeight: 900,
                letterSpacing: '-0.02em',
                background: isLight
                  ? 'linear-gradient(135deg, #0284C7 0%, #059669 100%)'
                  : 'linear-gradient(135deg, #00D4FF 0%, #00E676 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                mb: 0.5,
              }}
            >
              CyberAudit
            </Typography>

            <Typography variant="body2" sx={{ color: isLight ? '#64748B' : '#94A3B8', fontWeight: 500, mb: 1.5 }}>
              National Document Standardization & Risk Intelligence Gate
            </Typography>

            {/* Compliance Pills */}
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Chip
                icon={<GppGood sx={{ fontSize: 13 }} />}
                label="MeitY Compliant"
                size="small"
                sx={{
                  height: 22,
                  bgcolor: isLight ? 'rgba(2, 132, 199, 0.08)' : 'rgba(0, 212, 255, 0.12)',
                  color: isLight ? '#0284C7' : '#00D4FF',
                  fontWeight: 700,
                  fontSize: '0.68rem',
                  border: isLight ? '1px solid rgba(2, 132, 199, 0.15)' : '1px solid rgba(0, 212, 255, 0.25)',
                }}
              />
              <Chip
                icon={<Lock sx={{ fontSize: 13 }} />}
                label="Zero-Trust Enforced"
                size="small"
                sx={{
                  height: 22,
                  bgcolor: isLight ? 'rgba(5, 150, 105, 0.08)' : 'rgba(0, 230, 118, 0.12)',
                  color: isLight ? '#059669' : '#00E676',
                  fontWeight: 700,
                  fontSize: '0.68rem',
                  border: isLight ? '1px solid rgba(5, 150, 105, 0.15)' : '1px solid rgba(0, 230, 118, 0.25)',
                }}
              />
            </Box>
          </Box>

          {error && (
            <Alert
              severity="error"
              sx={{
                mb: 3,
                borderRadius: 2.5,
                bgcolor: isLight ? 'rgba(239, 68, 68, 0.08)' : 'rgba(239, 68, 68, 0.15)',
                color: isLight ? '#B91C1C' : '#FCA5A5',
                border: isLight ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid rgba(239, 68, 68, 0.35)',
                fontWeight: 600,
              }}
            >
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            {/* Username Input */}
            <Box sx={{ mb: 2.5 }}>
              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  mb: 0.8,
                  fontWeight: 700,
                  color: isLight ? '#334155' : '#CBD5E1',
                  letterSpacing: 0.3,
                }}
              >
                Operator Identity (Username)
              </Typography>
              <TextField
                id="login-username"
                fullWidth
                placeholder="e.g. admin"
                autoFocus
                {...register('username')}
                error={!!errors.username}
                helperText={errors.username?.message}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    bgcolor: isLight ? '#F8FAFC' : 'rgba(11, 17, 32, 0.85)',
                    borderRadius: 2.5,
                    color: isLight ? '#0F172A' : '#F1F5F9',
                    border: isLight ? '1px solid rgba(15, 23, 42, 0.12)' : '1px solid rgba(0, 212, 255, 0.22)',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      borderColor: isLight ? 'rgba(2, 132, 199, 0.5)' : 'rgba(0, 212, 255, 0.55)',
                      bgcolor: isLight ? '#FFFFFF' : 'rgba(15, 23, 42, 0.95)',
                    },
                    '&.Mui-focused': {
                      borderColor: isLight ? '#0284C7' : '#00D4FF',
                      boxShadow: isLight
                        ? '0 0 0 3px rgba(2, 132, 199, 0.15)'
                        : '0 0 0 3px rgba(0, 212, 255, 0.25)',
                      bgcolor: isLight ? '#FFFFFF' : '#0D1527',
                    },
                    '& fieldset': { border: 'none' },
                  },
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Person sx={{ color: isLight ? '#0284C7' : '#00D4FF', fontSize: 20 }} />
                    </InputAdornment>
                  ),
                }}
              />
            </Box>

            {/* Password Input */}
            <Box sx={{ mb: 3.5 }}>
              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  mb: 0.8,
                  fontWeight: 700,
                  color: isLight ? '#334155' : '#CBD5E1',
                  letterSpacing: 0.3,
                }}
              >
                Passkey / Secret Key
              </Typography>
              <TextField
                id="login-password"
                fullWidth
                placeholder="••••••••"
                type={showPassword ? 'text' : 'password'}
                {...register('password')}
                error={!!errors.password}
                helperText={errors.password?.message}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    bgcolor: isLight ? '#F8FAFC' : 'rgba(11, 17, 32, 0.85)',
                    borderRadius: 2.5,
                    color: isLight ? '#0F172A' : '#F1F5F9',
                    border: isLight ? '1px solid rgba(15, 23, 42, 0.12)' : '1px solid rgba(0, 212, 255, 0.22)',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      borderColor: isLight ? 'rgba(2, 132, 199, 0.5)' : 'rgba(0, 212, 255, 0.55)',
                      bgcolor: isLight ? '#FFFFFF' : 'rgba(15, 23, 42, 0.95)',
                    },
                    '&.Mui-focused': {
                      borderColor: isLight ? '#0284C7' : '#00D4FF',
                      boxShadow: isLight
                        ? '0 0 0 3px rgba(2, 132, 199, 0.15)'
                        : '0 0 0 3px rgba(0, 212, 255, 0.25)',
                      bgcolor: isLight ? '#FFFFFF' : '#0D1527',
                    },
                    '& fieldset': { border: 'none' },
                  },
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Lock sx={{ color: isLight ? '#0284C7' : '#00D4FF', fontSize: 20 }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                        size="small"
                        sx={{ color: isLight ? '#64748B' : '#94A3B8' }}
                      >
                        {showPassword ? <VisibilityOff sx={{ fontSize: 20 }} /> : <Visibility sx={{ fontSize: 20 }} />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Box>

            {/* Submit Button */}
            <Button
              id="login-submit"
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={loading}
              sx={{
                py: 1.5,
                fontSize: '0.95rem',
                fontWeight: 800,
                letterSpacing: 0.8,
                textTransform: 'uppercase',
                borderRadius: 2.5,
                background: isLight
                  ? 'linear-gradient(135deg, #0284C7 0%, #0D9488 100%)'
                  : 'linear-gradient(135deg, #00D4FF 0%, #00E676 100%)',
                color: isLight ? '#FFFFFF' : '#070B12',
                boxShadow: isLight
                  ? '0 8px 24px -4px rgba(2, 132, 199, 0.4)'
                  : '0 8px 30px -4px rgba(0, 212, 255, 0.45)',
                transition: 'all 0.25s ease',
                '&:hover': {
                  background: isLight
                    ? 'linear-gradient(135deg, #0369A1 0%, #0F766E 100%)'
                    : 'linear-gradient(135deg, #38BDF8 0%, #34D399 100%)',
                  boxShadow: isLight
                    ? '0 12px 30px -4px rgba(2, 132, 199, 0.5)'
                    : '0 12px 36px -4px rgba(0, 212, 255, 0.65)',
                  transform: 'translateY(-1px)',
                },
              }}
            >
              {loading ? (
                <CircularProgress size={24} sx={{ color: isLight ? '#FFFFFF' : '#070B12' }} />
              ) : (
                'Authenticate & Enter Gate'
              )}
            </Button>
          </form>

          {/* Security Guarantee inside Card */}
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              textAlign: 'center',
              mt: 3,
              color: isLight ? '#64748B' : '#94A3B8',
              fontSize: '0.72rem',
              fontWeight: 500,
            }}
          >
            🔒 Protected by AES-256-GCM Cryptographic Gate &bull; Sovereign Vault
          </Typography>
        </Paper>
      </Box>

      {/* ── Bottom Page Footer ── */}
      <Box
        sx={{
          textAlign: 'center',
          width: '100%',
          maxWidth: 1280,
          mx: 'auto',
          zIndex: 10,
          py: 1,
        }}
      >
        <Typography
          variant="caption"
          sx={{
            color: isLight ? '#94A3B8' : 'rgba(148, 163, 184, 0.6)',
            fontSize: '0.73rem',
            fontWeight: 500,
          }}
        >
          National Cybersecurity & Document Standardization Framework &bull; ISO/IEC 27001 Certified &bull; v2.4.0-PROD
        </Typography>
      </Box>
    </Box>
  );
}

export default LoginPage;
