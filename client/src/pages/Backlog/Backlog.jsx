import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import AddOutlinedIcon from '@mui/icons-material/AddOutlined'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'
import DragIndicatorOutlinedIcon from '@mui/icons-material/DragIndicatorOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import PlayArrowOutlinedIcon from '@mui/icons-material/PlayArrowOutlined'
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined'
import { useNavigate, useParams } from 'react-router'
import { z } from 'zod'
import { api, getApiErrorMessage, getApiFieldErrors } from '../../api/client'
import { fetchProject, fetchSprints, fetchTodos, publishDataChange, useProjectRefresh } from '../../api/kanbot'
import TodoEditorDialog from '../../components/TodoEditorDialog'

const sprintSchema = z.object({
  name: z.string().trim().max(80),
  goal: z.string().max(300),
  startDate: z.string(),
  endDate: z.string(),
}).refine((value) => !value.startDate || !value.endDate || value.endDate >= value.startDate, {
  message: 'End date must be on or after the start date.',
  path: ['endDate'],
})

const today = () => new Date().toISOString().slice(0, 10)
const plus14 = () => {
  const date = new Date()
  date.setDate(date.getDate() + 14)
  return date.toISOString().slice(0, 10)
}

function TodoRow({ todo, sprints, onOpen, onMove, draggable = true }) {
  return (
    <article
      className="todo-row"
      draggable={draggable}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('text/plain', todo.id)
      }}
      onClick={() => onOpen(todo)}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen(todo)
        }
      }}
    >
      <DragIndicatorOutlinedIcon className="todo-drag-handle" fontSize="small" aria-hidden="true" />
      <code className="todo-key">{todo.key}</code>
      <span className="todo-title">{todo.title}</span>
      <span className={`todo-type type-${todo.type}`}>{todo.type}</span>
      <span className={`todo-priority priority-${todo.priority}`}>{todo.priority}</span>
      {todo.storyPoints != null && <span className="todo-points">{todo.storyPoints} pts</span>}
      {todo.labels?.length > 0 && <span className="todo-labels">{todo.labels.map((label) => <span key={label}>{label}</span>)}</span>}
      <Select
        size="small"
        value={todo.sprintId || 'backlog'}
        aria-label={`Move ${todo.key} to another sprint`}
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => onMove(todo, event.target.value === 'backlog' ? null : event.target.value)}
        className="todo-move-select"
      >
        <MenuItem value="backlog">Backlog</MenuItem>
        {sprints.filter((sprint) => sprint.status !== 'completed').map((sprint) => (
          <MenuItem key={sprint.id} value={sprint.id}>{sprint.name}</MenuItem>
        ))}
      </Select>
    </article>
  )
}

export default function Backlog() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const [project, setProject] = useState(null)
  const [sprints, setSprints] = useState([])
  const [todos, setTodos] = useState([])
  const [loading, setLoading] = useState(true)
  const [requestError, setRequestError] = useState('')
  const [notice, setNotice] = useState('')
  const [quickTitle, setQuickTitle] = useState('')
  const quickInput = useRef(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [sprintDialog, setSprintDialog] = useState(false)
  const [sprintEdit, setSprintEdit] = useState(null)
  const [sprintValues, setSprintValues] = useState({ name: '', goal: '', startDate: '', endDate: '' })
  const [sprintErrors, setSprintErrors] = useState({})
  const [sprintRequestError, setSprintRequestError] = useState('')
  const [busy, setBusy] = useState(false)
  const [startSprint, setStartSprint] = useState(null)
  const [startDates, setStartDates] = useState({ startDate: today(), endDate: plus14() })
  const [deleteSprint, setDeleteSprint] = useState(null)
  const [selectedTodo, setSelectedTodo] = useState(null)
  const [createTodoOpen, setCreateTodoOpen] = useState(false)
  const [snackbar, setSnackbar] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setRequestError('')
    try {
      const [projectData, sprintData, todoData] = await Promise.all([
        fetchProject(projectId),
        fetchSprints(projectId),
        fetchTodos(projectId),
      ])
      setProject(projectData)
      setSprints(sprintData)
      setTodos(todoData)
    } catch (error) {
      setRequestError(getApiErrorMessage(error, 'Unable to load the backlog.'))
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { loadData() }, [loadData])
  useProjectRefresh(projectId, loadData)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 300)
    return () => window.clearTimeout(timer)
  }, [search])

  const activeSprint = sprints.find((sprint) => sprint.status === 'active')
  const plannedSprints = sprints.filter((sprint) => sprint.status === 'planned')
  const filteredTodos = useMemo(() => todos.filter((todo) => {
    if (todo.sprintId && !plannedSprints.some((sprint) => sprint.id === todo.sprintId)) return false
    if (priorityFilter && todo.priority !== priorityFilter) return false
    if (typeFilter && todo.type !== typeFilter) return false
    if (debouncedSearch) {
      const text = [todo.key, todo.title, todo.description, ...(todo.labels || [])].join(' ').toLowerCase()
      if (!text.includes(debouncedSearch)) return false
    }
    return true
  }), [todos, plannedSprints, priorityFilter, typeFilter, debouncedSearch])
  const backlogTodos = filteredTodos.filter((todo) => todo.sprintId === null)
  const backlogTotalPoints = backlogTodos.reduce((sum, todo) => sum + (todo.storyPoints || 0), 0)
  const hasFilters = Boolean(debouncedSearch || priorityFilter || typeFilter)

  async function createQuickTodo(event) {
    event.preventDefault()
    const title = quickTitle.trim()
    if (!title) return
    setRequestError('')
    try {
      const { data } = await api.post(`/projects/${projectId}/todos`, { title })
      setTodos((current) => [...current, data.todo])
      setQuickTitle('')
      setNotice(`${data.todo.key} created.`)
      quickInput.current?.focus()
    } catch (error) {
      setRequestError(getApiErrorMessage(error, 'Unable to create the todo.'))
    }
  }

  function reorderOptimistically(todo, destinationSprintId, position, destinationStatus) {
    const snapshot = todos
    const sourceList = todos
      .filter((item) => item.projectId === todo.projectId && item.sprintId === todo.sprintId && (todo.sprintId === null || item.status === todo.status))
      .sort((a, b) => a.order - b.order)
    const targetList = (destinationSprintId === todo.sprintId ? sourceList : todos
      .filter((item) => item.sprintId === destinationSprintId && (destinationSprintId === null || item.status === destinationStatus))
      .sort((a, b) => a.order - b.order))
    const without = sourceList.filter((item) => item.id !== todo.id)
    const destination = destinationSprintId === todo.sprintId ? without : targetList
    const index = Math.max(0, Math.min(position, destination.length))
    const moved = { ...todo, sprintId: destinationSprintId, status: destinationStatus }
    destination.splice(index, 0, moved)
    const changed = new Map()
    sourceList.forEach((item, order) => changed.set(item.id, { ...item, order }))
    destination.forEach((item, order) => changed.set(item.id, { ...item, order }))
    setTodos((current) => current.map((item) => changed.get(item.id) || item))
    return { snapshot, moved, position: index }
  }

  async function moveTodo(todo, destinationSprintId, position) {
    if (destinationSprintId === todo.sprintId && position === undefined) return
    const destinationStatus = destinationSprintId && destinationSprintId !== todo.sprintId ? 'todo' : todo.status
    const target = destinationSprintId
      ? todos.filter((item) => item.sprintId === destinationSprintId && item.id !== todo.id && item.status === destinationStatus)
      : todos.filter((item) => item.sprintId === null && item.id !== todo.id)
    const optimistic = reorderOptimistically(todo, destinationSprintId, position ?? target.length, destinationStatus)
    setRequestError('')
    try {
      await api.post(`/todos/${todo.id}/move`, {
        sprintId: destinationSprintId,
        status: destinationStatus,
        position: optimistic.position,
      })
      publishDataChange(projectId)
    } catch (error) {
      setTodos(optimistic.snapshot)
      setSnackbar(getApiErrorMessage(error, 'Could not move the todo. Its original position was restored.'))
    }
  }

  async function saveSprint(event) {
    event.preventDefault()
    setSprintErrors({})
    setSprintRequestError('')
    const parsed = sprintSchema.safeParse(sprintValues)
    if (!parsed.success) {
      setSprintErrors(Object.fromEntries(parsed.error.issues.map((issue) => [issue.path[0], issue.message])))
      return
    }
    if (sprintEdit && !parsed.data.name) {
      setSprintErrors({ name: 'Enter a sprint name.' })
      return
    }
    setBusy(true)
    try {
      const payload = {
        ...(parsed.data.name ? { name: parsed.data.name } : {}),
        goal: parsed.data.goal,
        startDate: parsed.data.startDate || null,
        endDate: parsed.data.endDate || null,
      }
      if (sprintEdit) {
        const { data } = await api.patch(`/sprints/${sprintEdit.id}`, payload)
        setSprints((current) => current.map((sprint) => sprint.id === sprintEdit.id ? data.sprint : sprint))
      } else {
        await api.post(`/projects/${projectId}/sprints`, payload)
        await loadData()
      }
      setSprintDialog(false)
      publishDataChange(projectId)
    } catch (error) {
      setSprintErrors((current) => ({ ...current, ...getApiFieldErrors(error) }))
      setSprintRequestError(getApiErrorMessage(error, 'Unable to save the sprint.'))
    } finally {
      setBusy(false)
    }
  }

  function openSprintDialog(sprint = null) {
    setSprintEdit(sprint)
    setSprintValues(sprint ? {
      name: sprint.name,
      goal: sprint.goal || '',
      startDate: sprint.startDate || '',
      endDate: sprint.endDate || '',
    } : { name: '', goal: '', startDate: '', endDate: '' })
    setSprintErrors({})
    setSprintRequestError('')
    setSprintDialog(true)
  }

  async function confirmStartSprint() {
    if (!startSprint) return
    setBusy(true)
    setSprintRequestError('')
    try {
      await api.post(`/sprints/${startSprint.id}/start`, startDates)
      setStartSprint(null)
      navigate(`/projects/${projectId}/board`)
    } catch (error) {
      setSprintRequestError(getApiErrorMessage(error, 'Unable to start the sprint.'))
    } finally {
      setBusy(false)
    }
  }

  async function confirmDeleteSprint() {
    if (!deleteSprint) return
    setBusy(true)
    setSprintRequestError('')
    try {
      await api.delete(`/sprints/${deleteSprint.id}`)
      setDeleteSprint(null)
      await loadData()
    } catch (error) {
      setSprintRequestError(getApiErrorMessage(error, 'Unable to delete the sprint.'))
    } finally {
      setBusy(false)
    }
  }

  function handleDrop(event, destinationSprintId, position) {
    event.preventDefault()
    const todoId = event.dataTransfer.getData('text/plain')
    const todo = todos.find((item) => item.id === todoId)
    if (!todo) return
    moveTodo(todo, destinationSprintId, position)
  }

  function groupTodos(sprintId) {
    return filteredTodos
      .filter((todo) => todo.sprintId === sprintId)
      .sort((a, b) => a.order - b.order)
  }

  return (
    <div className="app-content backlog-page">
      <div className="page-heading-row backlog-heading">
        <div>
          <span className="page-eyebrow">{project?.key || 'PROJECT'} · BACKLOG</span>
          <Typography component="h2" variant="h4" fontWeight={700}>{project?.name || 'Backlog'}</Typography>
          <div className="backlog-totals">
            <span>{backlogTodos.length} backlog items</span>
            <span>{backlogTotalPoints} story points</span>
            <span>{todos.length} total todos</span>
          </div>
        </div>
        <div className="backlog-actions">
          <Button startIcon={<AutoAwesomeOutlinedIcon />} onClick={() => window.dispatchEvent(new CustomEvent('kanbot:open-ai', { detail: { action: 'generate' } }))} variant="outlined">Generate todos</Button>
          <Button startIcon={<AutoAwesomeOutlinedIcon />} onClick={() => window.dispatchEvent(new CustomEvent('kanbot:open-ai', { detail: { action: 'plan' } }))} variant="outlined">Plan sprint</Button>
          <Button startIcon={<AddOutlinedIcon />} onClick={() => openSprintDialog()} variant="contained">Create sprint</Button>
        </div>
      </div>

      {requestError && <Alert severity="error" action={<Button color="inherit" size="small" onClick={loadData}>Try again</Button>}>{requestError}</Alert>}
      <div className="backlog-filter-row">
        <TextField size="small" placeholder="Search todos…" value={search} onChange={(event) => setSearch(event.target.value)} slotProps={{ htmlInput: { 'aria-label': 'Search todos' } }} />
        <TextField select size="small" label="Priority" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
          <MenuItem value="">All priorities</MenuItem>
          {['low', 'medium', 'high', 'urgent'].map((priority) => <MenuItem key={priority} value={priority}>{priority}</MenuItem>)}
        </TextField>
        <TextField select size="small" label="Type" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
          <MenuItem value="">All types</MenuItem>
          {['task', 'story', 'bug'].map((type) => <MenuItem key={type} value={type}>{type}</MenuItem>)}
        </TextField>
        {hasFilters && <span className="drag-disabled-hint">Clear filters to reorder todos.</span>}
      </div>

      {loading ? <div className="page-loading"><CircularProgress /><span>Loading your backlog…</span></div> : (
        <div className="sprint-buckets">
          {plannedSprints.map((sprint) => {
            const items = groupTodos(sprint.id)
            const points = items.reduce((sum, todo) => sum + (todo.storyPoints || 0), 0)
            return (
              <section key={sprint.id} className="sprint-bucket card-surface">
                <header className="sprint-bucket-header">
                  <div className="sprint-bucket-title">
                    <span className="sprint-status-dot planned" />
                    <div><strong>{sprint.name}</strong><span>{sprint.goal || 'Sprint goal not set'}</span></div>
                  </div>
                  <div className="sprint-bucket-meta">
                    <span>{items.length} todos · {points} pts</span>
                    <Button size="small" startIcon={<EditOutlinedIcon />} onClick={() => openSprintDialog(sprint)}>Edit</Button>
                    <Button size="small" startIcon={<PlayArrowOutlinedIcon />} disabled={Boolean(activeSprint)} title={activeSprint ? `${activeSprint.name} is active; complete it before starting another sprint.` : ''} onClick={() => { setStartSprint(sprint); setStartDates({ startDate: today(), endDate: plus14() }); setSprintRequestError('') }}>Start</Button>
                    <Button size="small" color="error" aria-label={`Delete ${sprint.name}`} onClick={() => setDeleteSprint(sprint)}><DeleteOutlineOutlinedIcon fontSize="small" /></Button>
                  </div>
                </header>
                <div
                  className="sprint-drop-list"
                  onDragOver={(event) => { if (!hasFilters) event.preventDefault() }}
                  onDrop={(event) => !hasFilters && handleDrop(event, sprint.id, items.length)}
                >
                  {items.map((todo, index) => (
                    <div
                      key={todo.id}
                      onDragOver={(event) => { if (!hasFilters) event.preventDefault() }}
                      onDrop={(event) => { event.stopPropagation(); if (!hasFilters) handleDrop(event, sprint.id, index) }}
                    >
                      <TodoRow todo={todo} sprints={sprints} onOpen={setSelectedTodo} onMove={(item, target) => moveTodo(item, target)} draggable={!hasFilters} />
                    </div>
                  ))}
                  {items.length === 0 && <p className="drop-empty">Drop todos here, or add tasks from the backlog.</p>}
                </div>
              </section>
            )
          })}

          <section className="sprint-bucket backlog-bucket card-surface">
            <header className="sprint-bucket-header">
              <div className="sprint-bucket-title">
                <span className="sprint-status-dot backlog-dot" />
                <div><strong>Backlog</strong><span>{backlogTodos.length} todos · {backlogTotalPoints} pts</span></div>
              </div>
              <Button size="small" startIcon={<AddOutlinedIcon />} onClick={() => setCreateTodoOpen(true)}>New todo</Button>
            </header>
            <div
              className="sprint-drop-list"
              onDragOver={(event) => { if (!hasFilters) event.preventDefault() }}
              onDrop={(event) => !hasFilters && handleDrop(event, null, backlogTodos.length)}
            >
              {backlogTodos.map((todo, index) => (
                <div
                  key={todo.id}
                  onDragOver={(event) => { if (!hasFilters) event.preventDefault() }}
                  onDrop={(event) => { event.stopPropagation(); if (!hasFilters) handleDrop(event, null, index) }}
                >
                  <TodoRow todo={todo} sprints={sprints} onOpen={setSelectedTodo} onMove={(item, target) => moveTodo(item, target)} draggable={!hasFilters} />
                </div>
              ))}
              {backlogTodos.length === 0 && <p className="drop-empty">{hasFilters ? 'No todos match these filters.' : 'Your backlog is empty. Create a todo or generate ideas with AI.'}</p>}
            </div>
            <form className="quick-create" onSubmit={createQuickTodo}>
              <AddOutlinedIcon fontSize="small" color="primary" />
              <TextField
                inputRef={quickInput}
                variant="standard"
                placeholder="Type a title and press Enter"
                value={quickTitle}
                onChange={(event) => setQuickTitle(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Escape') setQuickTitle('') }}
                slotProps={{ htmlInput: { 'aria-label': 'Create todo title', maxLength: 200 } }}
              />
              <Button type="submit" disabled={!quickTitle.trim()}>Create todo</Button>
            </form>
          </section>
        </div>
      )}

      <Dialog open={sprintDialog} onClose={() => !busy && setSprintDialog(false)} fullWidth maxWidth="sm">
        <form onSubmit={saveSprint} noValidate>
          <DialogTitle>{sprintEdit ? `Edit ${sprintEdit.name}` : 'Create a sprint'}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              {sprintRequestError && <Alert severity="error">{sprintRequestError}</Alert>}
              <TextField label="Sprint name" value={sprintValues.name} placeholder="Sprint name" onChange={(event) => setSprintValues((current) => ({ ...current, name: event.target.value }))} error={Boolean(sprintErrors.name)} helperText={sprintErrors.name || (!sprintEdit ? 'Leave blank to use the next sprint number.' : '')} />
              <TextField label="Goal (optional)" value={sprintValues.goal} onChange={(event) => setSprintValues((current) => ({ ...current, goal: event.target.value }))} slotProps={{ htmlInput: { maxLength: 300 } }} error={Boolean(sprintErrors.goal)} helperText={sprintErrors.goal} />
              <div className="todo-edit-grid">
                <TextField type="date" label="Start date" slotProps={{ inputLabel: { shrink: true } }} value={sprintValues.startDate} onChange={(event) => setSprintValues((current) => ({ ...current, startDate: event.target.value }))} error={Boolean(sprintErrors.startDate)} helperText={sprintErrors.startDate} />
                <TextField type="date" label="End date" slotProps={{ inputLabel: { shrink: true } }} value={sprintValues.endDate} onChange={(event) => setSprintValues((current) => ({ ...current, endDate: event.target.value }))} error={Boolean(sprintErrors.endDate)} helperText={sprintErrors.endDate} />
              </div>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button disabled={busy} onClick={() => setSprintDialog(false)}>Cancel</Button>
            <Button disabled={busy} type="submit" variant="contained">{busy ? 'Saving…' : sprintEdit ? 'Save sprint' : 'Create sprint'}</Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog open={Boolean(startSprint)} onClose={() => !busy && setStartSprint(null)} fullWidth maxWidth="xs">
        <DialogTitle>Start {startSprint?.name}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {activeSprint && <Alert severity="warning">{activeSprint.name} is currently active. Complete it before starting another sprint.</Alert>}
            {sprintRequestError && <Alert severity="error">{sprintRequestError}</Alert>}
            <TextField type="date" label="Start date" slotProps={{ inputLabel: { shrink: true } }} value={startDates.startDate} onChange={(event) => setStartDates((current) => ({ ...current, startDate: event.target.value }))} />
            <TextField type="date" label="End date" slotProps={{ inputLabel: { shrink: true } }} value={startDates.endDate} onChange={(event) => setStartDates((current) => ({ ...current, endDate: event.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setStartSprint(null)}>Cancel</Button>
          <Button disabled={busy || Boolean(activeSprint) || !startDates.startDate || !startDates.endDate || startDates.endDate < startDates.startDate} onClick={confirmStartSprint} variant="contained">Start sprint</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(deleteSprint)} onClose={() => !busy && setDeleteSprint(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete {deleteSprint?.name}?</DialogTitle>
        <DialogContent>
          <Typography>The sprint will be removed and its todos returned to the backlog.</Typography>
          {sprintRequestError && <Alert severity="error" sx={{ mt: 2 }}>{sprintRequestError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setDeleteSprint(null)}>Cancel</Button>
          <Button disabled={busy} color="error" variant="contained" onClick={confirmDeleteSprint}>Delete sprint</Button>
        </DialogActions>
      </Dialog>

      {(Boolean(selectedTodo) || createTodoOpen) && <TodoEditorDialog key={selectedTodo?.id || 'new'} open todo={selectedTodo} sprints={sprints} projectId={projectId}
        onClose={() => { setSelectedTodo(null); setCreateTodoOpen(false) }}
        onSaved={() => { setSelectedTodo(null); setCreateTodoOpen(false); loadData() }}
        onDeleted={() => { setSelectedTodo(null); loadData() }}
      />}
      <Snackbar open={Boolean(snackbar || notice)} autoHideDuration={4500} onClose={() => { setSnackbar(''); setNotice('') }} message={snackbar || notice} />
    </div>
  )
}
