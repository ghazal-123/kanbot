import { Typography } from '@mui/material'
import useThemeMode from '../context/useThemeMode'
import ThemeToggle from './ThemeToggle'

export default function AuthFrame({ children, heading, subtitle }) {
  const { mode } = useThemeMode()
  const logo = mode === 'dark'
    ? '/assets/images/kanbot-logo-dark.svg'
    : '/assets/images/kanbot-logo.svg'

  return (
    <main className="auth-page min-h-screen bg-slate-50 px-4 py-8 text-slate-900 transition-colors duration-300 dark:bg-[#0B1329] dark:text-white sm:px-6">
      <div className="auth-topbar">
        <span className="auth-topbar-note">Your sprint board with an AI teammate</span>
        <ThemeToggle />
      </div>
      <section className="auth-card w-full max-w-md rounded-2xl bg-white p-6 shadow-xl transition-all duration-300 dark:bg-slate-900 sm:p-9">
        <div className="auth-brand">
          <img className="auth-logo" src={logo} alt="Kanbot" />
        </div>
        <div className="auth-heading">
          <Typography component="h1" variant="h4" fontWeight={700} letterSpacing="-0.04em">
            {heading}
          </Typography>
          <Typography color="text.secondary">{subtitle}</Typography>
        </div>
        {children}
        <p className="auth-footer">Plan clearly. Ship steadily.</p>
      </section>
    </main>
  )
}
