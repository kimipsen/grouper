# Stage 1: Build
FROM node:24-bookworm-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --ignore-scripts

WORKDIR /app/grouper-app
COPY grouper-app/package*.json ./
RUN npm ci --ignore-scripts

COPY grouper-app/ ./
RUN npm run build

# Stage 2: Serve
# nginx-unprivileged runs as the non-root "nginx" user (uid 101) and keeps its
# pid/temp files in writable locations, so the server never needs root.
FROM nginxinc/nginx-unprivileged:alpine AS runtime

COPY --from=builder /app/grouper-app/dist/grouper-app/browser /usr/share/nginx/html

COPY nginx.conf /etc/nginx/conf.d/default.conf

USER nginx

EXPOSE 4204

CMD ["nginx", "-g", "daemon off;"]
