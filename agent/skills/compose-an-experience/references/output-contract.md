# Sidequest Output Contract

`submit_sidequest` is the canonical runtime contract. This note records the
intent behind its fields.

- `title` and `invitation` are user-facing and must preserve the magic.
- `moments` are one to five meaningful beats, never a forced three-stop format.
- A `place` may appear only when its identity and coordinates came from Places.
- `routes` contain verified transitions between moment indexes.
- `preparation` removes uncertainty; it should never become homework.
- `backupPlan` preserves the emotional shape when a likely disruption occurs.
- `uncertainties` make honesty explicit and are expected when live facts cannot
  be verified.
- `sources` provide provenance for claims that can change.

The product UI may render only a graceful subset. The richer object exists so
the agent, evaluator, and later delivery channels share one truthful plan.
