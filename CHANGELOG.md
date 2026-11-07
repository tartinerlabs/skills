# [1.0.0](https://github.com/tartinerlabs/mcp/compare/v0.12.0...v1.0.0) (2026-11-07)


* feat(index-now)!: run IndexNow MCP locally ([1bf25a7](https://github.com/tartinerlabs/mcp/commit/1bf25a7821d92d34d2e57b5263e9f8decabd2549))


### Features

* **index-now:** rely on root devEngines ([79a7d9b](https://github.com/tartinerlabs/mcp/commit/79a7d9bdb1979b7795225af03b2088675fee2342))


### BREAKING CHANGES

* the HTTP /mcp endpoint and submission_status are
removed. Clients connect with
`claude mcp add index-now -- pnpx @tartinerlabs/index-now-mcp`.

# [0.12.0](https://github.com/tartinerlabs/mcp/compare/v0.11.0...v0.12.0) (2026-10-25)


### Features

* add App Store keyword research server ([04fd0df](https://github.com/tartinerlabs/mcp/commit/04fd0df289094c987256318ac40cad7148a95243))
* document aso build watch paths ([c53066f](https://github.com/tartinerlabs/mcp/commit/c53066f5af9f50425be46183ea030fc5c5a6f2c7))
* serve aso on a custom domain ([a1342e7](https://github.com/tartinerlabs/mcp/commit/a1342e75c38d51097f5d4f0cf589c31f23e677e9))

# [0.11.0](https://github.com/tartinerlabs/mcp/compare/v0.10.1...v0.11.0) (2026-10-25)


### Features

* serve asc and index-now on mcp subdomains ([315d6b0](https://github.com/tartinerlabs/mcp/commit/315d6b0b65c93f6865175fa6e8b88cd230d66d11))

## [0.10.1](https://github.com/tartinerlabs/mcp/compare/v0.10.0...v0.10.1) (2026-10-25)


### Bug Fixes

* bind asc D1 database by name ([33f4b76](https://github.com/tartinerlabs/mcp/commit/33f4b7610933f165f482441c09c59378df0e1fe9))

# [0.10.0](https://github.com/tartinerlabs/mcp/compare/v0.9.0...v0.10.0) (2026-10-25)


### Features

* add App Store Connect MCP server on Workers ([aa65414](https://github.com/tartinerlabs/mcp/commit/aa6541440861961fc024bdb0860a7bd98a77fcb2)), closes [#28](https://github.com/tartinerlabs/mcp/issues/28)
* add db:push script for asc ([289c2e5](https://github.com/tartinerlabs/mcp/commit/289c2e537a6ef5d6b17c2c7aede05d768dcdaaf8))
* add initial asc migration ([be00a6b](https://github.com/tartinerlabs/mcp/commit/be00a6b70dbc71ce3bcec3f41422e1193fa20d4a))
* add shared Apple key storage and signing ([5f3c72c](https://github.com/tartinerlabs/mcp/commit/5f3c72ce7ac4d4e106f81739a076a6c62b9f393d)), closes [#63](https://github.com/tartinerlabs/mcp/issues/63)
* deploy asc with wrangler like index-now ([15b0311](https://github.com/tartinerlabs/mcp/commit/15b0311963186899052f25dd64d5a961ee0f6875))
* drop allowed hosts vars from asc config ([5ffe3ff](https://github.com/tartinerlabs/mcp/commit/5ffe3ff3530a7d4355f4becfdea65f2e7e828f8d))
* drop allowed origins var from asc config ([c70bca3](https://github.com/tartinerlabs/mcp/commit/c70bca36771f39c0a7111b6bdb61f5b83c101d43))
* run core on Node and Cloudflare Workers ([b5884c8](https://github.com/tartinerlabs/mcp/commit/b5884c8c9dc07eb92f86f486cf31bf6308d09863)), closes [#41](https://github.com/tartinerlabs/mcp/issues/41)

# [0.9.0](https://github.com/tartinerlabs/mcp/compare/v0.8.0...v0.9.0) (2026-10-22)


### Bug Fixes

* fail fast when IndexNow rate-limits ([1f2a61f](https://github.com/tartinerlabs/mcp/commit/1f2a61fc7428c8616817647af2720f07ac543622))


### Features

* queue IndexNow submissions in the background ([1dbbf09](https://github.com/tartinerlabs/mcp/commit/1dbbf09f864571623fe812cbb66d98c9540f668f))
* run IndexNow submissions as Workflows ([37e84b2](https://github.com/tartinerlabs/mcp/commit/37e84b2322ed7ec47bb522e081deda64ce191a48))

# [0.8.0](https://github.com/tartinerlabs/mcp/compare/v0.7.1...v0.8.0) (2026-10-21)


### Features

* deploy IndexNow MCP on Cloudflare Workers ([40519c1](https://github.com/tartinerlabs/mcp/commit/40519c1fc83661ea8fbc6a8cf5c9442b9ee73b50))

## [0.7.1](https://github.com/tartinerlabs/mcp/compare/v0.7.0...v0.7.1) (2026-10-21)


### Bug Fixes

* report package version from package.json ([f9b1259](https://github.com/tartinerlabs/mcp/commit/f9b1259f7a9db68437bf81bcc67fb83b4f63f690))

# [0.7.0](https://github.com/tartinerlabs/mcp/compare/v0.6.1...v0.7.0) (2026-10-21)


### Features

* add IndexNow MCP server ([377c31d](https://github.com/tartinerlabs/mcp/commit/377c31db68d8c1fe26ac9f92544317c315a271d2))

## [0.6.1](https://github.com/tartinerlabs/mcp/compare/v0.6.0...v0.6.1) (2026-10-20)


### Bug Fixes

* always show google account chooser ([b6a13d1](https://github.com/tartinerlabs/mcp/commit/b6a13d1df28670a237a7d9b9576faa1746f824e0))

# [0.6.0](https://github.com/tartinerlabs/mcp/compare/v0.5.0...v0.6.0) (2026-10-20)


### Features

* restyle OAuth pages ([c6980af](https://github.com/tartinerlabs/mcp/commit/c6980af0f7060c23632ca6f5772685438d1c27ba))

# [0.5.0](https://github.com/tartinerlabs/mcp/compare/v0.4.1...v0.5.0) (2026-10-20)


### Bug Fixes

* reject legacy clients, fix CrUX ratings ([9f56062](https://github.com/tartinerlabs/mcp/commit/9f56062a3050c5170e24b29663e37c3b77a3f640))


### Features

* add optional sitemap write scope and CIMD host allow-list ([2ad5acb](https://github.com/tartinerlabs/mcp/commit/2ad5acbe32e0df65766330a84af8ba5df9385ed4))

## [0.4.1](https://github.com/tartinerlabs/mcp/compare/v0.4.0...v0.4.1) (2026-10-20)


### Bug Fixes

* release idle db connections on fluid compute ([5791d8a](https://github.com/tartinerlabs/mcp/commit/5791d8a649e10bac09eceeb1ea91f72cfc810c31))

# [0.4.0](https://github.com/tartinerlabs/google-search-console-mcp/compare/v0.3.0...v0.4.0) (2026-10-20)


### Features

* add pagespeed insights mcp server ([a47b3bd](https://github.com/tartinerlabs/google-search-console-mcp/commit/a47b3bd37802dbe6a59498e8c39a758560fb1a51))

# [0.3.0](https://github.com/tartinerlabs/google-search-console-mcp/compare/v0.2.0...v0.3.0) (2026-10-20)


### Features

* add root status endpoint ([c32b055](https://github.com/tartinerlabs/google-search-console-mcp/commit/c32b055b9964d6eb5f3dc5e3dd9ddea9a3931a1f))
