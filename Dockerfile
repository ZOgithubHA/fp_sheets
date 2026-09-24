# Multi-stage Dockerfile for IT Asset Management & Telegram Bot
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/google-apps-script.js ./

EXPOSE 3000

# Runs the full-stack web UI, API server, Google Sheets 2-way sync, and Telegram bot polling
CMD ["node", "dist/server.js"]
