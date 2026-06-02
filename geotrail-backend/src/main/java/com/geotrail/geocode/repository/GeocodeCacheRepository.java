package com.geotrail.geocode.repository;

import com.geotrail.geocode.entity.GeocodeCache;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.Optional;

@Repository
public interface GeocodeCacheRepository extends JpaRepository<GeocodeCache, Long> {

    Optional<GeocodeCache> findByLatKeyAndLonKey(BigDecimal latKey, BigDecimal lonKey);
}
