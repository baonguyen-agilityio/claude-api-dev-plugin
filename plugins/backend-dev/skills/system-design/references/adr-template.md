# ADR template

Keep one ADR per decision that someone could reasonably have made differently. A design note without an ADR is a description; an ADR is a decision with its price.

```markdown
# ADR <nnnn> — <decision in one line>

Status: proposed | accepted | superseded by <nnnn>. Date: <YYYY-MM-DD>.

## Context
What forces the decision: the requirement, the platform limit, the data shape, the deadline. Numbers where they exist (requests/day, documents, payload size).

## Decision
What was chosen, in one paragraph. Name the primitive (Queue, Cron, Durable Object, request path) and the idempotency key.

## Alternatives considered
- <alternative> — why not (one line, concrete).

## Consequences
- What becomes easy.
- What becomes harder or costs money.
- What must be monitored (the metric and the alert).
- What would make us revisit this.
```
