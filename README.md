# dann.com.ar

Personal site: portfolio, links and blog. Astro, deployed to GitHub Pages.

- `npm run dev`: local site at http://localhost:4321
- `npm run admin`: local admin panel at http://localhost:4322, with the site running at :4321 for its preview. It edits games, blog posts, pages, links and wikis as files under `content/` (uploads in `public/media/`), runs the store sync, and publishes (commit + push to main). Listens on this machine only
- `npm run sync`: pull game data from Steam, itch.io and Ludum Dare into `content/store/` and `public/games/` (the list lives in `content/sources.json`, editable in the admin by pasting a link under Juegos y proyectos; removing an entry removes its data)

Tasks live in `compass/` ([Scope Compass](https://github.com/dannroda/scope-compass)); readable export in `docs/tareas.md`.

The workflow in `.github/workflows/deploy.yml` syncs daily, commits any changes and redeploys.
