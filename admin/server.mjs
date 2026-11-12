// Local admin panel: edits the files under content/ that the site is built from, with the site running beside it for preview.
// Usage: npm run admin, then open the address it prints. Listens on this machine only.
import { createServer } from 'node:http';
import { spawn, execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { promisify } from 'node:util';

const PORT = Number(process.env.ADMIN_PORT ?? 4322);
const SITE = Number(process.env.SITE_PORT ?? 4321);
const root = resolve(import.meta.dirname, '..');
const at = (...p) => resolve(root, ...p);
const langs = ['es', 'en'];
const slugRe = /^[a-z0-9][a-z0-9-]*$/;
// Paths the site already serves under /<lang>/.
const reserved = ['blog', 'games', 'wiki', 'links', 'rss.xml', 'godot-agent'];
// Every write and command needs it, so another site open in the browser can't drive this server.
const token = randomBytes(16).toString('hex');
const run = promisify(execFile);

// --- Markdown front matter: written as JSON scalars (valid YAML); read back with the few forms these files use.
export function parseMd(text) {
	const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
	if (!m) return { data: {}, body: text };
	const data = {};
	for (const line of m[1].split(/\r?\n/)) {
		const kv = line.match(/^([\w-]+):\s*(.*)$/);
		if (!kv) continue;
		const v = kv[2].trim();
		data[kv[1]] = (() => {
			try { return JSON.parse(v); } catch {}
			if (/^\[.*\]$/.test(v)) return v.slice(1, -1).split(',').map((s) => s.trim().replace(/^(['"])(.*)\1$/, '$2')).filter(Boolean);
			return v.replace(/^'(.*)'$/, '$1');
		})();
	}
	return { data, body: m[2] };
}
export const writeMd = ({ data, body }) =>
	`---\n${Object.entries(data)
		.filter(([, v]) => v !== '' && v !== null && v !== undefined)
		.map(([k, v]) => `${k}: ${k === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : JSON.stringify(v)}`)
		.join('\n')}\n---\n\n${body.trim()}\n`;

const readJson = (f) => readFile(at(f), 'utf8').then(JSON.parse);
const writeJson = (f, v) => writeFile(at(f), JSON.stringify(v, null, 2) + '\n');
const ls = (d) => readdir(at(d)).catch(() => []);

// content/<kind>/<lang>/<slug>.md, grouped by slug.
async function docs(kind) {
	const out = {};
	for (const lang of langs)
		for (const f of await ls(`content/${kind}/${lang}`)) {
			if (!f.endsWith('.md')) continue;
			(out[f.slice(0, -3)] ??= { slug: f.slice(0, -3) })[lang] = parseMd(await readFile(at(`content/${kind}/${lang}/${f}`), 'utf8'));
		}
	return Object.values(out);
}

async function state() {
	const games = [];
	for (const f of await ls('content/store')) {
		if (!f.endsWith('.json')) continue;
		const slug = f.slice(0, -5);
		const s = await readJson(`content/store/${f}`);
		const own = await readJson(`content/games/${f}`).catch(() => ({}));
		games.push({
			slug,
			own,
			store: { source: s.source, id: s.id, url: s.url, title: s.title, cover: s.local_images?.cover, text: s.short ?? { en: s.description ?? '', es: '' }, jam: s.jam?.name ?? null, synced_at: s.synced_at }
		});
	}
	// Landing pages: the site's own fixed pages plus the ones made here.
	const fixed = (await ls('src/pages/[lang]')).filter((f) => f.endsWith('.astro') && !f.startsWith('[') && f !== 'index.astro').map((f) => f.slice(0, -6));
	const { stdout: changes } = await run('git', ['status', '--porcelain', '--', 'content', 'public'], { cwd: root });
	return {
		games,
		sources: await readJson('content/sources.json'),
		profile: await readJson('content/profile.json'),
		blog: await docs('blog'),
		pages: await docs('pages'),
		fixedPages: fixed,
		reserved,
		changes: changes.split('\n').filter(Boolean),
		site: `http://localhost:${SITE}`
	};
}

async function saveDoc(kind, slug, body) {
	if (!slugRe.test(slug)) throw new Error('El nombre solo puede tener minúsculas, números y guiones');
	if (kind === 'pages' && reserved.includes(slug)) throw new Error(`/${slug}/ ya es una página del sitio`);
	for (const lang of langs) {
		const d = body[lang];
		if (!d) continue;
		if (!String(d.data?.title ?? '').trim()) throw new Error(`Falta el título (${lang})`);
		await mkdir(at(`content/${kind}/${lang}`), { recursive: true });
		await writeFile(at(`content/${kind}/${lang}/${slug}.md`), writeMd({ data: d.data, body: d.body ?? '' }));
	}
}

async function sh(cmd, args) {
	try {
		const { stdout, stderr } = await run(cmd, args, { cwd: root, maxBuffer: 1 << 24 });
		return { ok: true, log: stdout + stderr };
	} catch (e) {
		return { ok: false, log: (e.stdout ?? '') + (e.stderr ?? '') + e.message };
	}
}

async function publish(message) {
	const steps = [
		['git', ['add', '-A', '--', 'content', 'public']],
		['git', ['commit', '-m', message || 'content: update from admin']],
		['git', ['pull', '--rebase']],
		['git', ['push']]
	];
	let log = '';
	for (const [c, a] of steps) {
		const r = await sh(c, a);
		log += `$ ${c} ${a.join(' ')}\n${r.log}\n`;
		if (!r.ok) return { ok: false, log };
	}
	return { ok: true, log };
}

const routes = {
	'GET state': () => state(),
	'PUT game': async (slug, body) => {
		if (!slugRe.test(slug.replace(/\./g, '-'))) throw new Error('Juego desconocido');
		await readFile(at(`content/store/${slug}.json`)); // only games the sync knows
		await writeJson(`content/games/${slug}.json`, body);
	},
	'PUT sources': (_, body) => writeJson('content/sources.json', body),
	'PUT profile': (_, body) => writeJson('content/profile.json', body),
	'PUT blog': (slug, body) => saveDoc('blog', slug, body),
	'PUT pages': (slug, body) => saveDoc('pages', slug, body),
	'DELETE blog': (slug, _, q) => removeDoc('blog', slug, q.get('lang')),
	'DELETE pages': (slug, _, q) => removeDoc('pages', slug, q.get('lang')),
	'POST media': async (_, { name, data }) => {
		const clean = String(name).toLowerCase().replace(/[^a-z0-9.-]+/g, '-').replace(/^[-.]+/, '');
		if (!/\.(png|jpe?g|gif|webp|svg)$/.test(clean)) throw new Error('Solo imágenes png, jpg, gif, webp o svg');
		await mkdir(at('public/media'), { recursive: true });
		await writeFile(at('public/media', clean), Buffer.from(data, 'base64'));
		return { url: `/media/${clean}` };
	},
	'POST sync': () => sh(process.execPath, ['scripts/sync-games.mjs']),
	'POST publish': (_, body) => publish(String(body?.message ?? '').trim())
};

async function removeDoc(kind, slug, lang) {
	if (!slugRe.test(slug)) throw new Error('Nombre inválido');
	for (const l of lang ? [lang] : langs) if (langs.includes(l)) await rm(at(`content/${kind}/${l}/${slug}.md`), { force: true });
}

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp' };

const server = createServer(async (req, res) => {
	const send = (code, body, type = 'application/json') => {
		res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' });
		res.end(type === 'application/json' ? JSON.stringify(body) : body);
	};
	// DNS rebinding: only answer to this machine's own names.
	if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host ?? '')) return send(403, { error: 'host' });
	const url = new URL(req.url, 'http://localhost');
	try {
		if (url.pathname === '/') return send(200, (await readFile(at('admin/index.html'), 'utf8')).replace('__TOKEN__', token), types['.html']);
		// Pictures for the panel (covers, uploads), straight from public/.
		if (url.pathname.startsWith('/public/')) {
			const f = resolve(root, decodeURIComponent(url.pathname.slice(1)));
			if (!f.startsWith(at('public') + sep)) return send(404, { error: 'not found' });
			return send(200, await readFile(f), types[extname(f).toLowerCase()] ?? 'application/octet-stream');
		}
		const [, api, name, ...rest] = url.pathname.split('/');
		const route = api === 'api' && routes[`${req.method} ${name}`];
		if (!route) return send(404, { error: 'not found' });
		if (req.headers['x-admin-token'] !== token) return send(403, { error: 'token' });
		let raw = '';
		for await (const chunk of req) raw += chunk;
		const result = await route(decodeURIComponent(rest.join('/')), raw ? JSON.parse(raw) : null, url.searchParams);
		send(200, result ?? { ok: true });
	} catch (e) {
		send(e.code === 'ENOENT' ? 404 : 400, { error: e.message });
	}
});

if (import.meta.url === `file://${process.argv[1]}`) {
	{
		const md = '---\ntitle: Post de prueba\ndate: 2026-10-21\ntags: [sitio, "a b"]\ndraft: true\n---\n\nHola `x`.\n';
		const p = parseMd(md);
		console.assert(p.data.title === 'Post de prueba' && p.data.date === '2026-10-21' && p.data.draft === true && p.data.tags.join('|') === 'sitio|a b' && p.body.trim() === 'Hola `x`.', p);
		const again = parseMd(writeMd({ data: { ...p.data, title: 'Dice: "hola" #1' }, body: p.body }));
		console.assert(again.data.title === 'Dice: "hola" #1' && again.data.date === '2026-10-21' && again.data.tags.length === 2 && again.body.trim() === 'Hola `x`.', again);
	}
	server.listen(PORT, '127.0.0.1', () => console.log(`\n  Admin: http://localhost:${PORT}/\n  Sitio: http://localhost:${SITE}/\n`));
	// The site itself, for the preview pane; it reloads on its own when a file under content/ changes.
	const astro = spawn(at('node_modules/.bin/astro'), ['dev', '--port', String(SITE)], { cwd: root, stdio: 'inherit' });
	const stop = () => { astro.kill(); process.exit(0); };
	process.on('SIGINT', stop);
	process.on('SIGTERM', stop);
}
