# Repository Safety Rules (MUST Follow)

## Git
- NEVER run `git push` unless the user explicitly says "push" in the current message.
- NEVER run `git add .`, `git add -A`, or `git commit -a`. Stage files by explicit path only.
- Before every commit: run `git status` and `git diff --cached --stat`, list the staged files, and confirm none are secrets, `.env*`, keys, dumps, or build output.
- NEVER force-push, rewrite history, or change git config/hooks (including `--no-verify`) unless the user explicitly asks.
- If a pre-commit or secret-scan check fails, STOP and report. Do not bypass it.

## Secrets
- NEVER create, edit, print, or commit real secrets. Do not read `.env` contents into chat output; refer to variable names only.
- NEVER hardcode a secret or a default fallback for one. Read from validated env config.
- Generated keys/secrets must be written only to the gitignored `.env`, never to tracked files, README examples, tests, fixtures, or docs.
- Use placeholders (`replace-me`) in `.env.example`, docs, and test data.
- If you find a secret in the repo or in history, do not copy it anywhere. Tell the user to rotate it first, then help remove it from history.

## Data
- Use fake data only: no real NID, phone numbers, bank accounts, or card numbers.
