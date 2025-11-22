FROM node:18-alpine AS builder

ARG NODE_ENV=production
ENV NODE_ENV=$NODE_ENV

WORKDIR /app

# Copiamos los archivos de lock para aprovechar la caché de npm
COPY package*.json ./
# Instala **todas** las dependencias (incluye dev) para poder compilar Next
RUN npm ci

# Copiamos el resto del código
COPY . .

# Compilamos (Next 14 necesita `next build`)
RUN npm run build

# -------------------------------------------------
# 2️⃣ Imagen de runtime – solo lo necesario
# -------------------------------------------------
FROM node:18-alpine AS runtime

WORKDIR /app

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/next.config.mjs ./
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder .env.local ./.env.local   # opcional, puedes montar un secret en Docker‑Compose

# Instala solo las dependencias de producción (ya están en node_modules)
RUN npm ci --omit=dev

EXPOSE 4200

CMD ["npm", "run", "dev", "--", "-p", "4200"]