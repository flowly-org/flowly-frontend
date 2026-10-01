FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx ng build --configuration production

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/40-write-config.sh /docker-entrypoint.d/40-write-config.sh
COPY --from=build /app/dist/flowly-frontend/browser /usr/share/nginx/html
ENV API_URL=http://localhost:8000/api
EXPOSE 80
