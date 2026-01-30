# ============================================
# Stage 1: Build Angular App
# ============================================
FROM node:22-alpine AS build

WORKDIR /app

# Copy package files
COPY package*.json ./

<<<<<<< HEAD
# Install dependencies (build reproducible)
=======
# Install dependencies (usar npm ci para builds reproducibles)
>>>>>>> 4bda0213b12f0e9b0f2e170ed2e3e90a2b179603
RUN npm ci --legacy-peer-deps

# Copy source code
COPY . .

# Build Angular app for production
RUN npm run build --configuration=production

# ============================================
# Stage 2: Serve with Nginx
# ============================================
FROM nginx:alpine

RUN apk add --no-cache curl
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.docker.conf /etc/nginx/conf.d/default.conf

COPY --from=build /app/dist/bi-aug-24/browser /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
