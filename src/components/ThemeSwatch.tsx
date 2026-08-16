interface ThemeSwatchProps {
  ink: string
  paper: string
  className?: string
}

// A small square split diagonally between a theme's two colors — used
// anywhere a theme needs a visual preview (the menu picker, the overworld's
// unlock badge) without switching the whole app to it.
export default function ThemeSwatch({ ink, paper, className }: ThemeSwatchProps) {
  return (
    <span
      className={className ? `theme-swatch ${className}` : 'theme-swatch'}
      style={{ background: `linear-gradient(135deg, ${paper} 0 50%, ${ink} 50% 100%)` }}
      aria-hidden="true"
    />
  )
}
