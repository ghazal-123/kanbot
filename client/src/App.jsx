import { lazy, Suspense } from 'react'
import { Alert, Button, CircularProgress, Typography } from '@mui/material'
import {
  BrowserRouter,
  Link,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from 'react-router'
import { AuthProvider } from './context/AuthContext'
import useAuth from './context/useAuth'
import ThemeModeProvider from './context/ThemeProvider'
import AppShell from './components/AppShell'
import AuthFrame from './components/AuthFrame'
import './App.css'

const Login = lazy(() => import('./pages/Auth/Login'))
const Register = lazy(() => import('./pages/Auth/Register'))
const Projects = lazy(() => import('./pages/Projects/Projects'))
const Backlog = lazy(() => import('./pages/Backlog/Backlog'))
const ActiveSprint = lazy(() => import('./pages/Board/ActiveSprint'))
const Sprints = lazy(() => import('./pages/Sprints/Sprints'))

function FullPageLoader() {
  return (
    <main className="auth-page min-h-screen bg-slate-50 text-slate-900 transition-colors duration-300 dark:bg-[#0B1329] dark:text-white">
      <div className="loader-panel" role="status" aria-live="polite">
        <CircularProgress size={34} aria-label="Checking your session" />
        <Typography color="text.secondary">Checking your session…</Typography>
      </div>
    </main>
  )
}

function safeRedirect(search) {
  const requestedPath = new URLSearchParams(search).get('redirect')
  if (
    requestedPath
    && requestedPath.startsWith('/')
    && !requestedPath.startsWith('//')
    && !requestedPath.includes('\\')
  ) return requestedPath
  return '/projects'
}

function ProtectedRoute() {
  const { user, isLoading } = useAuth()
  const location = useLocation()
  if (isLoading) return <FullPageLoader />
  if (!user) {
    const requestedPath = `${location.pathname}${location.search}${location.hash}`
    return <Navigate to={`/login?redirect=${encodeURIComponent(requestedPath)}`} replace />
  }
  return <Outlet />
}

function GuestRoute() {
  const { user, isLoading } = useAuth()
  const location = useLocation()
  if (isLoading) return <FullPageLoader />
  if (user) {
    const destination = location.pathname === '/login' ? safeRedirect(location.search) : '/projects'
    return <Navigate to={destination} replace />
  }
  return <Outlet />
}

function NotFound() {
  return (
    <AuthFrame heading="Page not found" subtitle="We couldn't find the page you requested.">
      <Alert severity="info" sx={{ mb: 2 }}>The address may be outdated, or the page may have moved.</Alert>
      <Button component={Link} to="/projects" variant="contained" fullWidth>Go to your workspace</Button>
    </AuthFrame>
  )
}

function AppRoutes() {
  return (
    <Suspense fallback={<FullPageLoader />}>
      <Routes>
        <Route element={<GuestRoute />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<Navigate to="/projects" replace />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/projects/:projectId" element={<Navigate to="backlog" replace />} />
            <Route path="/projects/:projectId/backlog" element={<Backlog />} />
            <Route path="/projects/:projectId/board" element={<ActiveSprint />} />
            <Route path="/projects/:projectId/sprints" element={<Sprints />} />
            <Route path="/projects/:projectId/sprints/:sprintId" element={<Sprints />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeModeProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ThemeModeProvider>
    </BrowserRouter>
  )
}
