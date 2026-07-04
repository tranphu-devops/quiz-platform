FROM node:24-alpine AS builder
WORKDIR /app
# Copy package.json before source so the npm-install layer is cache-hit
# on source-only changes (package.json unchanged → layer reused).
COPY package.json ./
# --mount=type=cache keeps downloaded packages across builds even when
# package.json changes, avoiding re-downloads from the registry.
RUN --mount=type=cache,target=/root/.npm \
    npm install
COPY . .
# Sentry source-map upload: token passed as a BuildKit secret (not baked into
# any layer). Absent secret → plugin just skips the upload, build still succeeds.
RUN --mount=type=secret,id=sentry_auth_token \
    SENTRY_AUTH_TOKEN="$(cat /run/secrets/sentry_auth_token 2>/dev/null || true)" \
    npm run build

FROM node:24-alpine
WORKDIR /app
COPY package.json ./
# Only install runtime dependencies to keep the image lean.
RUN --mount=type=cache,target=/root/.npm \
    npm install --omit=dev
COPY --from=builder /app/build ./build
EXPOSE 3000
ENV PORT=3000
CMD ["node", "build"]
