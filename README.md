# GestorNominas

Aplicación web para gestión y análisis de nóminas con OCR.

## Stack

- **Backend**: Node.js + Express + Drizzle ORM (SQLite)
- **Frontend**: Astro + React + Tailwind CSS
- **OCR**: Tesseract (requiere `spa.traineddata`)

## Setup

```bash
# Instalar dependencias
npm install

# Copiar variables de entorno
cp .env.example .env
# Editar .env con un JWT_SECRET seguro

# Descargar datos OCR para español
# Colocar spa.traineddata en backend/
# https://github.com/tesseract-ocr/tessdata

# Ejecutar migraciones y arrancar
npm run dev
```
