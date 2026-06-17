package com.geotrail.common.exception;

import com.geotrail.common.dto.ApiResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

import java.util.Map;
import java.util.stream.Collectors;

/**
 * Centralised exception handling. Extends {@link ResponseEntityExceptionHandler} so that Spring's
 * built-in MVC exceptions (malformed JSON, missing request params, type mismatches on
 * {@code Instant}/{@code LocalDate}, …) are handled here too. The base class would emit an
 * RFC-9457 {@code ProblemDetail} body; we override {@link #handleExceptionInternal} to keep the
 * app-wide {@link ApiResponse} envelope everywhere.
 */
@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

    @Override
    protected ResponseEntity<Object> handleMethodArgumentNotValid(
            MethodArgumentNotValidException ex,
            HttpHeaders headers,
            HttpStatusCode status,
            WebRequest request) {

        Map<String, String> fieldErrors = ex.getBindingResult().getFieldErrors().stream()
                .collect(Collectors.toMap(
                        FieldError::getField,
                        error -> error.getDefaultMessage() != null ? error.getDefaultMessage() : "Invalid value",
                        (first, second) -> first
                ));

        return handleExceptionInternal(ex, ApiResponse.error("Validation failed", fieldErrors),
                headers, status, request);
    }

    /**
     * Wraps every exception handled by the base class in the {@link ApiResponse} envelope. Bodies
     * we have already built (e.g. the field-error map above) pass through untouched; the rest get a
     * friendly, type-specific message instead of the default ProblemDetail.
     */
    @Override
    protected ResponseEntity<Object> handleExceptionInternal(
            Exception ex,
            Object body,
            HttpHeaders headers,
            HttpStatusCode statusCode,
            WebRequest request) {

        Object envelope = (body instanceof ApiResponse<?>) ? body : ApiResponse.error(resolveMessage(ex));
        return super.handleExceptionInternal(ex, envelope, headers, statusCode, request);
    }

    private String resolveMessage(Exception ex) {
        if (ex instanceof MissingServletRequestParameterException missing) {
            return "Missing required request parameter: " + missing.getParameterName();
        }
        if (ex instanceof MethodArgumentTypeMismatchException mismatch) {
            return "Invalid value for parameter: " + mismatch.getName();
        }
        if (ex instanceof org.springframework.http.converter.HttpMessageNotReadableException) {
            return "Malformed or unreadable request body";
        }
        return ex.getMessage() != null ? ex.getMessage() : "Request could not be processed";
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiResponse<Void>> handleIllegalArgument(IllegalArgumentException ex) {
        return ResponseEntity.badRequest()
                .body(ApiResponse.error(ex.getMessage()));
    }

    @ExceptionHandler({BadCredentialsException.class, UsernameNotFoundException.class})
    public ResponseEntity<ApiResponse<Void>> handleAuthFailure(Exception ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(ApiResponse.error("Invalid username or password"));
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleNotFound(ResourceNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.error(ex.getMessage()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleGeneral(Exception ex) {
        log.error("Unhandled exception", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("An unexpected error occurred"));
    }
}
