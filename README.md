# Horario Semestre VI · UdeA

Horario académico interactivo para Ingeniería de Sistemas (Universidad de Antioquia).
Diseñado para ser desplegado directamente en **GitHub Pages** bajo `https://ema28pro.github.io/horario`.

## 🚀 Desarrollo local

```bash
npm install
npm run dev
```

## 📦 Despliegue en GitHub Pages

1. Crea el repositorio en GitHub con el nombre `horario`:
```bash
git init
git add .
git commit -m "feat: initial commit horario semestre VI"
git branch -M main
git remote add origin https://github.com/ema28pro/horario.git
git push -u origin main
```

2. Despliega a GitHub Pages:
```bash
npm run deploy
```

La URL final será: **https://ema28pro.github.io/horario**

## 🗓️ Sincronización con Google Calendar (Tutorías)

El horario sincroniza automáticamente las **Tutorías** desde tu Google Calendar institucional (`emanuel.lopez@udea.edu.co`) siguiendo estas reglas automáticas:
1. **Filtro de título**: Solo se incluyen eventos que comiencen con `Tutoría` o `Tutoria` (insensible a mayúsculas o tildes).
2. **Expiración diaria**: Al comenzar un nuevo día, los eventos de los días anteriores desaparecen automáticamente.
3. **Semana en curso**: Solo se muestran los eventos comprendidos dentro de la semana actual (Lunes a Domingo).
4. **Integración visual**: Se listan en el banner dinámico y se inyectan en los espacios libres del horario semanal.

### ⚡ Pasos para conectar tu Google Calendar:

1. Ve a [Google Apps Script](https://script.google.com/) y crea un **Nuevo proyecto**.
2. Copia y pega el código que está en el archivo [`google-apps-script/Code.gs`](file:///google-apps-script/Code.gs).
3. Haz clic en el botón azul superior **Implementar (Deploy)** > **Nueva implementación**.
4. Haz clic en el ícono de engranaje (Tipo) y selecciona **Aplicación web**.
5. Configuración:
   - **Ejecutar como**: Tu cuenta (`Yo`)
   - **Quién tiene acceso**: `Cualquiera` (Anyone)
6. Haz clic en **Implementar**, concede los permisos y copia la URL proporcionada (`https://script.google.com/macros/s/.../exec`).
7. En la web de Horario, haz clic en el botón superior **Google Calendar**, pega la URL y haz clic en **Guardar y Conectar**.

