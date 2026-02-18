export interface MultiModalTesting {
  visualTesting: VisualTestingEngine;
  apiTesting: APITestingEngine;
  performanceTesting: PerformanceTestingEngine;
  accessibilityTesting: AccessibilityTestingEngine;
  securityTesting: SecurityTestingEngine;
  integrationOrchestrator: TestIntegrationOrchestrator;
}

export interface VisualTestingEngine {
  screenshotManager: ScreenshotManager;
  visualComparison: VisualComparisonEngine;
  layoutAnalysis: LayoutAnalysisEngine;
  visualRegression: VisualRegressionDetector;
  crossBrowserValidation: CrossBrowserValidator;
}

export interface ScreenshotManager {
  captureScreenshot(options: ScreenshotOptions): Promise<Screenshot>;
  captureElementScreenshot(element: ElementSelector, options: ScreenshotOptions): Promise<Screenshot>;
  captureFullPageScreenshot(options: ScreenshotOptions): Promise<Screenshot>;
  captureRegionScreenshot(region: Region, options: ScreenshotOptions): Promise<Screenshot>;
  manageScreenshotStorage(screenshot: Screenshot, action: StorageAction): Promise<void>;
}

export interface ScreenshotOptions {
  format: ImageFormat;
  quality: number;
  fullPage: boolean;
  captureBeyondViewport: boolean;
  scale: number;
  devicePixelRatio?: number;
  hideScrollbars: boolean;
  removeFixedElements: boolean;
  delay: number;
  waitForSelector?: string;
  waitForFunction?: string;
}

export enum ImageFormat {
  PNG = 'png',
  JPEG = 'jpeg',
  WEBP = 'webp'
}

export interface Screenshot {
  id: string;
  data: string; // base64 encoded
  format: ImageFormat;
  dimensions: Dimensions;
  metadata: ScreenshotMetadata;
  timestamp: number;
}

export interface Dimensions {
  width: number;
  height: number;
}

export interface ScreenshotMetadata {
  url: string;
  viewport: Viewport;
  device: DeviceInfo;
  browser: BrowserInfo;
  captureTime: number;
}

export interface Viewport {
  width: number;
  height: number;
  deviceScaleFactor: number;
}

export interface DeviceInfo {
  name?: string;
  userAgent: string;
  touch: boolean;
  mobile: boolean;
}

export interface BrowserInfo {
  name: string;
  version: string;
  userAgent: string;
}

export enum StorageAction {
  SAVE = 'save',
  DELETE = 'delete',
  ARCHIVE = 'archive'
}

export interface ElementSelector {
  type: SelectorType;
  value: string;
  context?: string;
}

export enum SelectorType {
  CSS = 'css',
  XPATH = 'xpath',
  ID = 'id',
  CLASS = 'class',
  TAG = 'tag',
  ATTRIBUTE = 'attribute'
}

export interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VisualComparisonEngine {
  compareScreenshots(baseline: Screenshot, current: Screenshot, options: ComparisonOptions): Promise<ComparisonResult>;
  compareWithBaseline(testId: string, screenshot: Screenshot, options: ComparisonOptions): Promise<ComparisonResult>;
  generateDiffImage(baseline: Screenshot, current: Screenshot, options: DiffOptions): Promise<DiffImage>;
  calculateSimilarity(baseline: Screenshot, current: Screenshot, method: SimilarityMethod): SimilarityScore;
}

export interface ComparisonOptions {
  method: ComparisonMethod;
  threshold: number;
  ignoreRegions?: Region[];
  ignoreElements?: ElementSelector[];
  colorTolerance: number;
  pixelTolerance: number;
  antiAliasing: boolean;
  ignoreCaret: boolean;
}

export enum ComparisonMethod {
  PIXEL_BY_PIXEL = 'pixel_by_pixel',
  SSIM = 'ssim',
  HISTOGRAM = 'histogram',
  FEATURE_MATCHING = 'feature_matching',
  PERCEPTUAL_HASH = 'perceptual_hash'
}

export interface ComparisonResult {
  match: boolean;
  similarity: number;
  differences: VisualDifference[];
  confidence: number;
  comparisonTime: number;
  method: ComparisonMethod;
}

export interface VisualDifference {
  region: Region;
  type: DifferenceType;
  severity: DifferenceSeverity;
  pixelCount: number;
  description: string;
}

export enum DifferenceType {
  MISSING = 'missing',
  EXTRA = 'extra',
  CHANGED = 'changed',
  SHIFTED = 'shifted'
}

export enum DifferenceSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface DiffOptions {
  highlightColor: string;
  highlightOpacity: number;
  showOnlyDifferences: boolean;
  magnification: number;
}

export interface DiffImage {
  data: string; // base64 encoded
  format: ImageFormat;
  dimensions: Dimensions;
  differences: VisualDifference[];
}

export enum SimilarityMethod {
  SSIM = 'ssim',
  MSE = 'mse',
  PSNR = 'psnr',
  HISTOGRAM = 'histogram'
}

export interface SimilarityScore {
  value: number;
  method: SimilarityMethod;
  confidence: number;
  interpretation: SimilarityInterpretation;
}

export enum SimilarityInterpretation {
  IDENTICAL = 'identical',
  VERY_SIMILAR = 'very_similar',
  SIMILAR = 'similar',
  DIFFERENT = 'different',
  VERY_DIFFERENT = 'very_different'
}

export interface LayoutAnalysisEngine {
  analyzeLayout(screenshot: Screenshot): Promise<LayoutAnalysis>;
  detectLayoutShifts(baseline: LayoutAnalysis, current: LayoutAnalysis): LayoutShift[];
  validateLayoutConstraints(layout: LayoutAnalysis, constraints: LayoutConstraint[]): ValidationResult[];
  measureLayoutPerformance(layout: LayoutAnalysis): LayoutMetrics;
}

export interface LayoutAnalysis {
  elements: LayoutElement[];
  structure: LayoutStructure;
  metrics: LayoutMetrics;
  accessibility: AccessibilityInfo;
}

export interface LayoutElement {
  id: string;
  tagName: string;
  boundingBox: BoundingBox;
  computedStyle: ComputedStyle;
  textContent?: string;
  attributes: Record<string, string>;
  children: string[];
  parent?: string;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ComputedStyle {
  display: string;
  position: string;
  width: string;
  height: string;
  margin: string;
  padding: string;
  border: string;
  background: string;
  fontSize: string;
  color: string;
}

export interface LayoutStructure {
  hierarchy: ElementHierarchy;
  grid: GridLayout;
  flexbox: FlexboxLayout;
  positioning: PositioningInfo;
}

export interface ElementHierarchy {
  root: string;
  depth: number;
  branchingFactor: number;
  leafNodes: string[];
}

export interface GridLayout {
  used: boolean;
  columns: number;
  rows: number;
  gaps: {
    row: number;
    column: number;
  };
}

export interface FlexboxLayout {
  used: boolean;
  direction: FlexDirection;
  wrap: boolean;
  justifyContent: JustifyContent;
  alignItems: AlignItems;
}

export enum FlexDirection {
  ROW = 'row',
  ROW_REVERSE = 'row-reverse',
  COLUMN = 'column',
  COLUMN_REVERSE = 'column-reverse'
}

export enum JustifyContent {
  FLEX_START = 'flex-start',
  FLEX_END = 'flex-end',
  CENTER = 'center',
  SPACE_BETWEEN = 'space-between',
  SPACE_AROUND = 'space-around',
  SPACE_EVENLY = 'space-evenly'
}

export enum AlignItems {
  FLEX_START = 'flex-start',
  FLEX_END = 'flex-end',
  CENTER = 'center',
  BASELINE = 'baseline',
  STRETCH = 'stretch'
}

export interface PositioningInfo {
  positionedElements: PositionedElement[];
  zIndexLayers: number[];
  stackingContext: StackingContext[];
}

export interface PositionedElement {
  id: string;
  position: string;
  zIndex: number;
  offset: {
    top: number;
    left: number;
  };
}

export interface StackingContext {
  root: string;
  elements: string[];
  zIndex: number;
}

export interface LayoutMetrics {
  renderTime: number;
  layoutTime: number;
  paintTime: number;
  totalElements: number;
  domDepth: number;
  styleRecalculations: number;
  layoutShifts: number;
}

export interface AccessibilityInfo {
  score: number;
  violations: AccessibilityViolation[];
  recommendations: AccessibilityRecommendation[];
}

export interface AccessibilityViolation {
  rule: string;
  impact: ImpactLevel;
  description: string;
  elements: string[];
  help: string;
}

export interface AccessibilityRecommendation {
  type: string;
  description: string;
  priority: Priority;
}

export interface LayoutShift {
  element: string;
  shiftDistance: number;
  shiftDirection: ShiftDirection;
  impact: number;
  timestamp: number;
}

export enum ShiftDirection {
  UP = 'up',
  DOWN = 'down',
  LEFT = 'left',
  RIGHT = 'right',
  DIAGONAL = 'diagonal'
}

export interface LayoutConstraint {
  element: string;
  property: string;
  operator: ConstraintOperator;
  value: any;
  tolerance?: number;
}

export enum ConstraintOperator {
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than',
  CONTAINS = 'contains',
  WITHIN_RANGE = 'within_range'
}

export interface VisualRegressionDetector {
  detectRegression(baseline: Screenshot, current: Screenshot, context: RegressionContext): Promise<RegressionResult>;
  analyzeRegressionPattern(results: RegressionResult[]): RegressionPattern;
  generateRegressionReport(results: RegressionResult[]): RegressionReport;
  recommendRegressionFixes(results: RegressionResult[]): RegressionFix[];
}

export interface RegressionContext {
  testId: string;
  environment: string;
  userAgent: string;
  viewport: Viewport;
  timestamp: number;
}

export interface RegressionResult {
  detected: boolean;
  severity: RegressionSeverity;
  affectedRegions: Region[];
  confidence: number;
  falsePositiveProbability: number;
  context: RegressionContext;
  evidence: RegressionEvidence[];
}

export enum RegressionSeverity {
  MINOR = 'minor',
  MODERATE = 'moderate',
  MAJOR = 'major',
  CRITICAL = 'critical'
}

export interface RegressionEvidence {
  type: EvidenceType;
  data: any;
  weight: number;
  description: string;
}

export interface RegressionPattern {
  pattern: Pattern;
  frequency: number;
  confidence: number;
  impact: PatternImpact;
  recommendations: PatternRecommendation[];
}

export interface Pattern {
  type: PatternType;
  characteristics: PatternCharacteristic[];
  examples: PatternExample[];
}

export enum PatternType {
  LAYOUT_SHIFT = 'layout_shift',
  CONTENT_CHANGE = 'content_change',
  STYLE_CHANGE = 'style_change',
  DYNAMIC_CONTENT = 'dynamic_content',
  BROWSER_DIFFERENCE = 'browser_difference'
}

export interface PatternCharacteristic {
  attribute: string;
  value: any;
  significance: number;
}

export interface PatternExample {
  baseline: string;
  current: string;
  description: string;
}

export interface PatternImpact {
  userExperience: number;
  businessImpact: number;
  technicalDebt: number;
}

export interface PatternRecommendation {
  action: string;
  description: string;
  priority: Priority;
  effort: EffortLevel;
}

export interface RegressionReport {
  summary: RegressionSummary;
  details: RegressionDetail[];
  trends: RegressionTrend[];
  recommendations: RegressionRecommendation[];
}

export interface RegressionSummary {
  totalRegressions: number;
  severityBreakdown: Record<RegressionSeverity, number>;
  mostAffectedComponents: string[];
  timeRange: TimeRange;
}

export interface TimeRange {
  start: number;
  end: number;
}

export interface RegressionDetail {
  regression: RegressionResult;
  screenshots: {
    baseline: string;
    current: string;
    diff: string;
  };
  analysis: RegressionAnalysis;
}

export interface RegressionAnalysis {
  rootCause: string;
  impact: string;
  reproducibility: number;
  testCoverage: number;
}

export interface RegressionTrend {
  component: string;
  regressionCount: number;
  trend: TrendDirection;
  frequency: number;
}

export interface RegressionFix {
  regression: RegressionResult;
  fixes: Fix[];
  priority: Priority;
  effort: EffortLevel;
  successProbability: number;
}

export interface Fix {
  type: FixType;
  description: string;
  code: CodeChange;
  test: TestCase;
}

export enum FixType {
  CSS_FIX = 'css_fix',
  HTML_FIX = 'html_fix',
  JAVASCRIPT_FIX = 'javascript_fix',
  CONFIGURATION_FIX = 'configuration_fix',
  DESIGN_FIX = 'design_fix'
}

export interface CodeChange {
  file: string;
  line: number;
  change: string;
  before: string;
  after: string;
}

export interface TestCase {
  id: string;
  name: string;
  steps: string[];
  expected: string;
}

export interface CrossBrowserValidator {
  validateAcrossBrowsers(screenshot: Screenshot, browsers: BrowserConfig[]): Promise<BrowserValidationResult>;
  detectBrowserSpecificIssues(results: BrowserValidationResult[]): BrowserSpecificIssue[];
  generateBrowserCompatibilityReport(results: BrowserValidationResult[]): BrowserCompatibilityReport;
  recommendBrowserFixes(issues: BrowserSpecificIssue[]): BrowserFix[];
}

export interface BrowserConfig {
  name: BrowserName;
  version: string;
  platform: Platform;
  headless: boolean;
  viewport: Viewport;
}

export enum BrowserName {
  CHROME = 'chrome',
  FIREFOX = 'firefox',
  SAFARI = 'safari',
  EDGE = 'edge',
  IE = 'ie',
  OPERA = 'opera'
}

export enum Platform {
  WINDOWS = 'windows',
  MACOS = 'macos',
  LINUX = 'linux',
  ANDROID = 'android',
  IOS = 'ios'
}

export interface BrowserValidationResult {
  browser: BrowserConfig;
  screenshot: Screenshot;
  comparison: ComparisonResult;
  issues: BrowserIssue[];
  performance: BrowserPerformance;
}

export interface BrowserIssue {
  type: IssueType;
  severity: IssueSeverity;
  description: string;
  affectedElements: string[];
  screenshot?: string;
}

export enum IssueType {
  RENDERING_DIFFERENCE = 'rendering_difference',
  FUNCTIONALITY_ISSUE = 'functionality_issue',
  PERFORMANCE_DEGRADATION = 'performance_degradation',
  ACCESSIBILITY_ISSUE = 'accessibility_issue',
  COMPATIBILITY_PROBLEM = 'compatibility_problem'
}

export enum IssueSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface BrowserPerformance {
  loadTime: number;
  renderTime: number;
  interactionTime: number;
  memoryUsage: number;
  cpuUsage: number;
}

export interface BrowserSpecificIssue {
  browser: BrowserConfig;
  issue: BrowserIssue;
  frequency: number;
  impact: BrowserImpact;
  workarounds: string[];
}

export interface BrowserImpact {
  userExperience: number;
  marketShare: number;
  businessImpact: number;
}

export interface BrowserCompatibilityReport {
  summary: CompatibilitySummary;
  browserMatrix: BrowserMatrix;
  recommendations: BrowserRecommendation[];
  timeline: CompatibilityTimeline;
}

export interface CompatibilitySummary {
  overallScore: number;
  compatibleBrowsers: number;
  totalBrowsers: number;
  criticalIssues: number;
  warningIssues: number;
}

export interface BrowserMatrix {
  browsers: BrowserConfig[];
  compatibility: CompatibilityScore[][];
  issues: BrowserIssue[][];
}

export interface CompatibilityScore {
  visual: number;
  functional: number;
  performance: number;
  overall: number;
}

export interface BrowserRecommendation {
  browser: BrowserConfig;
  action: RecommendationAction;
  description: string;
  priority: Priority;
  effort: EffortLevel;
}

export enum RecommendationAction {
  FIX_ISSUE = 'fix_issue',
  ADD_POLYFILL = 'add_polyfill',
  UPDATE_BROWSER_SUPPORT = 'update_browser_support',
  DEFER_SUPPORT = 'defer_support',
  DROP_SUPPORT = 'drop_support'
}

export interface CompatibilityTimeline {
  milestones: CompatibilityMilestone[];
  roadmap: CompatibilityRoadmap;
}

export interface CompatibilityMilestone {
  date: number;
  target: string;
  browsers: BrowserConfig[];
  criteria: CompatibilityCriteria;
}

export interface CompatibilityCriteria {
  visualSimilarity: number;
  functionalCompleteness: number;
  performanceThreshold: number;
}

export interface CompatibilityRoadmap {
  phases: CompatibilityPhase[];
  dependencies: string[];
  risks: CompatibilityRisk[];
}

export interface CompatibilityPhase {
  name: string;
  duration: number;
  tasks: string[];
  deliverables: string[];
}

export interface CompatibilityRisk {
  risk: string;
  probability: number;
  impact: ImpactLevel;
  mitigation: string;
}

export interface BrowserFix {
  issue: BrowserSpecificIssue;
  fix: Fix;
  testing: TestCase[];
  validation: ValidationCriteria;
}

export interface ValidationCriteria {
  visualSimilarity: number;
  functionalTestPass: boolean;
  performanceThreshold: number;
  accessibilityScore: number;
}

export interface APITestingEngine {
  requestBuilder: RequestBuilder;
  responseValidator: ResponseValidator;
  contractTester: ContractTester;
  loadGenerator: LoadGenerator;
  securityScanner: SecurityScanner;
}

export interface RequestBuilder {
  buildRequest(spec: APIRequestSpec): Promise<HTTPRequest>;
  buildFromSpec(spec: OpenAPISpec, operationId: string): Promise<HTTPRequest>;
  parameterizeRequest(request: HTTPRequest, parameters: ParameterSet): HTTPRequest;
  authenticateRequest(request: HTTPRequest, auth: Authentication): HTTPRequest;
}

export interface APIRequestSpec {
  method: HTTPMethod;
  url: string;
  headers: Record<string, string>;
  body?: any;
  queryParams?: Record<string, string>;
  pathParams?: Record<string, string>;
  auth?: Authentication;
  timeout: number;
  retries: number;
}

export enum HTTPMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
  PATCH = 'PATCH',
  HEAD = 'HEAD',
  OPTIONS = 'OPTIONS'
}

export interface HTTPRequest {
  method: HTTPMethod;
  url: string;
  headers: Record<string, string>;
  body?: any;
  timeout: number;
  retries: number;
}

export interface OpenAPISpec {
  openapi: string;
  info: OpenAPIInfo;
  servers: OpenAPIServer[];
  paths: Record<string, OpenAPIPath>;
  components: OpenAPIComponents;
}

export interface OpenAPIInfo {
  title: string;
  version: string;
  description?: string;
}

export interface OpenAPIServer {
  url: string;
  description?: string;
}

export interface OpenAPIPath {
  [method: string]: OpenAPIOperation;
}

export interface OpenAPIOperation {
  operationId: string;
  summary?: string;
  description?: string;
  parameters?: OpenAPIParameter[];
  requestBody?: OpenAPIRequestBody;
  responses: Record<string, OpenAPIResponse>;
  security?: OpenAPISecurity[];
}

export interface OpenAPIParameter {
  name: string;
  in: ParameterLocation;
  required: boolean;
  schema: JSONSchema;
}

export enum ParameterLocation {
  QUERY = 'query',
  HEADER = 'header',
  PATH = 'path',
  COOKIE = 'cookie'
}

export interface JSONSchema {
  type: string;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  items?: JSONSchema;
  enum?: any[];
}

export interface OpenAPIRequestBody {
  required: boolean;
  content: Record<string, OpenAPIMediaType>;
}

export interface OpenAPIMediaType {
  schema: JSONSchema;
  example?: any;
  examples?: Record<string, OpenAPIExample>;
}

export interface OpenAPIExample {
  value: any;
  summary?: string;
  description?: string;
}

export interface OpenAPIResponse {
  description: string;
  content?: Record<string, OpenAPIMediaType>;
  headers?: Record<string, OpenAPIHeader>;
}

export interface OpenAPIHeader {
  description: string;
  schema: JSONSchema;
}

export interface OpenAPISecurity {
  [scheme: string]: string[];
}

export interface OpenAPIComponents {
  schemas?: Record<string, JSONSchema>;
  parameters?: Record<string, OpenAPIParameter>;
  requestBodies?: Record<string, OpenAPIRequestBody>;
  responses?: Record<string, OpenAPIResponse>;
  securitySchemes?: Record<string, OpenAPISecurityScheme>;
}

export interface OpenAPISecurityScheme {
  type: SecuritySchemeType;
  description?: string;
  name?: string;
  in?: ParameterLocation;
  scheme?: string;
  flows?: OAuthFlows;
}

export enum SecuritySchemeType {
  API_KEY = 'apiKey',
  HTTP = 'http',
  OAUTH2 = 'oauth2',
  OPENID_CONNECT = 'openIdConnect'
}

export interface OAuthFlows {
  implicit?: OAuthFlow;
  password?: OAuthFlow;
  clientCredentials?: OAuthFlow;
  authorizationCode?: OAuthFlow;
}

export interface OAuthFlow {
  authorizationUrl?: string;
  tokenUrl?: string;
  refreshUrl?: string;
  scopes: Record<string, string>;
}

export interface ParameterSet {
  query?: Record<string, any>;
  path?: Record<string, any>;
  header?: Record<string, any>;
  body?: any;
}

export interface Authentication {
  type: AuthType;
  credentials: any;
}

export enum AuthType {
  NONE = 'none',
  BASIC = 'basic',
  BEARER = 'bearer',
  API_KEY = 'api_key',
  OAUTH2 = 'oauth2',
  JWT = 'jwt'
}

export interface ResponseValidator {
  validateResponse(response: HTTPResponse, spec: ResponseSpec): ValidationResult;
  validateSchema(response: HTTPResponse, schema: JSONSchema): SchemaValidationResult;
  validatePerformance(response: HTTPResponse, criteria: PerformanceCriteria): PerformanceValidationResult;
  validateSecurity(response: HTTPResponse, rules: SecurityRules): SecurityValidationResult;
}

export interface HTTPResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: any;
  timing: ResponseTiming;
  size: ResponseSize;
}

export interface ResponseTiming {
  dns: number;
  tcp: number;
  tls?: number;
  request: number;
  response: number;
  total: number;
}

export interface ResponseSize {
  headers: number;
  body: number;
  total: number;
}

export interface ResponseSpec {
  statusCode: number;
  headers?: Record<string, string>;
  schema?: JSONSchema;
  performance?: PerformanceCriteria;
  security?: SecurityRules;
}

export interface PerformanceCriteria {
  maxResponseTime: number;
  maxSize: number;
  throughput?: number;
  latency?: number;
}

export interface SecurityRules {
  headers: SecurityHeader[];
  content: SecurityContent[];
  rateLimit?: RateLimit;
}

export interface SecurityHeader {
  name: string;
  required: boolean;
  pattern?: string;
}

export interface SecurityContent {
  type: ContentSecurityType;
  rules: string[];
}

export enum ContentSecurityType {
  JSON = 'json',
  XML = 'xml',
  HTML = 'html',
  TEXT = 'text'
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  score: number;
}

export interface ValidationError {
  field: string;
  rule: string;
  value: any;
  expected: any;
  message: string;
}

export interface ValidationWarning {
  field: string;
  rule: string;
  value: any;
  message: string;
}

export interface SchemaValidationResult extends ValidationResult {
  schemaErrors: SchemaError[];
  coverage: number;
}

export interface SchemaError {
  instancePath: string;
  schemaPath: string;
  keyword: string;
  params: any;
  message: string;
}

export interface PerformanceValidationResult extends ValidationResult {
  metrics: PerformanceMetric[];
  violations: PerformanceViolation[];
}

export interface PerformanceMetric {
  name: string;
  value: number;
  threshold: number;
  status: MetricStatus;
}

export enum MetricStatus {
  PASS = 'pass',
  WARN = 'warn',
  FAIL = 'fail'
}

export interface PerformanceViolation {
  metric: string;
  value: number;
  threshold: number;
  severity: ViolationSeverity;
}

export enum ViolationSeverity {
  MINOR = 'minor',
  MAJOR = 'major',
  CRITICAL = 'critical'
}

export interface SecurityValidationResult extends ValidationResult {
  vulnerabilities: SecurityVulnerability[];
  compliance: ComplianceStatus;
}

export interface SecurityVulnerability {
  type: VulnerabilityType;
  severity: VulnerabilitySeverity;
  description: string;
  location: string;
  remediation: string;
}

export enum VulnerabilityType {
  INJECTION = 'injection',
  BROKEN_AUTH = 'broken_auth',
  SENSITIVE_DATA = 'sensitive_data',
  XML_EXTERNAL_ENTITY = 'xml_external_entity',
  BROKEN_ACCESS_CONTROL = 'broken_access_control',
  SECURITY_MISCONFIGURATION = 'security_misconfiguration',
  XSS = 'xss',
  INSECURE_DESERIALIZATION = 'insecure_deserialization',
  VULNERABLE_COMPONENTS = 'vulnerable_components',
  INSUFFICIENT_LOGGING = 'insufficient_logging'
}

export enum VulnerabilitySeverity {
  INFO = 'info',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface ComplianceStatus {
  standard: string;
  compliant: boolean;
  violations: ComplianceViolation[];
  score: number;
}

export interface ComplianceViolation {
  rule: string;
  description: string;
  severity: ViolationSeverity;
}

export interface ContractTester {
  testContract(apiSpec: OpenAPISpec, implementation: APIImplementation): ContractTestResult;
  generateContractTests(spec: OpenAPISpec): ContractTest[];
  validateContractCompliance(tests: ContractTest[]): ContractComplianceResult;
  monitorContractDrift(spec: OpenAPISpec, traffic: APITraffic[]): ContractDriftAnalysis;
}

export interface APIImplementation {
  baseUrl: string;
  endpoints: APIEndpoint[];
  auth: Authentication;
  headers: Record<string, string>;
}

export interface APIEndpoint {
  path: string;
  method: HTTPMethod;
  handler: string;
  middlewares: string[];
}

export interface ContractTestResult {
  passed: number;
  failed: number;
  skipped: number;
  tests: ContractTest[];
  coverage: ContractCoverage;
}

export interface ContractTest {
  id: string;
  operationId: string;
  method: HTTPMethod;
  path: string;
  status: TestStatus;
  request: HTTPRequest;
  response: HTTPResponse;
  validation: ValidationResult;
  duration: number;
}

export enum TestStatus {
  PASSED = 'passed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
  ERROR = 'error'
}

export interface ContractCoverage {
  operations: number;
  parameters: number;
  responses: number;
  schemas: number;
  total: number;
}

export interface ContractComplianceResult {
  compliant: boolean;
  violations: ContractViolation[];
  recommendations: ContractRecommendation[];
  score: number;
}

export interface ContractViolation {
  operationId: string;
  type: ViolationType;
  description: string;
  severity: ViolationSeverity;
  evidence: string;
}

export enum ViolationType {
  MISSING_OPERATION = 'missing_operation',
  WRONG_METHOD = 'wrong_method',
  INVALID_SCHEMA = 'invalid_schema',
  MISSING_PARAMETER = 'missing_parameter',
  EXTRA_PARAMETER = 'extra_parameter',
  INVALID_RESPONSE = 'invalid_response'
}

export interface ContractRecommendation {
  type: RecommendationType;
  operationId: string;
  description: string;
  priority: Priority;
  implementation: string;
}

export interface APITraffic {
  timestamp: number;
  request: HTTPRequest;
  response: HTTPResponse;
  client: ClientInfo;
  duration: number;
}

export interface ClientInfo {
  ip: string;
  userAgent: string;
  referer?: string;
}

export interface ContractDriftAnalysis {
  driftDetected: boolean;
  driftScore: number;
  changes: ContractChange[];
  impact: DriftImpact;
  recommendations: DriftRecommendation[];
}

export interface ContractChange {
  operationId: string;
  changeType: ChangeType;
  description: string;
  impact: ImpactLevel;
}

export enum ChangeType {
  NEW_OPERATION = 'new_operation',
  REMOVED_OPERATION = 'removed_operation',
  CHANGED_SIGNATURE = 'changed_signature',
  CHANGED_RESPONSE = 'changed_response',
  CHANGED_SCHEMA = 'changed_schema'
}

export interface DriftImpact {
  backwardCompatibility: boolean;
  breakingChanges: number;
  affectedClients: number;
  riskLevel: RiskLevel;
}

export interface DriftRecommendation {
  action: string;
  description: string;
  priority: Priority;
  effort: EffortLevel;
}

export interface LoadGenerator {
  generateLoad(config: LoadConfig): Promise<LoadTestResult>;
  simulateUsers(config: UserSimulationConfig): Promise<UserSimulationResult>;
  stressTest(endpoint: APIEndpoint, config: StressConfig): Promise<StressTestResult>;
  spikeTest(endpoint: APIEndpoint, config: SpikeConfig): Promise<SpikeTestResult>;
}

export interface LoadConfig {
  endpoint: APIEndpoint;
  duration: number;
  rampUp: number;
  rampDown: number;
  concurrency: number;
  rate: number;
  payload: LoadPayload;
  assertions: LoadAssertion[];
}

export interface LoadPayload {
  type: PayloadType;
  data: any;
  size: number;
  distribution: PayloadDistribution;
}

export enum PayloadType {
  STATIC = 'static',
  DYNAMIC = 'dynamic',
  RANDOM = 'random',
  FILE = 'file'
}

export interface PayloadDistribution {
  type: DistributionType;
  parameters: any;
}

export interface LoadAssertion {
  type: AssertionType;
  field: string;
  operator: AssertionOperator;
  value: any;
  tolerance?: number;
}

export enum AssertionType {
  RESPONSE_TIME = 'response_time',
  STATUS_CODE = 'status_code',
  RESPONSE_SIZE = 'response_size',
  ERROR_RATE = 'error_rate',
  THROUGHPUT = 'throughput'
}

export enum AssertionOperator {
  LESS_THAN = 'less_than',
  GREATER_THAN = 'greater_than',
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  BETWEEN = 'between'
}

export interface LoadTestResult {
  summary: LoadSummary;
  metrics: LoadMetrics;
  errors: LoadError[];
  recommendations: LoadRecommendation[];
}

export interface LoadSummary {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  duration: number;
  averageResponseTime: number;
  throughput: number;
}

export interface LoadMetrics {
  responseTime: ResponseTimeMetrics;
  throughput: ThroughputMetrics;
  errorRate: ErrorRateMetrics;
  resourceUsage: ResourceUsageMetrics;
}

export interface ResponseTimeMetrics {
  min: number;
  max: number;
  mean: number;
  median: number;
  p95: number;
  p99: number;
  distribution: number[];
}

export interface ThroughputMetrics {
  requestsPerSecond: number;
  bytesPerSecond: number;
  peakThroughput: number;
}

export interface ErrorRateMetrics {
  totalErrors: number;
  errorRate: number;
  errorTypes: Record<string, number>;
  errorDistribution: number[];
}

export interface ResourceUsageMetrics {
  cpu: CPUMetrics;
  memory: MemoryMetrics;
  network: NetworkMetrics;
}

export interface CPUMetrics {
  user: number;
  system: number;
  idle: number;
  usage: number;
}

export interface MemoryMetrics {
  used: number;
  free: number;
  total: number;
  usage: number;
}

export interface NetworkMetrics {
  bytesIn: number;
  bytesOut: number;
  packetsIn: number;
  packetsOut: number;
}

export interface LoadError {
  timestamp: number;
  error: string;
  request: HTTPRequest;
  response?: HTTPResponse;
  severity: ErrorSeverity;
}

export interface LoadRecommendation {
  type: RecommendationType;
  description: string;
  priority: Priority;
  action: string;
  expectedImpact: number;
}

export interface UserSimulationConfig {
  userProfiles: UserProfile[];
  behaviorPatterns: BehaviorPattern[];
  sessionDuration: number;
  thinkTime: ThinkTimeConfig;
  geographicDistribution: GeographicDistribution[];
}

export interface UserProfile {
  name: string;
  weight: number;
  characteristics: UserCharacteristic[];
  journey: UserJourney;
}

export interface UserCharacteristic {
  attribute: string;
  value: any;
  distribution: string;
}

export interface UserJourney {
  steps: JourneyStep[];
  completionRate: number;
}

export interface JourneyStep {
  action: string;
  duration: number;
  successRate: number;
}

export interface BehaviorPattern {
  name: string;
  frequency: number;
  actions: string[];
  transitions: Transition[];
}

export interface Transition {
  from: string;
  to: string;
  probability: number;
}

export interface ThinkTimeConfig {
  min: number;
  max: number;
  distribution: DistributionType;
}

export interface GeographicDistribution {
  region: string;
  percentage: number;
  latency: number;
  bandwidth: number;
}

export interface UserSimulationResult {
  simulation: SimulationResult;
  userMetrics: UserMetrics;
  journeyMetrics: JourneyMetrics;
}

export interface SimulationResult {
  activeUsers: number;
  completedJourneys: number;
  failedJourneys: number;
  averageSessionTime: number;
}

export interface UserMetrics {
  satisfaction: number;
  abandonmentRate: number;
  errorRate: number;
  performanceScore: number;
}

export interface JourneyMetrics {
  completionRates: Record<string, number>;
  bottleneckSteps: BottleneckStep[];
  pathAnalysis: PathAnalysis;
}

export interface BottleneckStep {
  step: string;
  averageTime: number;
  failureRate: number;
  queueLength: number;
}

export interface PathAnalysis {
  commonPaths: UserPath[];
  dropOffPoints: DropOffPoint[];
  optimizationOpportunities: PathOptimization[];
}

export interface UserPath {
  path: string[];
  frequency: number;
  averageTime: number;
}

export interface DropOffPoint {
  step: string;
  dropOffRate: number;
  reasons: string[];
}

export interface PathOptimization {
  path: string[];
  optimization: string;
  expectedImprovement: number;
}

export interface StressConfig {
  endpoint: APIEndpoint;
  duration: number;
  concurrency: StressConcurrency;
  payload: LoadPayload;
  thresholds: StressThreshold[];
}

export interface StressConcurrency {
  initial: number;
  increment: number;
  max: number;
  incrementInterval: number;
}

export interface StressThreshold {
  metric: string;
  warning: number;
  critical: number;
  action: ThresholdAction;
}

export enum ThresholdAction {
  CONTINUE = 'continue',
  SCALE_UP = 'scale_up',
  SCALE_DOWN = 'scale_down',
  STOP = 'stop'
}

export interface StressTestResult {
  breakingPoint: BreakingPoint;
  scalability: ScalabilityMetrics;
  failureAnalysis: FailureAnalysis;
}

export interface BreakingPoint {
  concurrency: number;
  responseTime: number;
  errorRate: number;
  resourceUsage: ResourceUsage;
}

export interface ScalabilityMetrics {
  throughputScaling: number;
  latencyScaling: number;
  errorScaling: number;
  efficiency: number;
}

export interface FailureAnalysis {
  failureMode: FailureMode;
  rootCause: string;
  recoveryTime: number;
  impact: ImpactAssessment;
}

export enum FailureMode {
  RESOURCE_EXHAUSTION = 'resource_exhaustion',
  DEADLOCK = 'deadlock',
  MEMORY_LEAK = 'memory_leak',
  NETWORK_SATURATION = 'network_saturation',
  DATABASE_CONTENTION = 'database_contention'
}

export interface ImpactAssessment {
  downtime: number;
  dataLoss: boolean;
  userImpact: number;
  costImpact: number;
}

export interface SpikeConfig {
  endpoint: APIEndpoint;
  baselineLoad: number;
  spikeLoad: number;
  spikeDuration: number;
  recoveryPeriod: number;
  iterations: number;
}

export interface SpikeTestResult {
  spikeBehavior: SpikeBehavior;
  recoveryBehavior: RecoveryBehavior;
  systemResilience: ResilienceMetrics;
}

export interface SpikeBehavior {
  responseTimeDegradation: number;
  errorRateIncrease: number;
  throughputDrop: number;
  recoveryTime: number;
}

export interface RecoveryBehavior {
  recoveryPattern: RecoveryPattern;
  overshoot: number;
  stabilityTime: number;
  residualEffects: string[];
}

export enum RecoveryPattern {
  GRACEFUL = 'graceful',
  ABRUPT = 'abrupt',
  OSCILLATING = 'oscillating',
  UNSTABLE = 'unstable'
}

export interface ResilienceMetrics {
  stabilityScore: number;
  recoveryScore: number;
  resilienceScore: number;
  recommendations: ResilienceRecommendation[];
}

export interface ResilienceRecommendation {
  area: string;
  recommendation: string;
  priority: Priority;
  effort: EffortLevel;
}

export interface SecurityScanner {
  vulnerabilityScan(endpoint: APIEndpoint, config: ScanConfig): Promise<VulnerabilityScanResult>;
  complianceCheck(endpoint: APIEndpoint, standards: SecurityStandard[]): Promise<ComplianceCheckResult>;
  penetrationTest(endpoint: APIEndpoint, scenarios: PenetrationScenario[]): Promise<PenetrationTestResult>;
  fuzzTest(endpoint: APIEndpoint, config: FuzzConfig): Promise<FuzzTestResult>;
}

export interface ScanConfig {
  depth: ScanDepth;
  scope: ScanScope;
  techniques: ScanTechnique[];
  exclusions: ScanExclusion[];
}

export enum ScanDepth {
  SURFACE = 'surface',
  DEEP = 'deep',
  COMPREHENSIVE = 'comprehensive'
}

export interface ScanScope {
  endpoints: string[];
  parameters: string[];
  headers: string[];
  methods: HTTPMethod[];
}

export interface ScanTechnique {
  type: TechniqueType;
  configuration: any;
}

export enum TechniqueType {
  SQL_INJECTION = 'sql_injection',
  XSS = 'xss',
  CSRF = 'csrf',
  BROKEN_AUTH = 'broken_auth',
  SENSITIVE_DATA_EXPOSURE = 'sensitive_data_exposure',
  XML_EXTERNAL_ENTITY = 'xml_external_entity',
  BROKEN_ACCESS_CONTROL = 'broken_access_control',
  SECURITY_MISCONFIGURATION = 'security_misconfiguration',
  INSECURE_DESERIALIZATION = 'insecure_deserialization',
  VULNERABLE_COMPONENTS = 'vulnerable_components',
  INSUFFICIENT_LOGGING = 'insufficient_logging'
}

export interface ScanExclusion {
  type: ExclusionType;
  pattern: string;
  reason: string;
}

export enum ExclusionType {
  ENDPOINT = 'endpoint',
  PARAMETER = 'parameter',
  METHOD = 'method',
  HEADER = 'header'
}

export interface VulnerabilityScanResult {
  vulnerabilities: Vulnerability[];
  riskScore: number;
  scanCoverage: number;
  falsePositives: number;
  recommendations: SecurityRecommendation[];
}

export interface Vulnerability {
  id: string;
  type: VulnerabilityType;
  severity: VulnerabilitySeverity;
  title: string;
  description: string;
  location: VulnerabilityLocation;
  evidence: string;
  remediation: string;
  references: string[];
  cvss?: CVSSScore;
}

export interface VulnerabilityLocation {
  endpoint: string;
  parameter?: string;
  method?: HTTPMethod;
  line?: number;
  file?: string;
}

export interface CVSSScore {
  base: number;
  temporal: number;
  environmental: number;
  vector: string;
}

export interface SecurityRecommendation {
  vulnerability: Vulnerability;
  action: SecurityAction;
  priority: Priority;
  effort: EffortLevel;
  timeline: string;
}

export enum SecurityAction {
  PATCH = 'patch',
  CONFIGURE = 'configure',
  MONITOR = 'monitor',
  MITIGATE = 'mitigate',
  ACCEPT_RISK = 'accept_risk'
}

export interface SecurityStandard {
  name: string;
  version: string;
  requirements: SecurityRequirement[];
}

export interface SecurityRequirement {
  id: string;
  category: SecurityCategory;
  description: string;
  test: ComplianceTest;
}

export enum SecurityCategory {
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  DATA_PROTECTION = 'data_protection',
  COMMUNICATION_SECURITY = 'communication_security',
  ERROR_HANDLING = 'error_handling',
  SESSION_MANAGEMENT = 'session_management',
  INPUT_VALIDATION = 'input_validation',
  LOGGING = 'logging'
}

export interface ComplianceTest {
  type: TestType;
  configuration: any;
  expectedResult: string;
}

export interface ComplianceCheckResult {
  standard: SecurityStandard;
  compliant: boolean;
  score: number;
  passedTests: number;
  totalTests: number;
  violations: ComplianceViolation[];
  evidence: ComplianceEvidence[];
}

export interface ComplianceEvidence {
  requirement: string;
  testResult: boolean;
  evidence: string;
  timestamp: number;
}

export interface PenetrationScenario {
  name: string;
  description: string;
  type: PenetrationType;
  steps: PenetrationStep[];
  successCriteria: SuccessCriterion[];
}

export enum PenetrationType {
  RECONNAISSANCE = 'reconnaissance',
  SCANNING = 'scanning',
  GAINING_ACCESS = 'gaining_access',
  MAINTAINING_ACCESS = 'maintaining_access',
  COVERING_TRACKS = 'covering_tracks'
}

export interface PenetrationStep {
  action: string;
  tool?: string;
  parameters: any;
  expectedOutcome: string;
  timeout: number;
}

export interface SuccessCriterion {
  condition: string;
  severity: CriterionSeverity;
}

export enum CriterionSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface PenetrationTestResult {
  scenario: PenetrationScenario;
  success: boolean;
  exploited: boolean;
  impact: PenetrationImpact;
  steps: PenetrationStepResult[];
  recommendations: PenetrationRecommendation[];
}

export interface PenetrationImpact {
  confidentiality: number;
  integrity: number;
  availability: number;
  overall: number;
}

export interface PenetrationStepResult {
  step: PenetrationStep;
  success: boolean;
  output: string;
  duration: number;
  vulnerabilities: Vulnerability[];
}

export interface PenetrationRecommendation {
  step: string;
  recommendation: string;
  priority: Priority;
  remediation: string;
}

export interface FuzzConfig {
  inputGeneration: InputGeneration;
  mutationStrategy: MutationStrategy;
  stoppingCriteria: StoppingCriteria;
  monitoring: FuzzMonitoring;
}

export interface InputGeneration {
  type: GenerationType;
  sources: string[];
  templates: InputTemplate[];
}

export enum GenerationType {
  RANDOM = 'random',
  MUTATION = 'mutation',
  TEMPLATE = 'template',
  HYBRID = 'hybrid'
}

export interface InputTemplate {
  name: string;
  structure: any;
  constraints: InputConstraint[];
}

export interface InputConstraint {
  field: string;
  type: ConstraintType;
  value: any;
}

export interface MutationStrategy {
  techniques: MutationTechnique[];
  intensity: MutationIntensity;
}

export enum MutationTechnique {
  BIT_FLIP = 'bit_flip',
  BYTE_FLIP = 'byte_flip',
  ARITHMETIC = 'arithmetic',
  BLOCK_DELETION = 'block_deletion',
  BLOCK_INSERTION = 'block_insertion',
  KNOWN_INTEGER_OVERFLOWS = 'known_integer_overflows',
  KNOWN_VULNERABILITIES = 'known_vulnerabilities'
}

export enum MutationIntensity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  EXTREME = 'extreme'
}

export interface StoppingCriteria {
  maxIterations: number;
  maxTime: number;
  crashThreshold: number;
  coverageThreshold: number;
}

export interface FuzzMonitoring {
  crashDetection: boolean;
  hangDetection: boolean;
  memoryMonitoring: boolean;
  codeCoverage: boolean;
}

export interface FuzzTestResult {
  iterations: number;
  duration: number;
  crashes: Crash[];
  hangs: Hang[];
  coverage: CoverageMetrics;
  vulnerabilities: Vulnerability[];
  performance: FuzzPerformance;
}

export interface Crash {
  iteration: number;
  input: any;
  crashType: CrashType;
  stackTrace: string;
  registers: any;
}

export enum CrashType {
  SEGMENTATION_FAULT = 'segmentation_fault',
  STACK_OVERFLOW = 'stack_overflow',
  HEAP_CORRUPTION = 'heap_corruption',
  DOUBLE_FREE = 'double_free',
  USE_AFTER_FREE = 'use_after_free',
  NULL_POINTER = 'null_pointer'
}

export interface Hang {
  iteration: number;
  input: any;
  timeout: number;
  threadState: any;
}

export interface CoverageMetrics {
  lineCoverage: number;
  branchCoverage: number;
  functionCoverage: number;
  edgeCoverage: number;
}

export interface FuzzPerformance {
  inputsPerSecond: number;
  memoryUsage: number;
  cpuUsage: number;
  efficiency: number;
}

export interface PerformanceTestingEngine {
  loadTester: LoadTester;
  stressTester: StressTester;
  spikeTester: SpikeTester;
  volumeTester: VolumeTester;
  enduranceTester: EnduranceTester;
}

export interface LoadTester {
  configureTest(config: LoadTestConfig): LoadTest;
  executeTest(test: LoadTest): Promise<LoadTestResult>;
  analyzeResults(result: LoadTestResult): LoadTestAnalysis;
  generateReport(analysis: LoadTestAnalysis): LoadTestReport;
}

export interface LoadTestConfig {
  target: TestTarget;
  loadProfile: LoadProfile;
  duration: number;
  assertions: PerformanceAssertion[];
  monitoring: MonitoringConfig;
}

export interface TestTarget {
  type: TargetType;
  url: string;
  method: HTTPMethod;
  headers: Record<string, string>;
  body?: any;
}

export enum TargetType {
  HTTP = 'http',
  WEBSOCKET = 'websocket',
  DATABASE = 'database',
  CACHE = 'cache',
  QUEUE = 'queue'
}

export interface LoadProfile {
  type: ProfileType;
  parameters: ProfileParameters;
}

export enum ProfileType {
  CONSTANT = 'constant',
  RAMP_UP = 'ramp_up',
  STEP = 'step',
  SPIKE = 'spike',
  RANDOM = 'random',
  CUSTOM = 'custom'
}

export interface ProfileParameters {
  startLoad: number;
  endLoad: number;
  duration: number;
  stepSize?: number;
  stepDuration?: number;
  distribution?: DistributionType;
}

export interface PerformanceAssertion {
  metric: PerformanceMetric;
  operator: AssertionOperator;
  threshold: number;
  window?: number;
}

export enum PerformanceMetric {
  RESPONSE_TIME = 'response_time',
  THROUGHPUT = 'throughput',
  ERROR_RATE = 'error_rate',
  CPU_USAGE = 'cpu_usage',
  MEMORY_USAGE = 'memory_usage',
  NETWORK_LATENCY = 'network_latency',
  CONCURRENT_USERS = 'concurrent_users'
}

export interface LoadTest {
  id: string;
  config: LoadTestConfig;
  status: TestStatus;
  startTime?: number;
  endTime?: number;
}

export interface LoadTestResult {
  test: LoadTest;
  metrics: PerformanceMetrics;
  errors: PerformanceError[];
  violations: AssertionViolation[];
}

export interface PerformanceMetrics {
  responseTime: ResponseTimeStats;
  throughput: ThroughputStats;
  errorRate: ErrorRateStats;
  resourceUsage: ResourceUsageStats;
  customMetrics: CustomMetric[];
}

export interface ResponseTimeStats {
  min: number;
  max: number;
  mean: number;
  median: number;
  p95: number;
  p99: number;
  stdDev: number;
}

export interface ThroughputStats {
  requestsPerSecond: number;
  bytesPerSecond: number;
  transactionsPerSecond: number;
}

export interface ErrorRateStats {
  totalErrors: number;
  errorRate: number;
  errorTypes: Record<string, number>;
}

export interface ResourceUsageStats {
  cpu: ResourceStats;
  memory: ResourceStats;
  disk: ResourceStats;
  network: ResourceStats;
}

export interface ResourceStats {
  min: number;
  max: number;
  mean: number;
  median: number;
  p95: number;
  p99: number;
}

export interface CustomMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: number;
}

export interface PerformanceError {
  timestamp: number;
  error: string;
  severity: ErrorSeverity;
  context: any;
}

export interface AssertionViolation {
  assertion: PerformanceAssertion;
  actualValue: number;
  timestamp: number;
  duration: number;
}

export interface LoadTestAnalysis {
  summary: TestSummary;
  bottlenecks: Bottleneck[];
  trends: PerformanceTrend[];
  anomalies: PerformanceAnomaly[];
  recommendations: PerformanceRecommendation[];
}

export interface TestSummary {
  status: TestStatus;
  duration: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  peakThroughput: number;
  overallScore: number;
}

export interface Bottleneck {
  type: BottleneckType;
  location: string;
  impact: number;
  evidence: string[];
  recommendation: string;
}

export enum BottleneckType {
  CPU = 'cpu',
  MEMORY = 'memory',
  NETWORK = 'network',
  DATABASE = 'database',
  APPLICATION = 'application',
  INFRASTRUCTURE = 'infrastructure'
}

export interface PerformanceTrend {
  metric: PerformanceMetric;
  direction: TrendDirection;
  magnitude: number;
  significance: number;
  period: string;
}

export interface PerformanceAnomaly {
  metric: PerformanceMetric;
  value: number;
  expected: number;
  deviation: number;
  severity: AnomalySeverity;
  timestamp: number;
  context: string;
}

export interface PerformanceRecommendation {
  category: RecommendationCategory;
  description: string;
  priority: Priority;
  effort: EffortLevel;
  expectedBenefit: number;
  implementation: ImplementationGuidance;
}

export enum RecommendationCategory {
  INFRASTRUCTURE = 'infrastructure',
  APPLICATION = 'application',
  CONFIGURATION = 'configuration',
  ARCHITECTURE = 'architecture',
  MONITORING = 'monitoring'
}

export interface LoadTestReport {
  summary: TestSummary;
  analysis: LoadTestAnalysis;
  charts: PerformanceChart[];
  recommendations: PerformanceRecommendation[];
  metadata: ReportMetadata;
}

export interface PerformanceChart {
  title: string;
  type: ChartType;
  data: ChartData;
  config: ChartConfig;
}

export enum ChartType {
  LINE = 'line',
  BAR = 'bar',
  AREA = 'area',
  SCATTER = 'scatter',
  HEATMAP = 'heatmap'
}

export interface ChartData {
  labels: string[];
  datasets: Dataset[];
}

export interface Dataset {
  label: string;
  data: number[];
  backgroundColor?: string;
  borderColor?: string;
}

export interface ChartConfig {
  xAxis: AxisConfig;
  yAxis: AxisConfig;
  options: any;
}

export interface AxisConfig {
  title: string;
  type: AxisType;
  min?: number;
  max?: number;
}

export enum AxisType {
  LINEAR = 'linear',
  LOGARITHMIC = 'logarithmic',
  TIME = 'time',
  CATEGORY = 'category'
}

export interface ReportMetadata {
  generatedAt: number;
  testId: string;
  environment: string;
  toolVersion: string;
}

export interface StressTester {
  configureTest(config: StressTestConfig): StressTest;
  executeTest(test: StressTest): Promise<StressTestResult>;
  findBreakingPoint(result: StressTestResult): BreakingPoint;
  generateReport(result: StressTestResult): StressTestReport;
}

export interface StressTestConfig {
  target: TestTarget;
  loadPattern: StressLoadPattern;
  duration: number;
  thresholds: StressThreshold[];
  monitoring: MonitoringConfig;
}

export interface StressLoadPattern {
  initialLoad: number;
  increment: number;
  incrementInterval: number;
  maxLoad: number;
  cooldownPeriod: number;
}

export interface StressThreshold {
  metric: PerformanceMetric;
  warning: number;
  critical: number;
  action: ThresholdAction;
}

export enum ThresholdAction {
  CONTINUE = 'continue',
  LOG_WARNING = 'log_warning',
  STOP_TEST = 'stop_test'
}

export interface StressTest {
  id: string;
  config: StressTestConfig;
  status: TestStatus;
  currentLoad: number;
  startTime?: number;
  endTime?: number;
}

export interface StressTestResult {
  test: StressTest;
  loadLevels: LoadLevelResult[];
  breakingPoint?: BreakingPoint;
  stabilityAnalysis: StabilityAnalysis;
}

export interface LoadLevelResult {
  load: number;
  duration: number;
  metrics: PerformanceMetrics;
  errors: PerformanceError[];
  violations: AssertionViolation[];
}

export interface BreakingPoint {
  load: number;
  metric: PerformanceMetric;
  value: number;
  threshold: number;
  evidence: string;
}

export interface StabilityAnalysis {
  stable: boolean;
  degradationRate: number;
  recoveryTime: number;
  stabilityScore: number;
}

export interface StressTestReport {
  summary: StressSummary;
  breakingPoint: BreakingPoint;
  recommendations: StressRecommendation[];
  charts: PerformanceChart[];
}

export interface StressSummary {
  maxLoad: number;
  breakingLoad: number;
  stabilityScore: number;
  duration: number;
}

export interface StressRecommendation {
  type: RecommendationType;
  description: string;
  priority: Priority;
  action: string;
}

export interface SpikeTester {
  configureTest(config: SpikeTestConfig): SpikeTest;
  executeTest(test: SpikeTest): Promise<SpikeTestResult>;
  analyzeRecovery(result: SpikeTestResult): RecoveryAnalysis;
  generateReport(result: SpikeTestResult): SpikeTestReport;
}

export interface SpikeTestConfig {
  target: TestTarget;
  baselineLoad: number;
  spikeLoad: number;
  spikeDuration: number;
  recoveryDuration: number;
  iterations: number;
  thresholds: SpikeThreshold[];
}

export interface SpikeThreshold {
  phase: TestPhase;
  metric: PerformanceMetric;
  threshold: number;
  action: ThresholdAction;
}

export enum TestPhase {
  BASELINE = 'baseline',
  SPIKE = 'spike',
  RECOVERY = 'recovery'
}

export interface SpikeTest {
  id: string;
  config: SpikeTestConfig;
  status: TestStatus;
  currentIteration: number;
  startTime?: number;
  endTime?: number;
}

export interface SpikeTestResult {
  test: SpikeTest;
  iterations: SpikeIterationResult[];
  overallAnalysis: SpikeAnalysis;
}

export interface SpikeIterationResult {
  iteration: number;
  baseline: LoadLevelResult;
  spike: LoadLevelResult;
  recovery: LoadLevelResult;
  spikeImpact: SpikeImpact;
  recoveryAnalysis: RecoveryAnalysis;
}

export interface SpikeImpact {
  responseTimeIncrease: number;
  errorRateIncrease: number;
  throughputDrop: number;
  resourceSpike: ResourceUsage;
}

export interface RecoveryAnalysis {
  recoveryTime: number;
  overshoot: number;
  stabilityTime: number;
  recoveryPattern: RecoveryPattern;
}

export enum RecoveryPattern {
  GRACEFUL = 'graceful',
  OSCILLATING = 'oscillating',
  SLOW = 'slow',
  INSTABLE = 'instable'
}

export interface SpikeAnalysis {
  averageSpikeImpact: SpikeImpact;
  worstCaseImpact: SpikeImpact;
  recoveryReliability: number;
  systemResilience: ResilienceScore;
}

export interface ResilienceScore {
  stability: number;
  recovery: number;
  adaptability: number;
  overall: number;
}

export interface SpikeTestReport {
  summary: SpikeSummary;
  analysis: SpikeAnalysis;
  recommendations: SpikeRecommendation[];
  charts: PerformanceChart[];
}

export interface SpikeSummary {
  totalIterations: number;
  averageSpikeDuration: number;
  averageRecoveryTime: number;
  resilienceScore: number;
}

export interface SpikeRecommendation {
  type: RecommendationType;
  description: string;
  priority: Priority;
  implementation: string;
}

export interface VolumeTester {
  configureTest(config: VolumeTestConfig): VolumeTest;
  executeTest(test: VolumeTest): Promise<VolumeTestResult>;
  analyzeScaling(result: VolumeTestResult): ScalingAnalysis;
  generateReport(result: VolumeTestResult): VolumeTestReport;
}

export interface VolumeTestConfig {
  target: TestTarget;
  dataVolume: DataVolume;
  concurrency: number;
  duration: number;
  assertions: VolumeAssertion[];
}

export interface DataVolume {
  initial: number;
  increment: number;
  max: number;
  incrementInterval: number;
  dataType: VolumeDataType;
}

export enum VolumeDataType {
  RECORDS = 'records',
  SIZE = 'size',
  REQUESTS = 'requests',
  USERS = 'users'
}

export interface VolumeAssertion {
  metric: PerformanceMetric;
  operator: AssertionOperator;
  threshold: number;
  degradationTolerance: number;
}

export interface VolumeTest {
  id: string;
  config: VolumeTestConfig;
  status: TestStatus;
  currentVolume: number;
  startTime?: number;
  endTime?: number;
}

export interface VolumeTestResult {
  test: VolumeTest;
  volumeLevels: VolumeLevelResult[];
  scalingAnalysis: ScalingAnalysis;
}

export interface VolumeLevelResult {
  volume: number;
  metrics: PerformanceMetrics;
  degradation: PerformanceDegradation;
  errors: PerformanceError[];
}

export interface PerformanceDegradation {
  responseTime: number;
  throughput: number;
  errorRate: number;
  overall: number;
}

export interface ScalingAnalysis {
  linearScaling: boolean;
  scalingFactor: number;
  efficiency: ScalingEfficiency;
  bottlenecks: ScalingBottleneck[];
}

export interface ScalingEfficiency {
  resourceUtilization: number;
  performanceMaintenance: number;
  costEfficiency: number;
  overall: number;
}

export interface ScalingBottleneck {
  resource: string;
  threshold: number;
  impact: number;
  mitigation: string;
}

export interface VolumeTestReport {
  summary: VolumeSummary;
  analysis: ScalingAnalysis;
  recommendations: VolumeRecommendation[];
  charts: PerformanceChart[];
}

export interface VolumeSummary {
  maxVolume: number;
  scalingEfficiency: number;
  performanceMaintenance: number;
}

export interface VolumeRecommendation {
  type: RecommendationType;
  description: string;
  priority: Priority;
  scalingStrategy: string;
}

export interface EnduranceTester {
  configureTest(config: EnduranceTestConfig): EnduranceTest;
  executeTest(test: EnduranceTest): Promise<EnduranceTestResult>;
  analyzeStability(result: EnduranceTestResult): StabilityAnalysis;
  generateReport(result: EnduranceTestResult): EnduranceTestReport;
}

export interface EnduranceTestConfig {
  target: TestTarget;
  duration: number;
  load: EnduranceLoad;
  monitoring: MonitoringConfig;
  checkpoints: CheckpointConfig[];
}

export interface EnduranceLoad {
  type: LoadType;
  intensity: number;
  variation: LoadVariation;
}

export enum LoadType {
  CONSTANT = 'constant',
  VARIABLE = 'variable',
  PROFILE_BASED = 'profile_based'
}

export interface LoadVariation {
  amplitude: number;
  frequency: number;
  pattern: VariationPattern;
}

export enum VariationPattern {
  SINUSOIDAL = 'sinusoidal',
  STEP = 'step',
  RANDOM = 'random',
  SPIKE = 'spike'
}

export interface CheckpointConfig {
  interval: number;
  metrics: PerformanceMetric[];
  validations: CheckpointValidation[];
}

export interface CheckpointValidation {
  metric: PerformanceMetric;
  operator: AssertionOperator;
  threshold: number;
  action: ValidationAction;
}

export enum ValidationAction {
  CONTINUE = 'continue',
  WARNING = 'warning',
  FAIL = 'fail'
}

export interface EnduranceTest {
  id: string;
  config: EnduranceTestConfig;
  status: TestStatus;
  checkpoints: Checkpoint[];
  startTime?: number;
  endTime?: number;
}

export interface Checkpoint {
  timestamp: number;
  metrics: PerformanceMetrics;
  validations: ValidationResult[];
  status: CheckpointStatus;
}

export enum CheckpointStatus {
  PASSED = 'passed',
  WARNING = 'warning',
  FAILED = 'failed'
}

export interface EnduranceTestResult {
  test: EnduranceTest;
  stability: StabilityAnalysis;
  degradation: DegradationAnalysis;
  anomalies: AnomalyDetection[];
}

export interface StabilityAnalysis {
  stable: boolean;
  stabilityScore: number;
  confidence: number;
  stabilityPeriod: number;
  instabilityPeriods: InstabilityPeriod[];
}

export interface InstabilityPeriod {
  start: number;
  end: number;
  severity: InstabilitySeverity;
  cause: string;
}

export enum InstabilitySeverity {
  MINOR = 'minor',
  MODERATE = 'moderate',
  MAJOR = 'major',
  CRITICAL = 'critical'
}

export interface DegradationAnalysis {
  degradationRate: number;
  degradationPattern: DegradationPattern;
  projectedFailure: number;
  mitigationRequired: boolean;
}

export enum DegradationPattern {
  LINEAR = 'linear',
  EXPONENTIAL = 'exponential',
  STEP = 'step',
  CYCLIC = 'cyclic'
}

export interface AnomalyDetection {
  timestamp: number;
  type: AnomalyType;
  severity: AnomalySeverity;
  description: string;
  impact: number;
}

export enum AnomalyType {
  SPIKE = 'spike',
  DROP = 'drop',
  OSCILLATION = 'oscillation',
  TREND_CHANGE = 'trend_change'
}

export interface EnduranceTestReport {
  summary: EnduranceSummary;
  stability: StabilityAnalysis;
  degradation: DegradationAnalysis;
  recommendations: EnduranceRecommendation[];
  charts: PerformanceChart[];
}

export interface EnduranceSummary {
  duration: number;
  stabilityScore: number;
  degradationRate: number;
  overallHealth: HealthStatus;
}

export interface EnduranceRecommendation {
  type: RecommendationType;
  description: string;
  priority: Priority;
  timeline: string;
  cost: number;
}

export interface AccessibilityTestingEngine {
  auditRunner: AccessibilityAuditor;
  complianceChecker: ComplianceChecker;
  userFlowAnalyzer: UserFlowAnalyzer;
  assistiveTechTester: AssistiveTechTester;
  remediationAdvisor: RemediationAdvisor;
}

export interface SecurityTestingEngine {
  vulnerabilityScanner: VulnerabilityScanner;
  penetrationTester: PenetrationTester;
  complianceAuditor: ComplianceAuditor;
  riskAssessor: RiskAssessor;
  securityMonitor: SecurityMonitor;
}

export interface TestIntegrationOrchestrator {
  testPlanner: TestPlanner;
  executionCoordinator: ExecutionCoordinator;
  resultAggregator: ResultAggregator;
  qualityGate: QualityGate;
  reportingOrchestrator: ReportingOrchestrator;
}
