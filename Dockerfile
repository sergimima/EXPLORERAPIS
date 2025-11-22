FROM node:18-alpine AS builder

ARG NODE_ENV=production
ENV NODE_ENV=$NODE_ENV

RUN apk add --no-cache git python3 make g++

WORKDIR /app

# Copiamos los archivos de lock para aprovechar la caché de npm
COPY package*.json ./
# Instala **todas** las dependencias (incluye dev) para poder compilar Next
RUN npm ci

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
RUN npm ci --omit=dev --ignore-scripts

EXPOSE 4200

# Usa npm start para producción (next start)
CMD ["npm", "start"]
