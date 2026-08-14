const NBSP = ' '

interface WiggleProps {
  children: string
  className?: string
}

// Splits text into one span per letter, each with a staggered animation
// delay, so the CSS wiggle keyframe (letter-wiggle in App.css) reads as a
// loose organic wave passing through the word rather than the whole label
// bobbing as one rigid block. Spaces render as non-breaking so they don't
// collapse to zero width as flex items.
export default function Wiggle({ children, className }: WiggleProps) {
  return (
    <span className={className ? `wiggle ${className}` : 'wiggle'}>
      {[...children].map((char, i) => (
        <span key={i} className="wiggle-letter" style={{ animationDelay: `${(i % 7) * 0.11}s` }}>
          {char === ' ' ? NBSP : char}
        </span>
      ))}
    </span>
  )
}
