FROM node:20-slim AS builder

WORKDIR /app

COPY frontend/package*.json .
RUN npm install --legacy-peer-deps

COPY frontend/ .

RUN npm run build

# --- Imagen de produccion ---
FROM node:20-slim

WORKDIR /app

RUN npm install -g serve

COPY --from=builder /app/dist ./dist

CMD ["serve", "dist", "-l", "3000", "--single"]
