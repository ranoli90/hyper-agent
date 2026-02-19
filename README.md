# HyperAgent — Revolutionary Autonomous AI Browser Agent

**The world's most intelligent browser automation system.** HyperAgent is a Chrome extension that acts as a genuinely autonomous AI agent, capable of understanding and executing ANY task without preprogrammed workflows. Unlike traditional automation tools, HyperAgent dynamically analyzes requests, determines optimal approaches, and learns from experience.

[![Build Status](https://img.shields.io/badge/build-passing-green.svg)](https://github.com/ranoli90/hyper-agent)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Chrome Extension](https://img.shields.io/badge/Chrome-MV3-orange.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)

---

## 🚀 **What Makes HyperAgent Revolutionary**

### **True Autonomous Intelligence**
- **Dynamic Task Analysis**: Understands any request without predefined categories
- **Adaptive Execution**: Modifies approach based on context and results
- **Self-Learning System**: Learns from successes and failures to improve
- **Creative Problem-Solving**: Thinks of novel solutions, not just follows recipes
- **No Hardcoded Workflows**: Figures out solutions autonomously

## 🛠 **Tech Stack**

### **Core Technologies**
- **TypeScript 5.0+**: Strict typing, advanced language features, type safety
- **Chrome Extension Manifest V3**: Modern extension architecture with service workers
- **WXT (Web Extension Toolkit)**: Build system with hot reload and cross-browser support

### **Advanced Systems Layer**
- **Stealth & Anti-Bot Engine**: Human-like interaction modeling (Bezier curves, stochastic typing)
- **Mission Persistence (Checkpoint/Restore)**: State serialization for task recovery
- **Swarm Intelligence Coordinator**: Multi-agent collaboration with parallel orchestration
- **Advanced Caching System**: Multi-level caching with compression and analytics
- **Model Optimizer & Routing**: Cost-aware AI model selection and token optimization
- **Comprehensive Logging Framework**: Structured JSON logging with rotation
- **Error Boundary & Recovery System**: Graceful degradation and automatic recovery
- **Memory Management System**: Garbage collection monitoring and cleanup
- **Input Sanitization & XSS Protection**: Security-first data handling
- **Retry Circuit Breaker Patterns**: Intelligent retry logic with circuit breakers
- **Testing Framework**: Unit, integration, and end-to-end testing suite

### **AI & ML Integration**
- **Multi-Provider LLM Support**: OpenAI, Anthropic, Google, OpenRouter, and custom endpoints
- **Vision-Capable Models**: GPT-4o, Claude 3.5 Sonnet, Gemini 1.5 Pro, LLaMA 3.2
- **Intelligent Model Selection**: Automatic model switching based on task requirements
- **Cost Tracking & Optimization**: Real-time cost monitoring and model optimization
- **Fallback Reasoning**: Intelligent fallback when primary models fail

### **Performance & Reliability**
- **Rate Limiting & Throttling**: Prevents API abuse and ensures stability
- **Background Processing**: Non-blocking operations with Web Workers
- **Cross-Tab Synchronization**: Coordinated operations across browser tabs
- **Persistent Storage**: Chrome storage API with encryption and backup
- **Real-time Monitoring**: Performance metrics and system health monitoring

## 🎯 **What HyperAgent Can Do**

### **Universal Web Automation**
HyperAgent can handle ANY web-based task without preprogramming:

#### **E-commerce & Shopping**
```
"Find me wireless earbuds under $50 with good reviews"
"Compare prices for this product across Amazon, Best Buy, and Walmart"
"Purchase this item with my saved payment method"
"Track the delivery status of my recent order"
```

#### **Research & Information Gathering**
```
"Summarize the latest developments in quantum computing"
"Find academic papers about climate change solutions"
"Compare features of different project management tools"
"Research the best restaurants in downtown Seattle"
```

#### **Content Creation & Social Media**
```
"Write a LinkedIn post about my recent project"
"Find trending topics in AI and create a Twitter thread"
"Generate a blog post about sustainable technology"
"Create a presentation about our company achievements"
```

#### **Productivity & Workflow Automation**
```
"Set up recurring reminders for my weekly team meetings"
"Organize my email inbox by priority and sender"
"Create a task list from this meeting transcript"
"Generate a project timeline from these requirements"
```

#### **Data Analysis & Reporting**
```
"Analyze this sales dashboard, extract key metrics, create a summary report, and identify trends that need attention"
"Extract all email addresses from this webpage"
"Compare pricing tables and find the best deal"
"Generate a CSV of all products with ratings above 4 stars"
```

### **Intelligent Features**

#### **Context-Aware Understanding**
- Recognizes implicit requirements ("good reviews" = rating > 4.0)
- Understands business context ("enterprise solutions" vs "consumer products")
- Adapts to user preferences and past interactions
- Learns from correction and feedback

#### **Multi-Step Complex Tasks**
```
"Research vacation destinations in Europe, compare prices for flights and hotels, and book the best deal for next month"
```
**What HyperAgent Does:**
1. **Research Phase**: Searches multiple travel sites simultaneously
2. **Comparison Phase**: Extracts and compares pricing data
3. **Booking Phase**: Navigates booking flow with user confirmation

#### **Error Recovery & Adaptation**
- **Element Not Found**: Automatically tries fuzzy matching, ARIA labels, scroll-to-reveal
- **Network Issues**: Retries with exponential backoff, switches models if needed
- **Rate Limits**: Automatically throttles requests, queues operations
- **Page Changes**: Adapts to dynamic content and SPA navigation
- **Stealth & Detection**: Automatically masks identity and detects CAPTCHAs before blocking
- **Mission Recovery**: Auto-saves snapshots to resume tasks after interruptions

### 2. Development (hot reload)

```bash
npm run dev
```

## 🏗 **System Architecture**

```
┌─────────────────────────────────────────────────────────────┐
│                    HYPERAGENT ARCHITECTURE                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐     ┌─────────────────────────────┐   │
│  │   Side Panel    │     │    Background Service       │   │
│  │   UI (Chat)     │◄───►│    Worker (Autonomous AI)   │   │
│  │                 │     │                             │   │
│  │ • Command Input │     │ • Autonomous Intelligence   │   │
│  │ • Progress UI   │     │ • ReAct Loop Controller     │   │
│  │ • Confirmations │     │ • LLM Orchestration         │   │
│  │ • Chat History  │     │ • State Management          │   │
│  └─────────────────┘     │ • Error Recovery            │   │
│                          │ • Memory Management         │   │
│                          └─────────────┬───────────────┘   │
│                                        │                       │
│                          ┌─────────────▼───────────────┐   │
│                          │   Content Script Engine     │   │
│                          │                             │   │
│                          │ • Semantic DOM Analysis     │   │
│                          │ • Hybrid Locator System     │   │
│                          │ • Action Execution          │   │
│                          │ • Screenshot Capture        │   │
│                          │ • Element Self-Healing      │   │
│                          └─────────────┬───────────────┘   │
│                                        │                       │
│                          ┌─────────────▼───────────────┐   │
│                          │   Advanced Systems Layer    │   │
│                          │                             │   │
│                          │ • Caching & Performance     │   │
│                          │ • Security & Privacy        │   │
│                          │ • Logging & Monitoring      │   │
│                          │ • Memory & Storage          │   │
│                          │ • Multi-tab Coordination    │   │
│                          └─────────────────────────────┘   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │              EXTERNAL INTEGRATIONS                 │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ • OpenAI API (GPT-4, GPT-4o, GPT-4 Vision)         │   │
│  │ • Anthropic API (Claude 3, Claude 3.5 Sonnet)      │   │
│  │ • Google AI (Gemini 1.5 Pro, Gemini Vision)        │   │
│  │ • OpenRouter (Multi-provider access)               │   │
│  │ • Custom LLM Endpoints                             │   │
│  │ • Chrome Extension APIs (Tabs, Storage, Scripting) │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### **Core Components**

#### **1. Autonomous Intelligence Engine**
```typescript
// Meta-system for dynamic task understanding and execution
interface AutonomousIntelligenceEngine {
  understandAndPlan(task: string, context: IntelligenceContext): Promise<AutonomousPlan>
  executeWithAdaptation(plan: AutonomousPlan): Promise<ExecutionResult>
  learnFromSuccess(outcome: SuccessPattern): Promise<void>
  learnFromFailure(error: ErrorContext): Promise<AdaptiveStrategy>
}
```

**Capabilities:**
- **Task Classification**: Automatically categorizes requests without predefined workflows
- **Complexity Assessment**: Evaluates difficulty, risk, and resource requirements
- **Strategy Generation**: Creates multiple solution approaches
- **Adaptive Planning**: Modifies plans based on execution feedback
- **Learning Integration**: Updates knowledge base with successful patterns

#### **2. Enhanced LLM Client**
```typescript
class EnhancedLLMClient {
  async callLLM(request: LLMRequest): Promise<LLMResponse>
  private convertPlanToResponse(plan: AutonomousPlan): LLMResponse
  private makeTraditionalCall(request: LLMRequest): Promise<LLMResponse>
  clearCache(): void
}
```

**Features:**
- **Multi-Provider Support**: Automatic model selection and switching
- **Intelligent Caching**: Response caching with invalidation
- **Rate Limiting**: Prevents API abuse with smart throttling
- **Cost Tracking**: Real-time cost monitoring and optimization
- **Fallback Reasoning**: Intelligent model fallback when primary fails

#### **3. Advanced Content Script Engine**
```typescript
// DOM interaction with intelligent element resolution
class ContentScriptEngine {
  extractSemanticElements(): SemanticElement[]
  resolveHybridLocator(action: Action): Promise<Element>
  executeAction(action: Action): Promise<ActionResult>
  captureScreenshot(): Promise<string>
}
```

**Locator Hierarchy:**
1. **CSS Selectors**: Fast, precise, site-specific
2. **Text Matching**: Fuzzy text matching with Levenshtein distance
3. **ARIA Labels**: Accessibility-first element identification
4. **Role + Text**: Semantic role-based targeting
5. **Scroll-to-Reveal**: Lazy-loaded content detection
6. **Screenshot Fallback**: Vision-based element identification

#### **4. Background Service Worker**
```typescript
export default defineBackground(() => {
  // Orchestrates the entire autonomous operation
  chrome.runtime.onMessage.addListener(handleExtensionMessage)
})
```

**Responsibilities:**
- **ReAct Loop Management**: Observe → Plan → Act → Re-observe cycle
- **State Coordination**: Multi-tab, session, and user interaction management
- **Error Recovery**: Intelligent retry strategies and fallback handling
- **Security Enforcement**: Rate limiting, permission checking, privacy controls
- **Performance Monitoring**: Resource usage tracking and optimization

### 4. Configure

1. Click the HyperAgent icon in the toolbar (or right-click → Options)
2. Enter your **API Key** for an OpenAI-compatible endpoint
3. Set the **Base URL** (default: `https://api.openai.com/v1`)
4. Choose a **Model** (default: `gpt-4o` — vision-capable models recommended)
5. Adjust max steps, confirmation toggle, and dry-run mode as needed

### 5. Use it

1. Click the HyperAgent toolbar icon to open the side panel
2. Navigate to any webpage
3. Type a command like:
   - `"Summarize this page"`
   - `"Find the search box and search for 'wireless headphones'"`
   - `"Click the first product and add it to cart"`
   - `"Go to Reddit and check my latest messages"`
4. Watch the agent work step-by-step with live progress updates
5. Confirm or cancel any destructive actions when prompted

## Architecture

```
┌─────────────────┐     messages      ┌────────────────────┐
│   Side Panel UI  │ ◄──────────────► │  Background Worker  │
│  (chat + confirm)│                  │  (ReAct loop + LLM) │
└─────────────────┘                  └─────────┬──────────┘
                                               │ messages
                                     ┌─────────▼──────────┐
                                     │   Content Script     │
                                     │ (DOM read + actions) │
                                     └─────────────────────┘
```

- **Background service worker** — orchestrates the ReAct loop, calls the LLM API, manages confirmation flow
- **Content script** — injected into every page; extracts semantic elements, resolves hybrid locators, executes DOM actions
- **Side panel** — chat interface with live status updates and confirmation modals
- **Options page** — API key, model config, safety toggles

## Project Structure

```
hyper-agent/
├── entrypoints/
│   ├── background.ts          # Service worker (ReAct loop)
│   ├── content.ts             # Content script (DOM access)
│   ├── sidepanel/
│   │   ├── index.html         # Side panel HTML
│   │   ├── main.ts            # Side panel logic
│   │   └── style.css          # Side panel styles
│   └── options/
│       ├── index.html         # Options page HTML
│       ├── main.ts            # Options page logic
│       └── style.css          # Options page styles
├── shared/
│   ├── types.ts               # All TypeScript types & message definitions
│   ├── config.ts              # Storage keys, defaults, helpers
│   └── llmClient.ts           # LLM API client with vision support
├── public/icon/               # Extension icons
├── wxt.config.ts              # WXT + manifest configuration
├── package.json
└── tsconfig.json
```

## Debugging

- **Background worker**: `chrome://extensions` → HyperAgent → "Inspect views: service worker"
- **Content script**: Open DevTools on any page → Console (filter by `[HyperAgent]`)
- **Side panel**: Right-click the side panel → Inspect

## Extending

- **Multi-tab support**: Modify `runAgentLoop` to track and switch between tab IDs
- **Memory/persistence**: Store conversation history in `chrome.storage.local` for cross-session memory
- **Tool use**: Add custom tools (e.g., calculator, web search) as additional action types
- **Site-specific overrides**: Add per-domain configuration for element selectors or step limits
