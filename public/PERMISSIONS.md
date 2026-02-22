# HyperAgent Permission Justification

This document explains why HyperAgent requires each permission.

## Required Permissions

| Permission | Justification |
|------------|---------------|
| `sidePanel` | Opens the HyperAgent chat interface in Chrome's side panel |
| `tabs` | Detects active tab for automation, navigates pages, captures screenshots |
| `activeTab` | Access current tab when user invokes HyperAgent |
| `scripting` | Injects content script for DOM manipulation and page automation |
| `storage` | Saves settings, chat history, sessions locally |
| `unlimitedStorage` | Allows storage of chat history and sessions without 5MB limit |
| `contextMenus` | Right-click menu to send page content to HyperAgent |
| `alarms` | Schedules automated tasks (scheduler feature) |
| `notifications` | Alerts users when background tasks complete or fail |

## Host Permissions

| Permission | Justification |
|------------|---------------|
| `<all_urls>` | HyperAgent can automate any website the user navigates to. This is core functionality - the agent needs to read page content, click elements, fill forms, and extract data on any site the user chooses to automate. |

## Privacy Commitment

- **No data leaves the browser** except LLM API calls (user-provided API key)
- **No analytics or telemetry** by default
- **User controls** what sites to automate and what data to extract
- **API keys** stored in extension storage, accessible only by HyperAgent

## Optional Features

Some features can be disabled:
- Vision/screenshot capture: Disable in Settings
- Action history storage: Disable in Privacy Settings
- Background scheduling: Controlled by scheduler settings

For questions: privacy@hyperagent.ai
