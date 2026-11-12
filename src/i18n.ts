import texts from '../content/texts.json';

export const langs = ['es', 'en'] as const;
export type Lang = (typeof langs)[number];

// Every fixed text of the site, in both languages; edited in the admin (npm run admin) under Textos.
export const t = texts;

export const other = (lang: Lang): Lang => (lang === 'es' ? 'en' : 'es');

// Paths in content (e.g. "/games/x/cover.jpg") are site-relative; prefix the deploy base (GitHub Pages project sites live under /<repo>/).
export const url = (path: string) => import.meta.env.BASE_URL.replace(/\/$/, '') + path;

export const langPaths = () => langs.map((lang) => ({ params: { lang } }));

// Values that come from itch.io and Ludum Dare in English. Unknown ones show as-is.
const terms: Record<string, string> = {
	'In development': 'En desarrollo',
	Prototype: 'Prototipo',
	Released: 'Publicado',
	'On hold': 'En pausa',
	Canceled: 'Cancelado',
	'AI Assisted': 'Asistido por IA',
	'AI Generated': 'Generado por IA',
	Code: 'Código',
	Graphics: 'Gráficos',
	Text: 'Texto',
	Sounds: 'Sonido',
	'No generative AI was used': 'No se usó IA generativa',
	Overall: 'General',
	Fun: 'Diversión',
	Innovation: 'Innovación',
	Theme: 'Tema',
	Humor: 'Humor',
	Mood: 'Ambiente'
};
export const term = (lang: Lang, v: string) => (lang === 'es' ? (terms[v] ?? v) : v);

export const fmtDate =(d: Date, lang: Lang) => d.toLocaleDateString(t[lang].dateLocale, { dateStyle: 'long', timeZone: 'UTC' });
