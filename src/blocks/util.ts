import { url, type Lang } from '../i18n';

// A translated field ({es, en}) in one language; an empty translation falls back to the other language.
export const tx = (v: unknown, lang: Lang): string => {
	if (typeof v === 'string') return v;
	const o = (v ?? {}) as Record<string, string>;
	return o[lang] || o[lang === 'es' ? 'en' : 'es'] || '';
};
// Site paths ("/media/x.webp", "/games/…") get the deploy prefix; full links and #anchors stay as they are.
export const link = (u: unknown, lang?: Lang) => {
	const v = lang ? tx(u, lang) : typeof u === 'string' ? u : '';
	return v.startsWith('/') ? url(v) : v || undefined;
};
// A translated list of words ({es: [...], en: [...]}), or an older plain list.
export const words = (v: unknown, lang: Lang): string[] => {
	if (Array.isArray(v)) return v;
	const o = (v ?? {}) as Record<string, string[]>;
	return o[lang]?.length ? o[lang] : o[lang === 'es' ? 'en' : 'es'] ?? [];
};
export const img = (v: unknown, lang: Lang) => link(v, lang);
export const pill = (style: string | undefined) => (style === 'primary' ? 'pill primary' : style === 'ghost' ? 'pill ghost' : 'pill');
// Fields of list items arrive untyped from JSON.
export type Item = Record<string, any>;
// An image field's size, stored beside it as <key>Size ({es: [w, h], en: [w, h]}) when the admin picks it, so the page
// keeps the picture's space before it loads instead of jumping as you scroll.
export const size = (b: Item, key: string, lang: Lang) => {
	const v = (b[`${key}Size`] ?? {}) as Record<string, number[]>;
	const wh = v[lang]?.length ? v[lang] : v[lang === 'es' ? 'en' : 'es'];
	return wh?.length === 2 ? { width: wh[0], height: wh[1] } : {};
};
