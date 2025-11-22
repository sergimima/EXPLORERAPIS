FROM node:18 AS builder

ARG NODE_ENV=production
ENV NODE_ENV=$NODE_ENV

WORKDIR /app

# Verificar que npm y node están disponibles
RUN node --version && npm --version

# Copiar package files
COPY package*.json ./

# Verificar que los archivos se copiaron
RUN ls -la package*.json

# Instalar dependencias
RUN npm install --legacy-peer-deps --no-audit --no-fund

# Copiar código
COPY . .

# Compilar Next.js (prisma generate se ejecuta automáticamente en el script de build)
RUN npm run build

# Runtime
FROM node:18 AS runtime

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
