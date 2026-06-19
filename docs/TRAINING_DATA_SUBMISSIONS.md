# Training Data Submissions

OpenHarness can review training data, evaluation data, prompt examples,
model-behavior examples, routing examples, and tool-use traces when they may
improve model routing, prompt strategies, eval suites, documentation, or
project fixtures.

Submission does not guarantee inclusion. Training data is reviewed for source
rights, consent, privacy, safety, quality, representativeness, and maintenance
cost before it is accepted.

## What To Submit

Use the training data submission issue form when possible:

- Dataset or example-set name
- Submitter name and contact
- Intended OpenHarness use, such as eval suite, prompt strategy example,
  routing fixture, model comparison, tool-use regression, documentation sample,
  or synthetic training corpus
- Short description of the data and why it belongs in OpenHarness
- Data source and collection method
- License, ownership, and permission statement
- Whether the data is human-authored, model-generated, synthetic, public,
  private, or mixed
- Approximate size, format, language, and schema
- Redaction and privacy notes
- Known bias, safety, quality, or coverage limitations
- Sample rows, records, or links to a stable download
- Review deadline or launch timing, if any

Avoid submitting secrets, credentials, private customer data, private chat logs,
personal data without consent, copyrighted material you cannot license, or data
that includes minors, medical records, financial records, legal records, or other
sensitive material without explicit prior maintainer approval.

## Preferred Data Format

- Small examples: Markdown, JSONL, CSV, or plain text in the issue or a pull
  request
- Structured datasets: JSONL with one record per line and documented fields
- Prompt/eval examples: include input, expected behavior, scoring notes, and any
  allowed variance
- Tool-use traces: include redacted command/input/output boundaries and expected
  recovery behavior
- Large datasets: link to a stable download, release artifact, or read-only
  folder instead of committing large files directly
- Schemas: include field names, required fields, optional fields, and examples

## Permission Statement

Every training data submission must include this statement, adapted with the
correct owner name:

```text
I confirm that I own or am authorized to submit this data and grant the
OpenHarness project owner a perpetual, worldwide, royalty-free, irrevocable
license to use, copy, modify, distribute, sublicense, and relicense the
submitted data as part of OpenHarness, including in future proprietary,
source-available, or open-source releases.
```

If the data has additional usage rules, include them clearly in the same issue.
Maintainers may decline data whose restrictions are too broad, unclear,
privacy-sensitive, or difficult to honor.

## Review Checklist

Maintainers should review training data submissions for:

- Clear ownership, license, consent, and permission to include the data
- No secrets, credentials, private customer data, or unapproved personal data
- Clear provenance and collection method
- Sufficient schema, sample records, and intended-use notes
- Safety concerns, including harmful instructions, malware, self-harm,
  harassment, sexual content, or other sensitive content
- Bias, representativeness, quality, and duplication risks
- Whether data should be stored in the repo, linked externally, transformed into
  a fixture, or rejected
- Whether inclusion needs a dedicated pull request, discussion, security review,
  or release note

Accepted data should be added in a focused pull request that links back to the
training data submission issue and documents any redaction or transformation.
