// Shortcodes for posts and pages: a line like ::youtube{id="…"} becomes a widget. Rendered at build time by
// astro.config.mjs and live by the admin's preview, so both read this one file.
// The admin's toolbar lists `shortcodes`; each one's `insert` is what it puts in the text.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const read = (f) => {
	try { return JSON.parse(readFileSync(root + f, 'utf8')); } catch { return null; }
};
// A game by its file name in content/store/, or a clear error naming the shortcode.
const game = (name, slug) => {
	const store = read(`content/store/${slug}.json`);
	if (!store) throw new Error(`::${name}: no game "${slug}" in content/store/`);
	return { store, own: read(`content/games/${slug}.json`) ?? {} };
};
// YouTube takes a bare id or any of its link forms.
export const youtubeId = (v) => String(v ?? '').match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})|^([\w-]{11})$/)?.slice(1).find(Boolean) ?? null;

export const shortcodes = [
	{
		name: 'youtube',
		label: 'Video de YouTube (link o id)',
		insert: '::youtube{id="…"}', // the link or just the id
		render({ id, start }) {
			const v = youtubeId(id);
			if (!v) throw new Error(`::youtube: "${id ?? ''}" is not a YouTube link or id`);
			const t = Number(start) > 0 ? `?start=${Number(start)}` : '';
			return `<div class="embed embed-video"><iframe src="https://www.youtube-nocookie.com/embed/${v}${t}" title="YouTube" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>`;
		}
	},
	{
		name: 'game',
		label: 'Tarjeta de un juego del sitio',
		insert: '::game{slug="…"}',
		render({ slug }, { base, lang }) {
			const { store, own } = game('game', slug);
			const text = own.summary?.[lang] || store.short?.[lang] || store.short?.en || store.description || '';
			const cover = store.local_images?.cover;
			return `<a class="embed embed-game" href="${esc(`${base}${lang ? `/${lang}` : ''}/games/${slug}/`)}">${cover ? `<img src="${esc(base + cover)}" alt="" loading="lazy" />` : ''}<span><strong>${esc(store.title)}</strong>${text ? `<span>${esc(text)}</span>` : ''}</span></a>`;
		}
	},
	{
		name: 'store',
		label: 'Widget de Steam o itch.io',
		insert: '::store{slug="…"}',
		render({ slug }) {
			const { store } = game('store', slug);
			if (store.source === 'steam') return `<div class="embed embed-store"><iframe src="https://store.steampowered.com/widget/${store.id}/" title="${esc(store.title)} en Steam" loading="lazy" height="190"></iframe></div>`;
			if (store.source === 'itch') return `<div class="embed embed-store"><iframe src="https://itch.io/embed/${store.id}?dark=true" title="${esc(store.title)} en itch.io" loading="lazy" height="167"></iframe></div>`;
			throw new Error(`::store: "${slug}" is on ${store.source}, which has no widget; use ::game`);
		}
	}
];

// Sätteri plugin. base is the deploy prefix ("" locally); the language comes from the file's folder (content/blog/es/…).
export function shortcodePlugin(base = '') {
	return {
		name: 'shortcodes',
		leafDirective(node, ctx) {
			const sc = shortcodes.find((s) => s.name === node.name);
			if (!sc) throw new Error(`Unknown shortcode ::${node.name} (there are: ${shortcodes.map((s) => s.name).join(', ')})`);
			const lang = String(ctx.fileURL ?? '').match(/\/content\/(?:blog|pages)\/(es|en)\//)?.[1] ?? null;
			ctx.replaceNode(node, { type: 'html', value: sc.render(node.attributes ?? {}, { base, lang }) });
		},
		// Directives also read "10:30" or "nota:importante" as inline ones; put that text back as written.
		textDirective(node, ctx) {
			const label = ctx.textContent(node);
			ctx.replaceNode(node, { type: 'text', value: `:${node.name}${label ? `[${label}]` : ''}` });
		},
		containerDirective(node) {
			throw new Error(`Unknown block :::${node.name}; shortcodes are one line, like ::youtube{id="…"}`);
		}
	};
}

// The same settings for the site and the preview.
export const markdownFeatures = { directive: true };
