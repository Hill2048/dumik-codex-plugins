# Codex network approvals / sandbox notes

This guidance is intentionally isolated from `SKILL.md` because it can vary by environment and may become stale. Prefer the defaults in your environment when in doubt.

## Why am I asked to approve every image generation call?
Image generation uses the JuAIHub OpenAI-compatible Image API at `https://api.juaihub.cn/v1`, so the CLI needs outbound network access. In many Codex setups, network access is disabled by default (especially under stricter sandbox modes), and/or the approval policy may require confirmation before networked commands run.

API URL 和 key 的默认读取顺序：本机缓存 `CODEX_HOME/dumik-team-plugin/api_settings.py`、Codex `config.toml/auth.json`、环境变量、安全默认 URL。缓存由插件根目录 `scripts/init_api_cache.py` 生成，key 不写进公开插件文件。

## How do I reduce repeated approval prompts (network)?
If you trust the repo and want fewer prompts, enable network access for the relevant sandbox mode and relax the approval policy.

Example `~/.codex/config.toml` pattern:

```
approval_policy = "never"
sandbox_mode = "workspace-write"

[sandbox_workspace_write]
network_access = true
```

Or for a single session:

```
codex --sandbox workspace-write --ask-for-approval never
```

## Safety note
Use caution: enabling network and disabling approvals reduces friction but increases risk if you run untrusted code or work in an untrusted repository.
