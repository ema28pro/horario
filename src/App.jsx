import React, { useState, useEffect } from 'react'
import scheduleData from './data/schedule.json'

export default function App() {
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('theme')
      if (saved) return saved
      return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
    } catch {
      return 'dark'
    }
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    document.documentElement.style.colorScheme = theme
    try {
      localStorage.setItem('theme', theme)
    } catch {}
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark')
  }

  return (
    <div className="sched-page">
      <div className="sched-container">
        
        {/* Top bar with back to portfolio link & theme toggle */}
        <div className="sched-top-bar">
          <a 
            href="https://ema28pro.github.io/" 
            className="sched-back-btn"
            title="Ir al portafolio principal"
          >
            <span className="material-symbols-outlined">arrow_back</span>
            Portafolio
          </a>

          <button 
            className="sched-theme-btn"
            onClick={toggleTheme}
            aria-label="Cambiar tema"
            title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
          >
            <span className="material-symbols-outlined">
              {theme === 'dark' ? 'light_mode' : 'dark_mode'}
            </span>
          </button>
        </div>

        {/* Schedule Card */}
        <div className="sched-card">
          <div className="sched-card-header">
            <h1 className="sched-title">{scheduleData.title}</h1>
            {scheduleData.subtitle && (
              <span className="sched-subtitle">{scheduleData.subtitle}</span>
            )}
          </div>

          <div className="sched-table-wrapper">
            <table className="sched-table">
              <thead>
                <tr className="sched-header-row">
                  {scheduleData.columns.map((col, idx) => (
                    <th key={idx} className={`sched-th ${idx === 0 ? 'sched-th-time' : ''}`}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {scheduleData.rows.map((row, rowIdx) => (
                  <tr key={rowIdx}>
                    <td className="sched-td-time">{row.time}</td>
                    {row.cells.map((cell, cellIdx) => {
                      if (cell === 'SPANNED') {
                        return null
                      }
                      if (!cell) {
                        return (
                          <td key={cellIdx} className="sched-td-free">
                            <span className="sched-free-dot" />
                          </td>
                        )
                      }
                      return (
                        <td
                          key={cellIdx}
                          className={`sched-td-class sched-type-${cell.type || 'default'} ${
                            cell.rowSpan === 2 ? 'sched-rowspan-2' : ''
                          }`}
                          rowSpan={cell.rowSpan || 1}
                        >
                          <div className="sched-class-box">
                            <span className="sched-class-title">{cell.text}</span>
                            {cell.timeNote && (
                              <span className="sched-class-timenote">{cell.timeNote}</span>
                            )}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  )
}
