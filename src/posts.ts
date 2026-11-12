import { getCollection } from 'astro:content';
import type { Lang } from './i18n';

// Drafts and scheduled posts (dated in the future) show up in `npm run dev` only.
// A scheduled post goes live with the first build on or after its date: the deploy workflow rebuilds daily at 09:00 UTC.
export async function posts(lang: Lang) {
	const now = new Date();
	return (await getCollection('blog', (p) => p.id.startsWith(`${lang}/`) && (import.meta.env.DEV || (!p.data.draft && p.data.date <= now)))).sort(
		(a, b) => b.data.date.getTime() - a.data.date.getTime()
	);
}

// Block pages, both languages in one file; home is the home page, not one of these.
export async function pages() {
	return getCollection('pages', (p) => p.id !== 'home' && (import.meta.env.DEV || !p.data.draft));
}

export const slugOf = (id: string) => id.split('/').slice(1).join('/');
