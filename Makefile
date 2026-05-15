.PHONY: dev build lint test \
        db-generate db-migrate db-push db-studio db-seed db-seed-revealing \
        install clean

# ── 開発 ──────────────────────────────────────────────────
dev:
	pnpm dev

build:
	pnpm build

lint:
	pnpm lint

# ── テスト ────────────────────────────────────────────────
test:
	pnpm --filter './backend' test

test-watch:
	pnpm --filter './backend' test:watch

# ── DB (Drizzle + Turso) ──────────────────────────────────
db-generate:
	cd backend && npx drizzle-kit generate

db-migrate:
	cd backend && npx drizzle-kit migrate

db-push:
	cd backend && npx drizzle-kit push

db-studio:
	cd backend && npx drizzle-kit studio

db-seed:
	cd backend && npm run db:seed

db-seed-revealing:
	cd backend && npm run db:seed:revealing

# ── セットアップ ──────────────────────────────────────────
install:
	pnpm install

clean:
	rm -rf backend/node_modules frontend/node_modules node_modules
