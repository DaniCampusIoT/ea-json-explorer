FROM node:20-slim AS builder

WORKDIR /app

COPY frontend/package*.json .
RUN npm install --legacy-peer-deps

# Bust cache para forzar rebuild del bundle
ARG CACHEBUST=2026-08-06c
COPY frontend/ .

RUN npm run build

# --- Imagen de produccion ---
FROM node:20-slim

WORKDIR /app

RUN npm install -g serve

COPY --from=builder /app/dist ./dist

CMD ["sh", "-c", "serve dist --listen tcp://0.0.0.0:${PORT:-3000} --single"]
