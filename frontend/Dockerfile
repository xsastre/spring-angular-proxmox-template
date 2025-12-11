# Etapa 1: Build de l'aplicació Angular
FROM node:20-alpine AS build

WORKDIR /app

# Copiar fitxers de configuració de npm
COPY package*.json ./

# Instal·lar dependències
RUN npm ci

# Copiar el codi font
COPY . .

# Compilar l'aplicació per producció
RUN npm run build:prod

# Etapa 2: Servidor Nginx
FROM nginx:alpine

# Copiar els fitxers compilats des de l'etapa de build
COPY --from=build /app/dist/template-daw-frontend /usr/share/nginx/html

# Copiar configuració personalitzada de Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Exposar el port 80
EXPOSE 80

# Nginx s'executarà automàticament
CMD ["nginx", "-g", "daemon off;"]
