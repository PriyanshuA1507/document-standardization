import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AppBar,
  Box,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  useMediaQuery,
  useTheme,
  Tooltip,
  InputBase,
  Chip,
  Button,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard,
  CloudUpload,
  Description,
  People,
  Security,
  Person,
  Logout,
  Shield,
  Business,
  Analytics,
  Assessment,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Search,
  NotificationsNone,
  FiberManualRecord,
  KeyboardArrowRight,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import Footer from './Footer';

const EXPANDED_WIDTH = 250;
const COLLAPSED_WIDTH = 72;

const navItems = [
  { text: 'Dashboard', icon: <Dashboard />, path: '/dashboard' },
  { text: 'Analytics', icon: <Analytics />, path: '/analytics' },
  { text: 'Trend Analysis & Forecasting', icon: <TrendingUp />, path: '/trend-forecasting' },
  { text: 'AI Risk Analytics', icon: <Assessment />, path: '/ml-analytics' },
  { text: 'Upload Report', icon: <CloudUpload />, path: '/upload' },
  { text: 'Reports', icon: <Description />, path: '/reports' },
  { text: 'User Management', icon: <People />, path: '/users', adminOnly: true },
  { text: 'Agency Management', icon: <Business />, path: '/agencies', adminOnly: true },
  { text: 'Audit Logs', icon: <Security />, path: '/audit-logs', adminOnly: true },
  { text: 'Profile', icon: <Person />, path: '/profile' },
];

function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('cyber_sidebar_collapsed') === 'true';
  });
  const [anchorEl, setAnchorEl] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const drawerWidth = isMobile ? EXPANDED_WIDTH : collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;

  useEffect(() => {
    localStorage.setItem('cyber_sidebar_collapsed', collapsed ? 'true' : 'false');
  }, [collapsed]);

  const handleDrawerToggle = () => setMobileOpen(!mobileOpen);
  const handleMenuOpen = (e) => setAnchorEl(e.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);

  const handleLogout = async () => {
    handleMenuClose();
    await logout();
    navigate('/login');
  };

  const handleSearchSubmit = (e) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      navigate(`/reports?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const filteredNav = navItems.filter((item) => !item.adminOnly || isAdmin());
  const activeNavItem = navItems.find((n) => n.path === location.pathname);

  const drawerContent = (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: '#080E1A',
        transition: 'width 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        overflowX: 'hidden',
      }}
    >
      {/* Brand Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed && !isMobile ? 'center' : 'flex-start',
          gap: 1.5,
          px: collapsed && !isMobile ? 1.5 : 2.5,
          py: 2.2,
          minHeight: 64,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <Shield
          sx={{
            fontSize: 32,
            color: '#00D4FF',
            filter: 'drop-shadow(0 0 10px rgba(0,212,255,0.45))',
            flexShrink: 0,
          }}
        />
        {(!collapsed || isMobile) && (
          <Box sx={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 800,
                background: 'linear-gradient(135deg, #00D4FF 0%, #00E676 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                fontSize: '1.05rem',
                lineHeight: 1.2,
                letterSpacing: '-0.02em',
              }}
            >
              CyberAudit
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: '#64748B', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.05em' }}
            >
              SECURITY INTELLIGENCE
            </Typography>
          </Box>
        )}
      </Box>

      {/* Nav List */}
      <List sx={{ flex: 1, px: 1, py: 1.5 }}>
        {filteredNav.map((item) => {
          const isActive = location.pathname === item.path;

          const button = (
            <ListItemButton
              onClick={() => {
                navigate(item.path);
                if (isMobile) setMobileOpen(false);
              }}
              sx={{
                borderRadius: 2,
                py: 1.1,
                px: collapsed && !isMobile ? 1.5 : 1.75,
                justifyContent: collapsed && !isMobile ? 'center' : 'flex-start',
                mb: 0.5,
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                backgroundColor: isActive ? 'rgba(0, 212, 255, 0.1)' : 'transparent',
                border: isActive ? '1px solid rgba(0, 212, 255, 0.25)' : '1px solid transparent',
                position: 'relative',
                overflow: 'hidden',
                '&:hover': {
                  backgroundColor: isActive ? 'rgba(0, 212, 255, 0.14)' : 'rgba(255, 255, 255, 0.04)',
                  borderColor: isActive ? 'rgba(0, 212, 255, 0.4)' : 'rgba(255, 255, 255, 0.08)',
                  transform: 'translateX(2px)',
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: collapsed && !isMobile ? 0 : 36,
                  color: isActive ? '#00D4FF' : '#94A3B8',
                  transition: 'all 0.2s ease',
                  transform: isActive ? 'scale(1.05)' : 'scale(1)',
                  filter: isActive ? 'drop-shadow(0 0 6px rgba(0,212,255,0.4))' : 'none',
                }}
              >
                {item.icon}
              </ListItemIcon>
              {(!collapsed || isMobile) && (
                <ListItemText
                  primary={item.text}
                  primaryTypographyProps={{
                    fontWeight: isActive ? 600 : 450,
                    fontSize: '0.85rem',
                    color: isActive ? '#F1F5F9' : '#94A3B8',
                    noWrap: true,
                  }}
                />
              )}
            </ListItemButton>
          );

          return (
            <ListItem key={item.text} disablePadding sx={{ mb: 0.25 }}>
              {collapsed && !isMobile ? (
                <Tooltip title={item.text} placement="right" arrow>
                  {button}
                </Tooltip>
              ) : (
                button
              )}
            </ListItem>
          );
        })}
      </List>

      {/* Collapse Toggle (Desktop only) */}
      {!isMobile && (
        <Box
          sx={{
            px: 1.5,
            py: 1,
            borderTop: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-end',
          }}
        >
          <Tooltip title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} placement="right" arrow>
            <IconButton
              size="small"
              onClick={() => setCollapsed(!collapsed)}
              sx={{
                color: '#94A3B8',
                borderRadius: 1.5,
                p: 0.75,
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                '&:hover': {
                  color: '#00D4FF',
                  backgroundColor: 'rgba(0, 212, 255, 0.1)',
                },
              }}
            >
              {collapsed ? <ChevronRight fontSize="small" /> : <ChevronLeft fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Box>
      )}

      {/* User profile capsule at footer */}
      <Box
        sx={{
          p: collapsed && !isMobile ? 1 : 1.5,
          borderTop: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed && !isMobile ? 'center' : 'flex-start',
          gap: 1.5,
          backgroundColor: 'rgba(7, 11, 18, 0.5)',
        }}
      >
        <Avatar
          sx={{
            width: 34,
            height: 34,
            background: 'linear-gradient(135deg, #00D4FF 0%, #7C4DFF 100%)',
            fontSize: '0.85rem',
            fontWeight: 700,
            color: '#070B12',
            boxShadow: '0 0 10px rgba(0, 212, 255, 0.25)',
          }}
        >
          {user?.username?.charAt(0).toUpperCase() || 'A'}
        </Avatar>
        {(!collapsed || isMobile) && (
          <Box sx={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
            <Typography variant="body2" fontWeight={600} noWrap sx={{ fontSize: '0.8rem', color: '#F1F5F9' }}>
              {user?.full_name || user?.username}
            </Typography>
            <Typography variant="caption" noWrap sx={{ fontSize: '0.68rem', color: '#64748B' }}>
              {user?.roles?.join(', ') || 'User'}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', height: '100vh', backgroundColor: '#070B12' }}>
      {/* Top Application Bar (HUD) */}
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          backgroundColor: 'rgba(8, 14, 26, 0.88)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          boxShadow: 'none',
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between', minHeight: 64, px: { xs: 2, sm: 3 } }}>
          {/* Left: Mobile hamburger & Breadcrumbs */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            {isMobile && (
              <IconButton color="inherit" onClick={handleDrawerToggle} edge="start" sx={{ mr: 0.5 }}>
                <MenuIcon />
              </IconButton>
            )}

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Typography variant="body2" sx={{ color: '#64748B', fontWeight: 500, fontSize: '0.8rem' }}>
                CyberAudit
              </Typography>
              <KeyboardArrowRight sx={{ fontSize: 16, color: '#475569' }} />
              <Typography variant="body2" sx={{ color: '#E2E8F0', fontWeight: 600, fontSize: '0.875rem' }}>
                {activeNavItem?.text || 'Dashboard'}
              </Typography>
            </Box>
          </Box>

          {/* Center: Quick Search Bar */}
          <Box
            sx={{
              display: { xs: 'none', md: 'flex' },
              alignItems: 'center',
              backgroundColor: 'rgba(13, 21, 39, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 2,
              px: 1.5,
              py: 0.4,
              width: { md: 280, lg: 380 },
              transition: 'all 0.2s ease',
              '&:focus-within': {
                borderColor: '#00D4FF',
                boxShadow: '0 0 12px rgba(0, 212, 255, 0.15)',
                backgroundColor: 'rgba(13, 21, 39, 0.9)',
              },
            }}
          >
            <Search sx={{ color: '#64748B', fontSize: 18, mr: 1 }} />
            <InputBase
              placeholder="Search reports, vulnerabilities, agencies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchSubmit}
              sx={{
                color: '#F1F5F9',
                fontSize: '0.8rem',
                width: '100%',
                '& input::placeholder': { color: '#64748B', opacity: 1 },
              }}
            />
          </Box>

          {/* Right: Status Pill & Actions */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            {/* Live Status indicator */}
            <Chip
              icon={<Box className="live-pulse-dot" sx={{ ml: 1 }} />}
              label="System Operational"
              size="small"
              sx={{
                display: { xs: 'none', sm: 'inline-flex' },
                backgroundColor: 'rgba(0, 230, 118, 0.08)',
                color: '#00E676',
                border: '1px solid rgba(0, 230, 118, 0.25)',
                fontSize: '0.725rem',
                fontWeight: 600,
                height: 26,
              }}
            />

            {/* Quick Upload action */}
            <Button
              variant="outlined"
              size="small"
              startIcon={<CloudUpload sx={{ fontSize: 16 }} />}
              onClick={() => navigate('/upload')}
              sx={{
                display: { xs: 'none', lg: 'inline-flex' },
                borderColor: 'rgba(0, 212, 255, 0.35)',
                color: '#00D4FF',
                borderRadius: 1.75,
                py: 0.5,
                px: 1.5,
                fontSize: '0.75rem',
                '&:hover': {
                  borderColor: '#00D4FF',
                  backgroundColor: 'rgba(0, 212, 255, 0.08)',
                },
              }}
            >
              Upload
            </Button>

            {/* Profile Menu */}
            <IconButton onClick={handleMenuOpen} sx={{ p: 0.5 }}>
              <Avatar
                sx={{
                  width: 34,
                  height: 34,
                  background: 'linear-gradient(135deg, #00D4FF 0%, #7C4DFF 100%)',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: '#070B12',
                  boxShadow: '0 0 10px rgba(0, 212, 255, 0.3)',
                }}
              >
                {user?.username?.charAt(0).toUpperCase() || 'A'}
              </Avatar>
            </IconButton>

            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleMenuClose}
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
              PaperProps={{
                sx: {
                  mt: 1,
                  minWidth: 190,
                  backgroundColor: 'rgba(13, 21, 39, 0.95)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  boxShadow: '0 12px 36px rgba(0, 0, 0, 0.6)',
                },
              }}
            >
              <MenuItem
                onClick={() => {
                  handleMenuClose();
                  navigate('/profile');
                }}
                sx={{ py: 1, fontSize: '0.85rem' }}
              >
                <ListItemIcon>
                  <Person fontSize="small" sx={{ color: '#00D4FF' }} />
                </ListItemIcon>
                Profile Settings
              </MenuItem>
              <Divider sx={{ my: 0.5, borderColor: 'rgba(255, 255, 255, 0.06)' }} />
              <MenuItem onClick={handleLogout} sx={{ py: 1, fontSize: '0.85rem' }}>
                <ListItemIcon>
                  <Logout fontSize="small" sx={{ color: 'error.main' }} />
                </ListItemIcon>
                <Typography color="error.main" fontSize="0.85rem" fontWeight={500}>
                  Sign Out
                </Typography>
              </MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Sidebar Navigation */}
      <Box
        component="nav"
        sx={{
          width: { md: drawerWidth },
          flexShrink: { md: 0 },
          transition: 'width 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {isMobile ? (
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={handleDrawerToggle}
            ModalProps={{ keepMounted: true }}
            sx={{
              '& .MuiDrawer-paper': {
                width: EXPANDED_WIDTH,
                backgroundColor: '#080E1A',
                borderRight: '1px solid rgba(255, 255, 255, 0.06)',
              },
            }}
          >
            {drawerContent}
          </Drawer>
        ) : (
          <Drawer
            variant="permanent"
            sx={{
              '& .MuiDrawer-paper': {
                width: drawerWidth,
                transition: 'width 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                backgroundColor: '#080E1A',
                borderRight: '1px solid rgba(255, 255, 255, 0.06)',
                boxSizing: 'border-box',
              },
            }}
            open
          >
            {drawerContent}
          </Drawer>
        )}
      </Box>

      {/* Main Content Area with Smooth Page Transition & Bottom Footer */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          mt: '64px',
          overflow: 'auto',
          height: 'calc(100vh - 64px)',
          transition: 'width 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          backgroundColor: '#070B12',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Box
          sx={{
            flex: '1 0 auto',
            p: { xs: 2, sm: 3, lg: 3.5 },
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </Box>
        <Footer />
      </Box>
    </Box>
  );
}

export default Layout;
