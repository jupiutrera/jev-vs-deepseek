FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN apk add --no-cache ffmpeg && npm ci
COPY . .
EXPOSE 5173
# Servidor de Vite: sirve el juego y hace de proxy hacia Jev y el LLM con las claves del entorno
CMD ["npx", "vite", "--host", "0.0.0.0", "--port", "5173"]
