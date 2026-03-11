# Installing dpro-polymarket for OpenCode

## Prerequisites

- [OpenCode.ai](https://opencode.ai) installed
- Git installed
- Node.js 18+ installed

## Installation Steps

### 1. Clone the Repository

```bash
git clone https://github.com/dProLabs/dpro-polymarket ~/.config/opencode/dpro-pm
```

### 2. Install Dependencies

```bash
cd ~/.config/opencode/dpro-pm
npm install
```

### 3. Symlink the Skill

Create a symlink so OpenCode's native skill tool discovers this skill package:

```bash
mkdir -p ~/.config/opencode/skills
rm -rf ~/.config/opencode/skills/dpro-pm
ln -s ~/.config/opencode/dpro-pm ~/.config/opencode/skills/dpro-pm
```

### 4. Restart OpenCode

Restart OpenCode to reload discovered skills and instructions.

## Verify

```bash
ls -la ~/.config/opencode/skills/dpro-pm
test -f ~/.config/opencode/skills/dpro-pm/SKILL.md && echo "OK: SKILL.md found"
```

## Updating

```bash
cd ~/.config/opencode/dpro-pm && git pull && npm install
```

## Uninstalling

```bash
rm -rf ~/.config/opencode/skills/dpro-pm
# Optionally delete the clone:
rm -rf ~/.config/opencode/dpro-pm
```

## Troubleshooting

1. If the skill is not found, verify the symlink target:
   - `ls -l ~/.config/opencode/skills/dpro-pm`
2. Confirm root `SKILL.md` exists:
   - `ls ~/.config/opencode/dpro-pm/SKILL.md`
3. Restart OpenCode after changes.
