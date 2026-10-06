/**
 * Horario UdeA - Google Apps Script (Aplicación web)
 *
 * GET .../exec[?token=CLAVE]
 *   Sin token válido: tutorías de la semana (título y hora), sin ningún enlace.
 *   Con token válido: además el Meet de cada tutoría y los enlaces de las materias.
 *
 * Requisitos:
 *   - Servicio avanzado "Google Calendar API" agregado (Servicios > +).
 *   - CALENDAR_ID: id de tu calendario institucional.
 *   - Token: Configuración del proyecto > Propiedades del script > HORARIO_TOKEN.
 *   - MATERIAS: ⚠️ borra los enlaces antes de subir este archivo a GitHub.
 */

const CALENDAR_ID = '';
const TOKEN_PROP = 'HORARIO_TOKEN';

const MATERIAS = {
  "Nombre Materia": [
    { etiqueta: "Label", url: "Link" }
  ]
};

function doGet(e) {
  try {
    const token = e && e.parameter && e.parameter.token;
    const autorizado = tokenValido(token);
    const tutorias = leerTutorias();

    return json({
      ok: true,
      autorizado: autorizado,
      tutorias: autorizado
        ? tutorias
        : tutorias.map(t => ({ titulo: t.titulo, inicio: t.inicio, fin: t.fin })),
      materias: autorizado ? MATERIAS : {}
    });
  } catch (error) {
    return json({ ok: false, autorizado: false, error: String(error) });
  }
}

function json(datos) {
  return ContentService
    .createTextOutput(JSON.stringify(datos))
    .setMimeType(ContentService.MimeType.JSON);
}

function tokenValido(candidato) {
  const secreto = PropertiesService.getScriptProperties().getProperty(TOKEN_PROP);
  return Boolean(secreto) && candidato === secreto;
}

/** Tutorías que empiezan por "Tutoría"/"Tutoria", desde ahora hasta el domingo a las 23:59. */
function leerTutorias() {
  const ahora = new Date();
  const diasHastaDomingo = (7 - ahora.getDay()) % 7;
  const hasta = new Date(
    ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + diasHastaDomingo, 23, 59, 59
  );

  const respuesta = Calendar.Events.list(CALENDAR_ID, {
    timeMin: ahora.toISOString(),
    timeMax: hasta.toISOString(),
    singleEvents: true,
    orderBy: 'startTime'
  });

  return (respuesta.items || [])
    .filter(ev => ev.start.dateTime && /^tutor[íi]a/i.test((ev.summary || '').trim()))
    .map(ev => ({
      titulo: ev.summary.trim(),
      inicio: ev.start.dateTime,
      fin: ev.end.dateTime,
      link: ev.hangoutLink || null
    }));
}