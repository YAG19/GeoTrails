package com.geotrail.tracking.filter;

import com.geotrail.auth.entity.User;
import com.geotrail.auth.repository.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

/**
 * Authenticates OwnTracks requests via HTTP Basic against the same user table the rest of the app
 * uses. Scoped to the {@code /owntracks} endpoint so it never interferes with the JWT-protected
 * routes. On success it populates the {@link SecurityContextHolder} with the matching {@link User}
 * principal; on failure it leaves the context empty and the security chain rejects the request.
 *
 * <p>This keeps all auth out of {@code OwnTracksController}, which only forwards the authenticated
 * principal to the service (layered-architecture skill).
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class OwnTracksAuthFilter extends OncePerRequestFilter {

    /** Servlet path excludes the {@code /api} context-path, so this matches {@code POST /api/owntracks}. */
    private static final String OWNTRACKS_PATH = "/owntracks";

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    protected boolean shouldNotFilter(@NonNull HttpServletRequest request) {
        return !OWNTRACKS_PATH.equals(request.getServletPath());
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {

        if (SecurityContextHolder.getContext().getAuthentication() == null) {
            User user = authenticateBasic(request.getHeader(HttpHeaders.AUTHORIZATION));
            if (user != null) {
                var authToken = new UsernamePasswordAuthenticationToken(
                        user, null, user.getAuthorities());
                authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(authToken);
            }
        }

        filterChain.doFilter(request, response);
    }

    private User authenticateBasic(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Basic ")) {
            log.debug("Missing or invalid Authorization header for OwnTracks");
            return null;
        }

        try {
            String decoded = new String(
                    Base64.getDecoder().decode(authHeader.substring(6)),
                    StandardCharsets.UTF_8
            );
            String[] parts = decoded.split(":", 2);
            if (parts.length != 2) return null;

            String username = parts[0];
            String password = parts[1];

            return userRepository.findByUsername(username)
                    .filter(user -> passwordEncoder.matches(password, user.getPasswordHash()))
                    .orElse(null);

        } catch (Exception e) {
            log.warn("Failed to parse OwnTracks Basic auth: {}", e.getMessage());
            return null;
        }
    }
}
