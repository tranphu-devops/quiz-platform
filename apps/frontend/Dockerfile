FROM node:24-alpine AS builder
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:24-alpine
WORKDIR /app
COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./
EXPOSE 3000
ENV PORT=3000
WORKDIR /app/build
CMD ["node", "index.js"]
