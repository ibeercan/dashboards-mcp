# dashboards-mcp — build context is the TS source only
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci
COPY src/ src/
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist/ dist/
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Mount the Dashboards backend root that contains App_Data/
ENV DASHBOARDS_ROOT=/data
# Default MCP transport; override with e.g. DASHBOARDS_MCP_HTTP_PORT
ENV DASHBOARDS_MCP_HTTP_PORT=
CMD ["node", "dist/index.js"]
