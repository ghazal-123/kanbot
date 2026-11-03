import { useContext } from 'react'
import ThemeContext from './ThemeContextValue'

export default function useThemeMode() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useThemeMode must be used within a ThemeModeProvider.')
  return context
}
