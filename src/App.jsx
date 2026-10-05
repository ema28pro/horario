import { memo, useEffect, useState } from 'react'
import scheduleData from './data/schedule.json'

const CALENDAR_URL = import.meta.env.VITE_CALENDAR_URL
const THEME_KEY = 'theme'
const SPANNED = 'SPANNED'
const ES_TUTORIA = /^tutor[íi]a/i

const { columns, rows, subtitle, title } = scheduleData

// Hora inicial de cada fila (los bloques son de 2 h), precalculada para no
// reparsear `row.time` en cada celda.
const HORAS = rows.map(({ time }) => Number(time.split(':')[0]))

const cx = (...clases) => clases.filter(Boolean).join(' ')

/** Rango [hoy 00:00:00, domingo 23:59:59] de la semana en curso, en ms. */
function rangoSemanaActual() {
  const hoy = new Date()
  const [anio, mes, dia] = [hoy.getFullYear(), hoy.getMonth(), hoy.getDate()]
  const hastaDomingo = hoy.getDay() === 0 ? 0 : 7 - hoy.getDay()

  return [
    new Date(anio, mes, dia).getTime(),
    new Date(anio, mes, dia + hastaDomingo, 23, 59, 59, 999).getTime(),
  ]
}

/**
 * Descarga las tutorías de Google Calendar una sola vez y las indexa por
 * `columna:hora` (0 = Lunes ... 6 = Sábado), así cada celda resuelve su
 * bloque con una consulta al Map en vez de recorrer todos los eventos.
 */
function useIndiceTutorias() {
  const [indice, setIndice] = useState(() => new Map())

  useEffect(() => {
    if (!CALENDAR_URL) return

    const controller = new AbortController()

    fetch(CALENDAR_URL, { signal: controller.signal })
      .then(res => res.json())
      .then(data => {
        // El script de Google devuelve { error } si algo falla.
        if (!Array.isArray(data)) return

        const [desde, hasta] = rangoSemanaActual()
        const nuevos = new Map()

        for (const ev of data) {
          if (!ES_TUTORIA.test((ev.titulo ?? '').trim())) continue

          const inicio = new Date(ev.inicio)
          const ms = inicio.getTime()
          if (Number.isNaN(ms) || ms < desde || ms > hasta) continue

          const clave = `${inicio.getDay() - 1}:${inicio.getHours()}`
          if (!nuevos.has(clave)) nuevos.set(clave, ev.titulo)
        }

        setIndice(nuevos)
      })
      .catch(err => {
        if (err.name !== 'AbortError') console.warn('[horario] Calendar no disponible:', err)
      })

    return () => controller.abort()
  }, [])

  return indice
}

/** Título de la tutoría que cae en el bloque `hora`..`hora + 2`. */
function tutoriaEn(indice, hora, col) {
  return indice.get(`${col}:${hora}`) ?? indice.get(`${col}:${hora + 1}`) ?? null
}

function Contenido({ materia, titulo }) {
  return (
    <div className="sched-class-box">
      <span className="sched-class-title">{titulo ?? materia.text}</span>
      {materia?.timeNote && <span className="sched-class-timenote">{materia.timeNote}</span>}
    </div>
  )
}

/** Resuelve los 3 estados de una celda: libre, materia sola o choque materia + tutoría. */
function Celda({ materia, tutoria, rowSpan = 1 }) {
  const alto = rowSpan > 1 ? 'sched-rowspan-2' : null

  if (!materia && !tutoria) {
    return (
      <td className="sched-td-free">
        <span className="sched-free-dot" />
      </td>
    )
  }

  const tipo = materia ? `sched-type-${materia.type}` : 'sched-type-tutoria'

  if (materia && tutoria) {
    return (
      <td className={cx('sched-td-class', 'sched-td-dual', alto)} rowSpan={rowSpan}>
        <div className="sched-dual-wrapper">
          <div className={cx('sched-dual-item', tipo)}>
            <Contenido materia={materia} />
          </div>
          <div className="sched-dual-item sched-type-tutoria">
            <Contenido titulo={tutoria} />
          </div>
        </div>
      </td>
    )
  }

  return (
    <td className={cx('sched-td-class', alto, tipo)} rowSpan={rowSpan}>
      <Contenido materia={materia} titulo={tutoria} />
    </td>
  )
}

function celdaDe(celda, col, filaIdx, indice) {
  const hora = HORAS[filaIdx]

  // Mitad inferior de un bloque con rowSpan: 2 (marcada como 'SPANNED').
  if (celda === SPANNED) {
    const previa = rows[filaIdx - 1]?.cells[col]
    if (previa?.rowSpan !== 2) return null

    const tutoriaBloquePrevio = tutoriaEn(indice, HORAS[filaIdx - 1], col)
    const tutoriaBloqueActual = tutoriaEn(indice, hora, col)

    // Sin tutoría en ninguno de los dos bloques, el rowspan original sigue igual.
    if (!tutoriaBloquePrevio && !tutoriaBloqueActual) return null

    return <Celda key={col} materia={previa} tutoria={tutoriaBloqueActual} />
  }

  const tutoria = tutoriaEn(indice, hora, col)
  if (!celda) return <Celda key={col} tutoria={tutoria} />

  const filaSiguiente = rows[filaIdx + 1]
  const continuaAbajo = celda.rowSpan === 2 && filaSiguiente?.cells[col] === SPANNED
  const tutoriaAbajo = continuaAbajo ? tutoriaEn(indice, HORAS[filaIdx + 1], col) : null

  // Si la tutoría ocupa cualquiera de los dos bloques hay que desdoblar el rowspan.
  const rowSpan = continuaAbajo && (tutoria || tutoriaAbajo) ? 1 : celda.rowSpan || 1

  return <Celda key={col} materia={celda} tutoria={tutoria} rowSpan={rowSpan} />
}

// memo + `indice` estable: cambiar el tema ya no re-renderiza las ~48 celdas.
const Tabla = memo(function Tabla({ indice }) {
  return (
    <div className="sched-table-wrapper">
      <table className="sched-table">
        <thead>
          <tr>
            {columns.map((col, i) => (
              <th key={col} className={cx('sched-th', i === 0 && 'sched-th-time')}>
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((fila, filaIdx) => (
            <tr key={fila.time}>
              <td className="sched-td-time">{fila.time}</td>
              {fila.cells.map((celda, col) => celdaDe(celda, col, filaIdx, indice))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
})

export default function App() {
  // index.html ya aplicó el tema antes del primer paint: solo hay que leerlo.
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'dark')
  const indice = useIndiceTutorias()

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      /* modo privado: el tema solo vive en memoria */
    }
  }, [theme])

  return (
    <div className="sched-page">
      <div className="sched-container">
        <div className="sched-top-bar">
          <a
            className="sched-back-btn"
            href="https://ema28pro.github.io/"
            title="Ir al portafolio principal"
          >
            <span className="material-symbols-outlined">arrow_back</span>
            Portafolio
          </a>

          <button
            className="sched-theme-btn"
            onClick={() => setTheme(prev => (prev === 'dark' ? 'light' : 'dark'))}
            aria-label="Cambiar tema"
            title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
          >
            <span className="material-symbols-outlined">
              {theme === 'dark' ? 'light_mode' : 'dark_mode'}
            </span>
          </button>
        </div>

        <div className="sched-card">
          <div className="sched-card-header">
            <h1 className="sched-title">{title}</h1>
            {subtitle && <span className="sched-subtitle">{subtitle}</span>}
          </div>

          <Tabla indice={indice} />
        </div>
      </div>
    </div>
  )
}