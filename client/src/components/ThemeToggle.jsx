import { IconButton } from '@mui/material'
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined'
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined'
import useThemeMode from '../context/useThemeMode'

export default function ThemeToggle() {
  const { mode, toggleMode } = useThemeMode()
  const Icon = mode === 'dark' ? LightModeOutlinedIcon : DarkModeOutlinedIcon
  return (
    <IconButton
      aria-label={`Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`}
      onClick={toggleMode}
      className="theme-toggle"
      size="small"
    >
      <Icon fontSize="small" />
    </IconButton>
  )
}
