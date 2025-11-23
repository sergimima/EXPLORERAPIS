FROM node:20-alpine

# Instalar dependencias del sistema
RUN apk add --no-cache libc6-compat openssl

# Establecer directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar todas las dependencias (incluyendo devDependencies para el build)
RUN npm install --legacy-peer-deps

# Copiar código fuente
COPY . .

# Generar Prisma Client
RUN npx prisma generate

# Generar build de producción
RUN npm run build

# Exponer puerto
EXPOSE 4200

# Variables de entorno
ENV NODE_ENV=production
ENV PORT=4200

# Comando de inicio - ejecuta prisma db push y luego npm start
CMD sh -c "npx prisma db push --skip-generate && npm start"
