# -------------------------------------------------
# 1️⃣ Imagen base – Node 18 (alpine, ligera)
# -------------------------------------------------
FROM node:18-alpine AS builder

# Variables de entorno que no queremos que se impriman en la capa final
ARG NODE_ENV=production
ENV NODE_ENV=$NODE_ENV

# Directorio de trabajo
WORKDIR /app

# Copiamos solo los archivos de lock para aprovechar la caché de npm
COPY package*.json ./
# Si usas pnpm o yarn, cambia la línea anterior por el respectivo lockfile
RUN npm ci --omit=dev   # instala solo dependencias de producción

# Copiamos el resto del código
COPY . .

# Compilamos (Next 14 necesita `next build`)
RUN npm run build

# -------------------------------------------------
# 2️⃣ Imagen de runtime – solo lo necesario
# -------------------------------------------------
FROM node:18-alpine AS runtime

WORKDIR /app

# Copiamos solo lo que realmente necesita la app en producción
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/next.config.mjs ./
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/.env.local ./.env.local   # opcional, puedes montar un secret en Docker‑Compose

# Instalamos solo las dependencias de producción (ya están en node_modules)
RUN npm ci --omit=dev

# Puerto que expone Next (por defecto 3000, pero tu app usa 4200)
EXPOSE 4200

# Comando de arranque
CMD ["npm", "run", "dev", "--", "-p", "4200"]