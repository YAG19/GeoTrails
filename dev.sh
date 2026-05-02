#!/bin/bash

# GeoTrails Development Launcher
# This script starts both the Spring Boot backend and Angular frontend using npx concurrently.

echo ">>> Starting GeoTrails Development Environment..."

# We use npx concurrently to run both processes and automatically handle output prefixing and graceful shutdown.
npx concurrently \
  --kill-others \
  --names "BACKEND,FRONTEND" \
  --prefix-colors "blue,green" \
  "cd geotrail-backend && mvn spring-boot:run" \
  "cd geotrail-frontend && npm start"
