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

## 🗓️ Próxima integración: Google Calendar
Estructurado y listo para sincronizar tutorías semanales desde la API de Google Calendar / iCal.
