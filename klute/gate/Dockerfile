# The /klute sign-in gate, with the klute build baked in (it is not on public hosting).
# Build from the repo root: docker build -f klute/gate/Dockerfile .
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build:klute

FROM python:3.12-slim
WORKDIR /app
COPY klute/gate/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY klute/gate/main.py klute/gate/login.html ./
COPY --from=build /app/dist-klute/klute ./static
ENV PORT=8080
CMD ["sh", "-c", "exec uvicorn main:app --host 0.0.0.0 --port ${PORT} --proxy-headers --forwarded-allow-ips='*'"]
