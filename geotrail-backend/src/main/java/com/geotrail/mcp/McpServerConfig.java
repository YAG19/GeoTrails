package com.geotrail.mcp;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.modelcontextprotocol.server.McpServer;
import io.modelcontextprotocol.server.McpSyncServer;
import io.modelcontextprotocol.server.transport.WebMvcSseServerTransportProvider;
import io.modelcontextprotocol.spec.McpSchema;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.function.RouterFunction;
import org.springframework.web.servlet.function.ServerResponse;

/**
 * Wires an MCP server into the existing Spring MVC app over an SSE transport.
 *
 * <p>Two HTTP routes are added (relative to the {@code /api} context-path):
 * <ul>
 *   <li>{@code GET  /api/sse} — the SSE stream an MCP client connects to</li>
 *   <li>{@code POST /api/mcp/message} — where the client posts JSON-RPC requests</li>
 * </ul>
 * The {@code baseUrl} below is set to {@code /api} so the endpoint URL advertised
 * to clients over SSE includes the servlet context-path.
 */
@Configuration
public class McpServerConfig {

    @Bean
    public WebMvcSseServerTransportProvider mcpTransportProvider(ObjectMapper objectMapper) {
        return new WebMvcSseServerTransportProvider(objectMapper, "/api", "/mcp/message", "/sse");
    }

    /** Spring Boot auto-registers RouterFunction beans, exposing the MCP routes. */
    @Bean
    public RouterFunction<ServerResponse> mcpRouterFunction(WebMvcSseServerTransportProvider provider) {
        return provider.getRouterFunction();
    }

    @Bean
    public McpSyncServer mcpSyncServer(WebMvcSseServerTransportProvider provider, GeoTrailMcpTools tools) {
        return McpServer.sync(provider)
                .serverInfo("geotrail", "0.1.0")
                .capabilities(McpSchema.ServerCapabilities.builder().tools(true).build())
                .tools(tools.toolSpecifications())
                .build();
    }
}
