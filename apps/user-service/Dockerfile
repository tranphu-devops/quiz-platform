FROM node:24-alpine
WORKDIR /app
RUN npm install -g pnpm
COPY package.json ./
RUN pnpm install --prod --no-frozen-lockfile
COPY src/ ./src/
EXPOSE 3002
CMD ["node", "src/index.js"]
