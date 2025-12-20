---
agent: agent
description: This prompt is used to tersify requirement specification documents by removing duplicate information and ensuring a single source of truth.
model: Grok Code Fast 1 (copilot)
tools: [read, edit]
---
The purpose of this task is to eliminate duplicate information across spec documents and ensure that details about a given entity are mentioned only in the spec document dedicated to that entity, maintaining a single source of truth.

For the given requirement spec source document, identify all other spec documents it references in the references section, which looks like this example:

```
references: ["faction-crystaline-guard.req", "fissure-cell.req"]
```

For each referenced document, perform the following:

1. If the source document discusses details related to the referenced entity, verify consistency with the referenced document.

2. If the referenced document is missing any details discussed in the source document, add those details to the bottom of the referenced document under the [AI-CLARIFY] section.

3. If the details in the source document contradict the referenced document, add the discrepancy to the source document in an [AI-CLARIFY] section at the bottom, with a clear explanation of the conflict.

4. If the details in the source document could be learned by reading the referenced document, remove them from the source document to avoid duplication.