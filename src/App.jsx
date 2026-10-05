import React, { useState, useEffect } from 'react'
import scheduleData from './data/schedule.json'

const CALENDAR_URL = import.meta.env.VITE_CALENDAR_URL

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

  const [tutorias, setTutorias] = useState([])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    document.documentElement.style.colorScheme = theme
    try {
      localStorage.setItem('theme', theme)
    } catch {}
  }, [theme])

  useEffect(() => {
    if (!CALENDAR_URL) return

    fetch(CALENDAR_URL)
      .then(res => res.json())
      .then(data => {
        if (!Array.isArray(data)) return

        const hoy = new Date()
        // Hoy a las 00:00:00 (los días anteriores de la semana ya no aparecen)
        const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 0, 0, 0)

        // Fin de la semana actual (Domingo a las 23:59:59)
        const diaSemana = hoy.getDay() // 0 = Domingo
        const diasHastaFin = diaSemana === 0 ? 0 : 7 - diaSemana
        const finSemana = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + diasHastaFin, 23, 59, 59, 999)

        // Filtrar: Comienza con Tutoría/Tutoria, desde hoy en adelante y solo semana actual
        const filtradas = data.filter(ev => {
          const titulo = (ev.titulo || ev.title || '').trim()
          if (!/^tutor[íi]a/i.test(titulo)) return false

          const fechaInicio = new Date(ev.inicio || ev.startTime)
          return fechaInicio >= inicioHoy && fechaInicio <= finSemana
        })

        setTutorias(filtradas)
      })
      .catch(() => {})
  }, [])

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'))
  }

  // Comprobar si hay una tutoría para una celda vacía (por día y rango de hora)
  const getTutoriaForSlot = (rowTime, cellIdx) => {
    if (!tutorias.length) return null

    const horaInicioFila = parseInt(rowTime.split(':')[0], 10)

    return tutorias.find(ev => {
      const d = new Date(ev.inicio || ev.startTime)
      const diaCol = d.getDay() - 1 // 0 = Lunes, 1 = Martes, etc.
      if (diaCol !== cellIdx) return false

      const horaEvento = d.getHours()
      return horaEvento >= horaInicioFila && horaEvento < horaInicioFila + 2
    })
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
                      const prevRow = rowIdx > 0 ? scheduleData.rows[rowIdx - 1] : null
                      const parentSpannedCell =
                        prevRow && prevRow.cells[cellIdx] && prevRow.cells[cellIdx].rowSpan === 2
                          ? prevRow.cells[cellIdx]
                          : null

                      // Manejo del bloque inferior (que originalmente era 'SPANNED')
                      if (cell === 'SPANNED') {
                        if (!parentSpannedCell) return null

                        const tutoriaPrev = getTutoriaForSlot(prevRow.time, cellIdx)
                        const tutoriaCurrent = getTutoriaForSlot(row.time, cellIdx)

                        // Si ninguno de los dos bloques tiene tutoría, se mantiene el rowSpan original
                        if (!tutoriaPrev && !tutoriaCurrent) {
                          return null
                        }

                        // Si hay tutoría en este segundo bloque
                        if (tutoriaCurrent) {
                          return (
                            <td key={cellIdx} className="sched-td-class sched-td-dual" rowSpan={1}>
                              <div className="sched-dual-wrapper">
                                <div className={`sched-dual-item sched-type-${parentSpannedCell.type || 'default'}`}>
                                  <span className="sched-class-title">{parentSpannedCell.text}</span>
                                </div>
                                <div className="sched-dual-item sched-type-tutoria">
                                  <span className="sched-class-title">{tutoriaCurrent.titulo || tutoriaCurrent.title}</span>
                                </div>
                              </div>
                            </td>
                          )
                        }

                        // Si la tutoría estuvo solo en el primer bloque, este segundo bloque muestra la materia normal
                        return (
                          <td
                            key={cellIdx}
                            className={`sched-td-class sched-type-${parentSpannedCell.type || 'default'}`}
                            rowSpan={1}
                          >
                            <div className="sched-class-box">
                              <span className="sched-class-title">{parentSpannedCell.text}</span>
                            </div>
                          </td>
                        )
                      }

                      // Para celdas normales o que inician con rowSpan: 2
                      const nextRow = rowIdx < scheduleData.rows.length - 1 ? scheduleData.rows[rowIdx + 1] : null
                      const hasSpannedChild = cell && cell.rowSpan === 2 && nextRow && nextRow.cells[cellIdx] === 'SPANNED'

                      const tutoria = getTutoriaForSlot(row.time, cellIdx)
                      const tutoriaNext = hasSpannedChild ? getTutoriaForSlot(nextRow.time, cellIdx) : null

                      // Si tiene rowSpan: 2 y solo uno de los dos bloques tiene tutoría, se desdobla a 1 bloque
                      const shouldUnspan = hasSpannedChild && (tutoria || tutoriaNext)
                      const effectiveRowSpan = shouldUnspan ? 1 : (cell?.rowSpan || 1)

                      // Si coinciden clase y tutoría en la misma hora (choque)
                      if (cell && tutoria) {
                        return (
                          <td
                            key={cellIdx}
                            className={`sched-td-class sched-td-dual ${
                              effectiveRowSpan === 2 ? 'sched-rowspan-2' : ''
                            }`}
                            rowSpan={effectiveRowSpan}
                          >
                            <div className="sched-dual-wrapper">
                              <div className={`sched-dual-item sched-type-${cell.type || 'default'}`}>
                                <span className="sched-class-title">{cell.text}</span>
                                {cell.timeNote && (
                                  <span className="sched-class-timenote">{cell.timeNote}</span>
                                )}
                              </div>
                              <div className="sched-dual-item sched-type-tutoria">
                                <span className="sched-class-title">{tutoria.titulo || tutoria.title}</span>
                              </div>
                            </div>
                          </td>
                        )
                      }

                      // Si solo hay tutoría (la celda estaba libre)
                      if (tutoria) {
                        return (
                          <td key={cellIdx} className="sched-td-class sched-type-tutoria">
                            <div className="sched-class-box">
                              <span className="sched-class-title">{tutoria.titulo || tutoria.title}</span>
                            </div>
                          </td>
                        )
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
                            effectiveRowSpan === 2 ? 'sched-rowspan-2' : ''
                          }`}
                          rowSpan={effectiveRowSpan}
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
