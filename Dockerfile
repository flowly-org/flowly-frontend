FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx ng build --configuration production

FROM nginx:1.27-alpine
COPY docker/default.conf.template /etc/nginx/templates/default.conf.template
COPY docker/40-write-config.sh /docker-entrypoint.d/40-write-config.sh
COPY --from=build /app/dist/flowly-frontend/browser /usr/share/nginx/html
ENV API_URL=/api \
    API_UPSTREAM=http://host.docker.internal:8000
EXPOSE 80
