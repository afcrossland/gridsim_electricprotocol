# The /klute sign-in gate, with the klute build baked in (it is not on public hosting).
# Build from the repo root: docker build -f klute/gate/Dockerfile .
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
# npm silently skips an optional dependency it fails to download (npm/cli#4828). That has left out
# Rolldown's native binding, which Vite needs, and failed the build below with "Cannot find native
# binding". So check that Rolldown loads, retry the install if not, and say so if it never does.
RUN for attempt in 1 2 3; do \
      npm ci && node --input-type=module -e "await import('rolldown')" && exit 0; \
      echo "npm ci attempt $attempt failed or left out Rolldown's native binding" >&2; \
      sleep 5; \
    done; \
    echo "Giving up: Rolldown's native binding is still missing after 3 npm ci attempts" >&2; \
    exit 1
COPY . .
RUN npm run build:klute

FROM python:3.12-slim
WORKDIR /app
COPY klute/gate/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY klute/gate/main.py klute/gate/login.html ./
COPY klute/gate/ep_db ./ep_db
COPY --from=build /app/dist-klute/klute ./static
ENV PORT=8080
CMD ["sh", "-c", "exec uvicorn main:app --host 0.0.0.0 --port ${PORT} --proxy-headers --forwarded-allow-ips='*'"]
