import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  CardActionArea,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import AddOutlinedIcon from '@mui/icons-material/AddOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined'
import { useNavigate } from 'react-router'
import { z } from 'zod'
import { api, getApiErrorMessage, getApiFieldErrors } from '../../api/client'
import { fetchProjects } from '../../api/kanbot'

const projectSchema = z.object({
  name: z.string().trim().min(1, 'Enter a project name.').max(80),
  key: z.string().trim().refine((value) => !value || /^[A-Za-z]{2,6}$/.test(value), 'Key must be 2–6 letters.'),
  description: z.string().max(500, 'Description must be 500 characters or fewer.'),
})

const blankProject = { name: '', key: '', description: '' }

export default function Projects() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [values, setValues] = useState(blankProject)
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const loadProjects = useCallback(async () => {
    try {
      setProjects(await fetchProjects())
      setLoadError('')
    } catch (error) {
      setLoadError(getApiErrorMessage(error, 'Unable to load your projects.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    fetchProjects()
      .then((items) => {
        if (active) {
          setProjects(items)
          setLoadError('')
        }
      })
      .catch((error) => {
        if (active) setLoadError(getApiErrorMessage(error, 'Unable to load your projects.'))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  function openCreate() {
    setEditing(null)
    setValues(blankProject)
    setFieldErrors({})
    setFormError('')
    setDialogOpen(true)
  }

  function openEdit(project, event) {
    event?.stopPropagation()
    setEditing(project)
    setValues({ name: project.name, key: project.key, description: project.description || '' })
    setFieldErrors({})
    setFormError('')
    setDialogOpen(true)
  }

  async function saveProject(event) {
    event.preventDefault()
    setFieldErrors({})
    setFormError('')
    const parsed = projectSchema.safeParse(values)
    if (!parsed.success) {
      setFieldErrors(Object.fromEntries(parsed.error.issues.map((issue) => [issue.path[0], issue.message])))
      return
    }
    const payload = {
      name: parsed.data.name,
      description: parsed.data.description,
      ...(parsed.data.key ? { key: parsed.data.key.toUpperCase() } : {}),
    }

    setBusy(true)
    try {
      if (editing) {
        const { data } = await api.patch(`/projects/${editing.id}`, payload)
        setProjects((current) => current.map((project) => project.id === editing.id ? data.project : project))
      } else {
        const { data } = await api.post('/projects', payload)
        navigate(`/projects/${data.project.id}/backlog`)
      }
      setDialogOpen(false)
    } catch (error) {
      const errors = getApiFieldErrors(error)
      if (error?.response?.status === 409 && !errors.key) {
        errors.key = 'This key is already used by another project.'
      }
      setFieldErrors(errors)
      if (!errors.key && !errors.name) setFormError(getApiErrorMessage(error, 'Unable to save this project.'))
    } finally {
      setBusy(false)
    }
  }

  async function deleteProject() {
    if (!deleteTarget) return
    setBusy(true)
    setFormError('')
    try {
      await api.delete(`/projects/${deleteTarget.id}`)
      setProjects((current) => current.filter((project) => project.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch (error) {
      setFormError(getApiErrorMessage(error, 'Unable to delete this project.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="projects-page app-content">
      <div className="page-heading-row">
        <div>
          <span className="page-eyebrow">YOUR WORKSPACE</span>
          <Typography component="h2" variant="h4" fontWeight={700}>Projects</Typography>
          <Typography color="text.secondary">{projects.length} {projects.length === 1 ? 'project' : 'projects'} to keep your work moving.</Typography>
        </div>
        <Button startIcon={<AddOutlinedIcon />} onClick={openCreate} variant="contained">New project</Button>
      </div>

      {loadError && <Alert severity="error" action={<Button color="inherit" size="small" onClick={loadProjects}>Try again</Button>}>{loadError}</Alert>}
      {loading ? (
        <div className="page-loading"><CircularProgress /><span>Loading projects…</span></div>
      ) : projects.length === 0 ? (
        <section className="empty-state card-surface">
          <div className="empty-state-icon"><AddOutlinedIcon /></div>
          <Typography variant="h5" fontWeight={700}>No projects yet</Typography>
          <Typography color="text.secondary">Create your first project to start planning sprints.</Typography>
          <Button variant="contained" onClick={openCreate}>Create your first project</Button>
        </section>
      ) : (
        <div className="projects-grid">
          {projects.map((project) => (
            <Card className="project-card card-surface" key={project.id} elevation={0}>
              <CardActionArea onClick={() => navigate(`/projects/${project.id}/backlog`)} className="project-card-action">
                <CardContent>
                  <div className="project-card-heading">
                    <div className="project-mark">{project.key.slice(0, 2)}</div>
                    <div className="project-card-title">
                      <Typography variant="h6" fontWeight={700}>{project.name}</Typography>
                      <span className="project-key">{project.key}</span>
                    </div>
                  </div>
                  <Typography className="project-description" color="text.secondary">
                    {project.description || 'Make a plan, track progress, and ship your next idea.'}
                  </Typography>
                  <div className="project-card-stats">
                    <span><strong>{project.stats.backlogCount}</strong> backlog</span>
                    <span>{project.stats.activeSprint
                      ? <><strong>{project.stats.activeSprint.name}</strong> active</>
                      : 'No active sprint'}
                    </span>
                  </div>
                </CardContent>
              </CardActionArea>
              <div className="project-card-actions">
                <IconButton aria-label={`Edit ${project.name}`} onClick={(event) => openEdit(project, event)} size="small"><EditOutlinedIcon fontSize="small" /></IconButton>
                <IconButton aria-label={`Delete ${project.name}`} onClick={() => setDeleteTarget(project)} size="small" color="error"><DeleteOutlineOutlinedIcon fontSize="small" /></IconButton>
              </div>
            </Card>
          ))}
          <button className="project-new-card card-surface" onClick={openCreate}>
            <AddOutlinedIcon /><span>New project</span>
          </button>
        </div>
      )}

      <Dialog open={dialogOpen} onClose={() => !busy && setDialogOpen(false)} fullWidth maxWidth="sm">
        <form onSubmit={saveProject} noValidate>
          <DialogTitle>{editing ? 'Edit project' : 'Create a project'}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              {formError && <Alert severity="error">{formError}</Alert>}
              <TextField autoFocus required label="Project name" value={values.name} onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))} error={Boolean(fieldErrors.name)} helperText={fieldErrors.name} slotProps={{ htmlInput: { maxLength: 80 } }} />
              <TextField label="Project key (optional)" value={values.key} onChange={(event) => setValues((current) => ({ ...current, key: event.target.value.toUpperCase() }))} error={Boolean(fieldErrors.key)} helperText={fieldErrors.key || '2–6 letters. Leave blank to generate one automatically.'} slotProps={{ htmlInput: { maxLength: 6 } }} />
              <TextField label="Description" multiline minRows={3} value={values.description} onChange={(event) => setValues((current) => ({ ...current, description: event.target.value }))} error={Boolean(fieldErrors.description)} helperText={fieldErrors.description} slotProps={{ htmlInput: { maxLength: 500 } }} />
              {editing && <Typography variant="caption" color="text.secondary">Changing the project key does not change existing todo keys.</Typography>}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button disabled={busy} onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button disabled={busy} type="submit" variant="contained">{busy ? 'Saving…' : editing ? 'Save changes' : 'Create project'}</Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onClose={() => !busy && setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete {deleteTarget?.name}?</DialogTitle>
        <DialogContent>
          <Typography>This permanently deletes {deleteTarget?.name}, including all its todos and sprints.</Typography>
          {formError && <Alert severity="error" sx={{ mt: 2 }}>{formError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button disabled={busy} color="error" onClick={deleteProject} variant="contained">{busy ? 'Deleting…' : 'Delete project'}</Button>
        </DialogActions>
      </Dialog>
    </div>
  )
}
