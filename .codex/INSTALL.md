# Installing dpro-polymarket for Codex

Enable `dpro-pm` in Codex via native skill discovery.

## Prerequisites

- Git
- Node.js 18+

## Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/dProLabs/dpro-polymarket ~/.codex/dpro-pm
   ```

2. **Install dependencies:**

   ```bash
   cd ~/.codex/dpro-pm
   npm install
   ```

3. **Create the skills symlink:**

   ```bash
   mkdir -p ~/.agents/skills
   ln -s ~/.codex/dpro-pm ~/.agents/skills/dpro-pm
   ```

   **Windows (PowerShell):**

   ```powershell
   New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.agents\skills"
   cmd /c mklink /J "$env:USERPROFILE\.agents\skills\dpro-pm" "$env:USERPROFILE\.codex\dpro-pm"
   ```

4. **Restart Codex** (quit and relaunch the CLI) to discover the skill.

## Verify

```bash
ls -la ~/.agents/skills/dpro-pm
test -f ~/.agents/skills/dpro-pm/SKILL.md && echo "OK: SKILL.md found"
```

## Updating

```bash
cd ~/.codex/dpro-pm && git pull && npm install
```

## Uninstalling

```bash
rm ~/.agents/skills/dpro-pm
# Optionally delete the clone:
rm -rf ~/.codex/dpro-pm
```
