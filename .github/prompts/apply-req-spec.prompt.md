---
agent: agent
description: This prompt refactors a requirement specification document by synchronizing and strictifying functional and non-functional requirements.
---

# Requirement Spec Refactoring (Terse)

1. Check the YAML frontmatter at the top of the document for the key `phase:`. If missing, output `ERROR: Not a specification document` and stop processing.
2. Check the YAML frontmatter for `phase: requirement`. If missing, output `ERROR: Not a requirement specification` and stop processing.
3. Identify all functional requirements mentioned in the `Overview` section. Move them to the `Functional Requirements` section. If the `Functional Requirements` section does not exist, create it after the `Overview` section. Rewrite each moved requirement precisely and unambiguously.
4. Renumber the functional requirements in the `Functional Requirements` section as `- FR-01`, `- FR-02`, etc., starting from 01.
5. Ensure each functional requirement in the `Functional Requirements` section is atomic (addresses one thing), testable (can be verified), and unambiguous (clear meaning).
6. Identify all non-functional requirements mentioned in the `Overview` section. Move them to the `Non-Functional Requirements` section. If the `Non-Functional Requirements` section does not exist, create it after the `Functional Requirements` section. Rewrite each moved requirement precisely and unambiguously.
7. Renumber the non-functional requirements in the `Non-Functional Requirements` section as `- NFR-01`, `- NFR-02`, etc., starting from 01.
8. Ensure each non-functional requirement in the `Non-Functional Requirements` section is atomic, testable, and unambiguous.
9. Revise the `Overview` section to keep it as a high-level summary only, removing any specific requirement details that have been moved.

---