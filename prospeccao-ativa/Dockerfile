FROM node:20-alpine

WORKDIR /app

# Copiar package files
COPY server/package*.json ./

# Instalar dependências
RUN npm ci --only=production

# Copiar código
COPY server/server.js ./

# Porta do servidor
EXPOSE 3000

# Iniciar
CMD ["node", "server.js"]
