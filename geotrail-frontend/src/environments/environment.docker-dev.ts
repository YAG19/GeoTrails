// Used by ng serve inside Docker (docker-compose.dev.yml).
// Browser calls same-origin /api; the dev server proxies to backend:8080.
export const environment = {
  production: false,
  devMode: true,
  devUser: 'dev',
  apiUrl: '/api',
  wsUrl: '/api/ws/tracking',
  command: 'docker compose dev (ng serve)',
};
