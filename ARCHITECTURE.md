# Mise & Meal architecture

- Frontend: responsive, dependency-free SPA for the laptop-friendly MVP; components are separated by product surface.
- Backend: a Worker-style HTTP API is the intended boundary for recipes, inventory, plans, shopping, and cooking sessions.
- Supabase client: `supabase-client.js` provides the reusable browser client. The current Ruby copy build has no environment-variable substitution, so public project configuration is read from the Git-ignored `supabase-config.local.js` file when present.
- Database: SQLite locally and Cloudflare D1 when hosted, using `db/schema.sql`. PostgreSQL is the natural multi-user upgrade.
- Authentication: single-owner local mode for MVP; use private hosted access until per-user sign-in is introduced. Tables already carry `user_id`.
- Images: URL cover images initially; an object-storage adapter can later hold uploads.
- Import: a `RecipeImportProvider` boundary, starting with schema.org/JSON-LD pages and an editable review step. Video-only links fall back to manual entry.
- Barcode: browser `BarcodeDetector` behind a `ProductLookupProvider`; product misses fall back to manual completion.
- Units: canonical mass, volume, and discrete families. Cross-family conversions are deliberately marked ambiguous.

The workflow favors confirmation for deductions, generated shopping items, and imported fields. Recipe and barcode providers can be added without changing central ingredient identity.
