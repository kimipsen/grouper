# Stage 1: Build
FROM node:24-bookworm-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

WORKDIR /app/grouper-app
COPY grouper-app/package*.json ./
RUN npm ci

COPY grouper-app/ ./
RUN npm run build

# Stage 2: Serve
FROM nginx:alpine AS runtime

COPY --from=builder /app/grouper-app/dist/grouper-app/browser /usr/share/nginx/html

COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 4204

CMD ["nginx", "-g", "daemon off;"]
