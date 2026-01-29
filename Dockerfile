# ============================================
# Stage 1: Build Angular App
# ============================================
FROM node:22-alpine AS build

# ARG para seleccionar environment: production | development
# Default: production (para main/master)
# Usar: docker build --build-arg ENVIRONMENT=development .
ARG ENVIRONMENT=production

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (usar npm ci para builds reproducibles)
# --ignore-scripts evita postinstall (no hay Git en Docker)
RUN npm ci --legacy-peer-deps --ignore-scripts

# Copy source code
COPY . .

# Configurar environment según ARG (detectado por docker-compose o build arg)
RUN cp src/environments/environment.${ENVIRONMENT}.ts src/environments/environment.ts && \
  echo "✅ Environment configurado: ${ENVIRONMENT}"

# Build Angular app for production
RUN npm run build --configuration=${ENVIRONMENT}

# ============================================
# Stage 2: Serve with Nginx
# ============================================
FROM nginx:alpine

# Install curl for healthcheck
RUN apk add --no-cache curl

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config
COPY nginx.docker.conf /etc/nginx/conf.d/default.conf

# Copy built Angular app from build stage
COPY --from=build /app/dist/bi-aug-24/browser /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Health check (usar curl en lugar de wget)
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost/ || exit 1

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
