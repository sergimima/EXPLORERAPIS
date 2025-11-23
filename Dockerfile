FROM node:18-alpine AS builder

WORKDIR /app

# Copiar package files
COPY package*.json ./

# Instalar todas las dependencias (incluidas dev para el build)
RUN npm ci --legacy-peer-deps

# Copiar código
COPY . .

# Compilar Next.js (prisma generate se ejecuta automáticamente en el script de build)
RUN npm run build

# Runtime
FROM node:18-alpine AS runtime

WORKDIR /app

# Copiar node_modules del builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/next.config.js ./
COPY --from=builder /app/prisma ./prisma

EXPOSE 4200

CMD ["npm", "start"]
