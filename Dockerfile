# ============================================================
# BarberAgenda — Multi-stage Dockerfile
# Stage 1: Build React/Vite
# Stage 2: Serve com Nginx (imagem mínima ~25MB)
# ============================================================

# ---------- Stage 1: Builder ----------
FROM node:22-alpine AS builder

WORKDIR /app

# Copia dependências primeiro (cache layer)
COPY package*.json ./
RUN npm ci --frozen-lockfile

# Copia código-fonte
COPY . .

# Build de produção (gera /app/dist)
RUN npm run build

# ---------- Stage 2: Runtime Nginx ----------
FROM nginx:1.27-alpine AS runtime

# Remove config padrão do nginx
RUN rm /etc/nginx/conf.d/default.conf

# Copia config customizada
COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

# Copia build do React
COPY --from=builder /app/dist /usr/share/nginx/html

# Copia o config.js padrão (será sobrescrito em runtime pelo entrypoint)
COPY public/config.js /usr/share/nginx/html/config.js

# Entrypoint: injeta variáveis de ambiente em runtime antes de iniciar o Nginx
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Healthcheck nativo
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/health || exit 1

EXPOSE 80

CMD ["/docker-entrypoint.sh"]
