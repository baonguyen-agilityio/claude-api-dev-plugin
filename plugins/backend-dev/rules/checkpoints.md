# Checkpoints

Work on an API crosses sessions. The file that survives is `<api-repo>/.claude/checkpoints/<YYYY-MM-DD>-<session-id>.md`.

The plugin's hooks append rows automatically: `invoked` when a skill is loaded (PostToolUse on the Skill tool fires then, not when the work is done) and `turn ended` from the Stop hook. You own the phase entries under a heading per piece of work:

```markdown
## timeOffRequests approve/reject

- [x] understand — behaviour per endpoint stated; bug reproduced with curl, or "not reproducible"
- [x] plan — contract impact classified (additive/breaking), access rule decided
- [x] build — typecheck + test + check green, output pasted
- [ ] verify — every declared status driven with curl (live-verify); undriven ones named
- [ ] ship — reviewed, PR open, or deployed and smoke-tested
```

A gate is a condition, not a ritual: do not tick it by asserting it. A blocked gate is a result; record it and build what the block does not touch. Add `.claude/checkpoints/` to the API repo's `.gitignore` unless the team wants them reviewed. Resuming: read the newest checkpoint, resume at the first unticked phase; if it disagrees with the working tree, trust the tree and say so.
