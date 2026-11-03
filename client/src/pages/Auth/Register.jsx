import { useState } from 'react'
import { Alert, Button, CircularProgress, TextField } from '@mui/material'
import { Link } from 'react-router'
import { z } from 'zod'
import AuthFrame from '../../components/AuthFrame'
import { getApiErrorMessage, getApiFieldErrors } from '../../api/client'
import useAuth from '../../context/useAuth'

const registerSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name.').max(80),
  email: z.string().trim().email('Enter a valid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.').max(200),
  confirmPassword: z.string().min(1, 'Confirm your password.'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match.',
  path: ['confirmPassword'],
})

export default function Register() {
  const { register } = useAuth()
  const [values, setValues] = useState({ name: '', email: '', password: '', confirmPassword: '' })
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setFieldErrors({})
    setFormError('')
    const parsed = registerSchema.safeParse(values)
    if (!parsed.success) {
      setFieldErrors(Object.fromEntries(parsed.error.issues.map((issue) => [issue.path[0], issue.message])))
      return
    }

    setIsSubmitting(true)
    try {
      const payload = {
        name: parsed.data.name,
        email: parsed.data.email,
        password: parsed.data.password,
      }
      await register(payload)
    } catch (error) {
      const errors = getApiFieldErrors(error)
      if (error?.response?.status === 409 && !errors.email) {
        errors.email = 'An account with this email already exists.'
      }
      setFieldErrors(errors)
      if (!errors.email && !errors.name && !errors.password) {
        setFormError(getApiErrorMessage(error, 'Unable to create your account. Please try again.'))
      }
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
    <AuthFrame heading="Create your account" subtitle="Start planning your next sprint.">
      {formError && <Alert severity="error" className="auth-alert">{formError}</Alert>}
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <TextField autoComplete="name" autoFocus error={Boolean(fieldErrors.name)} fullWidth helperText={fieldErrors.name} id="register-name" label="Name" name="name" onChange={updateField} required value={values.name} />
        <TextField autoComplete="email" error={Boolean(fieldErrors.email)} fullWidth helperText={fieldErrors.email} id="register-email" label="Email" name="email" onChange={updateField} required type="email" value={values.email} />
        <TextField autoComplete="new-password" error={Boolean(fieldErrors.password)} fullWidth helperText={fieldErrors.password || 'Use at least 8 characters.'} id="register-password" label="Password" name="password" onChange={updateField} required type="password" value={values.password} />
        <TextField autoComplete="new-password" error={Boolean(fieldErrors.confirmPassword)} fullWidth helperText={fieldErrors.confirmPassword} id="register-confirm-password" label="Confirm password" name="confirmPassword" onChange={updateField} required type="password" value={values.confirmPassword} />
        <Button className="auth-submit active:scale-95" disabled={isSubmitting} fullWidth type="submit" variant="contained">
          {isSubmitting ? <CircularProgress size={21} color="inherit" /> : 'Create account'}
        </Button>
      </form>
      <p className="auth-switch">Already have an account? <Link to="/login">Log in</Link></p>
    </AuthFrame>
  )
}
