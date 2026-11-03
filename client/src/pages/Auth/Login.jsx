import { useState } from 'react'
import { Alert, Button, CircularProgress, TextField } from '@mui/material'
import { Link } from 'react-router'
import { z } from 'zod'
import AuthFrame from '../../components/AuthFrame'
import { getApiErrorMessage, getApiFieldErrors } from '../../api/client'
import useAuth from '../../context/useAuth'

const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
})

export default function Login() {
  const { login, sessionExpired, authError } = useAuth()
  const [values, setValues] = useState({ email: '', password: '' })
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setFieldErrors({})
    setFormError('')
    const parsed = loginSchema.safeParse(values)
    if (!parsed.success) {
      setFieldErrors(Object.fromEntries(parsed.error.issues.map((issue) => [issue.path[0], issue.message])))
      return
    }

    setIsSubmitting(true)
    try {
      await login(parsed.data)
    } catch (error) {
      setFieldErrors(getApiFieldErrors(error))
      setFormError(getApiErrorMessage(error, 'Unable to log in. Please try again.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  function updateField(event) {
    const { name, value } = event.target
    setValues((current) => ({ ...current, [name]: value }))
    setFieldErrors((current) => ({ ...current, [name]: undefined }))
    setFormError('')
  }

  return (
    <AuthFrame heading="Welcome back" subtitle="Log in to continue to your workspace.">
      {sessionExpired && <Alert severity="warning" className="auth-alert">Your session has expired. Please log in again.</Alert>}
      {!sessionExpired && authError && <Alert severity="error" className="auth-alert">{authError}</Alert>}
      {formError && <Alert severity="error" className="auth-alert">{formError}</Alert>}
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <TextField autoComplete="email" autoFocus error={Boolean(fieldErrors.email)} fullWidth helperText={fieldErrors.email} id="login-email" label="Email" name="email" onChange={updateField} required type="email" value={values.email} />
        <TextField autoComplete="current-password" error={Boolean(fieldErrors.password)} fullWidth helperText={fieldErrors.password} id="login-password" label="Password" name="password" onChange={updateField} required type="password" value={values.password} />
        <Button className="auth-submit active:scale-95" disabled={isSubmitting} fullWidth type="submit" variant="contained">
          {isSubmitting ? <CircularProgress size={21} color="inherit" /> : 'Log in'}
        </Button>
      </form>
      <p className="auth-switch">No account? <Link to="/register">Create one</Link></p>
    </AuthFrame>
  )
}
