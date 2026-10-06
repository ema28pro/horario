import { memo, useEffect, useState } from 'react'
import scheduleData from './data/schedule.json'

const CALENDAR_URL = import.meta.env.VITE_CALENDAR_URL
const THEME_KEY = 'theme'
const TOKEN_KEY = 'horario_token'
const SPANNED = 'SPANNED'
const ES_TUTORIA = /^tutor[íi]a/i

const { columns, rows, subtitle, title } = scheduleData

// Hora inicial de cada fila (los bloques son de 2 h), precalculada para no
// reparsear `row.time` en cada celda.
const HORAS = rows.map(({ time }) => Number(time.split(':')[0]))

const cx = (...clases) => clases.filter(Boolean).join(' ')

/**
 * localStorage envuelto en try/catch: en modo privado puede lanzar, y en ese caso
 * el token vive solo en la memoria de la pestaña (sigue funcionando).
 */
const almacen = {
  get(clave) {
    try {
      return localStorage.getItem(clave)
    } catch {
      return null
    }
  },
  set(clave, valor) {
    try {
      localStorage.setItem(clave, valor)
    } catch {
      /* modo privado: el token queda solo en memoria */
    }
  },
}

/** Rango [hoy 00:00:00, domingo 23:59:59] de la semana en curso, en ms. */
function rangoSemanaActual() {
  const hoy = new Date()
  const [anio, mes, dia] = [hoy.getFullYear(), hoy.getMonth(), hoy.getDate()]
  const hastaDomingo = hoy.getDay() === 0 ? 0 : 7 - hoy.getDay()

  return [
    Date.now(),
    new Date(anio, mes, dia + hastaDomingo, 23, 59, 59, 999).getTime(),
  ]
}

/** Normaliza el nombre de una materia para emparejarlo con el diccionario privado. */
function claveMateria(texto) {
  return (texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Monta la URL del Apps Script firmando la petición con el token privado. */
function urlConToken(token) {
  if (!CALENDAR_URL) return null

  try {
    const url = new URL(CALENDAR_URL)
    if (token) url.searchParams.set('token', token)
    return url.toString()
  } catch {
    // URL relativa o mal formada: se usa tal cual.
    return token ? `${CALENDAR_URL}${CALENDAR_URL.includes('?') ? '&' : '?'}token=${token}` : CALENDAR_URL
  }
}

/**
 * Toma el token de `?token=...` la primera vez, lo guarda y borra el parámetro de
 * la barra de direcciones para que no quede en el historial ni en un pantallazo.
 * En las siguientes visitas se recupera del almacenamiento local del navegador.
 */
function useTokenPrivado() {
  const [token] = useState(() => {
    try {
      const deUrl = new URLSearchParams(window.location.search).get('token')
      if (deUrl) {
        const token = deUrl.trim()
        almacen.set(TOKEN_KEY, token)

        const url = new URL(window.location.href)
        url.searchParams.delete('token')
        window.history.replaceState({}, '', url)

        return token
      }
    } catch {
      /* URL no manipulable: se sigue con el token guardado */
    }

    return almacen.get(TOKEN_KEY) ?? ''
  })

  return token
}

function normalizarEnlaces(valor) {
  if (!valor) return []
  if (typeof valor === 'string') return [{ etiqueta: 'Enlace', url: valor }]
  if (Array.isArray(valor)) {
    return valor
      .map(v => (typeof v === 'string' ? { etiqueta: 'Enlace', url: v } : v))
      .filter(v => v && typeof v.url === 'string' && v.url)
  }
  if (typeof valor === 'object' && valor.url) return [valor]
  return []
}

/**
 * Descarga las tutorías de Google Calendar una sola vez y las indexa por
 * `columna:hora` (0 = Lunes ... 6 = Sábado), así cada celda resuelve su
 * bloque con una consulta al Map en vez de recorrer todos los eventos.
 * Además guarda el diccionario de materias fijas que el servidor solo envía si el
 * token es válido. Para un visitante sin token, `indice` queda con títulos y el
 * diccionario vacío: ninguna celda se vuelve clicable.
 */
function useDatosCalendar(token) {
  const [datos, setDatos] = useState(() => ({ indice: new Map(), materias: {} }))

  useEffect(() => {
    const url = urlConToken(token)
    if (!url) {
      console.log('[horario] VITE_CALENDAR_URL no está configurado.')
      return
    }

    const controller = new AbortController()

    fetch(url, { signal: controller.signal })
      .then(res => res.json())
      .then(data => {
        // El script de Google devuelve { error } si algo falla.
        if (!data || !Array.isArray(data.tutorias)) return

        const [ahoraMs, hasta] = rangoSemanaActual()
        const indice = new Map()
        const materias = {}

        for (const [nombre, raw] of Object.entries(data.materias ?? {})) {
          const links = normalizarEnlaces(raw)
          if (links.length > 0) materias[claveMateria(nombre)] = links
        }

        for (const ev of data.tutorias) {
          if (!ES_TUTORIA.test((ev.titulo ?? '').trim())) continue

          const inicio = new Date(ev.inicio)
          const inicioMs = inicio.getTime()
          if (Number.isNaN(inicioMs) || inicioMs > hasta) continue

          // Duración de la clase (usa ev.fin o asume bloque de 2 horas)
          const finMs = ev.fin ? new Date(ev.fin).getTime() : inicioMs + 2 * 60 * 60 * 1000

          // Si el evento ya terminó respecto a la hora actual, desaparece de inmediato
          if (finMs <= ahoraMs) continue

          const links = ev.link ? [{ etiqueta: 'Google Meet', url: ev.link }] : []
          const clave = `${inicio.getDay() - 1}:${inicio.getHours()}`
          if (!indice.has(clave)) indice.set(clave, { ...ev, links })
        }

        setDatos({ indice, materias })
      })
      .catch(() => {
        // Silenciar para no ensuciar la consola si la URL no responde o falla
      })

    return () => controller.abort()
  }, [token])

  return datos
}

/** Tutoría que cae en el bloque `hora`..`hora + 2`. */
function tutoriaEn(indice, hora, col) {
  return indice.get(`${col}:${hora}`) ?? indice.get(`${col}:${hora + 1}`) ?? null
}

function Contenido({ materia, titulo, links }) {
  const tieneLinks = Array.isArray(links) && links.length > 0

  return (
    <div className={cx('sched-class-box', tieneLinks && 'sched-class-link')}>
      <span className="sched-class-title">{titulo ?? materia?.text}</span>
      {materia?.timeNote && <span className="sched-class-timenote">{materia.timeNote}</span>}
      {tieneLinks && (
        <span className="material-symbols-outlined sched-link-icon" aria-hidden="true">
          videocam
        </span>
      )}
    </div>
  )
}

/** Resuelve los 3 estados de una celda: libre, materia sola o choque materia + tutoría. */
function Celda({ materia, tutoria, linksMateria, rowSpan = 1, onAbrirEnlaces }) {
  const alto = rowSpan > 1 ? 'sched-rowspan-2' : null

  if (!materia && !tutoria) {
    return (
      <td className="sched-td-free">
        <span className="sched-free-dot" />
      </td>
    )
  }

  const tipo = materia ? `sched-type-${materia.type}` : 'sched-type-tutoria'
  const linksTutoria = tutoria?.links ?? []

  if (materia && tutoria) {
    const tieneLinksMat = Array.isArray(linksMateria) && linksMateria.length > 0
    const tieneLinksTut = linksTutoria.length > 0

    return (
      <td className={cx('sched-td-class', 'sched-td-dual', alto)} rowSpan={rowSpan}>
        <div className="sched-dual-wrapper">
          <div
            className={cx('sched-dual-item', tipo, tieneLinksMat && 'sched-class-clickable')}
            onClick={tieneLinksMat ? () => onAbrirEnlaces({ titulo: materia.text, links: linksMateria }) : undefined}
            title={tieneLinksMat ? 'Ver enlaces' : undefined}
          >
            <Contenido materia={materia} links={linksMateria} />
          </div>
          <div
            className={cx('sched-dual-item', 'sched-type-tutoria', tieneLinksTut && 'sched-class-clickable')}
            onClick={tieneLinksTut ? () => onAbrirEnlaces({ titulo: tutoria.titulo, links: linksTutoria }) : undefined}
            title={tieneLinksTut ? 'Ver enlaces' : undefined}
          >
            <Contenido titulo={tutoria.titulo} links={linksTutoria} />
          </div>
        </div>
      </td>
    )
  }

  const links = linksMateria ?? linksTutoria
  const tieneLinks = Array.isArray(links) && links.length > 0
  const tituloCelda = materia?.text ?? tutoria?.titulo

  return (
    <td
      className={cx('sched-td-class', alto, tipo, tieneLinks && 'sched-class-clickable')}
      rowSpan={rowSpan}
      onClick={tieneLinks ? () => onAbrirEnlaces({ titulo: tituloCelda, links }) : undefined}
      title={tieneLinks ? 'Ver enlaces de la clase' : undefined}
    >
      <Contenido materia={materia} titulo={tutoria?.titulo} links={links} />
    </td>
  )
}

function celdaDe(celda, col, filaIdx, datos, onAbrirEnlaces) {
  const { indice, materias } = datos
  const hora = HORAS[filaIdx]

  // Mitad inferior de un bloque con rowSpan: 2 (marcada como 'SPANNED').
  if (celda === SPANNED) {
    const previa = rows[filaIdx - 1]?.cells[col]
    if (previa?.rowSpan !== 2) return null

    const tutoriaBloquePrevio = tutoriaEn(indice, HORAS[filaIdx - 1], col)
    const tutoriaBloqueActual = tutoriaEn(indice, hora, col)

    // Sin tutoría en ninguno de los dos bloques, el rowspan original sigue igual.
    if (!tutoriaBloquePrevio && !tutoriaBloqueActual) return null

    return (
      <Celda
        key={col}
        materia={previa}
        tutoria={tutoriaBloqueActual}
        linksMateria={materias[claveMateria(previa?.text)]}
        onAbrirEnlaces={onAbrirEnlaces}
      />
    )
  }

  const tutoria = tutoriaEn(indice, hora, col)
  if (!celda) return <Celda key={col} tutoria={tutoria} onAbrirEnlaces={onAbrirEnlaces} />

  const filaSiguiente = rows[filaIdx + 1]
  const continuaAbajo = celda.rowSpan === 2 && filaSiguiente?.cells[col] === SPANNED
  const tutoriaAbajo = continuaAbajo ? tutoriaEn(indice, HORAS[filaIdx + 1], col) : null

  // Si la tutoría ocupa cualquiera de los dos bloques hay que desdoblar el rowspan.
  const rowSpan = continuaAbajo && (tutoria || tutoriaAbajo) ? 1 : celda.rowSpan || 1

  return (
    <Celda
      key={col}
      materia={celda}
      tutoria={tutoria}
      linksMateria={materias[claveMateria(celda.text)]}
      rowSpan={rowSpan}
      onAbrirEnlaces={onAbrirEnlaces}
    />
  )
}

// memo + `datos` estable: cambiar el tema ya no re-renderiza las ~48 celdas.
const Tabla = memo(function Tabla({ datos, onAbrirEnlaces }) {
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
              {fila.cells.map((celda, col) => celdaDe(celda, col, filaIdx, datos, onAbrirEnlaces))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
})

function ModalEnlaces({ item, onClose }) {
  const [copiadoIdx, setCopiadoIdx] = useState(null)

  useEffect(() => {
    if (!item) return
    const onKey = e => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [item, onClose])

  if (!item) return null

  const handleCopiar = (url, idx) => {
    try {
      navigator.clipboard.writeText(url)
      setCopiadoIdx(idx)
      setTimeout(() => setCopiadoIdx(null), 2000)
    } catch {
      const input = document.createElement('input')
      input.value = url
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setCopiadoIdx(idx)
      setTimeout(() => setCopiadoIdx(null), 2000)
    }
  }

  return (
    <div className="sched-popup-overlay" onClick={onClose}>
      <div className="sched-popup-modal" onClick={e => e.stopPropagation()}>
        <div className="sched-popup-header">
          <span className="sched-popup-title">{item.titulo}</span>
          <button className="sched-popup-close-btn" onClick={onClose} aria-label="Cerrar">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="sched-popup-body">
          {item.links.map((link, idx) => (
            <div key={idx} className="sched-popup-row">
              <a
                className="sched-popup-link-btn"
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="material-symbols-outlined">
                  {link.url.includes('zoom.us') ? 'videocam' : 'video_call'}
                </span>
                <span className="sched-popup-link-text">{link.etiqueta || 'Unirse'}</span>
                <span className="material-symbols-outlined sched-popup-arrow">
                  open_in_new
                </span>
              </a>

              <button
                className={cx('sched-popup-copy-btn', copiadoIdx === idx && 'is-copied')}
                onClick={() => handleCopiar(link.url, idx)}
                title="Copiar enlace"
              >
                <span className="material-symbols-outlined">
                  {copiadoIdx === idx ? 'check' : 'content_copy'}
                </span>
                <span>{copiadoIdx === idx ? 'Copiado' : 'Copiar'}</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function App() {
  // index.html ya aplicó el tema antes del primer paint: solo hay que leerlo.
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'dark')
  const [modalItem, setModalItem] = useState(null)
  const token = useTokenPrivado()
  const datos = useDatosCalendar(token)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    almacen.set(THEME_KEY, theme)
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

          <Tabla datos={datos} onAbrirEnlaces={setModalItem} />
        </div>
      </div>

      <ModalEnlaces item={modalItem} onClose={() => setModalItem(null)} />
    </div>
  )
}