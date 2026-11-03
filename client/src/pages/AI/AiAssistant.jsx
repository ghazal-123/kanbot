import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Alert,
  Avatar,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined'
import AddTaskOutlinedIcon from '@mui/icons-material/AddTaskOutlined'
import RestartAltOutlinedIcon from '@mui/icons-material/RestartAltOutlined'
import ReactMarkdown from 'react-markdown'
import { useNavigate } from 'react-router'
import { api, getApiErrorMessage } from '../../api/client'
import { fetchSprints, fetchTodos, publishDataChange } from '../../api/kanbot'

export default function AiAssistant({ open, onClose, projectId, projectName }) {
  const navigate = useNavigate()
  const [status, setStatus] = useState(null)
  const [statusError, setStatusError] = useState('')
  const [messages, setMessages] = useState([])
  const [draftMessage, setDraftMessage] = useState('')
  const [chatBusy, setChatBusy] = useState(false)
  const [chatError, setChatError] = useState('')
  const [retryMessages, setRetryMessages] = useState(null)
  const [dialog, setDialog] = useState('')
  const [prompt, setPrompt] = useState('')
  const [count, setCount] = useState(5)
  const [draftTodos, setDraftTodos] = useState([])
  const [selectedDrafts, setSelectedDrafts] = useState([])
  const [capacity, setCapacity] = useState(20)
  const [focus, setFocus] = useState('')
  const [plan, setPlan] = useState(null)
  const [planTodos, setPlanTodos] = useState([])
  const [selectedPlanIds, setSelectedPlanIds] = useState([])
  const [actionBusy, setActionBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')
  const messageEnd = useRef(null)
  const chatInput = useRef(null)

  useEffect(() => {
    let active = true
    api.get('/ai/status')
      .then(({ data }) => {
        if (active) {
          setStatus(data)
          setStatusError('')
        }
      })
      .catch((error) => {
        if (active) setStatusError(getApiErrorMessage(error, 'Unable to load AI status.'))
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    messageEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, chatBusy])

  async function sendChat(event, overrideMessages) {
    event?.preventDefault()
    const text = overrideMessages?.at(-1)?.content || draftMessage.trim()
    if (!text || chatBusy) return
    const conversation = overrideMessages || [...messages, { role: 'user', content: text }]
    if (conversation.length > 30) {
      setChatError('Start a new chat to continue; a conversation can contain up to 30 messages.')
      return
    }

    setChatBusy(true)
    setChatError('')
    setRetryMessages(null)
    if (!overrideMessages) {
      setMessages(conversation)
      setDraftMessage('')
    }
    try {
      const { data } = await api.post(`/projects/${projectId}/ai/chat`, { messages: conversation })
      setMessages((current) => [...current, data.message])
    } catch (error) {
      setChatError(getApiErrorMessage(error, 'The assistant could not reply.'))
      setRetryMessages(conversation)
    } finally {
      setChatBusy(false)
    }
  }

  function resetChat() {
    setMessages([])
    setDraftMessage('')
    setChatError('')
    setRetryMessages(null)
  }

  async function generateTodos(event) {
    event.preventDefault()
    setActionError('')
    setActionBusy(true)
    try {
      const { data } = await api.post(`/projects/${projectId}/ai/generate-todos`, {
        prompt,
        count: Number(count),
      })
      setDraftTodos(data.todos)
      setSelectedDrafts(data.todos.map((_, index) => index))
    } catch (error) {
      setActionError(getApiErrorMessage(error, 'Unable to generate todos.'))
    } finally {
      setActionBusy(false)
    }
  }

  async function saveGeneratedTodos() {
    const selected = draftTodos.filter((_, index) => selectedDrafts.includes(index))
    if (!selected.length) return
    setActionBusy(true)
    setActionError('')
    try {
      await api.post(`/projects/${projectId}/todos/bulk`, {
        todos: selected.map((todo) => ({
          title: todo.title,
          description: todo.description || '',
          type: todo.type,
          priority: todo.priority,
          storyPoints: todo.storyPoints ?? null,
        })),
      })
      publishDataChange(projectId)
      setNotice(`Added ${selected.length} ${selected.length === 1 ? 'todo' : 'todos'} to the backlog.`)
      setDialog('')
      setDraftTodos([])
      setPrompt('')
    } catch (error) {
      setActionError(getApiErrorMessage(error, 'Unable to save the generated todos.'))
    } finally {
      setActionBusy(false)
    }
  }

  async function suggestPlan(event) {
    event.preventDefault()
    setActionBusy(true)
    setActionError('')
    try {
      const [planResponse, backlog] = await Promise.all([
        api.post(`/projects/${projectId}/ai/plan-sprint`, {
          capacity: Number(capacity),
          ...(focus.trim() ? { focus: focus.trim() } : {}),
        }),
        fetchTodos(projectId, { sprintId: 'backlog' }),
      ])
      const suggested = planResponse.data
      const ids = new Set(suggested.todoIds)
      setPlan(suggested)
      setPlanTodos(backlog.filter((todo) => ids.has(todo.id)))
      setSelectedPlanIds(suggested.todoIds)
    } catch (error) {
      setActionError(getApiErrorMessage(error, 'Unable to suggest a sprint plan.'))
    } finally {
      setActionBusy(false)
    }
  }

  async function createPlannedSprint() {
    if (!plan || !selectedPlanIds.length) return
    setActionBusy(true)
    setActionError('')
    try {
      await api.post(`/projects/${projectId}/sprints`, {
        goal: plan.goal,
        todoIds: selectedPlanIds,
      })
      publishDataChange(projectId)
      setNotice('Your planned sprint is ready.')
      setDialog('')
      navigate(`/projects/${projectId}/backlog`)
    } catch (error) {
      setActionError(getApiErrorMessage(error, 'Unable to create the sprint.'))
    } finally {
      setActionBusy(false)
    }
  }

  const summarizeActiveSprint = useCallback(async () => {
    setActionBusy(true)
    setActionError('')
    try {
      const sprints = await fetchSprints(projectId)
      const active = sprints.find((sprint) => sprint.status === 'active')
      if (!active) {
        setActionError('There is no active sprint to summarize.')
        return
      }
      await api.post(`/sprints/${active.id}/ai/summary`)
      publishDataChange(projectId)
      setNotice(`Summary generated for ${active.name}.`)
      navigate(`/projects/${projectId}/sprints/${active.id}`)
      onClose()
    } catch (error) {
      setActionError(getApiErrorMessage(error, 'Unable to summarize the active sprint.'))
    } finally {
      setActionBusy(false)
    }
  }, [projectId, navigate, onClose])

  useEffect(() => {
    const handleAction = (event) => {
      const action = event.detail?.action
      if (action === 'generate' || action === 'plan') {
        setDialog(action)
        setActionError('')
      }
      if (action === 'summarize') summarizeActiveSprint()
    }
    window.addEventListener('kanbot:open-ai', handleAction)
    return () => window.removeEventListener('kanbot:open-ai', handleAction)
  }, [summarizeActiveSprint])

  function updateGeneratedDraft(index, field, value) {
    setDraftTodos((current) => current.map((todo, itemIndex) => (
      itemIndex === index ? { ...todo, [field]: value } : todo
    )))
  }

  function toggleSelection(ids, setIds, id) {
    setIds((current) => current.includes(id)
      ? current.filter((value) => value !== id)
      : [...current, id])
  }

  return (
    <>
      <Drawer anchor="right" open={open} onClose={onClose} slotProps={{ paper: { className: 'assistant-drawer' } }}>
        <div className="assistant-header">
          <div className="assistant-title">
            <Avatar className="assistant-avatar"><AutoAwesomeOutlinedIcon fontSize="small" /></Avatar>
            <div>
              <Typography fontWeight={700}>Kanbot Assistant</Typography>
              <span>{projectName}</span>
            </div>
          </div>
          <div className="assistant-header-actions">
            {status?.mode === 'mock' && <span className="mock-ai-badge">Mock AI</span>}
            <IconButton onClick={onClose} aria-label="Close assistant"><CloseOutlinedIcon /></IconButton>
          </div>
        </div>
        <div className="assistant-quick-actions">
          <Button size="small" variant="outlined" onClick={() => { setDialog('generate'); setActionError('') }}>Create todos</Button>
          <Button size="small" variant="outlined" onClick={() => { setDialog('plan'); setActionError('') }}>Plan sprint</Button>
          <Button size="small" variant="outlined" onClick={summarizeActiveSprint} disabled={actionBusy}>Summarize sprint</Button>
        </div>
        {statusError && <Alert severity="warning" className="assistant-inline-alert">{statusError}</Alert>}
        {actionError && <Alert severity="error" className="assistant-inline-alert" action={<Button color="inherit" size="small" onClick={() => setActionError('')}>Dismiss</Button>}>{actionError}</Alert>}
        <div className="assistant-messages" aria-live="polite">
          {messages.length === 0 && (
            <div className="assistant-welcome">
              <AutoAwesomeOutlinedIcon color="primary" />
              <strong>What would you like to work on?</strong>
              <span>Ask about {projectName}, your backlog, or active sprint.</span>
            </div>
          )}
          {messages.map((message, index) => (
            <article key={`${index}-${message.role}`} className={`assistant-message ${message.role}`}>
              {message.role === 'assistant' && <Avatar className="assistant-message-avatar">K</Avatar>}
              <div className="assistant-message-body">
                {message.role === 'assistant'
                  ? <ReactMarkdown>{message.content}</ReactMarkdown>
                  : message.content}
              </div>
            </article>
          ))}
          {chatBusy && <div className="assistant-thinking"><CircularProgress size={15} /> Thinking…</div>}
          <div ref={messageEnd} />
        </div>
        {chatError && (
          <Alert severity="error" className="assistant-inline-alert" action={
            retryMessages && <Button color="inherit" size="small" onClick={() => sendChat(null, retryMessages)}>Try again</Button>
          }>
            {chatError}
          </Alert>
        )}
        <form
          className="assistant-compose"
          onSubmit={(event) => sendChat(event)}
          onKeyDownCapture={(event) => {
            if (event.target.matches?.('textarea') && event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              sendChat(event)
            }
          }}
        >
          <TextField
            inputRef={chatInput}
            fullWidth
            multiline
            maxRows={5}
            placeholder="Ask Kanbot…"
            value={draftMessage}
            onChange={(event) => setDraftMessage(event.target.value)}
            slotProps={{
              htmlInput: {
                maxLength: 4000,
                'aria-label': 'Message Kanbot',
              },
            }}
          />
          <Button disabled={!draftMessage.trim() || chatBusy || messages.length >= 30} type="submit" variant="contained">Send</Button>
          <div className="assistant-compose-footer">
            <span>AI can make mistakes. Review before saving.</span>
            <Button size="small" startIcon={<RestartAltOutlinedIcon />} onClick={resetChat} disabled={!messages.length && !draftMessage}>
              New chat
            </Button>
          </div>
        </form>
      </Drawer>

      <Dialog open={dialog === 'generate'} onClose={() => !actionBusy && setDialog('')} fullWidth maxWidth="lg">
        <DialogTitle>Generate todos with AI</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {actionError && <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => generateTodos({ preventDefault() {} })}>Try again</Button>}>{actionError}</Alert>}
            <form className="ai-generate-form" onSubmit={generateTodos}>
              <TextField label="Describe the feature" required multiline minRows={3} value={prompt} onChange={(event) => setPrompt(event.target.value)} slotProps={{ htmlInput: { maxLength: 2000 } }} />
              <TextField label="Number of todos" type="number" value={count} onChange={(event) => setCount(event.target.value)} slotProps={{ htmlInput: { min: 1, max: 10 } }} />
              <Button disabled={actionBusy || prompt.trim().length < 3} type="submit" variant="contained">{actionBusy ? 'Generating…' : 'Generate'}</Button>
            </form>
            {draftTodos.length > 0 && (
              <>
                <Typography variant="subtitle1" fontWeight={700}>Suggested todos ({draftTodos.length})</Typography>
                <div className="ai-draft-list">
                  {draftTodos.map((todo, index) => (
                    <div className="ai-draft-row" key={`${todo.title}-${index}`}>
                      <Checkbox checked={selectedDrafts.includes(index)} onChange={() => toggleSelection(selectedDrafts, setSelectedDrafts, index)} slotProps={{ input: { 'aria-label': `Select ${todo.title}` } }} />
                      <TextField size="small" label="Title" value={todo.title} onChange={(event) => updateGeneratedDraft(index, 'title', event.target.value)} />
                      <TextField select size="small" label="Type" value={todo.type} onChange={(event) => updateGeneratedDraft(index, 'type', event.target.value)}>
                        {['task', 'story', 'bug'].map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
                      </TextField>
                      <TextField select size="small" label="Priority" value={todo.priority} onChange={(event) => updateGeneratedDraft(index, 'priority', event.target.value)}>
                        {['low', 'medium', 'high', 'urgent'].map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
                      </TextField>
                      <TextField select size="small" label="Points" value={todo.storyPoints ?? ''} onChange={(event) => updateGeneratedDraft(index, 'storyPoints', event.target.value ? Number(event.target.value) : null)}>
                        <MenuItem value="">None</MenuItem>
                        {[1, 2, 3, 5, 8, 13].map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
                      </TextField>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between', px: 3, pb: 2 }}>
          <span>{draftTodos.filter((_, index) => selectedDrafts.includes(index)).reduce((sum, todo) => sum + (todo.storyPoints || 0), 0)} points selected</span>
          <Stack direction="row" spacing={1}>
            <Button disabled={actionBusy} onClick={() => setDialog('')}>Cancel</Button>
            {draftTodos.length > 0 && <Button disabled={actionBusy || !selectedDrafts.length} onClick={saveGeneratedTodos} variant="contained" startIcon={<AddTaskOutlinedIcon />}>Add {selectedDrafts.length} to backlog</Button>}
          </Stack>
        </DialogActions>
      </Dialog>

      <Dialog open={dialog === 'plan'} onClose={() => !actionBusy && setDialog('')} fullWidth maxWidth="lg">
        <DialogTitle>Plan a sprint with AI</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {actionError && <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => suggestPlan({ preventDefault() {} })}>Try again</Button>}>{actionError}</Alert>}
            <form className="ai-plan-form" onSubmit={suggestPlan}>
              <TextField label="Capacity (story points)" type="number" required value={capacity} onChange={(event) => setCapacity(event.target.value)} slotProps={{ htmlInput: { min: 1, max: 200 } }} />
              <TextField label="Focus or goal (optional)" value={focus} onChange={(event) => setFocus(event.target.value)} slotProps={{ htmlInput: { maxLength: 300 } }} />
              <Button disabled={actionBusy} type="submit" variant="contained">{actionBusy ? 'Planning…' : 'Suggest plan'}</Button>
            </form>
            {plan && (
              <>
                <TextField label="Suggested sprint goal" value={plan.goal} onChange={(event) => setPlan((current) => ({ ...current, goal: event.target.value }))} slotProps={{ htmlInput: { maxLength: 300 } }} />
                <div className="ai-plan-content">
                  <div className="ai-plan-todos">
                    {planTodos.length === 0 && <Alert severity="info">No backlog todos fit the suggested plan.</Alert>}
                    {planTodos.map((todo) => (
                      <label key={todo.id} className="ai-plan-todo">
                        <Checkbox checked={selectedPlanIds.includes(todo.id)} onChange={() => toggleSelection(selectedPlanIds, setSelectedPlanIds, todo.id)} />
                        <code>{todo.key}</code><span>{todo.title}</span><b>{todo.storyPoints ?? 0} pts</b>
                      </label>
                    ))}
                    <div className="ai-plan-total">
                      Selected total: {planTodos.filter((todo) => selectedPlanIds.includes(todo.id)).reduce((sum, todo) => sum + (todo.storyPoints || 0), 0)} / {capacity} pts
                    </div>
                  </div>
                  <div className="ai-plan-reasoning"><strong>Why this plan?</strong><p>{plan.reasoning}</p></div>
                </div>
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between', px: 3, pb: 2 }}>
          <span>AI can make mistakes. Review before saving.</span>
          <Stack direction="row" spacing={1}>
            <Button disabled={actionBusy} onClick={() => setDialog('')}>Cancel</Button>
            {plan && <Button disabled={actionBusy || !selectedPlanIds.length} onClick={createPlannedSprint} variant="contained">Create sprint with {selectedPlanIds.length} todos</Button>}
          </Stack>
        </DialogActions>
      </Dialog>

      {notice && <div className="assistant-notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss">×</button></div>}
    </>
  )
}
