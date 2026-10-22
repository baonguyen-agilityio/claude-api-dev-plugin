# docs/onboarding.md: sections and evidence

Each generated section starts with `<!-- onboard:generated YYYY-MM-DD -->`. A refresh rewrites only marked sections whose facts changed; text without the marker belongs to people and stays.

```markdown
# Onboarding: <repo>
Reviewed by: <lead, date> (?: until a lead signs it)

<!-- onboard:generated YYYY-MM-DD -->
## What this is
<two lines on the product; apps and shared packages, which one is the API>

<!-- onboard:generated YYYY-MM-DD -->
## Run it
1. <tool versions the repo pins; where they disagree>
2. <install>
3. <env: copy <sample> to <file>; keys: <names>; values from: <who, or ?:>>
4. <build steps needed before dev, e.g. building a shared package>
5. <dev command, URL, docs URL>
6. <seed or test data; what local dev writes to>
Gates before any push: <profile's gates>

<!-- onboard:generated YYYY-MM-DD -->
## One request, end to end
<METHOD /path> → <route file:line> → <controller> → <service> → <data access> → <response shape>
A new endpoint touches: <files, from the profile>

<!-- onboard:generated YYYY-MM-DD -->
## Conventions
<branch pattern, commit format and the hook, MR template and target, pre-commit and pre-push and their cost, tests layout and fakes>

<!-- onboard:generated YYYY-MM-DD -->
## Glossary
| Term | Meaning (from the code) | Where |
|---|---|---|

<!-- onboard:generated YYYY-MM-DD -->
## Read first
1. <path> — <why>

<!-- onboard:generated YYYY-MM-DD -->
## Watch out
<the profile's watch-outs, expanded with the file that shows each>

## Open questions for the lead
- <?: item> (looked in: <files>)
```

Evidence rules: a command is evidence when it is a `package.json` script or a README step that matches one; a version when a file pins it (`.node-version`, `packageManager`, `engines`, CI `node-version`); a convention when a hook, config or template enforces it; a glossary meaning when a type, enum or comment states it. Anything else is a question.
