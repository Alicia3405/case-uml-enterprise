# Stage 1: Build the Angular App
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
# Compilamos Angular con optimizaciones
RUN npm run build --configuration=production

# Stage 2: Serve the app with NGINX
FROM nginx:alpine
# Copiamos la configuración perzonalizada de NGINX que creamos
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Eliminamos la página por defecto de nginx y copiamos la nuestra compilada (Cambia "workflow-frontend-angular" si en tu angular.json outputPath es distinto)
RUN rm -rf /usr/share/nginx/html/*
COPY --from=build /app/dist/workflow-frontend-angular/browser /usr/share/nginx/html

# Exponer el puerto por el cual Cloud Run le inyecta tráfico (Nginx conf espera el 8080)
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
