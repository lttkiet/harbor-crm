FROM node:24.21.0-alpine3.24 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# VITE_* values are public client configuration embedded in browser assets, never private credentials.
ARG VITE_API_URL
ARG VITE_AUTH_MODE
ARG VITE_FIREBASE_API_KEY=
ARG VITE_FIREBASE_AUTH_DOMAIN=
ARG VITE_FIREBASE_PROJECT_ID=
ARG VITE_FIREBASE_APP_ID=
RUN test -n "$VITE_API_URL" && test -n "$VITE_AUTH_MODE" \
  && VITE_API_URL="$VITE_API_URL" \
     VITE_AUTH_MODE="$VITE_AUTH_MODE" \
     VITE_FIREBASE_API_KEY="$VITE_FIREBASE_API_KEY" \
     VITE_FIREBASE_AUTH_DOMAIN="$VITE_FIREBASE_AUTH_DOMAIN" \
     VITE_FIREBASE_PROJECT_ID="$VITE_FIREBASE_PROJECT_ID" \
     VITE_FIREBASE_APP_ID="$VITE_FIREBASE_APP_ID" \
     npm run build

FROM nginxinc/nginx-unprivileged:1.31.6-alpine3.24
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build --chown=nginx:nginx /app/dist /usr/share/nginx/html
EXPOSE 8080
