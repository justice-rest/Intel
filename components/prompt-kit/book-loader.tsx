"use client"

import "./book-loader.css"

interface BookLoaderProps {
  className?: string
}

export function BookLoader({ className }: BookLoaderProps) {
  return (
    <div className={`book-loader ${className || ""}`}>
      <div className="inner">
        <div className="left" />
        <div className="middle" />
        <div className="right" />
      </div>
      <ul>
        {Array.from({ length: 18 }, (_, i) => (
          <li key={i} />
        ))}
      </ul>
    </div>
  )
}
