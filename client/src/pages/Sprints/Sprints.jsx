import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Button,
  CircularProgress,
  Typography,
} from '@mui/material'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import ReactMarkdown from 'react-markdown'
import { api, getApiErrorMessage } from '../../api/client'
import { fetchSprintBoard, fetchSprints, publishDataChange, useProjectRefresh } from '../../api/kanbot'

function formatDate(date) {
  if (!date) return 'Date not set'
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${date}T00:00:00`))
}

export default function Sprints() {
  const { projectId, sprintId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [sprints, setSprints] = useState([])
  const [selectedSprint, setSelectedSprint] = useState(null)
  const [todos, setTodos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [summaryBusy, setSummaryBusy] = useState(false)
  const [notice, setNotice] = useState('')

  const loadData = useCallback(async () => {
    try {
      const sprintList = await fetchSprints(projectId)
      setError('')
      setSprints(sprintList)
      if (sprintId) {
        const [board, sprintResponse] = await Promise.all([
          fetchSprintBoard(sprintId),
          api.get(`/sprints/${sprintId}`),
        ])
        setSelectedSprint(sprintResponse.data.sprint)
        setTodos(Object.values(board.columns).flat().sort((a, b) => a.order - b.order))
      } else {
        setSelectedSprint(null)
        setTodos([])
      }
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Unable to load sprint history.'))
    } finally {
      setLoading(false)
    }
  }, [projectId, sprintId])

  useEffect(() => {
    let active = true
    fetchSprints(projectId)
      .then((items) => {
        if (active) {
          setError('')
          setSprints(items)
        }
        if (!active || !sprintId) {
          if (active) {
            setSelectedSprint(null)
            setTodos([])
          }
          return null
        }
        return Promise.all([
          fetchSprintBoard(sprintId),
          api.get(`/sprints/${sprintId}`),
        ])
      })
      .then((results) => {
        if (active && results) {
          const [board, sprintResponse] = results
          setSelectedSprint(sprintResponse.data.sprint)
          setTodos(Object.values(board.columns).flat().sort((a, b) => a.order - b.order))
        }
      })
      .catch((requestError) => {
        if (active) setError(getApiErrorMessage(requestError, 'Unable to load sprint history.'))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [projectId, sprintId])
  useProjectRefresh(projectId, loadData)

  async function generateSummary() {
    if (!selectedSprint) return
    setSummaryBusy(true)
    setError('')
    try {
      const { data } = await api.post(`/sprints/${selectedSprint.id}/ai/summary`)
      setSelectedSprint(data.sprint)
      setNotice('Sprint summary updated.')
      publishDataChange(projectId)
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Unable to generate the sprint summary.'))
    } finally {
      setSummaryBusy(false)
    }
  }

  const stats = selectedSprint?.status === 'completed' && selectedSprint.completedStats
    ? selectedSprint.completedStats
    : selectedSprint?.stats
  const completion = stats?.totalTodos
    ? Math.round((stats.doneTodos / stats.totalTodos) * 100)
    : 0

  return (
    <div className="app-content sprints-page">
      {location.state?.summaryError && <Alert severity="warning">{location.state.summaryError}</Alert>}
      {error && <Alert severity="error" action={
        selectedSprint && selectedSprint.status !== 'planned'
          ? <Button color="inherit" size="small" onClick={generateSummary}>Try again</Button>
          : <Button color="inherit" size="small" onClick={loadData}>Try again</Button>
      }>{error}</Alert>}
      {loading ? <div className="page-loading"><CircularProgress /><span>Loading sprints…</span></div> : (
        <div className={`sprints-layout ${selectedSprint ? 'with-details' : ''}`}>
          <section className="sprint-history-list">
            <div className="page-heading-row">
              <div><span className="page-eyebrow">PROJECT TIMELINE</span><Typography component="h2" variant="h4" fontWeight={700}>Sprints</Typography></div>
              <span className="history-count">{sprints.length} total</span>
            </div>
            {sprints.length === 0 ? (
              <div className="empty-state card-surface compact">
                <Typography variant="h6" fontWeight={700}>No sprints yet</Typography>
                <Typography color="text.secondary">Create a planned sprint from the backlog to get started.</Typography>
                <Button component={Link} to={`/projects/${projectId}/backlog`} variant="contained">Open backlog</Button>
              </div>
            ) : (
              <div className="sprint-history-cards">
                {sprints.map((sprint) => (
                  <button
                    className={`sprint-history-card card-surface ${selectedSprint?.id === sprint.id ? 'selected' : ''}`}
                    key={sprint.id}
                    onClick={() => navigate(`/projects/${projectId}/sprints/${sprint.id}`)}
                  >
                    <div className="sprint-history-card-top">
                      <strong>{sprint.name}</strong>
                      <span className={`sprint-status-chip ${sprint.status}`}>{sprint.status}</span>
                    </div>
                    <span className="sprint-history-date">{formatDate(sprint.startDate)}{sprint.endDate ? ` – ${formatDate(sprint.endDate)}` : ''}</span>
                    <span className="sprint-history-goal">{sprint.goal || 'No goal set'}</span>
                    <span className="sprint-history-points">{sprint.stats.donePoints} / {sprint.stats.totalPoints} pts · {sprint.stats.doneTodos}/{sprint.stats.totalTodos} todos</span>
                  </button>
                ))}
              </div>
            )}
          </section>

          {selectedSprint && (
            <section className="sprint-detail-panel card-surface">
              <header className="sprint-detail-header">
                <div>
                  <div className="sprint-detail-title">
                    <Typography component="h3" variant="h5" fontWeight={700}>{selectedSprint.name}</Typography>
                    <span className={`sprint-status-chip ${selectedSprint.status}`}>{selectedSprint.status}</span>
                  </div>
                  <Typography color="text.secondary">{formatDate(selectedSprint.startDate)}{selectedSprint.endDate ? ` – ${formatDate(selectedSprint.endDate)}` : ''}</Typography>
                  <Typography color="text.secondary" sx={{ mt: 0.5 }}>{selectedSprint.goal || 'No sprint goal set.'}</Typography>
                </div>
                <Button component={Link} to={`/projects/${projectId}/sprints`} variant="outlined">Close</Button>
              </header>
              <div className="sprint-stats-grid">
                <div><span>Completed todos</span><strong>{stats?.doneTodos || 0}</strong></div>
                <div><span>Points done</span><strong>{stats?.donePoints || 0} / {stats?.totalPoints || 0}</strong></div>
                <div><span>Carried over</span><strong>{selectedSprint.completedStats?.carriedOver ?? '—'}</strong></div>
                <div><span>Completion</span><strong>{completion}%</strong></div>
              </div>
              <section className="sprint-detail-todos">
                <Typography variant="h6" fontWeight={700}>Sprint todos ({todos.length})</Typography>
                {todos.length === 0 ? <Typography color="text.secondary">No todos were assigned to this sprint.</Typography> : (
                  <ul>
                    {todos.map((todo) => (
                      <li key={todo.id} className={todo.status === 'done' ? 'completed' : ''}>
                        <span className={`column-dot ${todo.status}`} />
                        <code>{todo.key}</code><span>{todo.title}</span>
                        <span className={`todo-priority priority-${todo.priority}`}>{todo.priority}</span>
                        {todo.storyPoints != null && <span className="todo-points">{todo.storyPoints} pts</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              {selectedSprint.status !== 'planned' && (
                <section className="sprint-summary-card">
                  <header>
                    <div><AutoAwesomeOutlinedIcon color="success" /><Typography variant="h6" fontWeight={700}>AI summary</Typography></div>
                    <Button disabled={summaryBusy} onClick={generateSummary} variant="outlined">
                      {summaryBusy ? 'Generating…' : selectedSprint.summary ? 'Regenerate' : 'Summarize'}
                    </Button>
                  </header>
                  {selectedSprint.summary ? (
                    <>
                      <div className="markdown-content"><ReactMarkdown>{selectedSprint.summary.content}</ReactMarkdown></div>
                      <span className="summary-generated">Generated {formatDate(selectedSprint.summary.generatedAt.slice(0, 10))} · AI can make mistakes.</span>
                    </>
                  ) : <p className="summary-placeholder">Generate a summary of highlights, unfinished work, and suggestions for next time.</p>}
                </section>
              )}
            </section>
          )}
        </div>
      )}
      {notice && <div className="assistant-notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss">×</button></div>}
    </div>
  )
}
