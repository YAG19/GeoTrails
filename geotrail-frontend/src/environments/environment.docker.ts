// Docker / self-hosted build.
// API calls use RELATIVE URLs so they hit the same origin the app is served
// from (e.g. http://localhost:4200) and are reverse-proxied to the backend by
// nginx (see nginx.conf: location /api/ -> http://backend:8080/api/).
// This keeps requests same-origin and avoids CORS entirely.
export const environment = {
  production: true,
  devMode: true,
  devUser: 'dev',
  apiUrl: '/api',
  wsUrl: '/api/ws/tracking',
  command: 'docker'
};
