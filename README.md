# dann.com.ar

Personal site: portfolio, links and blog. Astro, deployed to GitHub Pages.

- `npm run dev`: local site at http://localhost:4321
- `npm run admin`: local admin panel at http://localhost:4322, with the site running at :4321 for its preview. It edits games, blog posts, pages, links and wikis as files under `content/` (uploads in `public/media/`), runs the store sync, and publishes (commit + push to main). Listens on this machine only
- Admin details: the markdown editor previews live in the site's layout; posts dated in the future are scheduled (they go live with the daily 09:00 UTC rebuild); fixed site texts live in `content/texts.json`; Publicar builds the site first and publishes nothing if that fails
- Shortcodes in posts and pages, one per line: `::youtube{id="<link or id>"}`, `::game{slug="<game file name>"}` (a card), `::store{slug="…"}` (Steam or itch.io widget). Defined in `src/shortcodes.mjs`; a wrong one fails the build
- `npm run sync`: pull game data from Steam, itch.io and Ludum Dare into `content/store/` and `public/games/` (the list lives in `content/sources.json`, editable in the admin by pasting a link under Juegos y proyectos; removing an entry removes its data)

Tasks live in `compass/` ([Scope Compass](https://github.com/dannroda/scope-compass)); readable export in `docs/tareas.md`.

The workflow in `.github/workflows/deploy.yml` syncs daily, commits any changes and redeploys.
