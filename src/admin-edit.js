// Visual editing for the admin's preview (npm run admin), Storyblok style: click a text or a block on the page and the
// admin opens it; type in the admin and the page changes live. Added to every page in `npm run dev` only, never to the
// built site. Messages from the admin:
//   {type: 'edit', texts: {key: value}, blocks}  mark every text found on the page as a whole element. A key starting
//                                                with a block's id ("b3.title.es" style keys, "b3.items.0.title") is
//                                                only looked for inside that block. blocks: blocks are clickable too.
//   {type: 'update', key, value}                 show a new value live
//   {type: 'select', key} / {type: 'block', id}  outline it and scroll to it
// and to the admin: {type: 'marked', keys}, {type: 'select', keys}, {type: 'block', id}.
(() => {
	if (parent === window) return;
	let admin = null, blockMode = false, moved = false; // moved: the admin scrolled us, so don't restore the old spot
	const send = (msg) => admin?.source.postMessage(msg, admin.origin);
	// The same text, however the browser and Astro's dev attributes spell it.
	const norm = (html) => {
		const t = document.createElement('template');
		t.innerHTML = html;
		t.content.querySelectorAll('*').forEach((el) => [...el.attributes].forEach((a) => el.removeAttribute(a.name)));
		return t.innerHTML.replace(/\s+/g, ' ').trim();
	};
	const style = document.createElement('style');
	style.textContent = `[data-ak]{outline:1px dashed #d7f25c66;outline-offset:3px;cursor:pointer}[data-ak]:hover{outline:2px solid #d7f25c}.ak-on{outline:2px solid #d7f25c!important;background:#d7f25c1f}
.ak-blocks [data-block]>*{cursor:pointer}.ak-blocks [data-block]>*:hover{outline:2px dashed #d7f25c88;outline-offset:6px}.ak-block-on>*{outline:2px solid #d7f25c!important;outline-offset:6px}`;
	const els = (key) => [...document.querySelectorAll('[data-ak]')].filter((el) => el.dataset.ak.split(',').includes(key));
	const blockEl = (id) => document.querySelector(`[data-block="${CSS.escape(id)}"]`);
	// A display: contents wrapper has no box: its first child stands for it.
	const box = (el) => el?.firstElementChild ?? el;

	function mark(texts) {
		document.querySelectorAll('[data-ak]').forEach((el) => el.removeAttribute('data-ak'));
		// scope (a block, or the whole page) -> value -> keys. Two texts with the same words point to the same element.
		const scopes = new Map();
		for (const [k, v] of Object.entries(texts)) {
			if (typeof v !== 'string' || v.trim().length < 2) continue;
			const scope = blockEl(k.split('.')[0]) ?? document.body;
			const byValue = scopes.get(scope) ?? new Map();
			const n = norm(v);
			byValue.set(n, [...(byValue.get(n) ?? []), k]);
			scopes.set(scope, byValue);
		}
		const found = new Set();
		for (const [scope, byValue] of scopes)
			for (const el of scope.querySelectorAll('*')) {
				if (/^(SCRIPT|STYLE|SVG|TEMPLATE|IFRAME)$/i.test(el.tagName) || el.parentElement?.closest('[data-ak]')) continue;
				const keys = byValue.get(norm(el.innerHTML));
				if (!keys) continue;
				el.dataset.ak = keys.join(',');
				keys.forEach((k) => found.add(k));
			}
		document.head.append(style);
		document.documentElement.classList.toggle('ak-blocks', blockMode);
		send({ type: 'marked', keys: [...found] });
	}
	function clear() {
		document.querySelectorAll('.ak-on').forEach((el) => el.classList.remove('ak-on'));
		document.querySelectorAll('.ak-block-on').forEach((el) => el.classList.remove('ak-block-on'));
	}
	function select(key, scroll) {
		clear();
		const list = els(key);
		list.forEach((el) => el.classList.add('ak-on'));
		if (scroll && list[0]) { moved = true; list[0].scrollIntoView({ block: 'center', behavior: 'smooth' }); }
	}
	function selectBlock(id, scroll) {
		clear();
		const el = blockEl(id);
		el?.classList.add('ak-block-on');
		if (scroll && el) { moved = true; box(el).scrollIntoView({ block: 'start', behavior: 'instant' }); }
	}

	// Capture phase: a click on something editable selects it instead of following a link.
	document.addEventListener('click', (e) => {
		if (!admin) return;
		const text = e.target.closest?.('[data-ak]');
		const block = blockMode && e.target.closest?.('[data-block]');
		if (!text && !block) return;
		e.preventDefault();
		e.stopPropagation();
		if (text) {
			const keys = text.dataset.ak.split(',');
			select(keys[0], false);
			send({ type: 'select', keys });
		} else {
			selectBlock(block.dataset.block, false);
			send({ type: 'block', id: block.dataset.block });
		}
	}, true);
	addEventListener('message', (e) => {
		if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(e.origin) || typeof e.data !== 'object') return;
		admin = { source: e.source, origin: e.origin };
		const d = e.data;
		if (d.type === 'edit') { blockMode = !!d.blocks; mark(d.texts); }
		else if (d.type === 'update') for (const el of els(d.key)) {
			if (/<\w/.test(d.value)) el.innerHTML = d.value;
			else el.textContent = d.value;
		}
		else if (d.type === 'select') select(d.key, true);
		else if (d.type === 'block') selectBlock(d.id, true);
	});
	// The admin reloads the preview after a structural change; come back to the same spot.
	const spot = `ak-scroll:${location.pathname}`;
	addEventListener('pagehide', () => { try { sessionStorage.setItem(spot, String(scrollY)); } catch {} });
	try {
		const y = Number(sessionStorage.getItem(spot));
		if (y) addEventListener('load', () => moved || scrollTo({ top: y, behavior: 'instant' }), { once: true });
	} catch {}
	parent.postMessage('site-ready', '*');
})();
