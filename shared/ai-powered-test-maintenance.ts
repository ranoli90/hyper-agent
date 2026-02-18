export interface AIPoweredTestMaintenance {
  testEvolution: TestEvolution;
  flakyTestDetection: FlakyTestDetection;
  testOptimization: TestOptimization;
  maintenanceAutomation: MaintenanceAutomation;
  qualityAssurance: QualityAssurance;
}

export interface TestEvolution {
  analyzeTestChanges(testId: string, changes: CodeChange[]): Promise<TestImpact>;
  evolveTest(testId: string, evolution: TestEvolution): Promise<EvolvedTest>;
  validateEvolution(evolvedTest: EvolvedTest): Promise<ValidationResult>;
  rollbackEvolution(testId: string, version: string): Promise<void>;
}

export interface CodeChange {
  type: ChangeType;
  file: string;
  line: number;
  content: string;
  timestamp: number;
}

export enum ChangeType {
  ADD = 'add',
  MODIFY = 'modify',
  DELETE = 'delete',
  RENAME = 'rename'
}

export interface TestImpact {
  testId: string;
  impactLevel: ImpactLevel;
  affectedComponents: string[];
  requiredChanges: TestChange[];
  risk: number;
  confidence: number;
}

export enum ImpactLevel {
  NONE = 'none',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface TestChange {
  type: ChangeType;
  description: string;
  priority: Priority;
  effort: EffortLevel;
}

export interface TestEvolution {
  changes: TestChange[];
  rationale: string;
  expectedBenefit: string;
  riskMitigation: string[];
}

export interface EvolvedTest {
  originalTest: Test;
  evolvedTest: Test;
  changes: TestChange[];
  validation: ValidationResult;
  timestamp: number;
}

export interface Test {
  id: string;
  name: string;
  content: any;
  metadata: TestMetadata;
}

export interface TestMetadata {
  author: string;
  createdAt: number;
  updatedAt: number;
  version: string;
  tags: string[];
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  score: number;
  recommendations: string[];
}

export interface ValidationIssue {
  type: IssueType;
  severity: SeverityLevel;
  description: string;
  location?: string;
}

export enum IssueType {
  FUNCTIONALITY = 'functionality',
  PERFORMANCE = 'performance',
  RELIABILITY = 'reliability',
  MAINTAINABILITY = 'maintainability'
}

export enum SeverityLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface FlakyTestDetection {
  analyzeTestHistory(testId: string, history: TestExecution[]): Promise<FlakinessAnalysis>;
  detectFlakyPatterns(tests: TestExecution[]): Promise<FlakyPattern[]>;
  diagnoseFlakiness(testId: string, analysis: FlakinessAnalysis): Promise<FlakinessDiagnosis>;
  mitigateFlakiness(testId: string, diagnosis: FlakinessDiagnosis): Promise<MitigationPlan>;
}

export interface TestExecution {
  testId: string;
  timestamp: number;
  result: TestResult;
  duration: number;
  environment: Environment;
  metadata: any;
}

export enum TestResult {
  PASSED = 'passed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
  ERROR = 'error'
}

export interface Environment {
  platform: string;
  browser: string;
  version: string;
  configuration: any;
}

export interface FlakinessAnalysis {
  testId: string;
  flakinessScore: number;
  confidence: number;
  patterns: FlakyPattern[];
  trends: FlakinessTrend[];
  rootCauses: RootCause[];
}

export interface FlakyPattern {
  type: PatternType;
  frequency: number;
  conditions: string[];
  impact: number;
}

export enum PatternType {
  TIMING_DEPENDENT = 'timing_dependent',
  ENVIRONMENT_SENSITIVE = 'environment_sensitive',
  RESOURCE_CONFLICT = 'resource_conflict',
  EXTERNAL_DEPENDENCY = 'external_dependency',
  RACE_CONDITION = 'race_condition'
}

export interface FlakinessTrend {
  period: string;
  score: number;
  change: number;
  direction: TrendDirection;
}

export enum TrendDirection {
  INCREASING = 'increasing',
  DECREASING = 'decreasing',
  STABLE = 'stable'
}

export interface RootCause {
  cause: string;
  probability: number;
  evidence: string[];
  mitigation: string;
}

export interface FlakinessDiagnosis {
  analysis: FlakinessAnalysis;
  diagnosis: string;
  confidence: number;
  evidence: DiagnosisEvidence[];
  recommendations: FlakinessRecommendation[];
}

export interface DiagnosisEvidence {
  type: EvidenceType;
  data: any;
  weight: number;
}

export enum EvidenceType {
  EXECUTION_PATTERN = 'execution_pattern',
  ENVIRONMENT_DATA = 'environment_data',
  CODE_ANALYSIS = 'code_analysis',
  LOG_ANALYSIS = 'log_analysis'
}

export interface FlakinessRecommendation {
  action: string;
  description: string;
  priority: Priority;
  effort: EffortLevel;
  expectedBenefit: number;
}

export interface MitigationPlan {
  diagnosis: FlakinessDiagnosis;
  actions: MitigationAction[];
  timeline: MitigationTimeline;
  successMetrics: SuccessMetric[];
}

export interface MitigationAction {
  action: string;
  description: string;
  priority: Priority;
  dependencies: string[];
  estimatedTime: number;
}

export interface MitigationTimeline {
  phases: MitigationPhase[];
  totalTime: number;
  milestones: Milestone[];
}

export interface MitigationPhase {
  name: string;
  actions: string[];
  duration: number;
  successCriteria: string[];
}

export interface Milestone {
  name: string;
  date: number;
  criteria: string[];
  deliverables: string[];
}

export interface SuccessMetric {
  metric: string;
  baseline: number;
  target: number;
  measurement: string;
}

export interface TestOptimization {
  analyzeTestEfficiency(testId: string): Promise<TestEfficiency>;
  optimizeTestExecution(testId: string, optimization: TestOptimization): Promise<OptimizedTest>;
  parallelizeTests(tests: string[]): Promise<ParallelizationPlan>;
  reduceTestRedundancy(tests: string[]): Promise<RedundancyReduction>;
}

export interface TestEfficiency {
  testId: string;
  executionTime: number;
  resourceUsage: ResourceUsage;
  coverage: TestCoverage;
  reliability: number;
  maintainability: number;
  score: number;
}

export interface ResourceUsage {
  cpu: number;
  memory: number;
  io: number;
  network: number;
}

export interface TestCoverage {
  statements: number;
  branches: number;
  functions: number;
  lines: number;
}

export interface TestOptimization {
  strategy: OptimizationStrategy;
  parameters: any;
  expectedBenefit: number;
  risk: number;
}

export enum OptimizationStrategy {
  PARALLELIZATION = 'parallelization',
  CACHING = 'caching',
  MOCKING = 'mocking',
  DATA_REDUCTION = 'data_reduction',
  ALGORITHM_IMPROVEMENT = 'algorithm_improvement'
}

export interface OptimizedTest {
  originalTest: Test;
  optimizedTest: Test;
  improvements: TestImprovement[];
  validation: ValidationResult;
}

export interface TestImprovement {
  aspect: string;
  improvement: number;
  description: string;
}

export interface ParallelizationPlan {
  tests: string[];
  groups: TestGroup[];
  dependencies: TestDependency[];
  executionOrder: ExecutionOrder[];
  estimatedTime: number;
}

export interface TestGroup {
  id: string;
  tests: string[];
  executionTime: number;
  resourceRequirements: ResourceUsage;
}

export interface TestDependency {
  testId: string;
  dependsOn: string[];
  type: DependencyType;
}

export enum DependencyType {
  DATA = 'data',
  RESOURCE = 'resource',
  ORDER = 'order',
  ENVIRONMENT = 'environment'
}

export interface ExecutionOrder {
  groupId: string;
  order: number;
  parallel: boolean;
}

export interface RedundancyReduction {
  redundantTests: string[];
  consolidationPlan: ConsolidationPlan;
  impact: RedundancyImpact;
}

export interface ConsolidationPlan {
  groups: ConsolidationGroup[];
  newTests: Test[];
  deprecatedTests: string[];
}

export interface ConsolidationGroup {
  tests: string[];
  consolidatedTest: Test;
  rationale: string;
}

export interface RedundancyImpact {
  testReduction: number;
  timeSavings: number;
  coverageImpact: number;
  riskIncrease: number;
}

export interface MaintenanceAutomation {
  identifyMaintenanceTasks(tests: Test[]): Promise<MaintenanceTask[]>;
  scheduleMaintenance(task: MaintenanceTask): Promise<ScheduledMaintenance>;
  executeMaintenance(taskId: string): Promise<MaintenanceResult>;
  validateMaintenance(result: MaintenanceResult): Promise<ValidationResult>;
}

export interface MaintenanceTask {
  id: string;
  type: MaintenanceType;
  tests: string[];
  priority: Priority;
  effort: EffortLevel;
  deadline: number;
  dependencies: string[];
}

export enum MaintenanceType {
  UPDATE_SELECTORS = 'update_selectors',
  FIX_BROKEN_TESTS = 'fix_broken_tests',
  OPTIMIZE_PERFORMANCE = 'optimize_performance',
  UPDATE_DATA = 'update_data',
  MIGRATE_FRAMEWORK = 'migrate_framework',
  CLEANUP_CODE = 'cleanup_code'
}

export interface ScheduledMaintenance {
  task: MaintenanceTask;
  schedule: MaintenanceSchedule;
  assignedTo: string;
  status: MaintenanceStatus;
}

export interface MaintenanceSchedule {
  startDate: number;
  endDate: number;
  milestones: MaintenanceMilestone[];
}

export interface MaintenanceMilestone {
  name: string;
  date: number;
  deliverables: string[];
}

export enum MaintenanceStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  OVERDUE = 'overdue'
}

export interface MaintenanceResult {
  task: MaintenanceTask;
  success: boolean;
  changes: MaintenanceChange[];
  metrics: MaintenanceMetrics;
  issues: MaintenanceIssue[];
}

export interface MaintenanceChange {
  testId: string;
  change: string;
  impact: ImpactLevel;
  validation: ValidationResult;
}

export interface MaintenanceMetrics {
  testsUpdated: number;
  timeSpent: number;
  successRate: number;
  qualityImprovement: number;
}

export interface MaintenanceIssue {
  testId: string;
  issue: string;
  severity: SeverityLevel;
  resolution: string;
}

export interface QualityAssurance {
  assessTestQuality(testId: string): Promise<TestQuality>;
  identifyQualityIssues(tests: Test[]): Promise<QualityIssue[]>;
  recommendImprovements(testId: string, issues: QualityIssue[]): Promise<QualityImprovement[]>;
  validateQualityStandards(tests: Test[], standards: QualityStandard[]): Promise<QualityCompliance>;
}

export interface TestQuality {
  testId: string;
  overallScore: number;
  dimensions: QualityDimension[];
  grade: QualityGrade;
  issues: QualityIssue[];
}

export interface QualityDimension {
  name: string;
  score: number;
  weight: number;
  issues: QualityIssue[];
}

export enum QualityGrade {
  EXCELLENT = 'excellent',
  GOOD = 'good',
  FAIR = 'fair',
  POOR = 'poor',
  CRITICAL = 'critical'
}

export interface QualityIssue {
  type: QualityIssueType;
  severity: SeverityLevel;
  description: string;
  location: string;
  suggestion: string;
  effort: EffortLevel;
}

export enum QualityIssueType {
  CODE_SMELL = 'code_smell',
  MAINTAINABILITY = 'maintainability',
  RELIABILITY = 'reliability',
  PERFORMANCE = 'performance',
  SECURITY = 'security',
  ACCESSIBILITY = 'accessibility'
}

export interface QualityImprovement {
  issue: QualityIssue;
  improvement: string;
  code: string;
  benefit: number;
  risk: number;
}

export interface QualityStandard {
  name: string;
  category: QualityCategory;
  criteria: QualityCriteria[];
  threshold: number;
}

export enum QualityCategory {
  CODE_QUALITY = 'code_quality',
  TEST_DESIGN = 'test_design',
  MAINTAINABILITY = 'maintainability',
  RELIABILITY = 'reliability',
  PERFORMANCE = 'performance'
}

export interface QualityCriteria {
  metric: string;
  operator: CriteriaOperator;
  value: number;
  weight: number;
}

export enum CriteriaOperator {
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than',
  EQUAL = 'equal',
  NOT_EQUAL = 'not_equal'
}

export interface QualityCompliance {
  standards: QualityStandard[];
  compliance: ComplianceResult[];
  overall: OverallCompliance;
}

export interface ComplianceResult {
  standard: QualityStandard;
  compliant: boolean;
  score: number;
  violations: ComplianceViolation[];
}

export interface ComplianceViolation {
  criteria: QualityCriteria;
  actual: number;
  message: string;
}

export interface OverallCompliance {
  compliant: boolean;
  score: number;
  grade: ComplianceGrade;
  recommendations: string[];
}

export enum ComplianceGrade {
  FULLY_COMPLIANT = 'fully_compliant',
  MOSTLY_COMPLIANT = 'mostly_compliant',
  PARTIALLY_COMPLIANT = 'partially_compliant',
  NON_COMPLIANT = 'non_compliant'
}

export interface TestEvolutionSystem {
  monitorCodeChanges(): Promise<CodeChange[]>;
  predictTestImpact(changes: CodeChange[]): Promise<TestImpact[]>;
  generateEvolutionPlan(impacts: TestImpact[]): Promise<EvolutionPlan>;
  executeEvolution(plan: EvolutionPlan): Promise<EvolutionResult>;
}

export interface EvolutionPlan {
  impacts: TestImpact[];
  changes: TestChange[];
  sequence: EvolutionStep[];
  validation: ValidationPlan;
  rollback: RollbackPlan;
}

export interface EvolutionStep {
  step: number;
  description: string;
  tests: string[];
  changes: TestChange[];
  validation: ValidationStep;
}

export interface ValidationStep {
  type: ValidationType;
  criteria: ValidationCriteria[];
}

export enum ValidationType {
  UNIT_TEST = 'unit_test',
  INTEGRATION_TEST = 'integration_test',
  REGRESSION_TEST = 'regression_test',
  MANUAL_REVIEW = 'manual_review'
}

export interface ValidationCriteria {
  metric: string;
  threshold: number;
  operator: CriteriaOperator;
}

export interface ValidationPlan {
  steps: ValidationStep[];
  successCriteria: SuccessCriteria;
  failureHandling: FailureHandling;
}

export interface SuccessCriteria {
  passRate: number;
  performanceThreshold: number;
  qualityScore: number;
}

export interface FailureHandling {
  maxRetries: number;
  rollbackOnFailure: boolean;
  notification: string[];
}

export interface RollbackPlan {
  steps: RollbackStep[];
  conditions: RollbackCondition[];
}

export interface RollbackStep {
  action: string;
  order: number;
  dependencies: string[];
}

export interface RollbackCondition {
  condition: string;
  threshold: number;
}

export interface EvolutionResult {
  plan: EvolutionPlan;
  executed: EvolutionStep[];
  results: StepResult[];
  success: boolean;
  metrics: EvolutionMetrics;
}

export interface StepResult {
  step: EvolutionStep;
  success: boolean;
  duration: number;
  issues: EvolutionIssue[];
}

export interface EvolutionIssue {
  type: IssueType;
  description: string;
  severity: SeverityLevel;
  resolution: string;
}

export interface EvolutionMetrics {
  totalTests: number;
  updatedTests: number;
  executionTime: number;
  successRate: number;
  qualityImprovement: number;
}

export interface FlakinessDetectionEngine {
  collectTestData(testId: string, period: TimeRange): Promise<TestData>;
  analyzeFlakiness(data: TestData): Promise<FlakinessScore>;
  identifyPatterns(data: TestData): Promise<FlakinessPattern[]>;
  generateReport(testId: string, analysis: FlakinessAnalysis): Promise<FlakinessReport>;
}

export interface TestData {
  executions: TestExecution[];
  environments: Environment[];
  metadata: any;
}

export interface FlakinessScore {
  score: number;
  confidence: number;
  level: FlakinessLevel;
  factors: FlakinessFactor[];
}

export enum FlakinessLevel {
  STABLE = 'stable',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface FlakinessFactor {
  factor: string;
  contribution: number;
  evidence: string;
}

export interface FlakinessPattern {
  pattern: string;
  frequency: number;
  conditions: string[];
  impact: number;
  mitigation: string;
}

export interface FlakinessReport {
  testId: string;
  score: FlakinessScore;
  patterns: FlakinessPattern[];
  recommendations: FlakinessRecommendation[];
  trends: FlakinessTrend[];
}

export interface FlakinessTrend {
  period: string;
  score: number;
  change: number;
}

export interface FlakinessRecommendation {
  recommendation: string;
  priority: Priority;
  effort: EffortLevel;
  expectedBenefit: number;
}

export interface TestOptimizationEngine {
  profileTestExecution(testId: string): Promise<TestProfile>;
  identifyBottlenecks(profile: TestProfile): Promise<Bottleneck[]>;
  suggestOptimizations(bottlenecks: Bottleneck[]): Promise<Optimization[]>;
  applyOptimizations(testId: string, optimizations: Optimization[]): Promise<OptimizationResult>;
}

export interface TestProfile {
  testId: string;
  executionTime: number;
  resourceUsage: ResourceUsage;
  steps: ProfileStep[];
  dependencies: TestDependency[];
}

export interface ProfileStep {
  name: string;
  duration: number;
  resourceUsage: ResourceUsage;
  success: boolean;
}

export interface Bottleneck {
  type: BottleneckType;
  location: string;
  impact: number;
  description: string;
  evidence: string;
}

export interface Optimization {
  type: OptimizationType;
  description: string;
  code: string;
  benefit: number;
  risk: number;
}

export interface OptimizationResult {
  optimizations: AppliedOptimization[];
  improvement: TestImprovement;
  validation: ValidationResult;
}

export interface AppliedOptimization {
  optimization: Optimization;
  success: boolean;
  improvement: number;
}

export interface TestImprovement {
  executionTime: number;
  resourceUsage: number;
  reliability: number;
  maintainability: number;
}

export interface MaintenanceScheduler {
  assessMaintenanceNeeds(tests: Test[]): Promise<MaintenanceNeed[]>;
  prioritizeTasks(needs: MaintenanceNeed[]): Promise<MaintenanceTask[]>;
  scheduleTasks(tasks: MaintenanceTask[]): Promise<ScheduledTask[]>;
  monitorProgress(tasks: ScheduledTask[]): Promise<MaintenanceProgress>;
}

export interface MaintenanceNeed {
  testId: string;
  type: MaintenanceType;
  urgency: number;
  effort: number;
  impact: number;
}

export interface ScheduledTask {
  task: MaintenanceTask;
  schedule: TaskSchedule;
  assignedTo: string;
  status: TaskStatus;
}

export interface TaskSchedule {
  startDate: number;
  dueDate: number;
  estimatedHours: number;
}

export enum TaskStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  BLOCKED = 'blocked',
  CANCELLED = 'cancelled'
}

export interface MaintenanceProgress {
  tasks: ScheduledTask[];
  completionRate: number;
  timeSpent: number;
  qualityScore: number;
}

export interface QualityAssessmentEngine {
  evaluateTest(testId: string): Promise<QualityAssessment>;
  benchmarkQuality(assessments: QualityAssessment[]): Promise<QualityBenchmark>;
  identifyImprovements(assessment: QualityAssessment): Promise<QualityImprovement[]>;
  trackQualityTrends(assessments: QualityAssessment[]): Promise<QualityTrend>;
}

export interface QualityAssessment {
  testId: string;
  dimensions: QualityDimension[];
  overallScore: number;
  grade: QualityGrade;
  issues: QualityIssue[];
  strengths: string[];
  weaknesses: string[];
}

export interface QualityBenchmark {
  assessment: QualityAssessment;
  percentile: number;
  comparisons: QualityComparison[];
  recommendations: string[];
}

export interface QualityComparison {
  dimension: string;
  score: number;
  average: number;
  difference: number;
}

export interface QualityTrend {
  dimension: string;
  trend: TrendDirection;
  change: number;
  period: string;
}

export interface TestMaintenanceWorkflow {
  analyzeMaintenanceOpportunity(testId: string): Promise<MaintenanceOpportunity>;
  createMaintenancePlan(opportunity: MaintenanceOpportunity): Promise<MaintenancePlan>;
  executeMaintenancePlan(plan: MaintenancePlan): Promise<MaintenanceExecution>;
  validateMaintenanceResult(result: MaintenanceExecution): Promise<ValidationResult>;
}

export interface MaintenanceOpportunity {
  testId: string;
  type: MaintenanceType;
  rationale: string;
  benefit: number;
  effort: number;
  risk: number;
}

export interface MaintenancePlan {
  opportunity: MaintenanceOpportunity;
  steps: MaintenanceStep[];
  resources: MaintenanceResource[];
  timeline: MaintenanceTimeline;
  successCriteria: SuccessCriteria;
}

export interface MaintenanceStep {
  step: number;
  description: string;
  type: StepType;
  dependencies: number[];
  estimatedTime: number;
}

export enum StepType {
  ANALYSIS = 'analysis',
  DESIGN = 'design',
  IMPLEMENTATION = 'implementation',
  TESTING = 'testing',
  DEPLOYMENT = 'deployment'
}

export interface MaintenanceResource {
  type: ResourceType;
  name: string;
  quantity: number;
}

export interface MaintenanceTimeline {
  startDate: number;
  endDate: number;
  milestones: MaintenanceMilestone[];
}

export interface MaintenanceExecution {
  plan: MaintenancePlan;
  status: ExecutionStatus;
  steps: ExecutedStep[];
  result: MaintenanceOutcome;
}

export interface ExecutedStep {
  step: MaintenanceStep;
  status: StepStatus;
  startedAt: number;
  completedAt?: number;
  output: any;
}

export interface MaintenanceOutcome {
  success: boolean;
  metrics: MaintenanceMetrics;
  issues: MaintenanceIssue[];
  lessons: string[];
}

export interface AutomatedMaintenanceEngine {
  detectMaintenanceNeeds(): Promise<MaintenanceNeed[]>;
  generateMaintenanceScripts(needs: MaintenanceNeed[]): Promise<MaintenanceScript[]>;
  executeMaintenanceScripts(scripts: MaintenanceScript[]): Promise<ExecutionResult>;
  validateMaintenanceResults(results: ExecutionResult[]): Promise<ValidationResult>;
}

export interface MaintenanceScript {
  id: string;
  need: MaintenanceNeed;
  commands: MaintenanceCommand[];
  rollback: RollbackCommand[];
}

export interface MaintenanceCommand {
  command: string;
  parameters: any;
  expectedOutcome: string;
  timeout: number;
}

export interface RollbackCommand {
  command: string;
  parameters: any;
  condition: string;
}

export interface ExecutionResult {
  script: MaintenanceScript;
  success: boolean;
  output: any;
  duration: number;
  errors: string[];
}

export interface QualityGateEngine {
  defineGates(standards: QualityStandard[]): Promise<void>;
  evaluateGates(testId: string, standards: QualityStandard[]): Promise<GateEvaluation>;
  enforceGates(evaluation: GateEvaluation): Promise<GateResult>;
  monitorCompliance(workspaceId: string): Promise<ComplianceReport>;
}

export interface GateEvaluation {
  testId: string;
  standards: QualityStandard[];
  results: GateResult[];
  overall: OverallResult;
}

export interface OverallResult {
  pass: boolean;
  score: number;
  issues: GateIssue[];
}

export interface GateResult {
  standard: QualityStandard;
  pass: boolean;
  score: number;
  violations: GateViolation[];
}

export interface GateViolation {
  criteria: QualityCriteria;
  actual: number;
  required: number;
  message: string;
}

export interface GateIssue {
  type: IssueType;
  description: string;
  severity: SeverityLevel;
}

export interface ComplianceReport {
  period: TimeRange;
  evaluations: GateEvaluation[];
  compliance: number;
  trends: ComplianceTrend[];
  recommendations: ComplianceRecommendation[];
}

export interface ComplianceTrend {
  standard: string;
  trend: TrendDirection;
  change: number;
}

export interface ComplianceRecommendation {
  standard: string;
  recommendation: string;
  priority: Priority;
}
