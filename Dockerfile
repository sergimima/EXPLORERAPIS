FROM node:18-alpine

# Instalar dependencias del sistema
RUN apk add --no-cache libc6-compat openssl

# Establecer directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar todas las dependencias (incluyendo devDependencies para el build)
RUN npm ci

# Copiar código fuente
COPY . .

# Generar Prisma Client
RUN npx prisma generate

# Variables de entorno necesarias para el build
ARG NEXT_PUBLIC_BASESCAN_API_KEY
ARG NEXT_PUBLIC_ETHERSCAN_API_KEY
ARG NEXT_PUBLIC_MORALIS_API_KEY
ARG NEXT_PUBLIC_QUICKNODE_URL
ARG NEXT_PUBLIC_BASE_RPC_URL
ARG NEXT_PUBLIC_BASE_TESTNET_RPC_URL
ARG NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL

ENV NEXT_PUBLIC_BASESCAN_API_KEY=$NEXT_PUBLIC_BASESCAN_API_KEY
ENV NEXT_PUBLIC_ETHERSCAN_API_KEY=$NEXT_PUBLIC_ETHERSCAN_API_KEY
ENV NEXT_PUBLIC_MORALIS_API_KEY=$NEXT_PUBLIC_MORALIS_API_KEY
ENV NEXT_PUBLIC_QUICKNODE_URL=$NEXT_PUBLIC_QUICKNODE_URL
ENV NEXT_PUBLIC_BASE_RPC_URL=$NEXT_PUBLIC_BASE_RPC_URL
ENV NEXT_PUBLIC_BASE_TESTNET_RPC_URL=$NEXT_PUBLIC_BASE_TESTNET_RPC_URL
ENV NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL=$NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL

# Generar build de producción
RUN npm run build

# Exponer puerto
EXPOSE 4200

# Variables de entorno
ENV NODE_ENV=production
ENV PORT=4200

# Comando de inicio - ejecuta prisma db push y luego npm start
CMD sh -c "npx prisma db push --skip-generate && npm start"
