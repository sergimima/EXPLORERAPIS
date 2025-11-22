FROM node:18-alpine AS builder

ARG NODE_ENV=production
ENV NODE_ENV=$NODE_ENV

# Instalar dependencias del sistema necesarias para compilar módulos nativos
RUN apk add --no-cache \
    git \
    python3 \
    make \
    g++ \
    libc6-compat

WORKDIR /app

# Copiar package.json primero (puede que no exista package-lock.json)
COPY package.json ./

# Si existe package-lock.json, copiarlo también
COPY package-lock.json* ./

# Verificar que package.json existe
RUN test -f package.json || (echo "ERROR: package.json no encontrado" && exit 1)

# Configurar npm para mejor manejo de errores y timeouts
RUN npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm config set audit false && \
    npm config set fund false

# Instala **todas** las dependencias (incluye dev) para poder compilar Next
# Usamos --legacy-peer-deps para evitar problemas de peer dependencies
RUN npm install --legacy-peer-deps --no-audit --no-fund

# Copiamos el resto del código necesario para el build
COPY . .

# Genera Prisma Client
RUN npx prisma generate

# Compilamos (Next 14 necesita `next build`)
RUN npm run build

# -------------------------------------------------
# 2️⃣ Imagen de runtime – solo lo necesario
# -------------------------------------------------
FROM node:18-alpine AS runtime

WORKDIR /app

# Copiamos archivos compilados y necesarios
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/next.config.js ./next.config.js
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Instala solo las dependencias de producción
RUN npm install --omit=dev --ignore-scripts --legacy-peer-deps --no-audit --no-fund

EXPOSE 4200

# Usa npm start para producción (next start)
CMD ["npm", "start"]
