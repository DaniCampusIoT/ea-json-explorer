FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json .
RUN npm install

COPY . .

# URL del backend en Railway
ENV VITE_API_URL=https://ea-explorer-backend-production.up.railway.app

RUN npm run build

# --- Imagen de produccion ---
FROM node:20-slim

WORKDIR /app

RUN npm install -g serve

COPY --from=builder /app/dist ./dist

CMD serve dist -l ${PORT:-3000} --single
