# ==================== BUILD STAGE ====================
# syntax=docker/dockerfile:1
FROM maven:3.9-eclipse-temurin-21-alpine AS builder

WORKDIR /app

COPY pom.xml .
COPY src/ src/

# BuildKit cache mount: ~/.m2 is reused across every build.
# Dependencies are never re-downloaded unless pom.xml changes.
RUN --mount=type=cache,target=/root/.m2 \
    mvn package -DskipTests -B

# ==================== RUNTIME STAGE ====================
FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

# Create non-root user
RUN addgroup -S geotrail && adduser -S geotrail -G geotrail

# Copy the built JAR
COPY --from=builder /app/target/*.jar app.jar

# Own files as non-root user
RUN chown -R geotrail:geotrail /app
USER geotrail

EXPOSE 8080

# JVM tuning for container environments
ENV JAVA_OPTS="-XX:+UseContainerSupport \
               -XX:MaxRAMPercentage=75.0 \
               -XX:+UseZGC \
               -XX:+ZGenerational"

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
