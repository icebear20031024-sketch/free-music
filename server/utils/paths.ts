import path from 'path';

/**
 * Writable root for plugins and JSON databases. Defaults to `<cwd>/server` so
 * `npm run dev` keeps using the repo layout; the Electron shell points it at
 * the per-user app data directory instead, since an installed .app/.exe cannot
 * write next to its own binary.
 */
export const DATA_ROOT = process.env.MUSIC_DATA_DIR ?? path.join(process.cwd(), 'server');

export const PLUGINS_DIR = path.join(DATA_ROOT, 'plugins');
export const DATA_DIR = path.join(DATA_ROOT, 'data');

/** Directory holding the built web client (index.html + assets). */
export const STATIC_DIR = process.env.MUSIC_STATIC_DIR ?? path.join(process.cwd(), 'dist');
