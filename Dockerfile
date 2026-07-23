# syntax=docker/dockerfile:1

# ---------- Stage 1: build ----------
FROM node:22 AS build
WORKDIR /app

# Cài dependencies trước để tận dụng cache layer khi chỉ đổi mã nguồn.
COPY package.json package-lock.json ./
COPY server/prisma ./server/prisma
# postinstall chạy "prisma generate" — cần sẵn schema ở trên (không cần DB).
RUN npm ci

COPY . .
# Sinh cả SPA (build/) lẫn server đã biên dịch (server/dist/).
RUN npm run build

# ---------- Stage 2: runtime ----------
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# openssl: Prisma engine cần; ca-certificates: gọi TLS tới Postgres.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY server/prisma ./server/prisma
# Bỏ devDependencies; postinstall sinh lại Prisma Client cho image runtime.
RUN npm ci --omit=dev

COPY --from=build /app/build ./build
COPY --from=build /app/server/dist ./server/dist

# Render cấp PORT lúc chạy; 4000 chỉ là mặc định khi chạy tay.
ENV PORT=4000
EXPOSE 4000

# migrate deploy idempotent — an toàn khi khởi động lại.
CMD ["sh", "-c", "npx prisma migrate deploy --schema server/prisma/schema.prisma && node server/dist/index.js"]
