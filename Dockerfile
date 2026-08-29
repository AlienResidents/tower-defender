# PHOSPHOR — static build + nginx-unprivileged serve.
# Build:  podman build -t ghcr.io/alienresidents/phosphor:latest .
# Push:   gh auth token | podman login ghcr.io -u AlienResidents --password-stdin
#         podman push ghcr.io/alienresidents/phosphor:latest
# Deploy: home_kube/deployments/phosphor/

FROM node:26-alpine AS build
WORKDIR /app
RUN npm install -g pnpm@11 # node 26 no longer bundles corepack
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM ghcr.io/nginxinc/nginx-unprivileged:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
