# Deployment Guide

## Recommended Host

Use Render for the first deployment because this project is a simple Node web service and stores uploaded files on the filesystem.

## Render Setup

1. Push the project to GitHub.
2. In Render, create a new Web Service from the GitHub repository.
3. Use these settings:
   - Build command: `npm install`
   - Start command: `npm start`
   - Health check path: `/healthz`
4. Add a persistent disk:
   - Name: `digital-legacy-storage`
   - Mount path: `/opt/render/project/src/storage`
   - Size: start with `1 GB`
5. Add this environment variable:
   - `STORAGE_DIR=/opt/render/project/src/storage`

## Why Persistent Storage Matters

The app stores uploaded files in `storage/uploads` and metadata in `storage/database.json`. Cloud web services often reset normal filesystem changes during redeploys. The persistent disk keeps these files across restarts and deployments.

## Production Checklist

- Add authentication before public launch.
- Add encryption for uploaded files.
- Add automated backups.
- Move metadata from JSON to PostgreSQL when multiple users or larger data volumes are needed.
- Move uploaded files to object storage when scaling beyond a small single-server deployment.
- Add OCR and AI providers through environment variables, not hardcoded keys.
