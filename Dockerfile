FROM node:24-bookworm-slim AS client
WORKDIR /src/aepp-generator-client
COPY aepp-generator-client/package*.json ./
RUN npm ci
COPY aepp-generator-client/ ./
ENV VITE_USE_DEMO=false VITE_API_BASE_URL=/api
RUN npm run build && npm run build:server-grader

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY AeppGenerator/ AeppGenerator/
COPY --from=client /src/aepp-generator-client/src/ aepp-generator-client/src/
COPY --from=client /src/AeppGenerator/src/AeppGenerator.Api/Assessment/Grader/ AeppGenerator/src/AeppGenerator.Api/Assessment/Grader/
WORKDIR /src/AeppGenerator
RUN dotnet publish src/AeppGenerator.Api/AeppGenerator.Api.csproj -c Release -o /out

FROM node:24-bookworm-slim AS api
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates libicu72 libssl3 zlib1g && rm -rf /var/lib/apt/lists/*
COPY --from=mcr.microsoft.com/dotnet/aspnet:8.0-bookworm-slim /usr/share/dotnet /usr/share/dotnet
ENV DOTNET_ROOT=/usr/share/dotnet PATH="/usr/share/dotnet:${PATH}" ASPNETCORE_URLS=http://+:8080 ASPNETCORE_ENVIRONMENT=Production
WORKDIR /app
COPY --from=build --chown=node:node /out/ ./
RUN mkdir -p /app/App_Data && chown node:node /app/App_Data
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s CMD node -e "fetch('http://127.0.0.1:8080/api/health',{headers:{'Host':process.env.AllowedHosts,'X-Forwarded-Proto':'https'}}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["dotnet", "AeppGenerator.Api.dll"]

FROM caddy:2-alpine AS web
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=client /src/aepp-generator-client/dist/ /srv/
