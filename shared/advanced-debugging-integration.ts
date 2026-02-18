export interface AdvancedDebuggingIntegration {
  debuggerEngine: DebuggerEngine;
  breakpointManager: BreakpointManager;
  callStackAnalyzer: CallStackAnalyzer;
  variableInspector: VariableInspector;
  performanceProfiler: PerformanceProfiler;
  errorTracingSystem: ErrorTracingSystem;
}

export interface DebuggerEngine {
  attachDebugger(target: DebugTarget): Promise<DebugSession>;
  detachDebugger(sessionId: string): Promise<void>;
  executeCommand(sessionId: string, command: DebugCommand): Promise<DebugResult>;
  getDebugInfo(sessionId: string): DebugInfo;
  handleDebugEvent(sessionId: string, event: DebugEvent): void;
}

export interface DebugTarget {
  type: TargetType;
  id: string;
  url?: string;
  tabId?: number;
  frameId?: number;
  context?: ExecutionContext;
}

export enum TargetType {
  TAB = 'tab',
  FRAME = 'frame',
  WORKER = 'worker',
  EXTENSION = 'extension',
  NODE = 'node'
}

export interface ExecutionContext {
  id: number;
  origin: string;
  name?: string;
  auxData?: any;
}

export interface DebugSession {
  id: string;
  target: DebugTarget;
  state: DebugState;
  breakpoints: Breakpoint[];
  callStack: CallFrame[];
  scopes: Scope[];
  paused: boolean;
  pauseReason?: PauseReason;
}

export enum DebugState {
  ATTACHED = 'attached',
  RUNNING = 'running',
  PAUSED = 'paused',
  DETACHED = 'detached',
  ERROR = 'error'
}

export enum PauseReason {
  BREAKPOINT = 'breakpoint',
  STEPPING = 'stepping',
  EXCEPTION = 'exception',
  OTHER = 'other'
}

export interface DebugCommand {
  method: string;
  params?: any;
  id: number;
}

export interface DebugResult {
  id: number;
  result?: any;
  error?: DebugError;
}

export interface DebugError {
  code: number;
  message: string;
  data?: any;
}

export interface DebugInfo {
  version: string;
  capabilities: DebugCapabilities;
  supportedCommands: string[];
}

export interface DebugCapabilities {
  breakpoints: boolean;
  stepping: boolean;
  exceptions: boolean;
  evaluation: boolean;
  profiling: boolean;
  tracing: boolean;
}

export interface DebugEvent {
  method: string;
  params?: any;
  sessionId: string;
}

export interface BreakpointManager {
  setBreakpoint(location: BreakpointLocation): Promise<Breakpoint>;
  removeBreakpoint(breakpointId: string): Promise<void>;
  getBreakpoints(): Breakpoint[];
  enableBreakpoint(breakpointId: string): Promise<void>;
  disableBreakpoint(breakpointId: string): Promise<void>;
  updateBreakpoint(breakpointId: string, updates: BreakpointUpdate): Promise<Breakpoint>;
}

export interface BreakpointLocation {
  scriptId: string;
  lineNumber: number;
  columnNumber?: number;
  condition?: string;
  url?: string;
  functionName?: string;
}

export interface Breakpoint {
  id: string;
  location: BreakpointLocation;
  enabled: boolean;
  condition?: string;
  hitCount: number;
  actions: BreakpointAction[];
  metadata: BreakpointMetadata;
}

export interface BreakpointAction {
  type: ActionType;
  value: any;
  condition?: string;
}

export enum ActionType {
  LOG = 'log',
  EVALUATE = 'evaluate',
  SOUND = 'sound',
  PAUSE = 'pause',
  CONTINUE = 'continue'
}

export interface BreakpointMetadata {
  createdAt: number;
  createdBy: string;
  tags: string[];
  description?: string;
  priority: BreakpointPriority;
}

export enum BreakpointPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface BreakpointUpdate {
  enabled?: boolean;
  condition?: string;
  actions?: BreakpointAction[];
  metadata?: Partial<BreakpointMetadata>;
}

export interface CallStackAnalyzer {
  getCallStack(sessionId: string): Promise<CallStack>;
  analyzeCallStack(stack: CallStack): CallStackAnalysis;
  traceFunctionCall(functionName: string, context: TraceContext): Promise<FunctionTrace>;
  detectRecursion(stack: CallStack): RecursionInfo;
  findPerformanceBottlenecks(stack: CallStack): PerformanceBottleneck[];
}

export interface CallStack {
  frames: CallFrame[];
  asyncStack?: AsyncCallStack;
  errorStack?: ErrorStack;
}

export interface CallFrame {
  callFrameId: string;
  functionName: string;
  location: SourceLocation;
  scopeChain: Scope[];
  this?: RemoteObject;
  returnValue?: RemoteObject;
  canRestart: boolean;
}

export interface SourceLocation {
  scriptId: string;
  lineNumber: number;
  columnNumber?: number;
  url?: string;
}

export interface Scope {
  type: ScopeType;
  object: RemoteObject;
  name?: string;
  startLocation?: SourceLocation;
  endLocation?: SourceLocation;
}

export enum ScopeType {
  GLOBAL = 'global',
  LOCAL = 'local',
  WITH = 'with',
  CLOSURE = 'closure',
  CATCH = 'catch',
  BLOCK = 'block',
  SCRIPT = 'script',
  EVAL = 'eval',
  MODULE = 'module'
}

export interface RemoteObject {
  type: ObjectType;
  subtype?: ObjectSubtype;
  className?: string;
  value?: any;
  description?: string;
  objectId?: string;
  preview?: ObjectPreview;
}

export enum ObjectType {
  OBJECT = 'object',
  FUNCTION = 'function',
  UNDEFINED = 'undefined',
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  SYMBOL = 'symbol',
  BIGINT = 'bigint'
}

export enum ObjectSubtype {
  ARRAY = 'array',
  NULL = 'null',
  NODE = 'node',
  REGEXP = 'regexp',
  DATE = 'date',
  MAP = 'map',
  SET = 'set',
  WEAKMAP = 'weakmap',
  WEAKSET = 'weakset',
  ITERATOR = 'iterator',
  GENERATOR = 'generator',
  ERROR = 'error',
  PROXY = 'proxy',
  PROMISE = 'promise',
  TYPEDARRAY = 'typedarray',
  ARRAYBUFFER = 'arraybuffer',
  DATAVIEW = 'dataview',
  WEBASSEMBLYMEMORY = 'webassemblymemory',
  WASMVALUE = 'wasmvalue'
}

export interface ObjectPreview {
  type: ObjectType;
  subtype?: ObjectSubtype;
  description?: string;
  overflow: boolean;
  properties: PropertyPreview[];
}

export interface PropertyPreview {
  name: string;
  type: ObjectType;
  value?: string;
  valuePreview?: ObjectPreview;
}

export interface AsyncCallStack {
  frames: AsyncCallFrame[];
  parentStack?: CallStack;
}

export interface AsyncCallFrame {
  functionName: string;
  location: SourceLocation;
  promiseState: PromiseState;
}

export enum PromiseState {
  PENDING = 'pending',
  FULFILLED = 'fulfilled',
  REJECTED = 'rejected'
}

export interface ErrorStack {
  error: ErrorInfo;
  frames: CallFrame[];
  cause?: ErrorStack;
}

export interface ErrorInfo {
  name: string;
  message: string;
  stack?: string;
  cause?: ErrorInfo;
}

export interface CallStackAnalysis {
  depth: number;
  complexity: StackComplexity;
  patterns: StackPattern[];
  anomalies: StackAnomaly[];
  performance: StackPerformance;
}

export interface StackComplexity {
  maxDepth: number;
  averageDepth: number;
  recursiveCalls: number;
  asyncCalls: number;
  complexityScore: number;
}

export interface StackPattern {
  type: PatternType;
  frequency: number;
  impact: PatternImpact;
  recommendation?: string;
}

export enum PatternType {
  RECURSION = 'recursion',
  DEEP_NESTING = 'deep_nesting',
  ASYNC_CHAIN = 'async_chain',
  ERROR_PROPAGATION = 'error_propagation',
  MEMORY_LEAK = 'memory_leak'
}

export enum PatternImpact {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface StackAnomaly {
  type: AnomalyType;
  location: SourceLocation;
  severity: AnomalySeverity;
  description: string;
  evidence: string[];
}

export enum AnomalyType {
  STACK_OVERFLOW = 'stack_overflow',
  INFINITE_RECURSION = 'infinite_recursion',
  MEMORY_LEAK = 'memory_leak',
  EXCEPTION_LOOP = 'exception_loop',
  PERFORMANCE_DEGRADATION = 'performance_degradation'
}

export enum AnomalySeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface StackPerformance {
  totalExecutionTime: number;
  frameExecutionTimes: number[];
  bottlenecks: PerformanceBottleneck[];
  optimizationOpportunities: OptimizationOpportunity[];
}

export interface PerformanceBottleneck {
  frame: CallFrame;
  executionTime: number;
  relativeImpact: number;
  cause: string;
}

export interface OptimizationOpportunity {
  type: OptimizationType;
  frame: CallFrame;
  description: string;
  expectedImprovement: number;
}

export enum OptimizationType {
  INLINE_FUNCTION = 'inline_function',
  MEMOIZATION = 'memoization',
  ASYNC_OPTIMIZATION = 'async_optimization',
  ALGORITHM_IMPROVEMENT = 'algorithm_improvement'
}

export interface TraceContext {
  sessionId: string;
  maxDepth: number;
  includeArguments: boolean;
  includeReturnValues: boolean;
  filter: TraceFilter;
}

export interface TraceFilter {
  includeFunctions: string[];
  excludeFunctions: string[];
  includeFiles: string[];
  excludeFiles: string[];
}

export interface FunctionTrace {
  functionName: string;
  calls: FunctionCall[];
  statistics: TraceStatistics;
  performance: FunctionPerformance;
}

export interface FunctionCall {
  id: string;
  timestamp: number;
  arguments: RemoteObject[];
  returnValue?: RemoteObject;
  executionTime: number;
  caller: SourceLocation;
  error?: ErrorInfo;
}

export interface TraceStatistics {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  averageExecutionTime: number;
  minExecutionTime: number;
  maxExecutionTime: number;
  percentile95: number;
  percentile99: number;
}

export interface FunctionPerformance {
  hotspots: PerformanceHotspot[];
  optimizationSuggestions: OptimizationSuggestion[];
  memoryUsage: MemoryUsage;
}

export interface PerformanceHotspot {
  location: SourceLocation;
  executionTime: number;
  callCount: number;
  impact: number;
}

export interface OptimizationSuggestion {
  type: OptimizationType;
  description: string;
  confidence: number;
  codeExample?: string;
}

export interface MemoryUsage {
  peakUsage: number;
  averageUsage: number;
  growthRate: number;
  leakIndicators: LeakIndicator[];
}

export interface LeakIndicator {
  type: LeakType;
  severity: LeakSeverity;
  evidence: string;
}

export enum LeakType {
  CLOSURE_LEAK = 'closure_leak',
  EVENT_LISTENER_LEAK = 'event_listener_leak',
  TIMER_LEAK = 'timer_leak',
  DOM_LEAK = 'dom_leak',
  MEMORY_GROWTH = 'memory_growth'
}

export enum LeakSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface RecursionInfo {
  detected: boolean;
  depth: number;
  pattern: RecursionPattern;
  risk: RecursionRisk;
  mitigation: string;
}

export interface RecursionPattern {
  type: RecursionType;
  baseCase: boolean;
  optimization: RecursionOptimization;
}

export enum RecursionType {
  DIRECT = 'direct',
  INDIRECT = 'indirect',
  MUTUAL = 'mutual'
}

export interface RecursionOptimization {
  tailRecursive: boolean;
  memoized: boolean;
  canOptimize: boolean;
}

export interface RecursionRisk {
  stackOverflow: boolean;
  performance: PerformanceImpact;
  complexity: ComplexityImpact;
}

export interface PerformanceImpact {
  severity: ImpactSeverity;
  description: string;
}

export enum ImpactSeverity {
  NEGLIGIBLE = 'negligible',
  MODERATE = 'moderate',
  SIGNIFICANT = 'significant',
  SEVERE = 'severe'
}

export interface ComplexityImpact {
  maintainability: number;
  readability: number;
  testability: number;
}

export interface VariableInspector {
  inspectVariable(sessionId: string, variableReference: string, context?: InspectionContext): Promise<VariableInspection>;
  setVariableValue(sessionId: string, variableReference: string, newValue: any): Promise<VariableUpdate>;
  watchVariable(sessionId: string, expression: string, options: WatchOptions): Promise<VariableWatch>;
  getVariableHistory(sessionId: string, variableReference: string): Promise<VariableHistory>;
  searchVariables(sessionId: string, query: VariableQuery): Promise<VariableSearchResult>;
}

export interface InspectionContext {
  frameId?: string;
  scopeNumber?: number;
  depth?: number;
  includeProperties?: boolean;
  includePrototypes?: boolean;
}

export interface VariableInspection {
  variable: RemoteObject;
  properties: VariableProperty[];
  prototype?: RemoteObject;
  metadata: VariableMetadata;
}

export interface VariableProperty {
  name: string;
  value: RemoteObject;
  configurable: boolean;
  enumerable: boolean;
  writable: boolean;
  getter?: RemoteObject;
  setter?: RemoteObject;
}

export interface VariableMetadata {
  size?: number;
  lastModified?: number;
  references: number;
  watchers: number;
  typeInfo: TypeInfo;
}

export interface TypeInfo {
  name: string;
  category: TypeCategory;
  primitive: boolean;
  constructor?: string;
  prototype?: string;
}

export enum TypeCategory {
  PRIMITIVE = 'primitive',
  OBJECT = 'object',
  FUNCTION = 'function',
  ARRAY = 'array',
  COLLECTION = 'collection',
  SPECIAL = 'special'
}

export interface VariableUpdate {
  success: boolean;
  newValue: RemoteObject;
  oldValue: RemoteObject;
  sideEffects: SideEffect[];
}

export interface SideEffect {
  type: SideEffectType;
  description: string;
  location?: SourceLocation;
}

export interface WatchOptions {
  condition?: string;
  silent: boolean;
  persistent: boolean;
  maxHistory: number;
}

export interface VariableWatch {
  id: string;
  expression: string;
  currentValue: RemoteObject;
  history: VariableChange[];
  active: boolean;
}

export interface VariableChange {
  timestamp: number;
  oldValue: RemoteObject;
  newValue: RemoteObject;
  changeType: ChangeType;
  trigger: ChangeTrigger;
}

export enum ChangeType {
  ASSIGNMENT = 'assignment',
  PROPERTY_CHANGE = 'property_change',
  PROTOTYPE_CHANGE = 'prototype_change',
  DELETION = 'deletion'
}

export interface ChangeTrigger {
  type: TriggerType;
  location?: SourceLocation;
  context?: string;
}

export enum TriggerType {
  CODE_EXECUTION = 'code_execution',
  USER_INTERACTION = 'user_interaction',
  NETWORK_REQUEST = 'network_request',
  TIMER_EVENT = 'timer_event',
  OTHER = 'other'
}

export interface VariableHistory {
  variableId: string;
  changes: VariableChange[];
  statistics: HistoryStatistics;
}

export interface HistoryStatistics {
  totalChanges: number;
  changeFrequency: number;
  stabilityScore: number;
  patterns: ChangePattern[];
}

export interface ChangePattern {
  type: PatternType;
  frequency: number;
  description: string;
}

export interface VariableQuery {
  expression: string;
  scope: QueryScope;
  filters: QueryFilter[];
  sortBy: SortCriterion;
  limit: number;
}

export enum QueryScope {
  GLOBAL = 'global',
  LOCAL = 'local',
  CLOSURE = 'closure',
  ALL = 'all'
}

export interface QueryFilter {
  property: string;
  operator: FilterOperator;
  value: any;
}

export enum FilterOperator {
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than',
  CONTAINS = 'contains',
  MATCHES = 'matches'
}

export enum SortCriterion {
  NAME = 'name',
  TYPE = 'type',
  SIZE = 'size',
  MODIFIED = 'modified'
}

export interface VariableSearchResult {
  variables: VariableMatch[];
  totalMatches: number;
  searchTime: number;
}

export interface VariableMatch {
  variable: RemoteObject;
  location: SourceLocation;
  context: string;
  relevance: number;
}

export interface PerformanceProfiler {
  startProfiling(sessionId: string, options: ProfilingOptions): Promise<ProfileSession>;
  stopProfiling(sessionId: string): Promise<ProfileResult>;
  getProfileData(sessionId: string, timeRange?: TimeRange): Promise<ProfileData>;
  analyzePerformance(profile: ProfileResult): PerformanceAnalysis;
  optimizePerformance(analysis: PerformanceAnalysis): OptimizationPlan;
}

export interface ProfilingOptions {
  samplingInterval: number;
  includeMemory: boolean;
  includeCPU: boolean;
  includeNetwork: boolean;
  maxDuration: number;
  filters: ProfilingFilter[];
}

export interface ProfilingFilter {
  type: FilterType;
  include: string[];
  exclude: string[];
}

export enum FilterType {
  FUNCTION = 'function',
  FILE = 'file',
  MODULE = 'module',
  URL = 'url'
}

export interface ProfileSession {
  id: string;
  sessionId: string;
  startTime: number;
  options: ProfilingOptions;
  status: ProfilingStatus;
}

export enum ProfilingStatus {
  STARTING = 'starting',
  RUNNING = 'running',
  STOPPING = 'stopping',
  COMPLETED = 'completed',
  ERROR = 'error'
}

export interface ProfileResult {
  session: ProfileSession;
  data: ProfileData;
  summary: ProfileSummary;
}

export interface ProfileData {
  samples: ProfileSample[];
  memorySnapshots: MemorySnapshot[];
  networkRequests: NetworkRequest[];
  customMetrics: CustomMetric[];
}

export interface ProfileSample {
  timestamp: number;
  stack: CallStack;
  cpuUsage: number;
  memoryUsage: number;
  activeFunctions: ActiveFunction[];
}

export interface ActiveFunction {
  name: string;
  location: SourceLocation;
  executionTime: number;
  callCount: number;
}

export interface MemorySnapshot {
  timestamp: number;
  heapSize: number;
  usedHeapSize: number;
  externalMemory: number;
  objectCounts: ObjectCount[];
}

export interface ObjectCount {
  type: string;
  count: number;
  size: number;
}

export interface NetworkRequest {
  id: string;
  url: string;
  method: string;
  startTime: number;
  endTime: number;
  size: number;
  status: number;
  timing: NetworkTiming;
}

export interface NetworkTiming {
  dns: number;
  tcp: number;
  tls?: number;
  request: number;
  response: number;
  total: number;
}

export interface CustomMetric {
  name: string;
  value: number;
  timestamp: number;
  tags: Record<string, string>;
}

export interface ProfileSummary {
  duration: number;
  totalSamples: number;
  averageCPU: number;
  peakCPU: number;
  averageMemory: number;
  peakMemory: number;
  totalNetworkRequests: number;
  totalNetworkSize: number;
}

export interface PerformanceAnalysis {
  bottlenecks: PerformanceBottleneck[];
  memoryIssues: MemoryIssue[];
  networkIssues: NetworkIssue[];
  recommendations: PerformanceRecommendation[];
  overallScore: PerformanceScore;
}

export interface MemoryIssue {
  type: MemoryIssueType;
  severity: IssueSeverity;
  location: SourceLocation;
  evidence: string[];
  impact: number;
}

export enum MemoryIssueType {
  LEAK = 'leak',
  FRAGMENTATION = 'fragmentation',
  HIGH_USAGE = 'high_usage',
  FREQUENT_GC = 'frequent_gc'
}

export interface NetworkIssue {
  type: NetworkIssueType;
  severity: IssueSeverity;
  request: NetworkRequest;
  evidence: string[];
  impact: number;
}

export enum NetworkIssueType {
  SLOW_REQUEST = 'slow_request',
  LARGE_PAYLOAD = 'large_payload',
  FREQUENT_REQUESTS = 'frequent_requests',
  INEFFICIENT_CACHING = 'inefficient_caching'
}

export interface PerformanceRecommendation {
  type: RecommendationType;
  description: string;
  location: SourceLocation;
  expectedImprovement: number;
  confidence: number;
  implementation: ImplementationGuidance;
}

export enum RecommendationType {
  OPTIMIZE_FUNCTION = 'optimize_function',
  REDUCE_MEMORY_USAGE = 'reduce_memory_usage',
  CACHE_DATA = 'cache_data',
  LAZY_LOAD = 'lazy_load',
  DEBOUNCE_EVENTS = 'debounce_events'
}

export interface ImplementationGuidance {
  codeExample: string;
  complexity: ComplexityLevel;
  breakingChanges: boolean;
  testRequirements: string[];
}

export enum ComplexityLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  VERY_HIGH = 'very_high'
}

export interface PerformanceScore {
  overall: number;
  components: PerformanceComponent[];
  grade: PerformanceGrade;
  trend: PerformanceTrend;
}

export interface PerformanceComponent {
  name: string;
  score: number;
  weight: number;
  trend: TrendDirection;
}

export enum PerformanceGrade {
  EXCELLENT = 'excellent',
  GOOD = 'good',
  FAIR = 'fair',
  POOR = 'poor',
  CRITICAL = 'critical'
}

export enum TrendDirection {
  IMPROVING = 'improving',
  STABLE = 'stable',
  DEGRADING = 'degrading'
}

export interface PerformanceTrend {
  direction: TrendDirection;
  magnitude: number;
  confidence: number;
  timeframe: number;
}

export interface OptimizationPlan {
  recommendations: PerformanceRecommendation[];
  implementationOrder: ImplementationStep[];
  estimatedImpact: EstimatedImpact;
  risks: OptimizationRisk[];
}

export interface ImplementationStep {
  recommendation: PerformanceRecommendation;
  order: number;
  dependencies: number[];
  estimatedTime: number;
  requiredSkills: string[];
}

export interface EstimatedImpact {
  performanceGain: number;
  memoryReduction: number;
  networkImprovement: number;
  userExperience: UXImpact;
}

export interface OptimizationRisk {
  type: RiskType;
  severity: RiskSeverity;
  description: string;
  mitigation: string;
}

export enum RiskType {
  FUNCTIONALITY_BREAKAGE = 'functionality_breakage',
  PERFORMANCE_REGRESSION = 'performance_regression',
  COMPATIBILITY_ISSUE = 'compatibility_issue',
  MAINTAINABILITY_DEGRADATION = 'maintainability_degradation'
}

export enum RiskSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface ErrorTracingSystem {
  traceError(error: ErrorInfo, context: ErrorContext): Promise<ErrorTrace>;
  analyzeErrorPattern(traces: ErrorTrace[]): ErrorPatternAnalysis;
  correlateErrors(traces: ErrorTrace[]): ErrorCorrelation;
  generateErrorReport(traces: ErrorTrace[], context: ReportContext): ErrorReport;
  recommendErrorFixes(traces: ErrorTrace[]): ErrorFixRecommendation[];
}

export interface ErrorContext {
  sessionId: string;
  userAgent: string;
  url: string;
  timestamp: number;
  userActions: UserAction[];
  systemState: SystemState;
}

export interface ErrorTrace {
  error: ErrorInfo;
  stackTrace: CallStack;
  executionContext: ExecutionContext;
  relatedErrors: ErrorInfo[];
  environmentalFactors: EnvironmentalFactor[];
  impact: ErrorImpact;
}

export interface EnvironmentalFactor {
  type: FactorType;
  value: any;
  relevance: number;
  evidence: string;
}

export enum FactorType {
  BROWSER_VERSION = 'browser_version',
  OS_VERSION = 'os_version',
  NETWORK_CONDITIONS = 'network_conditions',
  MEMORY_PRESSURE = 'memory_pressure',
  USER_INTERACTION = 'user_interaction',
  TIMING_CONSTRAINTS = 'timing_constraints'
}

export interface ErrorImpact {
  userExperience: UXImpact;
  systemStability: StabilityImpact;
  businessImpact: BusinessImpact;
  severity: ErrorSeverity;
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface ErrorPatternAnalysis {
  patterns: ErrorPattern[];
  frequency: ErrorFrequency;
  trends: ErrorTrend[];
  rootCauses: RootCause[];
  recommendations: PatternRecommendation[];
}

export interface ErrorPattern {
  signature: string;
  frequency: number;
  contexts: ErrorContext[];
  characteristics: PatternCharacteristic[];
  confidence: number;
}

export interface PatternCharacteristic {
  type: CharacteristicType;
  value: any;
  significance: number;
}

export enum CharacteristicType {
  STACK_TRACE = 'stack_trace',
  ERROR_MESSAGE = 'error_message',
  USER_ACTION = 'user_action',
  ENVIRONMENT = 'environment',
  TIMING = 'timing'
}

export interface ErrorFrequency {
  total: number;
  byType: Record<string, number>;
  bySeverity: Record<ErrorSeverity, number>;
  timeDistribution: TimeDistribution;
}

export interface TimeDistribution {
  hourly: number[];
  daily: number[];
  weekly: number[];
  peakHours: number[];
}

export interface ErrorTrend {
  direction: TrendDirection;
  magnitude: number;
  confidence: number;
  timeframe: string;
  affectedComponents: string[];
}

export interface RootCause {
  hypothesis: string;
  probability: number;
  evidence: Evidence[];
  testability: Testability;
}

export interface Evidence {
  type: EvidenceType;
  data: any;
  strength: number;
  source: string;
}

export enum EvidenceType {
  STACK_ANALYSIS = 'stack_analysis',
  CODE_REVIEW = 'code_review',
  LOG_ANALYSIS = 'log_analysis',
  USER_REPORT = 'user_report',
  PERFORMANCE_DATA = 'performance_data'
}

export interface Testability {
  testable: boolean;
  difficulty: TestDifficulty;
  requiredResources: string[];
  estimatedTime: number;
}

export enum TestDifficulty {
  EASY = 'easy',
  MEDIUM = 'medium',
  HARD = 'hard',
  VERY_HARD = 'very_hard'
}

export interface PatternRecommendation {
  action: RecommendationAction;
  priority: RecommendationPriority;
  description: string;
  expectedBenefit: number;
  implementation: ImplementationPlan;
}

export enum RecommendationAction {
  FIX_CODE = 'fix_code',
  ADD_ERROR_HANDLING = 'add_error_handling',
  IMPROVE_VALIDATION = 'improve_validation',
  UPDATE_DEPENDENCIES = 'update_dependencies',
  ADD_MONITORING = 'add_monitoring'
}

export enum RecommendationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

export interface ErrorCorrelation {
  correlations: ErrorCorrelationResult[];
  clusters: ErrorCluster[];
  causalRelationships: CausalRelationship[];
  networkAnalysis: ErrorNetwork;
}

export interface ErrorCorrelationResult {
  error1: ErrorInfo;
  error2: ErrorInfo;
  strength: number;
  evidence: CorrelationEvidence[];
  relationship: RelationshipType;
}

export interface CorrelationEvidence {
  type: EvidenceType;
  data: any;
  confidence: number;
}

export enum RelationshipType {
  CAUSAL = 'causal',
  ASSOCIATED = 'associated',
  INDEPENDENT = 'independent',
  CORRELATED = 'correlated'
}

export interface ErrorCluster {
  id: string;
  errors: ErrorInfo[];
  centroid: ErrorCentroid;
  characteristics: ClusterCharacteristic[];
  quality: ClusterQuality;
}

export interface ErrorCentroid {
  averageSeverity: number;
  commonPatterns: string[];
  typicalContext: ErrorContext;
}

export interface ClusterCharacteristic {
  dimension: string;
  distribution: Distribution;
  significance: number;
}

export interface Distribution {
  mean: number;
  variance: number;
  outliers: number;
}

export interface ClusterQuality {
  cohesion: number;
  separation: number;
  silhouetteScore: number;
  stability: number;
}

export interface CausalRelationship {
  cause: ErrorInfo;
  effect: ErrorInfo;
  strength: number;
  lag: number;
  evidence: CausalEvidence[];
}

export interface CausalEvidence {
  method: CausalityMethod;
  result: CausalityResult;
  confidence: number;
}

export enum CausalityMethod {
  GANGER_CAUSALITY = 'granger_causality',
  TRANSFER_ENTROPY = 'transfer_entropy',
  CONVERGENT_CROSS_MAPPING = 'convergent_cross_mapping',
  STRUCTURAL_EQUATION_MODELING = 'structural_equation_modeling'
}

export interface CausalityResult {
  statistic: number;
  pValue: number;
  significant: boolean;
}

export interface ErrorNetwork {
  nodes: ErrorNode[];
  edges: ErrorEdge[];
  communities: ErrorCommunity[];
  centrality: NetworkCentrality;
}

export interface ErrorNode {
  id: string;
  error: ErrorInfo;
  degree: number;
  betweenness: number;
  closeness: number;
}

export interface ErrorEdge {
  source: string;
  target: string;
  weight: number;
  type: RelationshipType;
}

export interface ErrorCommunity {
  id: string;
  nodes: string[];
  cohesion: number;
  characteristics: CommunityCharacteristic[];
}

export interface CommunityCharacteristic {
  attribute: string;
  value: any;
  significance: number;
}

export interface NetworkCentrality {
  degree: CentralityMeasure;
  betweenness: CentralityMeasure;
  closeness: CentralityMeasure;
  eigenvector: CentralityMeasure;
}

export interface CentralityMeasure {
  mean: number;
  std: number;
  max: number;
  distribution: number[];
}

export interface ErrorReport {
  summary: ReportSummary;
  details: ErrorDetail[];
  analysis: ErrorAnalysis;
  recommendations: ErrorRecommendation[];
  metadata: ReportMetadata;
}

export interface ReportSummary {
  totalErrors: number;
  uniqueErrors: number;
  mostFrequent: ErrorFrequency;
  impactAssessment: ImpactAssessment;
  timeRange: TimeRange;
}

export interface ErrorDetail {
  error: ErrorInfo;
  trace: ErrorTrace;
  frequency: number;
  impact: ErrorImpact;
  context: ErrorContext;
}

export interface ErrorAnalysis {
  patterns: ErrorPatternAnalysis;
  correlations: ErrorCorrelation;
  rootCauseAnalysis: RootCauseAnalysis;
  trendAnalysis: TrendAnalysis;
}

export interface RootCauseAnalysis {
  hypotheses: RootCause[];
  mostLikely: RootCause;
  confidence: number;
  evidence: Evidence[];
}

export interface ErrorRecommendation {
  type: RecommendationType;
  description: string;
  priority: RecommendationPriority;
  effort: EffortEstimate;
  expectedBenefit: BenefitEstimate;
  implementation: ImplementationGuidance;
}

export interface ErrorFixRecommendation {
  error: ErrorInfo;
  fixes: FixRecommendation[];
  prevention: PreventionRecommendation[];
  testing: TestRecommendation[];
}

export interface FixRecommendation {
  type: FixType;
  description: string;
  code: CodeChange;
  priority: FixPriority;
  complexity: ComplexityLevel;
}

export enum FixType {
  CODE_FIX = 'code_fix',
  CONFIGURATION_CHANGE = 'configuration_change',
  DEPENDENCY_UPDATE = 'dependency_update',
  INFRASTRUCTURE_CHANGE = 'infrastructure_change'
}

export enum FixPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface CodeChange {
  file: string;
  line: number;
  oldCode: string;
  newCode: string;
  explanation: string;
}

export interface PreventionRecommendation {
  measure: PreventionMeasure;
  description: string;
  implementation: ImplementationGuidance;
}

export enum PreventionMeasure {
  INPUT_VALIDATION = 'input_validation',
  ERROR_BOUNDARIES = 'error_boundaries',
  CIRCUIT_BREAKERS = 'circuit_breakers',
  RETRY_MECHANISMS = 'retry_mechanisms',
  MONITORING = 'monitoring'
}

export interface TestRecommendation {
  type: TestType;
  description: string;
  testCase: TestCase;
  priority: TestPriority;
}

export enum TestType {
  UNIT_TEST = 'unit_test',
  INTEGRATION_TEST = 'integration_test',
  E2E_TEST = 'e2e_test',
  LOAD_TEST = 'load_test',
  STRESS_TEST = 'stress_test'
}

export enum TestPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface TestCase {
  name: string;
  description: string;
  steps: TestStep[];
  expectedResult: ExpectedResult;
  tags: string[];
}

export interface TestStep {
  action: string;
  target: string;
  parameters: any;
}

export interface ExpectedResult {
  success: boolean;
  output: any;
  sideEffects: SideEffect[];
}
