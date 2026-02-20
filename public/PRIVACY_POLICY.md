# HyperAgent Privacy Policy

**Last Updated:** February 2026

## Overview

HyperAgent is a browser extension that provides AI-powered browser automation. This policy describes how we handle your data.

## Data Collection

**We do not collect personal data.** HyperAgent operates entirely within your browser.

### What stays local:
- **API Keys**: Stored in Chrome extension storage (unencrypted). Only you and this extension can access them.
- **Chat History**: Stored locally in Chrome storage. Never transmitted to our servers.
- **Agent Sessions**: Stored locally for resumption purposes.
- **Settings & Preferences**: All configuration stays in your browser.

### What is transmitted externally:
- **LLM API Requests**: When you run commands, text and screenshots are sent to your configured LLM provider (e.g., OpenRouter, OpenAI, Google). This is required for the AI to function.
- **Billing**: Payment processing via Stripe. We receive only subscription status, not payment details.

## Third-Party Services

| Service | Purpose | Data Shared |
|---------|---------|-------------|
| OpenRouter/OpenAI/Google | LLM inference | Command text, screenshots, page context |
| Stripe | Payment processing | Subscription tier only |

## Data Security

- API keys are stored in Chrome's extension storage, accessible only to HyperAgent
- We recommend using dedicated API keys with usage limits
- Export settings files contain sensitive data - do not share them

## Your Rights

- **Export**: Use the Export Settings feature to download your data
- **Delete**: Use Reset All Settings or uninstall the extension
- **Access**: All your data is visible in Chrome DevTools > Application > Storage

## Contact

For privacy questions: privacy@hyperagent.ai

## Changes

We will update this policy as needed. Significant changes will be announced in the extension.
