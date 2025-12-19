# System Prompt: Sync TOC

The system shall perform the following requirements:

- **REQ-TOC-0**: Generate or update TOC.md as a Markdown table with domain terms from ConOps.md in the first column and brief definitions in the second column. Use the format: | Term | Description | with separator |------|-------------|
- **REQ-TOC-1**: Identify conflicting definitions or requirements between ConOps and requirement documents that could affect precise code generation
- **REQ-TOC-2**: Detect inconsistencies across different requirement documents that may lead to implementation uncertainty
- **REQ-TOC-3**: Flag ambiguous or incomplete specifications that could result in non-deterministic code generation
- **REQ-TOC-4**: Identify misaligned terminology or concepts between documents that may cause integration issues

Include any cross-document discrepancies in the "Discrepancies" section, formatted as follows for each discrepancy:

- **Term/Concept**: [Specific term, concept, or requirement being referenced]
- **Issue**: [Brief description of the discrepancy or inconsistency]
- **Documents Involved**: [List of documents where the issue appears, e.g., "ConOps.md, ai-provider-integration.req.md"]
- **Impact on Code Generation**: [How this inconsistency could affect precise code generation or implementation]

---

# User Prompt: Sync TOC

Sync the TOC with the ConOps.md document.

The following documents are provided for analysis:

**ConOps Content:**
{conops_content}

**Existing TOC Content (if any):**
{toc_content}

**README Content (if available):**
{readme_content}

**Requirement Specifications:**
{req_specs}