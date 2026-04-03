# ============================================
# Stage 1: Build Angular App
# ============================================
FROM node:24-alpine AS build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with npm cache
RUN --mount=type=cache,target=/root/.npm \
    npm ci --legacy-peer-deps

# Copy source code
COPY . .

# Build Angular app for production
# NODE_OPTIONS: limita heap a 1.5 GB para evitar OOM en VPS con pocos recursos
ENV NODE_OPTIONS="--max_old_space_size=1536"
RUN npm run build

# ============================================
# Stage 2: Serve with Nginx
# ============================================
FROM nginx:1.27-alpine

RUN apk add --no-cache curl && \
  rm /etc/nginx/conf.d/default.conf

COPY nginx.docker.conf /etc/nginx/conf.d/default.conf

COPY --from=build /app/dist/hco-siaf-front/browser /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
