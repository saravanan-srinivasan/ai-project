# AI-Powered Digital Legacy Manager

An intelligent platform for discovering, organizing, preserving, and securely transferring a person's digital assets and memories to authorized beneficiaries.

## Overview

People now accumulate important digital assets across email accounts, cloud drives, local devices, financial platforms, social media, subscriptions, and document repositories. These assets often include family photographs, insurance policies, property papers, investment records, medical files, legal documents, passwords, financial statements, and personal communications.

When someone dies, becomes incapacitated, or loses account access, family members may struggle to locate critical information. The AI-Powered Digital Legacy Manager addresses this problem by consolidating scattered digital assets, understanding their contents, preserving meaningful memories, and generating secure inheritance reports.

## Problem Statement

Existing tools such as cloud storage, password managers, backup apps, and financial trackers solve isolated parts of digital asset management. They do not provide a unified, intelligent system that can:

- Discover assets across multiple authorized sources.
- Classify documents, photos, emails, and financial records.
- Extract key details from scanned documents and PDFs.
- Identify subscriptions, policies, liabilities, and investments.
- Reconstruct a personal memory timeline.
- Support natural language search across the estate.
- Produce secure digital inheritance packages for beneficiaries.

## Core Features

### Digital Asset Discovery and Consolidation

The platform connects to authorized sources such as Gmail, Outlook, Google Drive, Dropbox, OneDrive, local storage, social media exports, and document repositories. It ingests and classifies financial records, insurance files, legal agreements, investment portfolios, subscription receipts, property documents, photographs, and personal archives.

### AI-Powered Memory Timeline

The system analyzes image metadata, OCR text, emails, calendars, social posts, and facial patterns to reconstruct important life events. Milestones such as education, employment, marriage, travel, family events, and anniversaries can be organized into an interactive chronological timeline.

### Intelligent Document Understanding

OCR and large language models extract and summarize important details from insurance policies, tax records, property registrations, loan documents, bank statements, wills, investment reports, and legal agreements. Beneficiaries can quickly understand coverage, nominee details, ownership, maturity dates, balances, and obligations.

### Subscription and Financial Asset Detection

The system analyzes transactions, bank statements, emails, receipts, and recurring payment records to detect active subscriptions, SIPs, mutual funds, insurance premiums, loans, digital memberships, and other commitments.

### Secure Digital Inheritance Reports

The platform generates a structured inheritance package containing accounts, financial assets, insurance details, investment records, legal files, emergency contacts, subscription summaries, and memory archives. Encryption and role-based access control ensure only authorized people can access sensitive information.

### Conversational Retrieval

A retrieval-augmented generation interface allows beneficiaries or authorized users to ask questions such as:

- "Show all property documents."
- "List active insurance policies."
- "Which subscriptions are still active?"
- "Find investment records."
- "When was the first international trip?"

## Suggested Technology Stack

- **Frontend:** React, Next.js, or Angular
- **Backend:** Python FastAPI or Node.js
- **Databases:** PostgreSQL for structured records, object storage for files
- **Search:** Elasticsearch, OpenSearch, or PostgreSQL full-text search
- **Vector Store:** FAISS, Chroma, Weaviate, or pgvector
- **OCR:** Tesseract OCR, EasyOCR
- **Document Processing:** Apache Tika, PDF parsers, image preprocessing
- **AI/NLP:** Llama 3, Gemma, GPT-based models, sentence transformers
- **Face Recognition:** DeepFace, FaceNet
- **Security:** AES encryption, key management, audit logs, RBAC, MFA

## High-Level Modules

- Data source connectors
- Secure ingestion pipeline
- File and document classifier
- OCR extraction engine
- AI summarization engine
- Financial and subscription detector
- Memory timeline generator
- Face clustering and people recognition
- RAG-based conversational search
- Beneficiary and access management
- Digital inheritance report generator
- Audit, encryption, and compliance layer

## Expected Impact

The system helps families preserve memories, reduce administrative burden, discover financial assets, cancel unnecessary subscriptions, process insurance claims, locate legal documents, and maintain a structured digital estate for future generations.

## Documentation

- [Project Proposal](docs/project-proposal.md)
- [System Architecture](docs/system-architecture.md)
- [MVP Roadmap](docs/mvp-roadmap.md)

## Local Development

```powershell
npm.cmd start
```

Open `http://localhost:5173`.

Uploaded files and metadata are stored in `storage/`, which is intentionally ignored by Git.

## Deployment

The app is ready for Render deployment with `render.yaml`.

Recommended Render settings:

- Service type: Web Service
- Runtime: Node
- Build command: `npm install`
- Start command: `npm start`
- Health check path: `/healthz`
- Persistent disk mount path: `/opt/render/project/src/storage`
- Environment variable: `STORAGE_DIR=/opt/render/project/src/storage`

The persistent disk is required. Without it, uploaded files and `database.json` will be lost when the cloud service restarts or redeploys.

Before putting private documents online, add authentication and encryption.
