import { TestCase, TestResult } from './test-isolation';

export interface IntelligentTestSelection {
  impactAnalyzer: ImpactAnalysisEngine;
  mlPredictor: MLPredictionSystem;
  riskAssessor: RiskAssessmentSystem;
  selectionAlgorithm: SelectionAlgorithm;
  learningLoop: ContinuousLearningSystem;
}

export interface ImpactAnalysisEngine {
  codeAnalyzer: CodeChangeAnalyzer;
  dependencyMapper: DependencyMapper;
  impactCalculator: ImpactCalculator;
  confidenceScorer: ConfidenceScorer;
}

export interface CodeChangeAnalyzer {
  analyzeChanges(changes: CodeChange[]): ChangeAnalysis;
  identifyAffectedComponents(changes: CodeChange[]): AffectedComponent[];
  calculateChangeComplexity(changes: CodeChange[]): ChangeComplexity;
}

export interface CodeChange {
  file: string;
  type: ChangeType;
  lines: LineRange[];
  content: string;
  author: string;
  timestamp: number;
}

export enum ChangeType {
  ADD = 'add',
  MODIFY = 'modify',
  DELETE = 'delete',
  RENAME = 'rename'
}

export interface LineRange {
  start: number;
  end: number;
}

export interface ChangeAnalysis {
  totalFiles: number;
  totalLines: number;
  changeTypes: Map<ChangeType, number>;
  riskLevel: RiskLevel;
  affectedAreas: string[];
}

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface AffectedComponent {
  name: string;
  type: ComponentType;
  impact: ImpactLevel;
  dependencies: string[];
  testCoverage: number;
}

export enum ComponentType {
  CLASS = 'class',
  FUNCTION = 'function',
  MODULE = 'module',
  SERVICE = 'service',
  COMPONENT = 'component',
  UTILITY = 'utility'
}

export enum ImpactLevel {
  DIRECT = 'direct',
  INDIRECT = 'indirect',
  TRANSITIVE = 'transitive'
}

export interface ChangeComplexity {
  cyclomaticComplexity: number;
  linesOfCode: number;
  branchingFactor: number;
  nestingDepth: number;
  score: number;
}

export interface DependencyMapper {
  buildDependencyGraph(codebase: Codebase): DependencyGraph;
  findDependents(component: string): Dependency[];
  calculateDependencyDepth(component: string): number;
  identifyCircularDependencies(): CircularDependency[];
}

export interface Codebase {
  files: SourceFile[];
  language: string;
  framework: string;
}

export interface SourceFile {
  path: string;
  content: string;
  language: string;
  imports: string[];
  exports: string[];
  classes: ClassDefinition[];
  functions: FunctionDefinition[];
}

export interface ClassDefinition {
  name: string;
  methods: MethodDefinition[];
  properties: PropertyDefinition[];
  dependencies: string[];
}

export interface MethodDefinition {
  name: string;
  parameters: ParameterDefinition[];
  returnType: string;
  complexity: number;
}

export interface PropertyDefinition {
  name: string;
  type: string;
  visibility: Visibility;
}

export enum Visibility {
  PUBLIC = 'public',
  PRIVATE = 'private',
  PROTECTED = 'protected'
}

export interface FunctionDefinition {
  name: string;
  parameters: ParameterDefinition[];
  returnType: string;
  complexity: number;
}

export interface ParameterDefinition {
  name: string;
  type: string;
  optional: boolean;
}

export interface DependencyGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  rootNodes: string[];
  leafNodes: string[];
}

export interface GraphNode {
  id: string;
  type: ComponentType;
  metadata: NodeMetadata;
}

export interface NodeMetadata {
  file: string;
  line: number;
  complexity: number;
  testCoverage: number;
}

export interface GraphEdge {
  from: string;
  to: string;
  type: DependencyType;
  strength: number;
}

export enum DependencyType {
  IMPORT = 'import',
  INHERITANCE = 'inheritance',
  COMPOSITION = 'composition',
  USAGE = 'usage',
  CALL = 'call'
}

export interface Dependency {
  component: string;
  type: DependencyType;
  strength: number;
  depth: number;
}

export interface CircularDependency {
  components: string[];
  cycle: string[];
  severity: Severity;
}

export enum Severity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface ImpactCalculator {
  calculateComponentImpact(component: AffectedComponent, graph: DependencyGraph): ComponentImpact;
  calculateTestImpact(componentImpact: ComponentImpact, testSuite: TestSuite): TestImpact;
  prioritizeImpacts(impacts: ComponentImpact[]): PrioritizedImpact[];
}

export interface ComponentImpact {
  component: string;
  directImpact: number;
  indirectImpact: number;
  totalImpact: number;
  affectedTests: string[];
  riskScore: number;
  priority: Priority;
}

export enum Priority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface TestSuite {
  tests: TestCase[];
  coverage: CoverageData;
  dependencies: TestDependency[];
}

export interface CoverageData {
  statements: number;
  branches: number;
  functions: number;
  lines: number;
  components: ComponentCoverage[];
}

export interface ComponentCoverage {
  component: string;
  covered: number;
  total: number;
  percentage: number;
}

export interface TestDependency {
  testId: string;
  dependsOn: string[];
  type: TestDependencyType;
}

export enum TestDependencyType {
  UNIT = 'unit',
  INTEGRATION = 'integration',
  E2E = 'e2e',
  SMOKE = 'smoke'
}

export interface TestImpact {
  testId: string;
  impactScore: number;
  relevance: number;
  risk: number;
  priority: Priority;
  reasons: string[];
}

export interface PrioritizedImpact {
  component: string;
  impact: ComponentImpact;
  rank: number;
  confidence: number;
}

export interface ConfidenceScorer {
  calculateConfidence(analysis: ChangeAnalysis, graph: DependencyGraph): ConfidenceScore;
  adjustConfidence(feedback: FeedbackData): void;
  getConfidenceHistory(): ConfidenceHistory[];
}

export interface ConfidenceScore {
  overall: number;
  components: ComponentConfidence[];
  factors: ConfidenceFactor[];
}

export interface ComponentConfidence {
  component: string;
  score: number;
  factors: string[];
}

export interface ConfidenceFactor {
  name: string;
  weight: number;
  value: number;
}

export interface FeedbackData {
  predictedImpact: ComponentImpact;
  actualImpact: ComponentImpact;
  accuracy: number;
  timestamp: number;
}

export interface ConfidenceHistory {
  timestamp: number;
  score: ConfidenceScore;
  feedback: FeedbackData[];
}

export interface MLPredictionSystem {
  featureExtractor: FeatureExtractor;
  predictionModel: PredictionModel;
  probabilityCalculator: ProbabilityCalculator;
  explanationGenerator: ExplanationGenerator;
}

export interface FeatureExtractor {
  extractFeatures(test: TestCase, context: PredictionContext): FeatureVector;
  normalizeFeatures(features: FeatureVector): NormalizedFeatures;
  selectFeatures(features: NormalizedFeatures): SelectedFeatures;
}

export interface PredictionContext {
  codeChanges: CodeChange[];
  historicalData: HistoricalTestData[];
  environment: EnvironmentContext;
  dependencies: DependencyGraph;
}

export interface HistoricalTestData {
  testId: string;
  executionHistory: TestExecution[];
  failurePatterns: FailurePattern[];
  performanceMetrics: PerformanceMetrics[];
}

export interface TestExecution {
  timestamp: number;
  result: TestResult;
  duration: number;
  environment: string;
}

export interface FailurePattern {
  pattern: string;
  frequency: number;
  conditions: string[];
  lastOccurrence: number;
}

export interface PerformanceMetrics {
  duration: number;
  memoryUsage: number;
  cpuUsage: number;
  success: boolean;
}

export interface EnvironmentContext {
  platform: string;
  browser: string;
  version: string;
  configuration: any;
}

export interface FeatureVector {
  numeric: number[];
  categorical: string[];
  temporal: number[];
  structural: number[];
}

export interface NormalizedFeatures {
  features: number[];
  metadata: FeatureMetadata;
}

export interface FeatureMetadata {
  originalRange: Range[];
  normalizationMethod: string;
  outliers: OutlierInfo[];
}

export interface Range {
  min: number;
  max: number;
}

export interface OutlierInfo {
  index: number;
  value: number;
  method: string;
}

export interface SelectedFeatures {
  features: number[];
  selectionMethod: string;
  importance: FeatureImportance[];
}

export interface FeatureImportance {
  index: number;
  importance: number;
  name: string;
}

export interface PredictionModel {
  train(data: TrainingData): Promise<TrainedModel>;
  predict(features: SelectedFeatures): Promise<Prediction>;
  validate(model: TrainedModel, testData: TestData): ValidationResult;
  update(model: TrainedModel, newData: TrainingData): Promise<UpdatedModel>;
}

export interface TrainingData {
  features: SelectedFeatures[];
  labels: number[];
  metadata: DataMetadata;
}

export interface DataMetadata {
  size: number;
  features: number;
  classes: number;
  distribution: DataDistribution;
}

export interface DataDistribution {
  balanced: boolean;
  classWeights: number[];
  outliers: number;
}

export interface TrainedModel {
  parameters: any;
  metadata: ModelMetadata;
  performance: ModelPerformance;
}

export interface ModelMetadata {
  algorithm: string;
  hyperparameters: any;
  trainingTime: number;
  dataSize: number;
}

export interface ModelPerformance {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  confusionMatrix: number[][];
}

export interface Prediction {
  value: number;
  probability: number;
  confidence: number;
  range: PredictionRange;
}

export interface PredictionRange {
  lower: number;
  upper: number;
  confidence: number;
}

export interface TestData {
  features: SelectedFeatures[];
  labels: number[];
}

export interface ValidationResult {
  metrics: ValidationMetrics;
  predictions: Prediction[];
  errors: ValidationError[];
}

export interface ValidationMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  auc: number;
  logLoss: number;
}

export interface ValidationError {
  type: string;
  message: string;
  severity: string;
}

export interface UpdatedModel extends TrainedModel {
  updateHistory: ModelUpdate[];
}

export interface ModelUpdate {
  timestamp: number;
  dataSize: number;
  performanceDelta: number;
  reason: string;
}

export interface ProbabilityCalculator {
  calculateProbability(prediction: Prediction, context: PredictionContext): CalculatedProbability;
  adjustProbability(probability: CalculatedProbability, factors: AdjustmentFactor[]): AdjustedProbability;
  combineProbabilities(probabilities: CalculatedProbability[]): CombinedProbability;
}

export interface CalculatedProbability {
  baseProbability: number;
  adjustedProbability: number;
  factors: ProbabilityFactor[];
  confidence: number;
}

export interface ProbabilityFactor {
  name: string;
  weight: number;
  impact: number;
  reason: string;
}

export interface AdjustmentFactor {
  type: string;
  value: number;
  weight: number;
}

export interface AdjustedProbability {
  original: number;
  adjusted: number;
  adjustments: AdjustmentFactor[];
  finalConfidence: number;
}

export interface CombinedProbability {
  individualProbabilities: CalculatedProbability[];
  combinedProbability: number;
  method: CombinationMethod;
  confidence: number;
}

export enum CombinationMethod {
  AVERAGE = 'average',
  WEIGHTED_AVERAGE = 'weighted_average',
  MAXIMUM = 'maximum',
  MINIMUM = 'minimum'
}

export interface ExplanationGenerator {
  generateExplanation(prediction: Prediction, features: SelectedFeatures): Explanation;
  generateFeatureImportance(features: SelectedFeatures): FeatureImportance[];
  generateCounterfactuals(prediction: Prediction, features: SelectedFeatures): Counterfactual[];
}

export interface Explanation {
  prediction: Prediction;
  topFeatures: FeatureContribution[];
  reasoning: string[];
  confidence: number;
  alternatives: AlternativeExplanation[];
}

export interface FeatureContribution {
  feature: string;
  contribution: number;
  importance: number;
}

export interface AlternativeExplanation {
  scenario: string;
  probability: number;
  reasoning: string;
}

export interface Counterfactual {
  originalFeatures: SelectedFeatures;
  modifiedFeatures: SelectedFeatures;
  newPrediction: Prediction;
  changeExplanation: string;
}

export interface RiskAssessmentSystem {
  riskFactors: RiskFactor[];
  scoringAlgorithm: RiskScoringAlgorithm;
  businessImpactAnalyzer: BusinessImpactAnalyzer;
  prioritizationEngine: PrioritizationEngine;
}

export interface RiskFactor {
  name: string;
  type: RiskFactorType;
  weight: number;
  calculator: RiskCalculator;
}

export enum RiskFactorType {
  TECHNICAL = 'technical',
  BUSINESS = 'business',
  OPERATIONAL = 'operational',
  ENVIRONMENTAL = 'environmental'
}

export interface RiskCalculator {
  calculate(test: TestCase, context: RiskContext): number;
}

export interface RiskContext {
  codeChanges: CodeChange[];
  businessRequirements: BusinessRequirement[];
  historicalData: HistoricalRiskData;
  environment: EnvironmentContext;
}

export interface BusinessRequirement {
  id: string;
  description: string;
  priority: Priority;
  stakeholders: string[];
  dependencies: string[];
}

export interface HistoricalRiskData {
  testFailures: TestFailure[];
  incidentHistory: Incident[];
  performanceTrends: PerformanceTrend[];
}

export interface TestFailure {
  testId: string;
  timestamp: number;
  failureType: string;
  impact: ImpactLevel;
  resolution: string;
}

export interface Incident {
  id: string;
  description: string;
  severity: Severity;
  affectedComponents: string[];
  resolutionTime: number;
}

export interface PerformanceTrend {
  component: string;
  metric: string;
  trend: TrendDirection;
  significance: number;
}

export enum TrendDirection {
  IMPROVING = 'improving',
  DEGRADING = 'degrading',
  STABLE = 'stable'
}

export interface RiskScoringAlgorithm {
  calculateRisk(test: TestCase, factors: RiskFactor[], context: RiskContext): RiskScore;
  normalizeScore(score: RiskScore): NormalizedRiskScore;
  combineScores(scores: RiskScore[]): CombinedRiskScore;
}

export interface RiskScore {
  overall: number;
  factors: RiskFactorScore[];
  confidence: number;
  lastCalculated: number;
}

export interface RiskFactorScore {
  factor: string;
  score: number;
  weight: number;
  contribution: number;
}

export interface NormalizedRiskScore {
  score: number;
  percentile: number;
  category: RiskCategory;
}

export enum RiskCategory {
  VERY_LOW = 'very_low',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  VERY_HIGH = 'very_high',
  CRITICAL = 'critical'
}

export interface CombinedRiskScore {
  scores: RiskScore[];
  combinedScore: number;
  method: CombinationMethod;
  confidence: number;
}

export interface BusinessImpactAnalyzer {
  analyzeImpact(test: TestCase, requirements: BusinessRequirement[]): BusinessImpact;
  quantifyImpact(impact: BusinessImpact): ImpactQuantification;
  prioritizeByImpact(impacts: BusinessImpact[]): PrioritizedBusinessImpact[];
}

export interface BusinessImpact {
  testId: string;
  affectedRequirements: string[];
  impactLevel: ImpactLevel;
  affectedStakeholders: string[];
  financialImpact: number;
  operationalImpact: number;
}

export interface ImpactQuantification {
  qualitative: QualitativeImpact;
  quantitative: QuantitativeImpact;
  overall: OverallImpact;
}

export interface QualitativeImpact {
  description: string;
  severity: Severity;
  urgency: Urgency;
}

export enum Urgency {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  IMMEDIATE = 'immediate'
}

export interface QuantitativeImpact {
  affectedUsers: number;
  revenueImpact: number;
  productivityImpact: number;
  complianceRisk: number;
}

export interface OverallImpact {
  score: number;
  category: ImpactCategory;
  priority: Priority;
}

export enum ImpactCategory {
  MINIMAL = 'minimal',
  MODERATE = 'moderate',
  SIGNIFICANT = 'significant',
  SEVERE = 'severe',
  CATASTROPHIC = 'catastrophic'
}

export interface PrioritizedBusinessImpact {
  impact: BusinessImpact;
  priority: Priority;
  rank: number;
  reasoning: string[];
}

export interface PrioritizationEngine {
  prioritizeTests(tests: TestCase[], context: PrioritizationContext): PrioritizedTest[];
  balancePriorities(tests: PrioritizedTest[], constraints: PrioritizationConstraints): BalancedPrioritization;
  optimizeSelection(tests: PrioritizedTest[], goals: SelectionGoals): OptimizedSelection;
}

export interface PrioritizationContext {
  timeConstraints: TimeConstraint;
  resourceConstraints: ResourceConstraint;
  qualityRequirements: QualityRequirement;
  businessObjectives: BusinessObjective[];
}

export interface TimeConstraint {
  totalTime: number;
  deadline: number;
  timeDistribution: TimeDistribution;
}

export interface TimeDistribution {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface ResourceConstraint {
  maxParallelTests: number;
  availableResources: ResourceAvailability;
  costLimits: CostLimit[];
}

export interface ResourceAvailability {
  cpu: number;
  memory: number;
  network: number;
  storage: number;
}

export interface CostLimit {
  type: string;
  limit: number;
  current: number;
}

export interface QualityRequirement {
  minimumCoverage: number;
  riskThreshold: number;
  failureTolerance: number;
}

export interface BusinessObjective {
  name: string;
  weight: number;
  criteria: ObjectiveCriteria[];
}

export interface ObjectiveCriteria {
  metric: string;
  target: number;
  importance: number;
}

export interface PrioritizedTest {
  test: TestCase;
  priority: Priority;
  score: number;
  reasons: string[];
  constraints: string[];
}

export interface PrioritizationConstraints {
  maxTests: number;
  timeLimit: number;
  resourceLimit: ResourceAvailability;
  qualityMinimum: QualityRequirement;
}

export interface BalancedPrioritization {
  tests: PrioritizedTest[];
  balanceMetrics: BalanceMetrics;
  tradeoffs: PrioritizationTradeoff[];
}

export interface BalanceMetrics {
  priorityDistribution: PriorityDistribution;
  resourceUtilization: number;
  timeUtilization: number;
  qualityCoverage: number;
}

export interface PriorityDistribution {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface PrioritizationTradeoff {
  type: string;
  description: string;
  impact: number;
  alternative: string;
}

export interface SelectionGoals {
  coverage: number;
  risk: number;
  speed: number;
  cost: number;
}

export interface OptimizedSelection {
  tests: PrioritizedTest[];
  achievedGoals: GoalAchievement[];
  optimizationMetrics: OptimizationMetrics;
}

export interface GoalAchievement {
  goal: string;
  target: number;
  achieved: number;
  gap: number;
}

export interface OptimizationMetrics {
  selectionEfficiency: number;
  resourceEfficiency: number;
  timeEfficiency: number;
  qualityEfficiency: number;
}

export interface SelectionAlgorithm {
  selectTests(tests: PrioritizedTest[], criteria: SelectionCriteria): TestSelection;
  filterTests(tests: TestCase[], filters: SelectionFilter[]): FilteredTests;
  rankTests(tests: PrioritizedTest[], ranking: RankingCriteria): RankedTests;
  optimizeSelection(selection: TestSelection, optimization: SelectionOptimization): OptimizedTestSelection;
}

export interface SelectionCriteria {
  priority: Priority[];
  tags: string[];
  duration: DurationRange;
  risk: RiskRange;
  impact: ImpactLevel[];
}

export interface DurationRange {
  min: number;
  max: number;
}

export interface RiskRange {
  min: number;
  max: number;
}

export interface TestSelection {
  selectedTests: TestCase[];
  rejectedTests: TestCase[];
  selectionMetrics: SelectionMetrics;
}

export interface SelectionMetrics {
  totalTests: number;
  selectedTests: number;
  selectionRate: number;
  averagePriority: number;
  coverage: number;
}

export interface SelectionFilter {
  type: FilterType;
  criteria: any;
  operator: FilterOperator;
}

export enum FilterType {
  PRIORITY = 'priority',
  TAG = 'tag',
  DURATION = 'duration',
  RISK = 'risk',
  IMPACT = 'impact',
  DEPENDENCY = 'dependency'
}

export enum FilterOperator {
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than',
  CONTAINS = 'contains',
  NOT_CONTAINS = 'not_contains'
}

export interface FilteredTests {
  tests: TestCase[];
  filterMetrics: FilterMetrics;
}

export interface FilterMetrics {
  originalCount: number;
  filteredCount: number;
  filtersApplied: number;
}

export interface RankingCriteria {
  primary: RankingFactor;
  secondary: RankingFactor[];
  direction: SortDirection;
}

export enum SortDirection {
  ASCENDING = 'ascending',
  DESCENDING = 'descending'
}

export interface RankingFactor {
  type: FactorType;
  weight: number;
}

export enum FactorType {
  PRIORITY = 'priority',
  RISK = 'risk',
  IMPACT = 'impact',
  DURATION = 'duration',
  COVERAGE = 'coverage',
  DEPENDENCY = 'dependency'
}

export interface RankedTests {
  tests: PrioritizedTest[];
  rankingMetrics: RankingMetrics;
}

export interface RankingMetrics {
  rankingMethod: string;
  topTest: PrioritizedTest;
  distribution: PriorityDistribution;
}

export interface SelectionOptimization {
  goals: SelectionGoals;
  constraints: SelectionConstraints;
  algorithm: OptimizationAlgorithm;
}

export interface SelectionConstraints {
  maxTests: number;
  maxDuration: number;
  maxRisk: number;
  minCoverage: number;
}

export enum OptimizationAlgorithm {
  GREEDY = 'greedy',
  GENETIC = 'genetic',
  SIMULATED_ANNEALING = 'simulated_annealing',
  LINEAR_PROGRAMMING = 'linear_programming'
}

export interface OptimizedTestSelection extends TestSelection {
  optimizationResults: OptimizationResults;
}

export interface OptimizationResults {
  algorithm: OptimizationAlgorithm;
  iterations: number;
  convergence: boolean;
  improvement: number;
  tradeoffs: PrioritizationTradeoff[];
}

export interface ContinuousLearningSystem {
  feedbackCollector: FeedbackCollector;
  modelUpdater: ModelUpdater;
  performanceMonitor: PerformanceMonitor;
  adaptationEngine: AdaptationEngine;
}

export interface FeedbackCollector {
  collectExecutionFeedback(result: TestResult, context: FeedbackContext): Feedback;
  collectUserFeedback(feedback: UserFeedback): void;
  aggregateFeedback(feedbacks: Feedback[]): AggregatedFeedback;
}

export interface FeedbackContext {
  expectedResult: TestResult;
  environment: EnvironmentContext;
  dependencies: DependencyGraph;
}

export interface Feedback {
  type: FeedbackType;
  data: any;
  confidence: number;
  timestamp: number;
  source: string;
}

export enum FeedbackType {
  EXECUTION_RESULT = 'execution_result',
  PERFORMANCE_METRIC = 'performance_metric',
  USER_CORRECTION = 'user_correction',
  SYSTEM_ADAPTATION = 'system_adaptation'
}

export interface UserFeedback {
  testId: string;
  rating: number;
  comments: string;
  corrections: FeedbackCorrection[];
}

export interface FeedbackCorrection {
  type: string;
  original: any;
  corrected: any;
  reason: string;
}

export interface AggregatedFeedback {
  feedbacks: Feedback[];
  summary: FeedbackSummary;
  trends: FeedbackTrend[];
}

export interface FeedbackSummary {
  totalFeedbacks: number;
  positiveFeedbacks: number;
  negativeFeedbacks: number;
  averageRating: number;
}

export interface FeedbackTrend {
  metric: string;
  trend: TrendDirection;
  significance: number;
  period: string;
}

export interface ModelUpdater {
  updateModel(model: TrainedModel, feedback: AggregatedFeedback): Promise<UpdatedModel>;
  validateUpdate(model: UpdatedModel, validation: ValidationData): UpdateValidation;
  rollbackUpdate(model: UpdatedModel): Promise<boolean>;
}

export interface ValidationData {
  testSet: TestData;
  performanceThreshold: number;
  stabilityCheck: boolean;
}

export interface UpdateValidation {
  passed: boolean;
  metrics: ValidationMetrics;
  issues: ValidationIssue[];
  recommendations: string[];
}

export interface PerformanceMonitor {
  monitorModelPerformance(model: TrainedModel, metrics: PerformanceMetrics): ModelHealth;
  detectDrift(data: MonitoringData): DriftDetection;
  triggerRetraining(health: ModelHealth): RetrainingDecision;
}

export interface ModelHealth {
  accuracy: number;
  stability: number;
  drift: number;
  overall: HealthStatus;
}

export enum HealthStatus {
  EXCELLENT = 'excellent',
  GOOD = 'good',
  FAIR = 'fair',
  POOR = 'poor',
  CRITICAL = 'critical'
}

export interface MonitoringData {
  predictions: Prediction[];
  actuals: number[];
  features: SelectedFeatures[];
  timestamps: number[];
}

export interface DriftDetection {
  detected: boolean;
  type: DriftType;
  severity: Severity;
  affectedFeatures: string[];
}

export enum DriftType {
  CONCEPT_DRIFT = 'concept_drift',
  DATA_DRIFT = 'data_drift',
  MODEL_DEGRADATION = 'model_degradation'
}

export interface RetrainingDecision {
  shouldRetraining: boolean;
  urgency: Urgency;
  reason: string;
  dataRequirements: DataRequirement[];
}

export interface DataRequirement {
  type: string;
  amount: number;
  quality: number;
}

export interface AdaptationEngine {
  adaptStrategy(feedback: AggregatedFeedback): AdaptationStrategy;
  implementAdaptation(strategy: AdaptationStrategy): ImplementationResult;
  validateAdaptation(result: ImplementationResult): AdaptationValidation;
}

export interface AdaptationStrategy {
  changes: AdaptationChange[];
  rationale: string;
  expectedImpact: ExpectedImpact;
  rollbackPlan: RollbackPlan;
}

export interface AdaptationChange {
  component: string;
  type: ChangeType;
  parameters: any;
  conditions: string[];
}

export interface ExpectedImpact {
  performance: number;
  accuracy: number;
  stability: number;
}

export interface RollbackPlan {
  steps: RollbackStep[];
  conditions: RollbackCondition[];
}

export interface RollbackStep {
  action: string;
  parameters: any;
}

export interface RollbackCondition {
  metric: string;
  threshold: number;
  action: string;
}

export interface ImplementationResult {
  success: boolean;
  changes: ImplementedChange[];
  metrics: ImplementationMetrics;
}

export interface ImplementedChange {
  change: AdaptationChange;
  status: ImplementationStatus;
  errors: string[];
}

export enum ImplementationStatus {
  SUCCESS = 'success',
  PARTIAL = 'partial',
  FAILED = 'failed'
}

export interface ImplementationMetrics {
  executionTime: number;
  resourceUsage: number;
  sideEffects: string[];
}

export interface AdaptationValidation {
  valid: boolean;
  metrics: ValidationMetrics;
  issues: ValidationIssue[];
  recommendations: AdaptationRecommendation[];
}

export interface AdaptationRecommendation {
  type: string;
  description: string;
  priority: Priority;
}
