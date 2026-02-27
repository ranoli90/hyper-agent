# Plan: Settings, Security, and OpenRouter Integration Improvements (Sprint 3)

## Overview
This plan focuses on implementing key items from Sprint 3 to enhance the settings, security, and OpenRouter integration of HyperAgent. The selected items are chosen for their impact on user experience, security, and reliability.

## Phase 1: API Key Validation and UI Improvements
### Task 1: Improve API Key Validation in Shared Config
- **Description**: Enhance `validateSettings` function to strictly check for OpenRouter API key format (`sk-or-` prefix and length heuristics)
- **File**: `shared/config.ts`
- **Changes**:
  - Add regex validation for OpenRouter API keys: `/^sk-or-[a-zA-Z0-9_-]{32,}$/`
  - Add validation logic to `validateSettings` function
  - Display user-friendly error messages for invalid API key formats

### Task 2: Add Eye-Icon Toggle for API Key Visibility on Options Page
- **Description**: Add the same eye-icon toggle functionality from sidepanel to options page
- **Files**: `entrypoints/options/index.html`, `entrypoints/options/main.ts`
- **Changes**:
  - Modify API key input field in options HTML to include eye-icon buttons
  - Add CSS styles for the eye-icon toggle
  - Implement JavaScript logic to handle visibility toggle
  - Ensure accessibility (ARIA labels, keyboard support)

### Task 3: Update Model Selection UI
- **Description**: Remove dead model choices and explicitly state that only `openrouter/auto` is supported
- **Files**: `entrypoints/sidepanel/index.html`, `entrypoints/options/index.html`, `shared/config.ts`
- **Changes**:
  - Update model dropdown in both sidepanel and options to only show `openrouter/auto`
  - Modify UI copy to explain that OpenRouter's smart router is used
  - Ensure consistency between sidepanel and options UI

## Phase 2: Connection Testing and Error Handling
### Task 4: Add Test Connection Button
- **Description**: Add a "Test Connection" button in both sidepanel and options that verifies API key validity and OpenRouter connectivity
- **Files**: `shared/llmClient.ts`, `entrypoints/sidepanel/main.ts`, `entrypoints/options/main.ts`
- **Changes**:
  - Add `testConnection()` function to `llmClient.ts` that pings OpenRouter `/models` endpoint
  - Add button and UI feedback in both settings modals
  - Implement error handling for connection failures
  - Show loading state and success/failure messages

### Task 5: Centralize API Key Validation Timeouts
- **Description**: Ensure `validateApiKey` (or similar function) has strict, centralized timeouts
- **Files**: `shared/llmClient.ts`, `shared/config.ts`
- **Changes**:
  - Create centralized timeout configuration in `config.ts`
  - Implement timeout logic in API validation calls
  - Add error handling for timeout scenarios

### Task 6: Runtime API Key Invalidation Handling
- **Description**: Surface a canonical error message when API key is invalidated at runtime (401/403 errors)
- **Files**: `shared/llmClient.ts`, `entrypoints/sidepanel/main.ts`
- **Changes**:
  - Modify error parsing in `llmClient.ts` to detect 401/403 errors
  - Create user-friendly error message: "Reconfigure your API key"
  - Add logic to surface this error in chat interface
  - Provide guidance on how to fix the issue

## Phase 3: Security and Input Sanitization
### Task 7: API Key Redaction
- **Description**: Strip API keys from any error payload before logging or showing to user
- **Files**: `shared/llmClient.ts`, `shared/utils.ts`
- **Changes**:
  - Create `redactApiKey()` helper function that replaces API keys with `[REDACTED]`
  - Apply redaction to all error messages and logs
  - Ensure redaction happens before any error is displayed or logged

### Task 8: Harden Input Sanitization
- **Description**: Improve `sanitizeMessages` and `sanitizeForPrompt` functions to catch more injection styles
- **Files**: `shared/input-sanitization.ts`
- **Changes**:
  - Enhance `sanitizeMessages` to drop tool calls with non-whitelisted URLs or dangerous schemes
  - Tighten `sanitizeForPrompt` to detect and remove `[INST]` wrappers and other injection patterns
  - Add tests for new sanitization patterns

## Phase 4: OpenRouter Integration Hardening
### Task 9: Ensure OpenRouter Request Consistency
- **Description**: Ensure `buildOpenRouterRequest` never sets non-OpenRouter providers in `provider.order`
- **Files**: `shared/llmClient.ts`
- **Changes**:
  - Modify request building logic to strictly enforce OpenRouter provider
  - Remove any logic that allows setting custom provider orders
  - Add validation to prevent non-OpenRouter providers

### Task 10: Centralize Error Parsing
- **Description**: Centralize error parsing for both `/chat/completions` and `/embeddings` endpoints
- **Files**: `shared/llmClient.ts`
- **Changes**:
  - Create a single `parseLLMError()` function that handles all OpenRouter error formats
  - Ensure consistent error structure across all LLM API calls
  - Add support for 429 (rate limit) errors and other common OpenRouter error codes

## Phase 5: Testing and Validation
### Task 11: Test Coverage
- **Description**: Add unit tests for new functionality
- **Files**: `tests/unit/config.test.ts`, `tests/unit/llmClient.test.ts`
- **Changes**:
  - Add tests for API key validation
  - Test connection testing functionality
  - Add tests for input sanitization
  - Verify error handling scenarios

### Task 12: Build and Validation
- **Description**: Ensure all changes build and validate correctly
- **Commands**:
  - `npm run build` - Build the extension
  - `npm run fix:utf8` - Fix UTF-8 encoding (MANDATORY)
  - `npm run lint` - Run linting
  - `npm run test:unit` - Run unit tests

## Success Criteria
- API key validation correctly identifies invalid keys with `sk-or-` prefix check
- Eye-icon toggle works on both sidepanel and options page
- Test connection button properly verifies API key and connectivity
- Invalid API keys at runtime show user-friendly error message
- API keys are properly redacted from errors and logs
- Input sanitization handles new injection patterns
- OpenRouter integration is consistent and reliable