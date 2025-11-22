FROM node:18-alpine AS builder

ARG NODE_ENV=production
ENV NODE_ENV=$NODE_ENV

# Instalar dependencias del sistema
RUN apk add --no-cache git python3 make g++ libc6-compat

WORKDIR /app

# Copiar package files
COPY package*.json ./

# Instalar dependencias
RUN npm install --legacy-peer-deps --no-audit --no-fund

# Copiar código
COPY . .

# Compilar Next.js (prisma generate se ejecuta automáticamente en el script de build)
RUN npm run build

# Runtime
FROM node:18-alpine AS runtime

WORKDIR /app

# Copiar archivos necesarios
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/next.config.js ./next.config.js
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Instalar solo dependencias de producción
RUN npm install --omit=dev --ignore-scripts --legacy-peer-deps --no-audit --no-fund

EXPOSE 4200

CMD ["npm", "start"]
