import handler, { PluginBridge } from '@emdash-cms/cloudflare/worker';
import media from './worker.js';
import home from './content/index.html?raw';
import projects from './content/projects.html?raw';
import notes from './content/work-notes.html?raw';
import outside from './content/outside-work.html?raw';

export { PluginBridge };
const OWNER_DIGEST = "e574344e8bccbbaf38d49d77d492801fa7c48e30f6161e57f53cfb4f6c15b230";
const originals = new Map([['/', home], ['/projects', projects], ['/work-notes', notes], ['/outside-work', outside]]);
let initialized = false;
async function ready(db) {
  if (initialized) return true;
  try {
    const row = await db.prepare("SELECT value FROM options WHERE name='emdash:setup_complete' AND EXISTS (SELECT 1 FROM users)").first();
    initialized = row?.value === 'true' || row?.value === '"true"';
  } catch (error) {
    if (!String(error).includes('no such table')) throw error;
  }
  return initialized;
}
export default {
  ...handler,
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (path.startsWith('/media/')) return media.fetch(request, env, ctx);
    if (path === '/admin') return Response.redirect(new URL('/_emdash/admin', url), 302);
    const canonical = path.replace(/\.html$/, '').replace(/^\/index$/, '/').replace(/\/$/, '') || '/';
    if (canonical !== path && originals.has(canonical)) return Response.redirect(new URL(canonical + url.search, url), 308);
    if (!(await ready(env.DB))) {
      if (originals.has(path) && ['GET','HEAD'].includes(request.method)) {
        return new Response(request.method === 'HEAD' ? null : originals.get(path), {headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
      }
      // Before the owner registers a passkey, protect the entire setup surface.
      const input = (request.headers.get('Authorization') || '').replace(/^Basic /, '');
      const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
      const digest = Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2,'0')).join('');
      if (digest !== OWNER_DIGEST) return new Response('Owner setup', {status:401,headers:{'WWW-Authenticate':'Basic realm="Portfolio setup"','Cache-Control':'no-store'}});
    }
    return handler.fetch(request, env, ctx);
  },
};
