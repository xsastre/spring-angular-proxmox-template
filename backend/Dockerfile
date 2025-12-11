# Etapa 1: Build de l'aplicació
FROM maven:3.9.6-eclipse-temurin-17 AS build

WORKDIR /app

# Copiar fitxers de configuració de Maven
COPY pom.xml .
COPY .mvn .mvn

# Descarregar dependències (aquesta capa es cachejarà si el pom.xml no canvia)
RUN mvn dependency:go-offline -B

# Copiar el codi font
COPY src ./src

# Compilar i empaquetar l'aplicació
RUN mvn clean package -DskipTests

# Etapa 2: Imatge d'execució
FROM eclipse-temurin:17-jre-alpine

WORKDIR /app

# Copiar el JAR des de l'etapa de build
COPY --from=build /app/target/*.jar app.jar

# Exposar el port 8080
EXPOSE 8080

# Executar l'aplicació amb el perfil de producció
ENTRYPOINT ["java", "-Dspring.profiles.active=prod", "-jar", "app.jar"]
