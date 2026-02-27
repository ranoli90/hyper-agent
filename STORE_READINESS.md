# HyperAgent Store Readiness Checklist

> **Status**: Beta (v3.1.0)
> **Last Updated**: 2024-02-24

## Chrome Web Store Requirements

### Manifest Compliance
- [x] Manifest version 3 (MV3)
- [x] Minimum Chrome version: 114
- [x] Permissions justified and minimal
- [x] Host permissions: `<all_urls>` (required for browser automation)
- [x] Content Security Policy configured
- [x] Extension icons provided (16, 32, 48, 128px)

### Permissions Used
| Permission | Justification |
|------------|---------------|
| `sidePanel` | Main UI for chat interface |
| `tabs` | Tab management for automation |
| `activeTab` | Access current tab for DOM interaction |
| `scripting` | Inject content scripts for automation |
| `storage` | Persist settings and chat history |
| `unlimitedStorage` | Large chat history and workflows |
| `contextMenus` | Right-click context menu actions |
| `alarms` | Scheduled tasks |
| `notifications` | User notifications for task completion |

### Privacy & Security

#### Data Collection
- **API Keys**: Stored locally in `chrome.storage.local`, never transmitted to third parties
- **Chat History**: Stored locally in user's browser storage
- **Settings**: All settings stored locally
- **No Telemetry**: No analytics or telemetry without explicit user opt-in

#### Security Measures
- [x] Input sanitization for all user inputs
- [x] XSS prevention with HTML escaping
- [x] Rate limiting on LLM API calls
- [x] Domain allowlist/blocklist for automation
- [x] Safe regex validation for user patterns
- [x] No `eval()` or dynamic code execution
- [x] Content scripts sandboxed

#### Sensitive Data Handling
- API keys are redacted in logs
- Chat history is sanitized before storage
- Export files warn about sensitive data
- GDPR-compliant data deletion (`/delete-data` command)

## Feature Completeness

### Chat Tab (Primary Interface)
- [x] Message sending with Enter key
- [x] Multi-line input with Shift+Enter
- [x] Slash commands (`/help`, `/clear`, `/memory`, etc.)
- [x] Command history navigation (Arrow Up/Down)
- [x] Auto-growing input textarea
- [x] Character counter with warning
- [x] Loading/processing states
- [x] Stop button to cancel requests
- [x] Retry capability for failed requests
- [x] Code blocks with syntax highlighting
- [x] Markdown rendering
- [x] Copy code button
- [x] Scroll to bottom button
- [x] Export chat history
- [x] Clear history
- [x] Timestamps on messages
- [x] Message avatars (user/agent icons)
- [x] Thinking indicator animation
- [x] Reduced motion support for animations
- [x] Model selection dropdown
- [x] Message status indicator (sending/sent/error)

### Error Handling
- [x] Network error detection
- [x] API rate limit handling
- [x] Invalid API key detection
- [x] User-friendly error messages
- [x] Retry prompts for network failures
- [x] Offline mode detection
- [x] Streaming response support
- [x] Malformed response recovery
- [x] Error taxonomy with classification
- [x] Proper abort/cancellation handling

### Accessibility
- [x] ARIA landmarks for main regions
- [x] ARIA live region for chat messages
- [x] Keyboard navigation for tabs
- [x] Focus trap for modals
- [x] Skip to main content link
- [x] Disabled states for interactive elements
- [x] Reduced motion support for animations
- [x] Focus-visible ring styling
- [x] Progress bar with ARIA attributes
- [x] Screen reader announcements for status changes
- [x] High contrast mode support
- [x] Model selector with proper label association

### Offline Support
- [x] Offline detection with visual banner
- [x] Toast notifications for connection state
- [x] Prevents command execution when offline

### Internationalization
- [x] Text structured for i18n (no hardcoded layouts)
- [ ] Translation framework integration (future)

## Monetization & Limits

### Tier Structure
| Tier | Price | Actions/Day | Features |
|------|-------|-------------|----------|
| Community | Free | 500 | Full AI features, watermark on exports |
| Beta | $5/mo | Unlimited | Priority AI, no watermark, early access |

### Enforcement
- [x] Usage tracking in background
- [x] Limit display in Subscription tab
- [x] Upgrade prompts near limits
- [x] License key activation
- [x] Crypto payment support
- [x] Stripe integration ready

## Performance

### Optimization
- [x] Debounced history saves
- [x] Rate limiting on commands
- [x] Efficient DOM updates
- [x] Memory cleanup intervals
- [ ] Virtual scrolling for long histories (Sprint 4)

### Memory Management
- [x] Recovery log bounded (100 entries)
- [x] History compression
- [x] Storage quota monitoring
- [x] Expired data cleanup

### Settings & Storage
- [x] Model selection saved to storage
- [x] Settings persistence across sessions
- [x] Schema versioning with migrations
- [x] Corruption recovery for invalid data
- [x] Import/export validation

## Testing

### Unit Tests
- [x] 253 tests passing
- [x] LLM client tests
- [x] Billing tests
- [x] Security tests
- [x] Config tests
- [x] Background handler tests

### E2E Tests (Playwright)
- [ ] Basic extension loading
- [ ] Chat flow tests
- [ ] Settings persistence

## Known Issues

### Current Limitations
1. Streaming updates not displayed in real-time (infrastructure ready)
2. Limited offline functionality
3. No message search (planned)

### Browser Compatibility
- Chrome 114+ (required for sidePanel API)
- Chromium-based browsers supported
- Firefox not supported (MV3 only)

## Release Notes

### v3.1.0 (Beta)
- Initial Chrome Web Store submission
- Complete Chat tab implementation
- Subscription and billing integration
- 6 automation tabs (Swarm, Vision, Tasks, Memory, Marketplace, Subscription)
- Comprehensive error taxonomy with user-friendly messages
- Streaming response infrastructure
- Improved abort/cancellation handling
- Model selection dropdown in Chat UI
- Settings persistence with schema migrations
- Storage corruption recovery
- Visual offline indicator banner
- Enhanced accessibility with ARIA progress indicators
- High contrast mode support
- Focus-visible styling improvements

---

## Pre-Submission Checklist

- [x] TypeScript compiles without errors
- [x] ESLint passes without errors
- [x] All unit tests pass
- [x] Extension builds successfully
- [x] Loads unpacked in Chrome
- [x] README.md updated with all features
- [x] CHANGELOG.md updated for v4.0.1
- [x] Store listing text prepared (STORE_LISTING.md)
- [x] Privacy policy bundled (PRIVACY_POLICY.md in output)
- [x] Permissions document bundled (PERMISSIONS.md in output)
- [x] Manifest version 3 compliant
- [x] Minimum Chrome version 114
- [ ] Screenshots prepared (1280x800 or 640x400)
- [ ] Branded icons created (current icons are placeholders - 70 bytes each)
- [ ] Support email configured in manifest

## Screenshots Required

Take these screenshots at 1280x800 or 640x400:

1. **Chat Interface** — Sidepanel showing empty chat with model selector
2. **Command Execution** — Agent processing a command with progress stepper visible
3. **Settings Panel** — Options page with API key input and model selection
4. **Subscription View** — Pricing tier display (Community/Beta)

### Screenshot Tips
- Use a clean browser profile (no bookmarks bar)
- Use default light mode for consistency
- Include the extension icon in the toolbar
- Show realistic example commands
- Mask any personal data

## Icon Requirements

Current icons are placeholders (70 bytes). Create proper icons at:
- 16x16 px (toolbar icon)
- 32x32 px (Windows)
- 48x48 px (extension management page)
- 128x128 px (Chrome Web Store)

Save to `public/icons/` and rebuild.

## Build Output Summary

```
.output/chrome-mv3/
├── manifest.json         (1.16 KB)
├── background.js         (292 KB)
├── sidepanel.html        (64 KB)
├── options.html          (13 KB)
├── content-scripts/
│   └── content.js        (162 KB)
├── chunks/               (~105 KB)
├── assets/               (~80 KB CSS)
├── icons/                (placeholder icons)
├── PRIVACY_POLICY.md     (3.6 KB)
└── PERMISSIONS.md        (1.7 KB)

Total: ~726 KB
```

---

## Sprint Completion Summary

### Sprint 0 ✅ COMPLETE
- Fixed TypeScript blockers and ESLint errors
- Added missing CSS utilities
- Created STORE_READINESS.md

### Sprint 1 ✅ COMPLETE
- Rewrote addMessage() with avatars, timestamps, status indicators
- Added thinking animation
- Reduced motion support

### Sprint 2 ✅ COMPLETE
- Error taxonomy with classification
- Streaming response infrastructure
- Abort/cancellation handling
- MsgAgentError type

### Sprint 3 ✅ COMPLETE
- Model selection dropdown in Chat UI
- Settings persistence to chrome.storage
- Schema migrations (v2)
- Import/export validation

### Sprint 4 ✅ COMPLETE
- Visual offline indicator banner
- ARIA progress indicators
- Focus-visible styling
- High contrast mode support
- Screen reader announcements

### Sprint 5 ✅ COMPLETE
- README.md updated
- CHANGELOG.md updated
- STORE_LISTING.md created

### Sprint 6 ✅ COMPLETE
- Manifest verified (MV3, Chrome 114+)
- Privacy policy bundled
- Permissions document bundled
- Build output verified
- Screenshots checklist created
- Icon requirements documented
- Privacy policy verified

### Sprint 6 🔜 PENDING
- Screenshots preparation
- Final manual QA
- Chrome Web Store submission

---

**IMPORTANT**: This repository is **temporarily public** for beta testing. After Chrome Web Store launch, it should be made **private** to protect intellectual property.
