# submissions/

The pull-request route for encounters. Put a draft here (copy `templates/encounter.md`), **without an `id`**, named `<date>-<slug>.md` so that drafts sort in order of arrival.

- CI checks every draft with `npm run validate -- --submissions`.
- When the pull request is merged, the Publish workflow assigns accession numbers in filename order and moves each draft to `entries/encounters/`.
- If a slot was taken in the meantime, the draft moves to `submissions/rejected/` with a `rejected:` list in its front matter explaining why.

Most people should use the encounter issue form instead; it does all of this immediately.
