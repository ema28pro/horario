import { memo, useEffect, useMemo, useState } from 'react'
import scheduleData from './data/schedule.json'

const CALENDAR_URL = import.meta.env.VITE_CALENDAR_URL
const THEME_KEY = 'theme'
const TOKEN_KEY = 'horario_token'
// El enlace de acceso usa ?t=... (corto, para copiar y pegar); al Apps Script
// se le manda ?token=..., que es el nombre que el script sabe leer.
const PARAM_ENTRADA = 't'
const PARAM_API = 'token'
const SPANNED = 'SPANNED'

const { columns, rows, subtitle, title } = scheduleData

// Columnas de días (todas menos "Hora"). Las filas del JSON que tengan menos
// celdas que días (p. ej. sin la del domingo) se completan con celdas libres.
const DIAS = columns.length - 1

// Hora inicial de cada fila (los bloques son de 2 h).
const HORAS = rows.map(({ time }) => Number(time.split(':')[0]))

const SIN_DATOS = { indice: new Map(), materias: {} }

const cx = (...clases) => clases.filter(Boolean).join(' ')

/** localStorage sin romper en modo privado: allí el valor solo vive en memoria. */
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
      /* modo privado */
    }
  },
}

/** Normaliza el nombre de una materia para emparejarlo con el diccionario del servidor. */
function claveMateria(texto) {
  return (texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/* ───────────────────────────── Datos ───────────────────────────── */

/**
 * Toma el token de `?t=...` la primera vez, lo guarda y borra el parámetro de la
 * barra de direcciones. En las siguientes visitas lo recupera del navegador.
 */
function leerToken() {
  const url = new URL(window.location.href)
  const deUrl = url.searchParams.get(PARAM_ENTRADA)?.trim()

  if (deUrl) {
    almacen.set(TOKEN_KEY, deUrl)
    url.searchParams.delete(PARAM_ENTRADA)
    window.history.replaceState({}, '', url)
    return deUrl
  }

  return almacen.get(TOKEN_KEY) ?? ''
}

function useTokenPrivado() {
  const [token] = useState(leerToken)
  return token
}

/**
 * Descarga las tutorías una sola vez y las indexa por `día:hora`
 * (0 = lunes ... 6 = domingo). El servidor ya filtra lo que no corresponde y solo
 * manda enlaces y materias si el token es válido.
 */
function useDatosCalendar(token) {
  const [datos, setDatos] = useState(SIN_DATOS)

  useEffect(() => {
    if (!CALENDAR_URL) return

    const url = new URL(CALENDAR_URL)
    if (token) url.searchParams.set(PARAM_API, token)

    const controller = new AbortController()

    fetch(url, { signal: controller.signal })
      .then(res => res.json())
      .then(data => {
        if (!Array.isArray(data.tutorias)) return

        const indice = new Map()
        for (const ev of data.tutorias) {
          const inicio = new Date(ev.inicio)
          const dia = (inicio.getDay() + 6) % 7 // getDay(): 0 = domingo → lo pasamos a 0 = lunes
          const clave = `${dia}:${inicio.getHours()}`

          if (!indice.has(clave)) {
            indice.set(clave, {
              titulo: ev.titulo,
              links: ev.link ? [{ etiqueta: 'Google Meet', url: ev.link }] : [],
            })
          }
        }

        const materias = Object.fromEntries(
          Object.entries(data.materias ?? {}).map(([nombre, links]) => [claveMateria(nombre), links])
        )

        setDatos({ indice, materias })
      })
      .catch(() => {})

    return () => controller.abort()
  }, [token])

  return datos
}

/* ───────────────────────────── Grilla ───────────────────────────── */

/** Tutoría que cae en el bloque `hora`..`hora + 2`. */
function tutoriaEn(indice, hora, dia) {
  return indice.get(`${dia}:${hora}`) ?? indice.get(`${dia}:${hora + 1}`) ?? null
}

/** Materia de la fila `f`; si la celda es la mitad de abajo de un bloque, la de la fila de arriba. */
function materiaEn(f, dia) {
  const celda = rows[f]?.cells[dia]
  return celda === SPANNED ? rows[f - 1]?.cells[dia] ?? null : celda ?? null
}

/**
 * Cruza el horario fijo con las tutorías y devuelve, por fila y día:
 *   null                    → celda cubierta por el rowSpan de la de arriba
 *   { items, rowSpan }      → items = [materia?, tutoría?]; vacío = hora libre
 * Un bloque de 2 h solo se mantiene unido si ninguna de sus dos filas tiene tutoría.
 */
function armarGrilla({ indice, materias }) {
  return rows.map((fila, f) =>
    Array.from({ length: DIAS }, (_, dia) => {
      const inicio = fila.cells[dia] === SPANNED ? f - 1 : f
      const esBloque =
        rows[inicio]?.cells[dia]?.rowSpan === 2 && rows[inicio + 1]?.cells[dia] === SPANNED
      const unido =
        esBloque &&
        !tutoriaEn(indice, HORAS[inicio], dia) &&
        !tutoriaEn(indice, HORAS[inicio + 1], dia)

      if (unido && f !== inicio) return null

      const items = []
      const materia = materiaEn(f, dia)
      const tutoria = tutoriaEn(indice, HORAS[f], dia)

      if (materia) {
        items.push({
          titulo: materia.text,
          nota: materia.timeNote,
          tipo: `sched-type-${materia.type}`,
          links: materias[claveMateria(materia.text)] ?? [],
        })
      }
      if (tutoria) {
        items.push({ titulo: tutoria.titulo, tipo: 'sched-type-tutoria', links: tutoria.links })
      }

      return { items, rowSpan: unido ? 2 : 1 }
    })
  )
}

/* ───────────────────────────── Vista ───────────────────────────── */

function Contenido({ item }) {
  const tieneLinks = item.links.length > 0

  return (
    <div className={cx('sched-class-box', tieneLinks && 'sched-class-link')}>
      <span className="sched-class-title">{item.titulo}</span>
      {item.nota && <span className="sched-class-timenote">{item.nota}</span>}
      {tieneLinks && (
        <span className="material-symbols-outlined sched-link-icon" aria-hidden="true">
          videocam
        </span>
      )}
    </div>
  )
}

function Celda({ celda, onAbrirEnlaces }) {
  const { items, rowSpan } = celda

  if (items.length === 0) {
    return (
      <td className="sched-td-free">
        <span className="sched-free-dot" />
      </td>
    )
  }

  const alto = rowSpan > 1 && 'sched-rowspan-2'
  const clic = item =>
    item.links.length > 0
      ? { onClick: () => onAbrirEnlaces({ titulo: item.titulo, links: item.links }), title: 'Ver enlaces' }
      : {}

  // Materia y tutoría a la vez: celda partida en dos.
  if (items.length > 1) {
    return (
      <td className={cx('sched-td-class', 'sched-td-dual', alto)} rowSpan={rowSpan}>
        <div className="sched-dual-wrapper">
          {items.map((item, i) => (
            <div
              key={i}
              className={cx('sched-dual-item', item.tipo, item.links.length > 0 && 'sched-class-clickable')}
              {...clic(item)}
            >
              <Contenido item={item} />
            </div>
          ))}
        </div>
      </td>
    )
  }

  const [item] = items

  return (
    <td
      className={cx('sched-td-class', alto, item.tipo, item.links.length > 0 && 'sched-class-clickable')}
      rowSpan={rowSpan}
      {...clic(item)}
    >
      <Contenido item={item} />
    </td>
  )
}

// memo: cambiar el tema no vuelve a calcular ni a renderizar la tabla.
const Tabla = memo(function Tabla({ datos, onAbrirEnlaces }) {
  const grilla = useMemo(() => armarGrilla(datos), [datos])

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
          {rows.map((fila, f) => (
            <tr key={fila.time}>
              <td className="sched-td-time">{fila.time}</td>
              {grilla[f].map((celda, dia) =>
                celda && <Celda key={dia} celda={celda} onAbrirEnlaces={onAbrirEnlaces} />
              )}
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
    const onKey = e => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [item, onClose])

  if (!item) return null

  const copiar = async (url, idx) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopiadoIdx(idx)
      setTimeout(() => setCopiadoIdx(null), 2000)
    } catch {
      /* sin permiso para el portapapeles: el enlace sigue visible para copiarlo a mano */
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
              <a className="sched-popup-link-btn" href={link.url} target="_blank" rel="noopener noreferrer">
                <span className="material-symbols-outlined">
                  {link.url.includes('zoom.us') ? 'videocam' : 'video_call'}
                </span>
                <span className="sched-popup-link-text">{link.etiqueta || 'Unirse'}</span>
                <span className="material-symbols-outlined sched-popup-arrow">open_in_new</span>
              </a>

              <button
                className={cx('sched-popup-copy-btn', copiadoIdx === idx && 'is-copied')}
                onClick={() => copiar(link.url, idx)}
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
          <a className="sched-back-btn" href="https://ema28pro.github.io/" title="Ir al portafolio principal">
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