FROM node:24-alpine AS builder
WORKDIR /app
# Copy lock file together with package.json so npm ci can use the cache layer
# whenever neither file changes — even if source files change.
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Sentry source-map upload: token passed as a BuildKit secret (not baked into
# any layer). Absent secret → plugin just skips the upload, build still succeeds.
RUN --mount=type=secret,id=sentry_auth_token \
    SENTRY_AUTH_TOKEN="$(cat /run/secrets/sentry_auth_token 2>/dev/null || true)" \
    npm run build

FROM node:24-alpine
WORKDIR /app
# Install only production dependencies to keep the image lean.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/build ./build
EXPOSE 3000
ENV PORT=3000
CMD ["node", "build"]
