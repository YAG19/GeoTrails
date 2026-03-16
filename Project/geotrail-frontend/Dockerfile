# ==================== BUILD STAGE ====================
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build:prod

# ==================== RUNTIME STAGE ====================
FROM nginx:alpine

# Copy built Angular app
COPY --from=builder /app/dist/geotrail-frontend/browser /usr/share/nginx/html

# Nginx config for SPA routing + API proxy
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
