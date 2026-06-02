# PostGIS + pgvector in one image.
# GeoTrail needs PostGIS (geometry columns / hibernate-spatial) AND pgvector
# (RAG timeline_embeddings). No official image bundles both, so we extend the
# official PostGIS image and install the matching pgvector apt package.
#
# Base is Debian-based and already ships the PGDG apt repo, so the versioned
# pgvector package installs cleanly.
FROM postgis/postgis:16-3.4

RUN apt-get update \
    && apt-get install -y --no-install-recommends postgresql-16-pgvector \
    && rm -rf /var/lib/apt/lists/*
