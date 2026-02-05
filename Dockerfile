FROM node:20-alpine

# Instalar dependencias del sistema
RUN apk add --no-cache libc6-compat openssl

# Establecer directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias y schema de Prisma
COPY package*.json ./
COPY prisma ./prisma

# Instalar todas las dependencias (incluyendo devDependencies para el build)
RUN npm install --legacy-peer-deps

# Copiar resto del código fuente
COPY . .

# Prisma necesita DATABASE_URL en el build (solo para generar el cliente, no conecta)
# El valor real se inyecta en runtime via docker-compose
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"

# Generar build de producción
RUN npm run build

# Exponer puerto
EXPOSE 4200

# Variables de entorno
ENV NODE_ENV=production
ENV PORT=4200

# Comando de inicio - ejecuta prisma db push y luego npm start
CMD sh -c "npx prisma db push && npm start"
