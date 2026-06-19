# syntax=docker/dockerfile:1

# --- build stage: compile the static Astro site -----------------------------
FROM node:22-alpine AS build
WORKDIR /app

# Install deps first (cached unless the lockfile changes).
COPY package.json package-lock.json ./
RUN npm ci

# Build the static site to /app/dist.
COPY . .
RUN npm run build

# --- runtime stage: serve the static output with nginx ----------------------
FROM nginx:1.27-alpine AS runtime

# Security headers (mirrors netlify.toml) + SPA-friendly static serving.
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

# Lightweight container healthcheck against the served page.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost/ >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
