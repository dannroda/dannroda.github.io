// Local admin panel: edits the files under content/ that the site is built from, with the site running beside it for preview.
// Usage: npm run admin, then open the address it prints. Listens on this machine only.
import { createServer } from 'node:http';
import { spawn, execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import { markdownToHtml } from 'satteri';
import { shortcodePlugin, shortcodes, markdownFeatures } from '../src/shortcodes.mjs';
import { blocks as blockLibrary, blockTypes } from '../src/blocks/schema.mjs';

const PORT = Number(process.env.ADMIN_PORT ?? 4322);
const SITE = Number(process.env.SITE_PORT ?? 4321);
const root = resolve(import.meta.dirname, '..');
const at = (...p) => resolve(root, ...p);
const langs = ['es', 'en'];
const slugRe = /^[a-z0-9][a-z0-9-]*$/;
// Paths the site already serves under /<lang>/.
const reserved = ['blog', 'games', 'wiki', 'links', 'rss.xml', 'admin-preview', 'admin-draft', 'home'];
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
// Every text file under content/, to find where a picture is used.
async function contentFiles(dir = 'content') {
	const out = [];
	for (const e of await readdir(at(dir), { withFileTypes: true }).catch(() => [])) {
		const p = `${dir}/${e.name}`;
		if (e.isDirectory()) out.push(...(await contentFiles(p)));
		else if (/\.(md|json)$/.test(e.name)) out.push(p);
	}
	return out;
}
async function media() {
	const files = (await readdir(at('public/media'), { withFileTypes: true }).catch(() => [])).filter((e) => e.isFile()).map((e) => e.name);
	const texts = await Promise.all((await contentFiles()).map(async (f) => [f, await readFile(at(f), 'utf8')]));
	return Promise.all(files.map(async (name) => ({
		name,
		url: `/media/${name}`,
		size: (await stat(at('public/media', name))).size,
		usedIn: texts.filter(([, t]) => t.includes(`/media/${name}`)).map(([f]) => f)
	})));
}

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
	// The site's own fixed pages (links), beside the block pages.
	const fixed = (await ls('src/pages/[lang]')).filter((f) => f.endsWith('.astro') && !f.startsWith('[') && !f.startsWith('admin-') && f !== 'index.astro').map((f) => f.slice(0, -6));
	const { stdout: changes } = await run('git', ['status', '--porcelain', '--untracked-files=all', '--', 'content', 'public'], { cwd: root });
	return {
		games,
		sources: await readJson('content/sources.json'),
		profile: await readJson('content/profile.json'),
		blog: await docs('blog'),
		// content/pages/<slug>.json, built from blocks; home is the home page.
		pages: Object.fromEntries(await Promise.all((await ls('content/pages')).filter((f) => f.endsWith('.json')).map(async (f) => [f.slice(0, -5), await readJson(`content/pages/${f}`)]))),
		blocks: blockLibrary,
		fixedPages: fixed,
		texts: await readJson('content/texts.json'),
		media: await media(),
		shortcodes: shortcodes.map(({ name, label, insert }) => ({ name, label, insert })),
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

// The site's own build, into a scratch folder: whatever would break the deploy breaks here first.
const check = () => sh(at('node_modules/.bin/astro'), ['build', '--outDir', '.astro/check-dist']);

async function publish(message) {
	const built = await check();
	if (!built.ok) return { ok: false, log: `La compilación del sitio falló; no se publicó nada.\n\n${built.log}` };
	let log = '';
	const step = async (a) => {
		const r = await sh('git', a);
		log += `$ git ${a.join(' ')}\n${r.log}\n`;
		return r;
	};
	const before = (await sh('git', ['rev-parse', 'HEAD'])).log.trim();
	for (const a of [['add', '-A', '--', 'content', 'public'], ['commit', '-m', message || 'content: update from admin']]) {
		if (!(await step(a)).ok) return { ok: false, log };
	}
	// --autostash: edits outside content/ and public/ (code, compass/) don't stop the pull.
	if (!(await step(['pull', '--rebase', '--autostash'])).ok) {
		const r = await settleRebase(before);
		log = r.log + log;
		if (!r.ok) return { ok: false, log };
	}
	if (!(await step(['push'])).ok) return { ok: false, log };
	return { ok: true, log };
}

// The sync bot commits store data to main every day and on each deploy, so a pull can clash with what the panel is
// publishing. Files the sync writes (content/store/, public/games/) are rebuilt on the next deploy anyway: keep this
// commit's side of them (a deletion included) and go on. Any other clash cancels the rebase and undoes the commit, so
// the changes are back as unpublished, and says which files clash. The repo is never left halfway through a rebase.
const syncOwned = (p) => p.startsWith('content/store/') || p.startsWith('public/games/');
async function settleRebase(before) {
	const inRebase = (await sh('git', ['rev-parse', '--verify', '-q', 'REBASE_HEAD'])).ok;
	if (!inRebase) {
		await sh('git', ['reset', '--soft', before]);
		return { ok: false, log: 'No se pudo traer lo último de GitHub; no se publicó nada y tus cambios siguen en «Cambios sin publicar».\n\n' };
	}
	for (let round = 0; round < 20; round++) {
		const { log: unmerged } = await sh('git', ['ls-files', '-u']);
		// "<mode> <sha> <stage>\t<path>"; stage 3 is this commit's side while rebasing
		const stages = new Map();
		for (const l of unmerged.split('\n').filter(Boolean)) {
			const [meta, path] = l.split('\t');
			stages.set(path, [...(stages.get(path) ?? []), meta.split(' ')[2]]);
		}
		const clash = [...stages.keys()];
		if (!clash.length || !clash.every(syncOwned)) {
			await sh('git', ['rebase', '--abort']);
			await sh('git', ['reset', '--soft', before]);
			return {
				ok: false,
				log: `Mientras editabas, cambiaron en GitHub los mismos archivos que querés publicar:\n\n${clash.map((p) => '  ' + p).join('\n')}\n\nNo se publicó nada y tus cambios siguen en «Cambios sin publicar». Revisalos en el Historial (lo nuevo de GitHub ya está ahí) y publicá de nuevo.\n\n`
			};
		}
		for (const [path, st] of stages) {
			if (st.includes('3')) await sh('git', ['checkout', '--theirs', '--', path]).then(() => sh('git', ['add', '--', path]));
			else await sh('git', ['rm', '-q', '--', path]);
		}
		const r = await sh('git', ['-c', 'core.editor=true', 'rebase', '--continue']);
		if (r.ok) return { ok: true, log: `Choque con la sync de las tiendas en ${clash.join(', ')}: quedó tu versión.\n\n` };
		if (!(await sh('git', ['rev-parse', '--verify', '-q', 'REBASE_HEAD'])).ok) return { ok: false, log: r.log };
	}
	await sh('git', ['rebase', '--abort']);
	await sh('git', ['reset', '--soft', before]);
	return { ok: false, log: 'El rebase no terminó; se canceló y no se publicó nada.\n\n' };
}

// ---------- History: git, limited to the files the panel edits.
const shaRe = /^[0-9a-f]{7,40}$/;
const pathOk = (p) => /^(content|public)\//.test(p) && !p.split('/').includes('..');
async function history() {
	const { stdout } = await run('git', ['log', '-n', '200', '--format=%x1e%H%x1f%an%x1f%aI%x1f%s', '--name-status', '--', 'content', 'public'], { cwd: root, maxBuffer: 1 << 24 });
	return stdout.split('\x1e').filter(Boolean).map((block) => {
		const [head, ...lines] = block.split('\n');
		const [sha, author, date, message] = head.split('\x1f');
		// "M\tpath", or "R100\told\tnew" for a rename: the file as it ended up.
		const files = lines.filter(Boolean).map((l) => { const [st, ...ps] = l.split('\t'); return { status: st[0], path: ps.at(-1), from: ps.length > 1 ? ps[0] : null }; }).filter((f) => pathOk(f.path));
		return { sha, author, date, message, bot: author.endsWith('[bot]'), files };
	}).filter((c) => c.files.length);
}
async function diff(sha, path) {
	if (!pathOk(path) || (sha && !shaRe.test(sha))) throw new Error('Pedido inválido');
	if (sha) return (await run('git', ['show', '--format=', '--no-color', sha, '--', path], { cwd: root, maxBuffer: 1 << 24 })).stdout;
	// Not published yet: against the last commit, or the whole file when it's new.
	const { stdout } = await run('git', ['diff', '--no-color', 'HEAD', '--', path], { cwd: root, maxBuffer: 1 << 24 });
	if (stdout) return stdout;
	const text = await readFile(at(path), 'utf8').catch(() => '');
	return text.split('\n').map((l) => '+' + l).join('\n');
}
// Put a file back as it was before `sha` (or as last published, with no sha). A file that didn't exist then is removed.
async function restore(sha, path) {
	if (!pathOk(path) || (sha && !shaRe.test(sha))) throw new Error('Pedido inválido');
	const source = sha ? `${sha}^` : 'HEAD';
	const existed = await run('git', ['cat-file', '-e', `${source}:${path}`], { cwd: root }).then(() => true, () => false);
	if (existed) await run('git', ['restore', `--source=${source}`, '--staged', '--worktree', '--', path], { cwd: root });
	else {
		await run('git', ['rm', '-q', '--cached', '--ignore-unmatch', '--', path], { cwd: root });
		await rm(at(path), { force: true });
	}
}

// Texts read by the site's code (content/texts.json): only values change here, never the keys.
async function saveTexts(file, body) {
	const keys = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' && !Array.isArray(v) ? keys(v, `${p}${k}.`) : [`${p}${k}`])).sort().join();
	if (keys(body) !== keys(await readJson(file))) throw new Error('Los textos no tienen las mismas claves que el sitio');
	await writeJson(file, body);
}

const routes = {
	'GET state': () => state(),
	'PUT game': async (slug, body) => {
		if (!slugRe.test(slug.replace(/\./g, '-'))) throw new Error('Juego desconocido');
		await readFile(at(`content/store/${slug}.json`)); // only games the sync knows
		await writeJson(`content/games/${slug}.json`, body);
	},
	// Off the site now, not at the next store sync: the same files the sync's cleanup removes.
	'DELETE game': async (slug) => {
		if (!slugRe.test(slug.replace(/\./g, '-'))) throw new Error('Juego desconocido');
		for (const f of [`content/store/${slug}.json`, `content/games/${slug}.json`, `public/games/${slug}`]) await rm(at(f), { recursive: true, force: true });
	},
	'PUT sources': (_, body) => writeJson('content/sources.json', body),
	'PUT profile': (_, body) => writeJson('content/profile.json', body),
	'PUT blog': (slug, body) => saveDoc('blog', slug, body),
	'PUT page': async (slug, body) => {
		if (!slugRe.test(slug) || (slug !== 'home' && reserved.includes(slug))) throw new Error('Ese nombre ya es una ruta del sitio');
		if (!Array.isArray(body?.blocks) || body.blocks.some((b) => !blockTypes.includes(b?.type) || !b.id)) throw new Error('Un bloque no es de ningún tipo conocido');
		await writeJson(`content/pages/${slug}.json`, body);
	},
	// The page being edited, unsaved, for the preview (src/pages/[lang]/admin-draft.astro).
	'POST draft': async (_, body) => {
		await mkdir(at('.astro'), { recursive: true });
		await writeFile(at('.astro/admin-draft.json'), JSON.stringify(body));
	},
	'DELETE blog': (slug, _, q) => removeDoc('blog', slug, q.get('lang')),
	'DELETE page': async (slug) => {
		if (!slugRe.test(slug) || slug === 'home') throw new Error('La página de inicio no se borra');
		await rm(at(`content/pages/${slug}.json`));
	},
	'POST media': async (_, { name, data, replace }) => {
		// Replace: new picture, same file, so every page using it shows the new one.
		if (replace) {
			if (!/^[a-z0-9][a-z0-9.-]*$/.test(replace)) throw new Error('Nombre inválido');
			if (extname(replace).toLowerCase() !== extname(String(name)).toLowerCase().replace('.jpeg', '.jpg') && extname(replace).toLowerCase() !== extname(String(name)).toLowerCase())
				throw new Error(`El reemplazo tiene que ser del mismo tipo (${extname(replace)})`);
			await stat(at('public/media', replace));
			await writeFile(at('public/media', replace), Buffer.from(data, 'base64'));
			return { url: `/media/${replace}` };
		}
		const clean = String(name).toLowerCase().replace(/[^a-z0-9.-]+/g, '-').replace(/^[-.]+/, '');
		if (!/\.(png|jpe?g|gif|webp|svg)$/.test(clean)) throw new Error('Solo imágenes png, jpg, gif, webp o svg');
		await mkdir(at('public/media'), { recursive: true });
		// Never replace a picture already in use: a taken name gets -2, -3…
		let file = clean;
		for (let i = 2; await stat(at('public/media', file)).then(() => true, () => false); i++) file = clean.replace(/(\.\w+)$/, `-${i}$1`);
		await writeFile(at('public/media', file), Buffer.from(data, 'base64'));
		return { url: `/media/${file}` };
	},
	'PUT texts': (_, body) => saveTexts('content/texts.json', body),
	'POST render': (_, { md, kind, lang }) => {
		try {
			// A path like the real file's, so shortcodes link in the right language.
			const fileURL = `file://${root}/content/${kind}/${lang}/preview.md`;
			return { html: markdownToHtml(String(md ?? ''), { features: markdownFeatures, mdastPlugins: [shortcodePlugin('')], fileURL }).html };
		} catch (e) {
			return { error: e.message };
		}
	},
	// Rename a picture and every reference to it under content/.
	'POST rename-media': async (name, { to }) => {
		const clean = String(to ?? '').toLowerCase().replace(/[^a-z0-9.-]+/g, '-').replace(/^[-.]+/, '');
		if (!/^[a-z0-9][a-z0-9.-]*$/.test(name) || !clean) throw new Error('Nombre inválido');
		const target = extname(clean) ? clean : clean + extname(name);
		if (extname(target).toLowerCase() !== extname(name).toLowerCase()) throw new Error(`Tiene que seguir siendo ${extname(name)}`);
		if (await stat(at('public/media', target)).then(() => true, () => false)) throw new Error(`Ya existe ${target}`);
		await rename(at('public/media', name), at('public/media', target));
		for (const f of await contentFiles()) {
			const text = await readFile(at(f), 'utf8');
			if (text.includes(`/media/${name}`)) await writeFile(at(f), text.split(`/media/${name}`).join(`/media/${target}`));
		}
		return { url: `/media/${target}` };
	},
	'DELETE media': async (name) => {
		if (!/^[a-z0-9][a-z0-9.-]*$/.test(name)) throw new Error('Nombre inválido');
		await rm(at('public/media', name));
	},
	'POST rename': async (path, { to }) => {
		const [kind, slug] = path.split('/');
		if (!['blog', 'pages'].includes(kind) || !slugRe.test(slug) || slug === 'home') throw new Error('Nombre inválido');
		if (!slugRe.test(to ?? '')) throw new Error('El nombre nuevo solo puede tener minúsculas, números y guiones');
		if (kind === 'pages' && reserved.includes(to)) throw new Error(`/${to}/ ya es una página del sitio`);
		const file = (s, l) => (kind === 'pages' ? `content/pages/${s}.json` : `content/blog/${l}/${s}.md`);
		const exists = await Promise.all(langs.map((l) => stat(at(file(to, l))).then(() => true, () => false)));
		if (exists.some(Boolean)) throw new Error(`Ya existe /${to}/`);
		for (const l of kind === 'pages' ? ['es'] : langs) await rename(at(file(slug, l)), at(file(to, l))).catch((e) => { if (e.code !== 'ENOENT') throw e; });
		// A game whose landing is this page follows it.
		if (kind === 'pages')
			for (const f of await ls('content/games')) {
				const g = await readJson(`content/games/${f}`);
				if (g.landing?.trim() === slug) await writeJson(`content/games/${f}`, { ...g, landing: to });
			}
	},
	'GET history': () => history(),
	'POST diff': (_, { sha, path }) => diff(sha, path).then((text) => ({ text })),
	'POST restore': async (_, { sha, path }) => {
		for (const p of [].concat(path)) await restore(sha, p);
	},
	'POST check': () => check(),
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
	// The site itself, for the preview pane. --ignore-lock: Astro otherwise refuses a second dev server, and the preview
	// would silently show whatever other one runs on its port.
	const astro = spawn(at('node_modules/.bin/astro'), ['dev', '--port', String(SITE), '--ignore-lock'], { cwd: root, stdio: 'inherit' });
	const stop = (code = 0) => { astro.kill(); process.exit(code); };
	process.on('SIGINT', () => stop());
	process.on('SIGTERM', () => stop());
	server.on('error', (e) => {
		console.error(e.code === 'EADDRINUSE' ? `\n  The admin is already running at http://localhost:${PORT}/ (or something else uses that port; set ADMIN_PORT).\n` : e);
		stop(1);
	});
	server.listen(PORT, '127.0.0.1', () => console.log(`\n  Admin: http://localhost:${PORT}/\n  Sitio: http://localhost:${SITE}/\n`));
}
