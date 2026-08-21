# Task runner — thin wrappers over the package.json scripts.
.PHONY: build test typecheck lint serve check

build:
	npm run build

test:
	npm test

typecheck:
	npm run typecheck

lint:
	npm run lint:modules && npm run lint:i18n

serve:
	npm run serve

check:
	npm run check:local