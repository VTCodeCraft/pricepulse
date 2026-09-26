# Playwright's image ships Chromium and its system libraries. The tag must match the npm "playwright" version.
FROM mcr.microsoft.com/playwright:v1.63.0-noble

WORKDIR /app
ENV NODE_ENV=production

RUN npm install -g pnpm@11.25.0
COPY package.json pnpm-lock.yaml ./
RUN CI=true pnpm install --frozen-lockfile --prod

COPY src ./src

USER pwuser
CMD ["node", "src/server.js"]
