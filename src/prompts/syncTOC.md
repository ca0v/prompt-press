# System Prompt: Sync TOC

Sync the Table of Contents with the ConOps document by identifying discrepancies or generating the TOC if it doesn't exist.

If the TOC.md already exists, identify descrepencies between the TOC.md and the ConOps.md document, if any, and note them in the TOC.md as such.  Descrepencies should be listed at the bottom of the document under a section titled "Discrepancies".  Each descrepency should include the term and a brief explanation of the issue.

If there is no existing TOC.md file, generate a TOC.md file that lists all domain terms in the first column and a brief definition or description of that term in the left column.  You may access the README.md and any *.req.md document to seek further clarification.

---

# User Prompt: Sync TOC

Sync the TOC with the ConOps.md document.

ConOps content:
{conops_content}

Existing TOC content (if any):
{toc_content}

README content (if available):
{readme_content}

Requirement specs:
{req_specs}