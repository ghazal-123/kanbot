import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  Typography,
} from '@mui/material'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined'
import DragIndicatorOutlinedIcon from '@mui/icons-material/DragIndicatorOutlined'
import { useNavigate, useParams } from 'react-router'
import { api, getApiErrorMessage } from '../../api/client'
import { fetchSprintBoard, fetchSprints, publishDataChange, useProjectRefresh } from '../../api/kanbot'
import TodoEditorDialog from '../../components/TodoEditorDialog'

const columns = [
  { id: 'todo', label: 'To Do' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'in_review', label: 'In Review' },
  { id: 'done', label: 'Done' },
]

function prettyDate(date) {
  if (!date) return null
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(`${date}T00:00:00`))
}

function daysRemaining(endDate) {
  if (!endDate) return null
  return Math.ceil((new Date(`${endDate}T23:59:59`).getTime() - Date.now()) / 86400000)
}

export default function ActiveSprint() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const [sprints, setSprints] = useState([])
  const [sprint, setSprint] = useState(null)
  const [board, setBoard] = useState(Object.fromEntries(columns.map((column) => [column.id, []])))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [selectedTodo, setSelectedTodo] = useState(null)
  const [completeOpen, setCompleteOpen] = useState(false)
  const [moveUnfinishedTo, setMoveUnfinishedTo] = useState('backlog')
  const [generateSummary, setGenerateSummary] = useState(true)
  const [busy, setBusy] = useState(false)
  const [summaryError, setSummaryError] = useState('')

  const loadData = useCallback(async () => {
    try {
      const sprintData = await fetchSprints(projectId)
      setError('')
      setSprints(sprintData)
      const active = sprintData.find((item) => item.status === 'active')
      if (!active) {
        setSprint(null)
        setBoard(Object.fromEntries(columns.map((column) => [column.id, []])))
        return
      }
      const boardData = await fetchSprintBoard(active.id)
      setSprint(boardData.sprint)
      setBoard(boardData.columns)
      setError('')
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Unable to load the active sprint.'))
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    let active = true
    fetchSprints(projectId)
      .then((items) => {
        if (!active) return null
        setError('')
        setSprints(items)
        const activeSprint = items.find((item) => item.status === 'active')
        if (!activeSprint) {
          setSprint(null)
          setBoard(Object.fromEntries(columns.map((column) => [column.id, []])))
          return null
        }
        return fetchSprintBoard(activeSprint.id)
      })
      .then((data) => {
        if (active && data) {
          setSprint(data.sprint)
          setBoard(data.columns)
        }
      })
      .catch((requestError) => {
        if (active) setError(getApiErrorMessage(requestError, 'Unable to load the active sprint.'))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [projectId])
  useProjectRefresh(projectId, loadData)

  const planned = useMemo(() => sprints.filter((item) => item.status === 'planned'), [sprints])
  const statusCounts = useMemo(() => columns.reduce((counts, column) => ({
    ...counts,
    [column.id]: board[column.id]?.length || 0,
  }), {}), [board])
  const flatBoard = useMemo(() => columns.flatMap((column) => board[column.id] || []), [board])
  const donePoints = (board.done || []).reduce((sum, todo) => sum + (todo.storyPoints || 0), 0)
  const totalPoints = flatBoard.reduce((sum, todo) => sum + (todo.storyPoints || 0), 0)
  const progress = totalPoints ? Math.min(100, Math.round((donePoints / totalPoints) * 100)) : 0
  const remaining = daysRemaining(sprint?.endDate)
  const unfinishedCount = flatBoard.filter((todo) => todo.status !== 'done').length

  async function moveTodo(todo, targetStatus, position) {
    const snapshot = board
    const source = [...(snapshot[todo.status] || [])].filter((item) => item.id !== todo.id)
    const target = targetStatus === todo.status
      ? source
      : [...(snapshot[targetStatus] || [])].filter((item) => item.id !== todo.id)
    const next = { ...snapshot, [todo.status]: source }
    const moved = { ...todo, status: targetStatus }
    target.splice(Math.max(0, Math.min(position, target.length)), 0, moved)
    next[targetStatus] = target.map((item, index) => ({ ...item, order: index }))
    next[todo.status] = (targetStatus === todo.status ? target : source).map((item, index) => ({ ...item, order: index }))
    setBoard(next)

    try {
      await api.post(`/todos/${todo.id}/move`, { status: targetStatus, position })
      publishDataChange(projectId)
    } catch (requestError) {
      setBoard(snapshot)
      setNotice(`${getApiErrorMessage(requestError, 'Could not move the todo.')} The card was returned to its original position.`)
    }
  }

  function onDrop(event, status, position) {
    event.preventDefault()
    const id = event.dataTransfer.getData('text/plain')
    const todo = flatBoard.find((item) => item.id === id)
    if (todo) moveTodo(todo, status, position)
  }

  async function completeSprint() {
    if (!sprint) return
    setBusy(true)
    setSummaryError('')
    let summaryWarning = ''
    try {
      const { data } = await api.post(`/sprints/${sprint.id}/complete`, { moveUnfinishedTo })
      setCompleteOpen(false)
      publishDataChange(projectId)
      if (generateSummary) {
        try {
          await api.post(`/sprints/${data.sprint.id}/ai/summary`)
        } catch (summaryRequestError) {
          summaryWarning = getApiErrorMessage(summaryRequestError, 'Sprint completed, but its AI summary could not be generated.')
          setSummaryError(summaryWarning)
        }
      }
      navigate(`/projects/${projectId}/sprints/${data.sprint.id}`, {
        state: { summaryError: summaryWarning || undefined },
      })
    } catch (requestError) {
      setNotice(getApiErrorMessage(requestError, 'Unable to complete this sprint.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app-content board-page">
      {error && <Alert severity="error" action={<Button color="inherit" size="small" onClick={loadData}>Try again</Button>}>{error}</Alert>}
      {loading ? <div className="page-loading"><CircularProgress /><span>Loading sprint board…</span></div> : !sprint ? (
        <section className="empty-state card-surface">
          <div className="empty-state-icon"><CheckCircleOutlineOutlinedIcon /></div>
          <Typography variant="h5" fontWeight={700}>No active sprint</Typography>
          <Typography color="text.secondary">Plan a sprint from the backlog, then start it to see your board here.</Typography>
          <Button variant="contained" onClick={() => navigate(`/projects/${projectId}/backlog`)}>Go to backlog</Button>
        </section>
      ) : (
        <>
          <section className="board-summary card-surface">
            <div className="board-summary-main">
              <span className="page-eyebrow">ACTIVE SPRINT</span>
              <div className="board-summary-title">
                <Typography component="h2" variant="h4" fontWeight={700}>{sprint.name}</Typography>
                <span className="sprint-status-chip active">Active</span>
              </div>
              <p className="board-goal">{sprint.goal || 'No sprint goal set.'}</p>
              <div className="board-date-line">
                <span>{prettyDate(sprint.startDate) || 'Start date not set'}{sprint.endDate ? ` – ${prettyDate(sprint.endDate)}` : ''}</span>
                {remaining !== null && <span>{remaining < 0 ? `${Math.abs(remaining)} days overdue` : remaining === 0 ? 'Ends today' : `${remaining} days left`}</span>}
              </div>
              <div className="progress-row">
                <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
                <span>{donePoints} / {totalPoints} pts done</span>
              </div>
              <div className="board-progress-caption">{board.done?.length || 0} / {flatBoard.length} todos complete</div>
            </div>
            <div className="board-summary-actions">
              <Button startIcon={<AutoAwesomeOutlinedIcon />} onClick={() => window.dispatchEvent(new CustomEvent('kanbot:open-ai', { detail: { action: 'summarize' } }))} variant="outlined">Summarize</Button>
              <Button color="error" onClick={() => { setMoveUnfinishedTo('backlog'); setCompleteOpen(true) }} variant="contained">Complete sprint</Button>
            </div>
          </section>
          <div className="kanban-board">
            {columns.map((column) => {
              const items = board[column.id] || []
              return (
                <section key={column.id} className={`kanban-column column-${column.id}`}>
                  <header className="kanban-column-header">
                    <span><span className={`column-dot ${column.id}`} />{column.label}</span>
                    <span className="kanban-count">{statusCounts[column.id]}</span>
                  </header>
                  <div
                    className="kanban-dropzone"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => onDrop(event, column.id, items.length)}
                  >
                    {items.map((todo, index) => (
                      <div
                        key={todo.id}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => { event.stopPropagation(); onDrop(event, column.id, index) }}
                      >
                        <article
                          className="kanban-card card-surface"
                          draggable
                          onDragStart={(event) => {
                            event.dataTransfer.effectAllowed = 'move'
                            event.dataTransfer.setData('text/plain', todo.id)
                          }}
                          onClick={() => setSelectedTodo(todo)}
                          onKeyDown={(event) => {
                            if (event.target !== event.currentTarget) return
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              setSelectedTodo(todo)
                            }
                          }}
                          tabIndex={0}
                        >
                          <div className="kanban-card-key"><DragIndicatorOutlinedIcon fontSize="small" /><code>{todo.key}</code></div>
                          <strong>{todo.title}</strong>
                          <div className="kanban-card-meta">
                            <span className={`todo-type type-${todo.type}`}>{todo.type}</span>
                            <span className={`todo-priority priority-${todo.priority}`}>{todo.priority}</span>
                            {todo.storyPoints != null && <span className="todo-points">{todo.storyPoints} pts</span>}
                          </div>
                          <Select
                            size="small"
                            value={todo.status}
                            aria-label={`Change ${todo.key} status`}
                            onClick={(event) => event.stopPropagation()}
                            onChange={(event) => moveTodo(todo, event.target.value, board[event.target.value]?.length || 0)}
                          >
                            {columns.map((item) => <MenuItem key={item.id} value={item.id}>{item.label}</MenuItem>)}
                          </Select>
                        </article>
                      </div>
                    ))}
                    {items.length === 0 && <div className="column-empty">Drop a todo here</div>}
                  </div>
                </section>
              )
            })}
          </div>
        </>
      )}

      <Dialog open={completeOpen} onClose={() => !busy && setCompleteOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Complete {sprint?.name}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography><strong>{board.done?.length || 0} todos done</strong>, {unfinishedCount} not finished</Typography>
            <Typography color="text.secondary">{donePoints} of {totalPoints} story points completed.</Typography>
            <Typography variant="subtitle2">Move unfinished todos to:</Typography>
            <Select value={moveUnfinishedTo} onChange={(event) => setMoveUnfinishedTo(event.target.value)} aria-label="Move unfinished todos to">
              <MenuItem value="backlog">Backlog</MenuItem>
              {planned.map((item) => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}
            </Select>
            <FormControlLabel control={<Checkbox checked={generateSummary} onChange={(event) => setGenerateSummary(event.target.checked)} />} label="Generate AI summary after completing" />
            {summaryError && <Alert severity="warning">{summaryError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setCompleteOpen(false)}>Cancel</Button>
          <Button color="error" disabled={busy} onClick={completeSprint} variant="contained">{busy ? 'Completing…' : 'Complete sprint'}</Button>
        </DialogActions>
      </Dialog>

      {selectedTodo && <TodoEditorDialog key={selectedTodo.id} open todo={selectedTodo} sprints={sprints} projectId={projectId}
        onClose={() => setSelectedTodo(null)}
        onSaved={() => { setSelectedTodo(null); loadData() }}
        onDeleted={() => { setSelectedTodo(null); loadData() }}
      />}
      <Snackbar open={Boolean(notice)} autoHideDuration={5000} onClose={() => setNotice('')} message={notice} />
    </div>
  )
}
