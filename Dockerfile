# syntax=docker/dockerfile:1

# --- deps stage: install node_modules (shared by build & dev) ----------------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- dev stage: live Astro dev server with HMR (used by docker-compose.dev) --
FROM node:22-alpine AS dev
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
EXPOSE 4321
# --host binds 0.0.0.0 so the dev server is reachable from the host. Source is
# bind-mounted at runtime (see docker-compose.dev.yml), so nothing else is COPYed.
CMD ["npm", "run", "dev", "--", "--host"]

# --- build stage: compile the static Astro site -----------------------------
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
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
