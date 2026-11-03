import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  CircularProgress,
  FormControl,
  IconButton,
  MenuItem,
  Select,
  Typography,
} from '@mui/material'
import { Link, NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined'
import ViewKanbanOutlinedIcon from '@mui/icons-material/ViewKanbanOutlined'
import PlaylistAddCheckOutlinedIcon from '@mui/icons-material/PlaylistAddCheckOutlined'
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined'
import MenuOutlinedIcon from '@mui/icons-material/MenuOutlined'
import { fetchProjects } from '../api/kanbot'
import { getApiErrorMessage } from '../api/client'
import useAuth from '../context/useAuth'
import useThemeMode from '../context/useThemeMode'
import ThemeToggle from './ThemeToggle'
import AiAssistant from '../pages/AI/AiAssistant'

function routeTitle(pathname) {
  if (/\/backlog$/.test(pathname)) return 'Backlog'
  if (/\/board$/.test(pathname)) return 'Active sprint'
  if (/\/sprints/.test(pathname)) return 'Sprints'
  return 'Projects'
}

export default function AppShell() {
  const { projectId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { mode } = useThemeMode()
  const logo = mode === 'dark'
    ? '/assets/images/kanbot-logo-dark.svg'
    : '/assets/images/kanbot-logo.svg'
  const [projects, setProjects] = useState([])
  const [isLoadingProjects, setIsLoadingProjects] = useState(true)
  const [projectError, setProjectError] = useState('')
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    let active = true
    fetchProjects()
      .then((items) => {
        if (active) {
          setProjects(items)
          setProjectError('')
        }
      })
      .catch((error) => {
        if (active) setProjectError(getApiErrorMessage(error, 'Unable to load your projects.'))
      })
      .finally(() => {
        if (active) setIsLoadingProjects(false)
      })
    return () => { active = false }
  }, [location.pathname])

  useEffect(() => {
    const openAssistant = () => setAssistantOpen(true)
    window.addEventListener('kanbot:open-ai', openAssistant)
    return () => window.removeEventListener('kanbot:open-ai', openAssistant)
  }, [])

  const activeProject = useMemo(
    () => projects.find((project) => project.id === projectId),
    [projects, projectId],
  )
  const rootPath = projectId ? `/projects/${projectId}` : ''

  function changeProject(event) {
    const selectedId = event.target.value
    if (selectedId) navigate(`/projects/${selectedId}/backlog`)
  }

  return (
    <div className="app-shell min-h-screen bg-slate-50 text-slate-900 transition-colors duration-300 dark:bg-[#0B1329] dark:text-white">
      <aside className={`app-sidebar ${mobileNavOpen ? 'mobile-open' : ''}`}>
        <Link to="/projects" className="sidebar-brand" aria-label="Kanbot projects">
          <img src={logo} alt="Kanbot" />
        </Link>
        <div className="sidebar-project-select">
          <FormControl fullWidth size="small">
            <Select
              aria-label="Select project"
              displayEmpty
              value={projectId || ''}
              onChange={changeProject}
              renderValue={(value) => {
                if (!value) return 'All projects'
                const project = projects.find((item) => item.id === value)
                return project ? `${project.key} · ${project.name}` : isLoadingProjects ? 'Loading project…' : 'Project unavailable'
              }}
            >
              <MenuItem value=""><em>All projects</em></MenuItem>
              {projectId && !projects.some((project) => project.id === projectId) && (
                <MenuItem value={projectId} disabled>
                  {isLoadingProjects ? 'Loading project…' : 'Project unavailable'}
                </MenuItem>
              )}
              {projects.map((project) => (
                <MenuItem key={project.id} value={project.id}>{project.key} · {project.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          {isLoadingProjects && <CircularProgress size={14} className="project-select-progress" />}
          {projectError && <Alert severity="error" className="sidebar-alert">{projectError}</Alert>}
        </div>
        <nav className="sidebar-nav" aria-label="Main navigation">
          <span className="sidebar-section-label">{activeProject?.key || 'WORKSPACE'}</span>
          <NavLink to={rootPath ? `${rootPath}/backlog` : '/projects'} className={({ isActive }) => `sidebar-link ${isActive && projectId ? 'active' : ''}`}>
            <PlaylistAddCheckOutlinedIcon fontSize="small" /> <span>Backlog</span>
          </NavLink>
          <NavLink to={rootPath ? `${rootPath}/board` : '/projects'} className={({ isActive }) => `sidebar-link ${isActive && /\/board$/.test(location.pathname) ? 'active' : ''}`}>
            <ViewKanbanOutlinedIcon fontSize="small" /> <span>Active sprint</span>
          </NavLink>
          <NavLink to={rootPath ? `${rootPath}/sprints` : '/projects'} className={({ isActive }) => `sidebar-link ${isActive && /\/sprints/.test(location.pathname) ? 'active' : ''}`}>
            <HistoryOutlinedIcon fontSize="small" /> <span>Sprints</span>
          </NavLink>
          <NavLink to="/projects" className={({ isActive }) => `sidebar-link ${isActive && !projectId ? 'active' : ''}`}>
            <FolderOutlinedIcon fontSize="small" /> <span>Projects</span>
          </NavLink>
        </nav>
        <div className="sidebar-user">
          <div className="sidebar-avatar">{user?.name?.trim()?.charAt(0)?.toUpperCase() || 'K'}</div>
          <div className="sidebar-user-details">
            <strong>{user?.name}</strong>
            <span>{user?.email}</span>
          </div>
          <Button size="small" onClick={logout}>Log out</Button>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <div className="app-title-group">
            <IconButton className="mobile-menu-button" onClick={() => setMobileNavOpen((open) => !open)} aria-label="Toggle navigation">
              <MenuOutlinedIcon />
            </IconButton>
            <div>
              <Typography component="h1" variant="h6" fontWeight={700}>{routeTitle(location.pathname)}</Typography>
              {activeProject && <span className="topbar-project-name">{activeProject.name}</span>}
            </div>
          </div>
          <div className="app-topbar-actions">
            {projectId && (
              <Button variant="outlined" startIcon={<AutoAwesomeOutlinedIcon />} onClick={() => setAssistantOpen(true)}>
                Ask AI
              </Button>
            )}
            <ThemeToggle />
          </div>
        </header>
        <main className="page-transition" key={location.pathname}>
          <Outlet />
        </main>
      </div>

      {mobileNavOpen && <button className="mobile-nav-scrim" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation" />}
      {projectId && (
        <AiAssistant
          key={projectId}
          open={assistantOpen}
          onClose={() => setAssistantOpen(false)}
          projectId={projectId}
          projectName={activeProject?.name || 'this project'}
        />
      )}
    </div>
  )
}
