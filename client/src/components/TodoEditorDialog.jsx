import { useState } from 'react'
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
} from '@mui/material'
import { z } from 'zod'
import { api, getApiErrorMessage, getApiFieldErrors } from '../api/client'

const todoSchema = z.object({
  title: z.string().trim().min(1, 'Enter a title.').max(200),
  description: z.string().max(5000),
  type: z.enum(['task', 'story', 'bug']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  status: z.enum(['todo', 'in_progress', 'in_review', 'done']),
  storyPoints: z.union([z.literal(''), z.enum(['1', '2', '3', '5', '8', '13'])]),
  labelsText: z.string(),
  dueDate: z.string(),
  sprintId: z.string(),
}).superRefine((value, context) => {
  const labels = value.labelsText.split(',').map((label) => label.trim()).filter(Boolean)
  if (labels.length > 10) context.addIssue({ code: 'custom', path: ['labelsText'], message: 'Use no more than 10 labels.' })
  if (labels.some((label) => label.length > 30)) context.addIssue({ code: 'custom', path: ['labelsText'], message: 'Each label must be 30 characters or fewer.' })
})

const emptyValues = {
  title: '',
  description: '',
  type: 'task',
  priority: 'medium',
  status: 'todo',
  storyPoints: '',
  labelsText: '',
  dueDate: '',
  sprintId: '',
}

function getTodoValues(todo) {
  if (!todo) return emptyValues
  return {
    title: todo.title,
    description: todo.description || '',
    type: todo.type,
    priority: todo.priority,
    status: todo.status,
    storyPoints: todo.storyPoints == null ? '' : String(todo.storyPoints),
    labelsText: (todo.labels || []).join(', '),
    dueDate: todo.dueDate || '',
    sprintId: todo.sprintId || '',
  }
}

export default function TodoEditorDialog({
  open,
  todo,
  sprints,
  projectId,
  onClose,
  onSaved,
  onDeleted,
}) {
  const [initialValues] = useState(() => getTodoValues(todo))
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState({})
  const [requestError, setRequestError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const isDirty = JSON.stringify(values) !== JSON.stringify(initialValues)

  function requestClose() {
    if (busy) return
    if (isDirty) setConfirmDiscard(true)
    else onClose()
  }

  function change(event) {
    const { name, value } = event.target
    setValues((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: undefined }))
  }

  async function save(event) {
    event.preventDefault()
    setErrors({})
    setRequestError('')
    const parsed = todoSchema.safeParse(values)
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((issue) => [issue.path[0], issue.message])))
      return
    }

    const labels = parsed.data.labelsText.split(',').map((label) => label.trim()).filter(Boolean)
    const payload = {
      title: parsed.data.title,
      description: parsed.data.description,
      type: parsed.data.type,
      priority: parsed.data.priority,
      status: parsed.data.status,
      storyPoints: parsed.data.storyPoints === '' ? null : Number(parsed.data.storyPoints),
      labels,
      dueDate: parsed.data.dueDate || null,
      sprintId: parsed.data.sprintId || null,
    }

    setBusy(true)
    try {
      const { data } = todo
        ? await api.patch(`/todos/${todo.id}`, payload)
        : await api.post(`/projects/${projectId}/todos`, payload)
      onSaved(data.todo)
      onClose()
    } catch (error) {
      setErrors(getApiFieldErrors(error))
      setRequestError(getApiErrorMessage(error, 'Unable to save this todo.'))
    } finally {
      setBusy(false)
    }
  }

  async function removeTodo() {
    if (!todo) return
    setBusy(true)
    setRequestError('')
    try {
      await api.delete(`/todos/${todo.id}`)
      onDeleted(todo.id)
      setConfirmDelete(false)
      onClose()
    } catch (error) {
      setRequestError(getApiErrorMessage(error, 'Unable to delete this todo.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Dialog open={open} onClose={requestClose} fullWidth maxWidth="md">
        <form onSubmit={save} noValidate>
          <DialogTitle>{todo ? `Edit ${todo.key}` : 'Create a todo'}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              {requestError && <Alert severity="error">{requestError}</Alert>}
              <TextField autoFocus required label="Title" name="title" value={values.title} onChange={change} error={Boolean(errors.title)} helperText={errors.title} />
              <TextField label="Description" name="description" value={values.description} onChange={change} multiline minRows={4} error={Boolean(errors.description)} helperText={errors.description} />
              <div className="todo-edit-grid">
                <TextField select label="Type" name="type" value={values.type} onChange={change}>
                  {['task', 'story', 'bug'].map((type) => <MenuItem key={type} value={type}>{type}</MenuItem>)}
                </TextField>
                <TextField select label="Priority" name="priority" value={values.priority} onChange={change}>
                  {['low', 'medium', 'high', 'urgent'].map((priority) => <MenuItem key={priority} value={priority}>{priority}</MenuItem>)}
                </TextField>
                <TextField select label="Status" name="status" value={values.status} onChange={change}>
                  {[['todo', 'To Do'], ['in_progress', 'In Progress'], ['in_review', 'In Review'], ['done', 'Done']].map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
                </TextField>
                <TextField select label="Story points" name="storyPoints" value={values.storyPoints} onChange={change} error={Boolean(errors.storyPoints)} helperText={errors.storyPoints}>
                  <MenuItem value="">Not estimated</MenuItem>
                  {[1, 2, 3, 5, 8, 13].map((points) => <MenuItem key={points} value={String(points)}>{points}</MenuItem>)}
                </TextField>
                <TextField label="Labels" name="labelsText" value={values.labelsText} onChange={change} placeholder="frontend, urgent" error={Boolean(errors.labelsText)} helperText={errors.labelsText || 'Separate labels with commas (up to 10).'} />
                <TextField label="Due date" name="dueDate" type="date" value={values.dueDate} onChange={change} slotProps={{ inputLabel: { shrink: true } }} error={Boolean(errors.dueDate)} helperText={errors.dueDate} />
                <TextField select label="Sprint" name="sprintId" value={values.sprintId} onChange={change} error={Boolean(errors.sprintId)} helperText={errors.sprintId}>
                  <MenuItem value="">Backlog</MenuItem>
                  {sprints.filter((sprint) => sprint.status !== 'completed').map((sprint) => <MenuItem key={sprint.id} value={sprint.id}>{sprint.name} ({sprint.status})</MenuItem>)}
                </TextField>
              </div>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ justifyContent: 'space-between', px: 3, pb: 2 }}>
            <span>{todo && <Button color="error" disabled={busy} onClick={() => setConfirmDelete(true)}>Delete</Button>}</span>
            <Stack direction="row" spacing={1}>
              <Button disabled={busy} onClick={requestClose}>Cancel</Button>
              <Button disabled={busy} type="submit" variant="contained">{busy ? 'Saving…' : 'Save'}</Button>
            </Stack>
          </DialogActions>
        </form>
      </Dialog>
      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete {todo?.key}?</DialogTitle>
        <DialogContent>This todo will be permanently deleted.</DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setConfirmDelete(false)}>Cancel</Button>
          <Button color="error" disabled={busy} onClick={removeTodo} variant="contained">Delete todo</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={confirmDiscard} onClose={() => setConfirmDiscard(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Discard changes?</DialogTitle>
        <DialogContent>Your edits have not been saved. Do you want to close without saving?</DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDiscard(false)}>Keep editing</Button>
          <Button color="error" onClick={onClose}>Discard changes</Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
