# Result block

Every skill ends with this block. The reader was not in the session; separate what you ran from what you concluded.

```markdown
## Result
**Verdict:** DONE | DONE-WITH-GAPS | BLOCKED   (probe-endpoint: VERIFIED | PARTIAL | UNVERIFIED)
**Did:** commands run, files touched, requests sent
**Saw:** observed output, failures included, verbatim where short
**Not done:** anything in scope that was skipped, and why
**Blocked by:** open questions or missing access, or "nothing"
**Next:** the single next action
```

- `DONE` only when every gate passed and nothing in scope was skipped. `DONE-WITH-GAPS` when gates passed but Not done is non-empty. `BLOCKED` when a gate is red or a decision is missing.
- Report a failure with its output, not a characterisation. "Tests passed" when they were not run is worse than a failure.
- Never invent an id, token, env name or consumer. Ask.
- Tick the matching phase entry in the checkpoint file (`rules/checkpoints.md`).
