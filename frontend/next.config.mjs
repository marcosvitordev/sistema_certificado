import { fileURLToPath } from 'node:url';

const apiUrl = (process.env.API_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const parsed = new URL(apiUrl);
if (!['http:', 'https:'].includes(parsed.protocol) || parsed.pathname !== '/' || parsed.search || parsed.hash || parsed.username || parsed.password) {
  throw new Error('API_URL deve conter apenas a origem da API, por exemplo https://certifica-api.onrender.com');
}
if (process.env.VERCEL && (!process.env.API_URL || parsed.protocol !== 'https:')) {
  throw new Error('Configure API_URL com a URL HTTPS do Render antes de publicar.');
}

export default {
  turbopack: { root: fileURLToPath(new URL('.', import.meta.url)) },
  poweredByHeader: false,
  async rewrites() {
    return ['/api/:path*', '/certificado/:path*', '/qr/:path*', '/imprimir/:path*', '/js/print.js'].map(source => ({
      source, destination: `${apiUrl}${source}`,
    }));
  },
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    ] }];
  },
};
