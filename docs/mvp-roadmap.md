# MVP Roadmap

## MVP Goal

Build a working prototype that allows a user to upload digital assets, automatically classify and summarize important files, search across the estate, view a basic memory timeline, detect subscriptions or financial records, and generate a secure inheritance report.

## Phase 1: Foundation

- Create user authentication.
- Add secure file upload.
- Store uploaded files in object storage or local encrypted storage.
- Save metadata in a relational database.
- Build a basic asset inventory dashboard.
- Add file type detection and duplicate hashing.

## Phase 2: OCR and Classification

- Extract text from PDFs and images.
- Classify files into categories such as financial, insurance, legal, property, medical, memory, subscription, and personal.
- Display extracted text and confidence scores.
- Add filtering by category, date, and source.

## Phase 3: Document Summaries

- Generate concise summaries for important documents.
- Extract entities such as names, dates, amounts, account references, nominees, and maturity dates.
- Add source-linked summaries so users can verify extracted information.
- Flag low-confidence or incomplete results for review.

## Phase 4: Financial and Subscription Detection

- Detect recurring payments from uploaded statements and receipts.
- Identify insurance premiums, subscriptions, loans, SIPs, and investment documents.
- Build a financial overview page with assets, liabilities, recurring payments, and follow-up actions.

## Phase 5: Memory Timeline

- Extract dates and locations from photos, documents, and notes.
- Group related files into events.
- Generate timeline entries with titles, dates, related people, and associated assets.
- Add manual correction and annotation support.

## Phase 6: Conversational Search

- Index extracted text and metadata.
- Add semantic embeddings.
- Build a RAG query interface.
- Return grounded answers with source references.
- Support example queries such as "show all insurance policies" and "list active subscriptions."

## Phase 7: Inheritance Reports

- Add beneficiary profiles and role-based access scopes.
- Generate an exportable inheritance report.
- Separate financial, legal, memory, and account sections.
- Add encryption and access audit logs.

## Suggested MVP Scope

The first demonstration version should support:

- Manual upload of PDFs, images, and documents.
- OCR for scanned files.
- AI-based document classification.
- AI-generated summaries.
- Search and filters.
- Simple memory timeline.
- Subscription and financial asset detection from uploaded documents.
- PDF or HTML inheritance report export.

## Out of Scope for First MVP

- Live bank integrations.
- Automatic social media access.
- Full legal verification of death or incapacitation.
- Password vault replacement.
- Fully automated beneficiary release without human review.
- Cross-border legal compliance automation.

## Evaluation Metrics

- Document classification accuracy.
- OCR extraction quality.
- Entity extraction precision.
- Subscription detection accuracy.
- Search relevance.
- Summary usefulness.
- User time saved compared with manual review.
- Security audit completeness.

## Risks

- Incorrect AI summaries may mislead beneficiaries.
- Sensitive data requires strong privacy controls.
- Connector permissions can be complex.
- Face recognition introduces consent and privacy concerns.
- Legal inheritance rules vary by jurisdiction.

## Mitigations

- Show confidence scores and source references.
- Require human review for important decisions.
- Keep all access auditable.
- Use encryption and least-privilege access.
- Make face recognition optional.
- Avoid presenting AI outputs as legal or financial advice.
