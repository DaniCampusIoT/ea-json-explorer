FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json .
RUN npm install --legacy-peer-deps

COPY . .

# bust cache 2026-08-05b
ENV VITE_API_URL=https://ea-explorer-backend-production.up.railway.app

RUN npm run build

# --- Imagen de produccion ---
FROM node:20-slim

WORKDIR /app

RUN npm install -g serve

COPY --from=builder /app/dist ./dist
COPY serve.json ./serve.json

CMD serve dist -l ${PORT:-3000} -c ../serve.json
