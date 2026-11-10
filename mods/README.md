<div align="center">

# 🧩 Claude Code Mods

**Live panes, prompt bands, status line entries, toasts, and hooks for [Claude Code](https://claude.com/claude-code)**, each shipped as a plugin.

[![Release](https://img.shields.io/github/v/release/tartinerlabs/claude-code-mods?style=flat-square&color=d97757)](https://github.com/tartinerlabs/claude-code-mods/releases)
[![CI](https://img.shields.io/github/actions/workflow/status/tartinerlabs/claude-code-mods/ci.yml?branch=main&style=flat-square&label=ci)](https://github.com/tartinerlabs/claude-code-mods/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)

</div>

## 🚀 Install

```
/plugin marketplace add tartinerlabs/claude-code-mods
/plugin install <mod> --marketplace tartinerlabs/claude-code-mods
```

## 🧰 Mods

| | Mod | Where it shows | In one line |
| :-: | --- | --- | --- |
| ⏸ | [auto-resume](#-auto-resume) | Status line, toast | Picks a turn back up once a usage limit resets |
| 🏷 | [auto-session-name](#-auto-session-name) | Session title | Names each session from its first prompt and keeps the name current as the work moves on |
| ⏱ | [cache-clock](#-cache-clock) | Band above the prompt | Counts down to the prompt cache going cold |
| 🌿 | [git-status](#-git-status) | Band above the prompt, toasts | Shows the branch, working tree and pull request, and merges the PR with `/merge` |
| 📊 | [limit-watch](#-limit-watch) | Band above the prompt, toasts | Shows the 5-hour and weekly usage limits and the session's cost |
| 📝 | [release-notes](#-release-notes) | Band above the prompt, toast | Drafts App Store release notes for Xcode projects when the version is bumped |
| 📱 | [resource-watch](#-resource-watch) | Band above the prompt, toast | Shows which session is using each simulator, Claude Design project or the Xcode app, and messages the other session on a clash |
| 🗜 | [smart-compact](#-smart-compact) | Toast | Compacts between turns, sooner at checkpoints or when the cache is cooling |
| ⛅ | [token-weather](#-token-weather) | Band above the prompt | Forecasts how full the context window is |
| ▶️ | [youtube](#️-youtube) | Toast, Claude's context | Hands Claude the transcript, chapters and description of YouTube links in a prompt |

---

### ⏸ auto-resume

When a turn stops on a usage limit, waits until the limit resets and sends `continue`. Typing a prompt yourself or running `/auto-resume cancel` stops the wait.

```text
⏸ auto-resume in 1h 12m                                    ← status line
Usage limit reset, resuming                                 ← toast
```

<sub>📁 [`plugins/auto-resume`](plugins/auto-resume)</sub>

### 🏷 auto-session-name

Names each session from its first prompt using Haiku and can give it a prompt bar colour, so it is easy to find with `claude -r` after a crash. When the first prompt is short, such as `continue` or `look at this`, it titles the session again from the last four prompts on the fourth. Every eighth prompt it checks the title against the last four prompts and renames the session only when the work has moved to a different task; small shifts keep the title. Sessions already named with `-n` or `/rename` are left alone, and a rename stops any re-title. Set the `color` option to `red`, `blue`, `green`, `yellow`, `purple`, `orange`, `pink` or `cyan` to colour named sessions; `default` leaves the colour alone.

```text
> fix the flaky retry test in the upload worker
                                    → session titled "Fix flaky upload retry test"
```

<sub>📁 [`plugins/auto-session-name`](plugins/auto-session-name)</sub>

### ⏱ cache-clock

Draws a countdown above the prompt to when the prompt cache goes cold, with the last request's hit rate. Once cold, it shows how much the next turn re-writes. Set the `ttl` option to `1h` when extended caching is on.

```text
🔥 cache 3:42 left · 96% hit                                ← green, yellow under a minute
🧊 cache cold · next turn re-writes 84.3k                   ← red
```

<sub>📁 [`plugins/cache-clock`](plugins/cache-clock)</sub>

### 🌿 git-status

Draws the branch and working tree above the prompt, refreshed after every tool call and every 15 seconds, in plain words grouped by what they are about: commits ahead and behind the upstream as of the last fetch; staged, changed and new files; a rebase, merge, cherry-pick, revert or bisect in progress and its conflicts; and stashes. Each part has its own colour, and a clean tree reads `✓ clean`. Toasts when an operation stops on conflicts. It never fetches.

Beside it, draws the current branch's open pull request with its checks and whether it can merge, refreshed each minute and after every turn. Toasts when a run of checks finishes. `/merge` merges it with `gh` and deletes the branch, but only once every check has passed and nothing blocks it. On a [gh-stack](https://github.com/github/gh-stack) layer the band shows its place in the stack, and `/merge` merges the whole stack with `gh stack merge` once every unmerged layer has passed its checks and has no unpushed commits, then switches to the trunk and deletes every layer's branch, local and remote, once all of them have merged. Set the `method` option to `merge` (default), `squash` or `rebase`. Needs the [GitHub CLI](https://cli.github.com), signed in.

```text
🌿 main  ·  ✓ clean                                                          ← band
🌿 feat/x  ·  ↑ 2 ahead, ↓ 1 behind  ·  ● 3 staged, ✎ 1 changed, + 2 new  ·  ⚑ 1 stashed
🌿 feat/x  ·  ↑ 1 ahead  🔀 PR #42  ⏳ 3/5 checks  waiting                    ← with a PR
🌿 feat/x  ·  ✓ clean  🔀 PR #42  ❌ 1 failing: SonarCloud  blocked           ← red
🌿 feat/x  ·  ✓ clean  🔀 PR #42  📚 stack 2/3  ✅ 5/5 checks  ready · /merge ← a gh-stack layer
🌿 1a2b3c4  ·  ⚠ rebasing, ✖ 2 conflicts                                     ← stopped mid-rebase
Rebasing stopped on 2 conflicts                                              ← toast
PR #42 checks passed, ready to /merge                                        ← toast
```

<sub>📁 [`plugins/git-status`](plugins/git-status)</sub>

### 📊 limit-watch

Draws the 5-hour and weekly usage limits above the prompt with live reset countdowns, green under 60%, yellow to 80% and red past it. Toasts once a window passes 80% and again at 95%. Any other window the API reports, such as a gateway spend limit, shows under its own name. The session's cost so far follows the limits.

```text
🕔 5h 42% · 2h17m  📅 7d 81% · 3d4h  💰 $2.36              ← band
7d limit at 81%, resets in 3d4h                             ← toast
```

<sub>📁 [`plugins/limit-watch`](plugins/limit-watch)</sub>

### 📝 release-notes

In an Xcode project, draws the app's `MARKETING_VERSION` and build above the prompt with the commits since the last release. When a turn, or anything between sessions, changes the version, Haiku drafts App Store "What's New" notes from those commits and a toast says where they went. With fastlane they go to `fastlane/metadata/<locale>/release_notes.txt` for the `default` locale, else `en-US`, else the first. Without fastlane they become a `## <version>` section in `CHANGELOG.md`, and a section that is already there is left alone. The last release is the newest tag, or the commit that set the previous version when the repository has no tags. The first time it sees a repository it only records the version. `/draft-release-notes` drafts the notes again, replacing what is there.

```text
📝 v2.4.0 (41)  12 commits since v2.3.0  notes drafted      ← band
Release notes for 2.4.0 drafted in fastlane/metadata/en-US/release_notes.txt   ← toast
```

<sub>📁 [`plugins/release-notes`](plugins/release-notes)</sub>

### 📱 resource-watch

Shows which Claude Code session is using each shared thing on the machine, so parallel agents do not fight over one. Booted Apple simulators and Claude Design projects are the baseline; the Xcode app sits on top.

- **Simulators**: in an Xcode project, or once the session has used one, every booted simulator with the sessions holding it. A session takes a simulator when `simctl` or `xcodebuild` names it by UDID or name, or uses `booted` or an Xcode MCP run while only one is booted; commands that only look, as `simctl list` or `xcodebuild -showdestinations`, do not count.
- **Claude Design**: a project, on any `claude-design` tool call on it.
- **Xcode app**: on Xcode MCP calls that change its shared state: switching scheme, run destination or test plan, opening or closing a workspace, building, running, testing or stopping.

A hold lasts the `hold` option's minutes (10 by default) after the last call, and ends with the session. Sessions share their holds as files in `~/.claude/resource-watch/`, labelled by their project's folder. A simulator call on one another session holds is refused the first time: the holding session is asked, and the agent is told to wait for its reply, then repeat the call to go ahead, and never to switch to or create another simulator without asking you. The holder tells the waiting sessions once it is done: after `StopProject` or `DeviceInteractionEndSession`, when its hold runs out, or when it ends. For a Claude Design project or the Xcode app nothing is refused: it toasts, messages the holding session so its agent can reply asking it to wait, and tells its own agent who holds it; a session that ends tells the sessions it shared with.

```text
📱 iPhone 18 Pro (iOS 27.2) · this session  🛠 the Xcode app · ⚠ also the web session   ← band
iPhone 18 Pro is in use by the web session; asked it, waiting                            ← toast
```

<sub>📁 [`plugins/resource-watch`](plugins/resource-watch)</sub>

### 🗜 smart-compact

Compacts the conversation between turns, never during one, weighing several factors against the context's fill. Past the `threshold` option (60, 70 default, or 80%) it compacts about ten seconds after a turn ends. It compacts sooner when compacting is cheapest or most worth it:

- **Checkpoints**, 20 points lower: a turn that committed, opened or merged a PR (`gh pr`, `gh stack`), had a plan approved, finished its todo list, or switched branch or worktree. The summary is told what to keep for each, such as the approved plan verbatim. A checkpoint counts only until the next turn starts. Set `checkpoints` to `off` to ignore them.
- **Cache cooling**, 20 points lower in the last minute before the prompt cache goes cold, so the summary still reads the conversation from cache. Once the cache is cold it does not compact sooner, since the summary would re-read the whole conversation uncached.
- **5-hour limit**, 10 points lower while it is at 80% or more.

Nothing takes it under the `floor` option (30, 40 default, or 50%), and it tries at most once per idle stretch. The `ttl` option defaults to `auto`: 1h on a subscription, 5m on an API key or cloud provider. Set it to `5m` while a subscription draws on usage credits, or to `1h` when you set a one-hour cache yourself.

Set `continue` to `tasks` to carry on after compacting while todos or tasks are still open. It sends `Continue with the remaining tasks.`, unless the turn was interrupted or ended on a question.

```text
Compacted at 52%: committed                                  ← toast
Compacted at 55%: cache cooling                              ← toast
Compacted at 74%: context high, 5h limit at 86%              ← toast
Compacted at 75%: context high; continuing                   ← toast
```

<sub>📁 [`plugins/smart-compact`](plugins/smart-compact)</sub>

### ⛅ token-weather

Draws a forecast of the context window above the prompt, with tokens used, a sparkline of the last 12 turns and the change since the last turn.

```text
⛅ Cloudy  38% of context  76.4k / 200k   last turns ▁▂▂▃▄▄▅▆  ▲ +4.1k last turn
```

| 🌞 Clear | ⛅ Cloudy | ☔ Showers | ⚡ Storm | 🚨 Compact soon |
| :-: | :-: | :-: | :-: | :-: |
| under 25% | under 50% | under 75% | under 90% | 90% and up |

<sub>📁 [`plugins/token-weather`](plugins/token-weather)</sub>

### ▶️ youtube

Finds YouTube links in a prompt (`watch`, `youtu.be`, `shorts`, `live` and `embed`, up to three per prompt) and fetches each video's title, channel, length, description, chapters and English transcript with [yt-dlp](https://github.com/yt-dlp/yt-dlp). They reach Claude beside the prompt, so you can ask it to apply a tutorial to your code. The transcript is in timestamped paragraphs, one every 30 seconds or so. If yt-dlp is not installed, the mod offers to install it with Homebrew, uv or pipx, and stops asking for the rest of the session if you say no.

```text
> apply https://www.youtube.com/watch?v=SfX43uIubj4 to the landing page
YouTube: added "4 UI Design Hacks to KILL boring designs" with its transcript   ← toast
```

<sub>📁 [`plugins/youtube`](plugins/youtube)</sub>

---

<div align="center">

[MIT](LICENSE) © [Tartiner Labs](https://tartinerlabs.com)

</div>
