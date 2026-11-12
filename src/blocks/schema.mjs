// The block library: every block a page can be built from, and the fields the admin shows for each.
// Read by the site (src/content.config.ts validates pages with it, src/components/Blocks.astro renders them)
// and by the admin (npm run admin builds its forms from it). Plain JS so both can import it.
//
// Field types. Translated ones are stored as {es, en}; the rest once for both languages.
//   text, textarea, html (simple inline HTML like <em>, <code>, <a>), markdown, image, url, tags (list of words)
//       translated; an empty translation shows the other language's, so a link both share is filled once
//   string, select (options), game (a game's file name), bool                              shared
//   list (fields: the item's own fields)                                                   shared list, translated inside
export const i18nTypes = ['text', 'textarea', 'html', 'markdown', 'image', 'url', 'tags'];

// Fields several blocks share: the small label, heading and intro above a section, and an anchor for links like #tools.
const head = [
	{ key: 'eyebrow', label: 'Antetítulo', type: 'text' },
	{ key: 'heading', label: 'Título', type: 'text' },
	{ key: 'intro', label: 'Bajada', type: 'html' }
];
const anchor = { key: 'anchor', label: 'Ancla', type: 'string', hint: 'Opcional: con «tools», un link a #tools lleva a este bloque.' };
const sideImage = [
	{ key: 'image', label: 'Imagen al costado', type: 'image' },
	{ key: 'imageAlt', label: 'Texto alternativo de la imagen', type: 'text' },
	{ key: 'caption', label: 'Epígrafe', type: 'text' }
];
const button = [
	{ key: 'label', label: 'Texto', type: 'text' },
	{ key: 'url', label: 'Link', type: 'url' },
	{ key: 'style', label: 'Estilo', type: 'select', options: [['primary', 'Principal'], ['plain', 'Normal'], ['ghost', 'Borde']] }
];

export const blocks = [
	{
		type: 'hero', label: 'Portada', group: 'Secciones',
		help: 'El primer pantallazo: título grande, bajada, botones y una imagen o los trabajos destacados.',
		fields: [
			{ key: 'layout', label: 'Diseño', type: 'select', options: [['split', 'Texto e imagen lado a lado'], ['stacked', 'Título arriba, imagen abajo']] },
			{ key: 'title', label: 'Título', type: 'html', hint: '<em>palabra</em> la pinta del color de acento.' },
			{ key: 'intro', label: 'Bajada', type: 'html' },
			{ key: 'buttons', label: 'Botones', type: 'list', fields: button },
			{ key: 'game', label: 'Etiqueta de IA de', type: 'game', hint: 'Opcional: muestra la etiqueta de uso de IA de ese juego.' },
			{ key: 'chips', label: 'Etiquetas', type: 'list', fields: [{ key: 'text', label: 'Texto', type: 'text' }] },
			{ key: 'side', label: 'Al costado', type: 'select', options: [['featured', 'Los trabajos destacados'], ['image', 'Una imagen'], ['none', 'Nada']] },
			{ key: 'image', label: 'Imagen', type: 'image' },
			{ key: 'imageMobile', label: 'Imagen en el teléfono', type: 'image', hint: 'Opcional: otra imagen para pantallas angostas.' },
			{ key: 'imageAlt', label: 'Texto alternativo', type: 'text' },
			{ key: 'caption', label: 'Epígrafe', type: 'text' }
		]
	},
	{
		type: 'works', label: 'Trabajos', group: 'Juegos',
		help: 'Los juegos publicados, otros juegos y proyectos, con el filtro por uso de IA. Se arma solo con los juegos del sitio.',
		fields: [{ key: 'heading', label: 'Título', type: 'text' }]
	},
	{
		type: 'jams', label: 'Game jams', group: 'Juegos',
		help: 'Los juegos de jams con su resultado. Se arma solo.',
		fields: [{ key: 'heading', label: 'Título', type: 'text' }, { key: 'intro', label: 'Bajada', type: 'text' }]
	},
	{
		type: 'lab', label: 'Lab', group: 'Juegos',
		help: 'Lo marcado como vibe-coded. Se arma solo.',
		fields: [{ key: 'heading', label: 'Título', type: 'text' }, { key: 'intro', label: 'Bajada', type: 'text' }, { key: 'empty', label: 'Si no hay nada', type: 'text' }]
	},
	{
		type: 'text', label: 'Texto', group: 'Contenido',
		help: 'Texto en Markdown, con shortcodes como ::youtube{id="…"}.',
		fields: [anchor, { key: 'body', label: 'Texto', type: 'markdown' }]
	},
	{
		type: 'image', label: 'Imagen', group: 'Contenido',
		fields: [{ key: 'image', label: 'Imagen', type: 'image' }, { key: 'alt', label: 'Texto alternativo', type: 'text' }, { key: 'caption', label: 'Epígrafe', type: 'text' }, { key: 'wide', label: 'Ancho completo', type: 'bool' }]
	},
	{
		type: 'gallery', label: 'Galería', group: 'Contenido',
		fields: [...head, { key: 'images', label: 'Imágenes', type: 'list', fields: [{ key: 'image', label: 'Imagen', type: 'image' }, { key: 'alt', label: 'Texto alternativo', type: 'text' }] }]
	},
	{
		type: 'video', label: 'Video de YouTube', group: 'Contenido',
		fields: [{ key: 'url', label: 'Link o id del video', type: 'url' }, { key: 'caption', label: 'Epígrafe', type: 'text' }]
	},
	{
		type: 'game', label: 'Juego', group: 'Juegos',
		help: 'Una tarjeta de un juego del sitio, o el widget de su tienda (Steam o itch.io).',
		fields: [{ key: 'game', label: 'Juego', type: 'game' }, { key: 'display', label: 'Mostrar', type: 'select', options: [['card', 'Tarjeta'], ['store', 'Widget de la tienda']] }]
	},
	{
		type: 'buttons', label: 'Botones', group: 'Contenido',
		fields: [{ key: 'buttons', label: 'Botones', type: 'list', fields: button }]
	},
	{
		type: 'cards', label: 'Tarjetas', group: 'Secciones',
		help: 'Una grilla de tarjetas con título, texto y etiquetas; opcionalmente una imagen al costado, comandos para copiar y una nota.',
		fields: [
			anchor, ...head,
			{ key: 'style', label: 'Estilo', type: 'select', options: [['grid', 'Grilla con bordes'], ['grid-mono', 'Grilla, títulos en monoespaciada'], ['rules', 'Columnas con línea de acento']] },
			...sideImage,
			{ key: 'items', label: 'Tarjetas', type: 'list', fields: [
				{ key: 'title', label: 'Título', type: 'text' },
				{ key: 'text', label: 'Texto', type: 'html' },
				{ key: 'tags', label: 'Etiquetas', type: 'tags' },
				{ key: 'command', label: 'Comando para copiar', type: 'string' },
				{ key: 'linkLabel', label: 'Link (texto)', type: 'text' },
				{ key: 'linkUrl', label: 'Link', type: 'url' },
				{ key: 'wide', label: 'Ocupa toda la fila', type: 'bool' }
			] },
			{ key: 'asideHeading', label: 'Recuadro al pie: título', type: 'text' },
			{ key: 'asideText', label: 'Recuadro al pie: texto', type: 'html' },
			{ key: 'commands', label: 'Comandos para copiar', type: 'list', fields: [{ key: 'label', label: 'Para qué', type: 'text' }, { key: 'command', label: 'Comando', type: 'string' }] },
			{ key: 'buttons', label: 'Botones', type: 'list', fields: button },
			{ key: 'note', label: 'Nota al pie', type: 'html' }
		]
	},
	{
		type: 'table', label: 'Tabla de permisos', group: 'Secciones',
		help: 'Filas por grupo y columnas por modo; cada celda es allow, ask o deny (con * al final para marcarla).',
		fields: [
			anchor, ...head, ...sideImage,
			{ key: 'groupLabel', label: 'Encabezado de las filas', type: 'text' },
			{ key: 'columns', label: 'Columnas', type: 'list', fields: [{ key: 'name', label: 'Nombre', type: 'text' }, { key: 'what', label: 'Descripción', type: 'text' }] },
			{ key: 'rows', label: 'Filas', type: 'list', fields: [{ key: 'label', label: 'Grupo', type: 'text' }, { key: 'cells', label: 'Celdas', type: 'string', hint: 'Una por columna, separadas por comas: allow, ask o deny.' }] },
			{ key: 'allow', label: 'Texto de «allow»', type: 'text' },
			{ key: 'ask', label: 'Texto de «ask»', type: 'text' },
			{ key: 'deny', label: 'Texto de «deny»', type: 'text' },
			{ key: 'note', label: 'Nota al pie', type: 'html' }
		]
	},
	{
		type: 'steps', label: 'Pasos', group: 'Secciones',
		help: 'Una lista numerada con una imagen fija al costado.',
		fields: [anchor, ...head, { key: 'steps', label: 'Pasos', type: 'list', fields: [{ key: 'title', label: 'Título', type: 'text' }, { key: 'text', label: 'Texto', type: 'html' }] }, ...sideImage]
	},
	{
		type: 'panels', label: 'Paneles', group: 'Secciones',
		help: 'Dos o más recuadros lado a lado, cada uno con su imagen o un bloque de código.',
		fields: [{ key: 'panels', label: 'Paneles', type: 'list', fields: [
			{ key: 'eyebrow', label: 'Antetítulo', type: 'text' },
			{ key: 'heading', label: 'Título', type: 'text' },
			{ key: 'text', label: 'Texto', type: 'html' },
			{ key: 'image', label: 'Imagen', type: 'image' },
			{ key: 'imageAlt', label: 'Texto alternativo', type: 'text' },
			{ key: 'code', label: 'Código', type: 'html', hint: 'HTML: <span class="k"> resalta, <span class="ghost"> atenúa.' },
			{ key: 'keys', label: 'Atajos', type: 'html', hint: 'HTML con <kbd>Tab</kbd> y similares.' }
		] }]
	},
	{
		type: 'band', label: 'Franja de acento', group: 'Secciones',
		help: 'Un recuadro del color de acento, para instalar o descargar: título, notas, botones y pasos.',
		fields: [
			anchor,
			{ key: 'heading', label: 'Título', type: 'text' },
			{ key: 'notes', label: 'Notas', type: 'list', fields: [{ key: 'text', label: 'Texto', type: 'html' }] },
			{ key: 'buttons', label: 'Botones', type: 'list', fields: button },
			{ key: 'steps', label: 'Pasos', type: 'list', fields: [{ key: 'text', label: 'Texto', type: 'html' }] },
			{ key: 'fine', label: 'Letra chica', type: 'html' }
		]
	}
];

export const blockTypes = blocks.map((b) => b.type);
export const blockOf = (type) => blocks.find((b) => b.type === type);

// An empty block of a type, as the admin adds it.
export function emptyBlock(type, id) {
	const empty = (f) => (f.type === 'list' ? [] : f.type === 'tags' ? { es: [], en: [] } : f.type === 'bool' ? false : f.type === 'select' ? f.options[0][0] : i18nTypes.includes(f.type) ? { es: '', en: '' } : '');
	return { id, type, ...Object.fromEntries(blockOf(type).fields.map((f) => [f.key, empty(f)])) };
}
