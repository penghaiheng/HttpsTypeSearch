.PHONY: help install clean typecheck build test package ci

EXTENSION_NAME := HttpsTypeSearch-chrome-extension
VERSION := $(shell node -p "require('./manifest.json').version")
DIST_DIR := dist
RELEASE_DIR := release
PACKAGE_FILE := $(RELEASE_DIR)/$(EXTENSION_NAME)-v$(VERSION).zip

help:
	@echo "Chrome extension automation targets:"
	@echo "  make install    Install npm dependencies with npm ci"
	@echo "  make typecheck  Run TypeScript type checks"
	@echo "  make build      Compile TypeScript and copy extension assets to dist/"
	@echo "  make test       Build and run tests"
	@echo "  make package    Build and create release zip in release/"
	@echo "  make ci         Install, typecheck, test, and package"
	@echo "  make clean      Remove build and release outputs"

install:
	npm ci

clean:
	rm -rf $(DIST_DIR) $(RELEASE_DIR)

typecheck:
	npm run typecheck

build:
	npm run build

test:
	npm test

package: build
	mkdir -p $(RELEASE_DIR)
	cd $(DIST_DIR) && zip -r ../$(PACKAGE_FILE) .
	@echo "Created $(PACKAGE_FILE)"

ci: install typecheck test package
