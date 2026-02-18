export interface PerformanceRegressionDetection {
  baselineManager: BaselineManager;
  regressionAnalyzer: RegressionAnalyzer;
  statisticalEngine: StatisticalEngine;
  alertingSystem: RegressionAlerting;
  reportingEngine: RegressionReporting;
}

export interface BaselineManager {
  establishBaselines(metrics: PerformanceMetrics[]): Promise<PerformanceBaseline[]>;
  updateBaselines(newMetrics: PerformanceMetrics[], existingBaselines: PerformanceBaseline[]): Promise<PerformanceBaseline[]>;
  validateBaselines(baselines: PerformanceBaseline[]): Promise<ValidationResult>;
  detectBaselineDrift(metrics: PerformanceMetrics[], baselines: PerformanceBaseline[]): Promise<DriftDetection>;
}

export interface PerformanceBaseline {
  metricName: string;
  baselineType: BaselineType;
  statisticalModel: StatisticalModel;
  confidenceInterval: ConfidenceInterval;
  seasonalPatterns: SeasonalPattern[];
  trendAnalysis: TrendAnalysis;
  lastUpdated: number;
  sampleSize: number;
  stabilityScore: number;
}

export enum BaselineType {
  STATIC = 'static',
  ROLLING = 'rolling',
  ADAPTIVE = 'adaptive',
  SEASONAL = 'seasonal'
}

export interface StatisticalModel {
  distribution: DistributionType;
  parameters: DistributionParameters;
  goodnessOfFit: GoodnessOfFit;
  outliers: OutlierDetection;
}

export enum DistributionType {
  NORMAL = 'normal',
  LOG_NORMAL = 'log_normal',
  EXPONENTIAL = 'exponential',
  WEIBULL = 'weibull',
  GAMMA = 'gamma',
  BETA = 'beta'
}

export interface DistributionParameters {
  mean?: number;
  median?: number;
  mode?: number;
  variance?: number;
  standardDeviation?: number;
  skewness?: number;
  kurtosis?: number;
  min?: number;
  max?: number;
  percentiles: PercentileValues;
}

export interface PercentileValues {
  p50: number;
  p90: number;
  p95: number;
  p99: number;
  p999: number;
}

export interface GoodnessOfFit {
  testStatistic: number;
  pValue: number;
  testType: GoodnessOfFitTest;
  acceptable: boolean;
}

export enum GoodnessOfFitTest {
  KOLMOGOROV_SMIRNOV = 'kolmogorov_smirnov',
  ANDERSON_DARLING = 'anderson_darling',
  SHAPIRO_WILK = 'shapiro_wilk',
  CHI_SQUARE = 'chi_square'
}

export interface OutlierDetection {
  method: OutlierMethod;
  threshold: number;
  detectedOutliers: Outlier[];
  outlierPercentage: number;
}

export enum OutlierMethod {
  Z_SCORE = 'z_score',
  IQR = 'iqr',
  MAD = 'mad',
  ISOLATION_FOREST = 'isolation_forest',
  LOCAL_OUTLIER_FACTOR = 'local_outlier_factor'
}

export interface Outlier {
  value: number;
  index: number;
  score: number;
  timestamp: number;
}

export interface ConfidenceInterval {
  level: number; // e.g., 0.95 for 95% confidence
  lowerBound: number;
  upperBound: number;
  marginOfError: number;
  method: ConfidenceMethod;
}

export enum ConfidenceMethod {
  T_DISTRIBUTION = 't_distribution',
  NORMAL_APPROXIMATION = 'normal_approximation',
  BOOTSTRAP = 'bootstrap',
  BAYESIAN = 'bayesian'
}

export interface SeasonalPattern {
  period: TimePeriod;
  amplitude: number;
  phase: number;
  significance: number;
  patternType: SeasonalPatternType;
}

export enum TimePeriod {
  HOURLY = 'hourly',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly'
}

export enum SeasonalPatternType {
  SINUSOIDAL = 'sinusoidal',
  STEP_FUNCTION = 'step_function',
  CUSTOM = 'custom'
}

export interface TrendAnalysis {
  trendType: TrendType;
  slope: number;
  intercept: number;
  rSquared: number;
  significance: number;
  breakpoints: Breakpoint[];
}

export enum TrendType {
  LINEAR = 'linear',
  EXPONENTIAL = 'exponential',
  LOGARITHMIC = 'logarithmic',
  POLYNOMIAL = 'polynomial',
  NO_TREND = 'no_trend'
}

export interface Breakpoint {
  timestamp: number;
  changePoint: number;
  confidence: number;
  cause?: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  recommendations: ValidationRecommendation[];
  overallQuality: QualityScore;
}

export interface ValidationIssue {
  type: ValidationIssueType;
  severity: ValidationSeverity;
  description: string;
  affectedMetrics: string[];
  suggestedFix: string;
}

export enum ValidationIssueType {
  INSUFFICIENT_DATA = 'insufficient_data',
  HIGH_VARIABILITY = 'high_variability',
  OUTLIER_CONTAMINATION = 'outlier_contamination',
  DISTRIBUTION_MISMATCH = 'distribution_mismatch',
  SEASONAL_INSTABILITY = 'seasonal_instability'
}

export enum ValidationSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface ValidationRecommendation {
  action: ValidationAction;
  priority: ValidationPriority;
  description: string;
  expectedImprovement: number;
}

export enum ValidationAction {
  COLLECT_MORE_DATA = 'collect_more_data',
  REMOVE_OUTLIERS = 'remove_outliers',
  ADJUST_DISTRIBUTION = 'adjust_distribution',
  STABILIZE_SEASONALITY = 'stabilize_seasonality',
  REESTABLISH_BASELINE = 'reestablish_baseline'
}

export enum ValidationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

export interface QualityScore {
  overall: number;
  components: QualityComponent[];
  grade: QualityGrade;
}

export interface QualityComponent {
  name: string;
  score: number;
  weight: number;
  contribution: number;
}

export enum QualityGrade {
  EXCELLENT = 'excellent',
  GOOD = 'good',
  FAIR = 'fair',
  POOR = 'poor',
  UNACCEPTABLE = 'unacceptable'
}

export interface DriftDetection {
  detected: boolean;
  driftType: DriftType;
  severity: DriftSeverity;
  affectedBaselines: string[];
  confidence: number;
  evidence: DriftEvidence[];
  recommendations: DriftRecommendation[];
}

export enum DriftType {
  CONCEPT_DRIFT = 'concept_drift',
  DATA_DRIFT = 'data_drift',
  PERFORMANCE_DRIFT = 'performance_drift',
  SEASONAL_DRIFT = 'seasonal_drift'
}

export enum DriftSeverity {
  MINOR = 'minor',
  MODERATE = 'moderate',
  SIGNIFICANT = 'significant',
  SEVERE = 'severe'
}

export interface DriftEvidence {
  metric: string;
  observedChange: number;
  statisticalSignificance: number;
  timeframe: TimeRange;
}

export interface TimeRange {
  start: number;
  end: number;
}

export interface DriftRecommendation {
  action: DriftAction;
  priority: DriftPriority;
  description: string;
  expectedBenefit: number;
}

export enum DriftAction {
  UPDATE_BASELINE = 'update_baseline',
  INVESTIGATE_CAUSE = 'investigate_cause',
  ADJUST_THRESHOLDS = 'adjust_thresholds',
  REESTABLISH_BASELINE = 'reestablish_baseline',
  MONITOR_CLOSELY = 'monitor_closely'
}

export enum DriftPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  IMMEDIATE = 'immediate'
}

export interface RegressionAnalyzer {
  detectRegressions(metrics: PerformanceMetrics[], baselines: PerformanceBaseline[]): Promise<RegressionDetection[]>;
  classifyRegressions(regressions: RegressionDetection[]): Promise<RegressionClassification[]>;
  quantifyImpact(regressions: RegressionDetection[]): Promise<RegressionImpact[]>;
  correlateRegressions(regressions: RegressionDetection[]): Promise<RegressionCorrelation[]>;
}

export interface PerformanceMetrics {
  timestamp: number;
  metrics: MetricValue[];
  context: MetricContext;
}

export interface MetricValue {
  name: string;
  value: number;
  unit: string;
  tags: Record<string, string>;
}

export interface MetricContext {
  environment: string;
  version: string;
  build: string;
  testSuite: string;
  configuration: Record<string, any>;
}

export interface RegressionDetection {
  metricName: string;
  baseline: PerformanceBaseline;
  observedValue: number;
  expectedRange: ExpectedRange;
  deviation: Deviation;
  statisticalSignificance: number;
  confidence: number;
  timestamp: number;
}

export interface ExpectedRange {
  lowerBound: number;
  upperBound: number;
  method: RangeMethod;
}

export enum RangeMethod {
  STATISTICAL = 'statistical',
  HISTORICAL = 'historical',
  PREDICTIVE = 'predictive'
}

export interface Deviation {
  absolute: number;
  relative: number;
  direction: DeviationDirection;
  magnitude: DeviationMagnitude;
}

export enum DeviationDirection {
  IMPROVEMENT = 'improvement',
  DEGRADATION = 'degradation',
  NEUTRAL = 'neutral'
}

export enum DeviationMagnitude {
  NEGLIGIBLE = 'negligible',
  SMALL = 'small',
  MEDIUM = 'medium',
  LARGE = 'large',
  EXTREME = 'extreme'
}

export interface RegressionClassification {
  regression: RegressionDetection;
  category: RegressionCategory;
  severity: RegressionSeverity;
  confidence: number;
  evidence: ClassificationEvidence[];
  similarPastIncidents: SimilarIncident[];
}

export enum RegressionCategory {
  PERFORMANCE = 'performance',
  MEMORY = 'memory',
  CPU = 'cpu',
  NETWORK = 'network',
  IO = 'io',
  LATENCY = 'latency',
  THROUGHPUT = 'throughput',
  ERROR_RATE = 'error_rate'
}

export enum RegressionSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface ClassificationEvidence {
  factor: string;
  weight: number;
  contribution: number;
  reasoning: string;
}

export interface SimilarIncident {
  incidentId: string;
  similarity: number;
  resolution: string;
  timeToResolve: number;
}

export interface RegressionImpact {
  regression: RegressionDetection;
  businessImpact: BusinessImpactAssessment;
  technicalImpact: TechnicalImpactAssessment;
  riskAssessment: RiskAssessment;
  priority: ImpactPriority;
}

export interface BusinessImpactAssessment {
  affectedUsers: number;
  revenueImpact: FinancialImpact;
  userExperience: UXImpact;
  compliance: ComplianceImpact;
}

export interface FinancialImpact {
  directCost: number;
  indirectCost: number;
  opportunityCost: number;
  totalImpact: number;
  timeframe: string;
}

export interface UXImpact {
  frustrationLevel: number;
  abandonmentRate: number;
  satisfactionDrop: number;
  brandDamage: number;
}

export interface ComplianceImpact {
  slaViolation: boolean;
  regulatoryRisk: number;
  contractualPenalties: number;
  legalExposure: number;
}

export interface TechnicalImpactAssessment {
  systemStability: StabilityImpact;
  scalability: ScalabilityImpact;
  maintainability: MaintainabilityImpact;
  security: SecurityImpact;
}

export interface StabilityImpact {
  crashProbability: number;
  errorRateIncrease: number;
  recoveryTime: number;
  cascadingFailures: boolean;
}

export interface ScalabilityImpact {
  capacityReduction: number;
  performanceDegradation: number;
  resourceInefficiency: number;
  bottleneckCreation: boolean;
}

export interface MaintainabilityImpact {
  debuggingDifficulty: number;
  monitoringComplexity: number;
  deploymentRisk: number;
  rollbackDifficulty: number;
}

export interface SecurityImpact {
  vulnerabilityExposure: number;
  attackSurfaceIncrease: number;
  dataBreachRisk: number;
  complianceViolation: boolean;
}

export interface RiskAssessment {
  likelihood: number;
  impact: number;
  riskScore: number;
  riskLevel: RiskLevel;
  mitigationDifficulty: number;
}

export enum RiskLevel {
  VERY_LOW = 'very_low',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  VERY_HIGH = 'very_high',
  EXTREME = 'extreme'
}

export enum ImpactPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
  BUSINESS_CRITICAL = 'business_critical'
}

export interface RegressionCorrelation {
  regressions: RegressionDetection[];
  correlationStrength: number;
  commonCause: CommonCause;
  rootCauseHypothesis: RootCauseHypothesis[];
  investigationPriority: number;
}

export interface CommonCause {
  type: CauseType;
  description: string;
  confidence: number;
  evidence: string[];
}

export enum CauseType {
  CODE_CHANGE = 'code_change',
  CONFIGURATION_CHANGE = 'configuration_change',
  INFRASTRUCTURE_CHANGE = 'infrastructure_change',
  DEPENDENCY_UPDATE = 'dependency_update',
  ENVIRONMENTAL_FACTOR = 'environmental_factor',
  LOAD_PATTERN_CHANGE = 'load_pattern_change',
  UNKNOWN = 'unknown'
}

export interface RootCauseHypothesis {
  hypothesis: string;
  probability: number;
  supportingEvidence: string[];
  contradictingEvidence: string[];
  testability: number;
  investigationSteps: InvestigationStep[];
}

export interface InvestigationStep {
  step: string;
  priority: number;
  estimatedTime: number;
  requiredResources: string[];
  expectedOutcome: string;
}

export interface StatisticalEngine {
  hypothesisTesting: HypothesisTesting;
  changePointDetection: ChangePointDetection;
  timeSeriesAnalysis: TimeSeriesAnalysis;
  statisticalModeling: StatisticalModeling;
}

export interface HypothesisTesting {
  performTest(data1: number[], data2: number[], testType: HypothesisTestType): TestResult;
  powerAnalysis(sampleSize: number, effectSize: number, alpha: number): PowerAnalysisResult;
  multipleTestingCorrection(pValues: number[], method: CorrectionMethod): CorrectedPValues;
}

export enum HypothesisTestType {
  T_TEST = 't_test',
  MANN_WHITNEY_U = 'mann_whitney_u',
  WILCOXON_SIGNED_RANK = 'wilcoxon_signed_rank',
  ANOVA = 'anova',
  KRUSKAL_WALLIS = 'kruskal_wallis',
  CHI_SQUARE = 'chi_square',
  FISHER_EXACT = 'fisher_exact'
}

export interface TestResult {
  testStatistic: number;
  pValue: number;
  effectSize: number;
  confidenceInterval: ConfidenceInterval;
  power: number;
  significance: boolean;
  interpretation: string;
}

export interface PowerAnalysisResult {
  requiredSampleSize: number;
  achievedPower: number;
  effectSize: number;
  alpha: number;
  recommendations: string[];
}

export interface CorrectedPValues {
  originalPValues: number[];
  correctedPValues: number[];
  method: CorrectionMethod;
  significantIndices: number[];
}

export enum CorrectionMethod {
  BONFERRONI = 'bonferroni',
  HOLM_BONFERRONI = 'holm_bonferroni',
  BENJAMINI_HOCHBERG = 'benjamini_hochberg',
  BENJAMINI_YEKUTIELI = 'benjamini_yekutieli'
}

export interface ChangePointDetection {
  detectChanges(timeSeries: TimeSeriesData, method: ChangePointMethod): ChangePointResult[];
  validateChangePoints(changePoints: ChangePointResult[], originalData: TimeSeriesData): ValidationResult;
  contextualizeChangePoints(changePoints: ChangePointResult[], context: ChangePointContext): ContextualizedChangePoint[];
}

export interface TimeSeriesData {
  timestamps: number[];
  values: number[];
  metadata: TimeSeriesMetadata;
}

export interface TimeSeriesMetadata {
  metricName: string;
  unit: string;
  frequency: DataFrequency;
  seasonality: boolean;
  trend: boolean;
}

export enum DataFrequency {
  SECOND = 'second',
  MINUTE = 'minute',
  HOUR = 'hour',
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month'
}

export enum ChangePointMethod {
  PELT = 'pelt',
  BINARY_SEGMENTATION = 'binary_segmentation',
  BAYESIAN_ONLINE = 'bayesian_online',
  CUSUM = 'cusum',
  EXPONENTIAL_FAMILY = 'exponential_family'
}

export interface ChangePointResult {
  index: number;
  timestamp: number;
  confidence: number;
  magnitude: number;
  direction: ChangeDirection;
  statisticalSignificance: number;
}

export enum ChangeDirection {
  INCREASE = 'increase',
  DECREASE = 'decrease',
  LEVEL_SHIFT = 'level_shift'
}

export interface ChangePointContext {
  deploymentEvents: DeploymentEvent[];
  configurationChanges: ConfigurationChange[];
  incidentHistory: IncidentRecord[];
}

export interface DeploymentEvent {
  timestamp: number;
  version: string;
  type: DeploymentType;
  success: boolean;
}

export enum DeploymentType {
  CODE_DEPLOYMENT = 'code_deployment',
  CONFIGURATION_UPDATE = 'configuration_update',
  INFRASTRUCTURE_CHANGE = 'infrastructure_change',
  DEPENDENCY_UPDATE = 'dependency_update'
}

export interface ConfigurationChange {
  timestamp: number;
  parameter: string;
  oldValue: any;
  newValue: any;
  reason: string;
}

export interface IncidentRecord {
  timestamp: number;
  type: string;
  severity: string;
  resolution: string;
}

export interface ContextualizedChangePoint {
  changePoint: ChangePointResult;
  likelyCause: string;
  confidence: number;
  relatedEvents: RelatedEvent[];
  impact: ChangeImpact;
}

export interface RelatedEvent {
  event: DeploymentEvent | ConfigurationChange | IncidentRecord;
  timeDifference: number;
  correlationStrength: number;
}

export interface ChangeImpact {
  magnitude: ImpactMagnitude;
  duration: number;
  persistence: PersistenceType;
  cascadingEffects: boolean;
}

export enum ImpactMagnitude {
  NEGLIGIBLE = 'negligible',
  SMALL = 'small',
  MEDIUM = 'medium',
  LARGE = 'large',
  EXTREME = 'extreme'
}

export enum PersistenceType {
  TRANSIENT = 'transient',
  TEMPORARY = 'temporary',
  PERMANENT = 'permanent'
}

export interface TimeSeriesAnalysis {
  decomposeSeries(data: TimeSeriesData): TimeSeriesDecomposition;
  forecastSeries(data: TimeSeriesData, steps: number): ForecastResult;
  detectAnomalies(data: TimeSeriesData, method: AnomalyDetectionMethod): AnomalyResult[];
  analyzeTrends(data: TimeSeriesData): TrendAnalysisResult;
}

export interface TimeSeriesDecomposition {
  trend: number[];
  seasonal: number[];
  residual: number[];
  seasonalityPeriod?: number;
  decompositionMethod: DecompositionMethod;
}

export enum DecompositionMethod {
  ADDITIVE = 'additive',
  MULTIPLICATIVE = 'multiplicative',
  STL = 'stl'
}

export interface ForecastResult {
  forecasts: number[];
  confidenceIntervals: ConfidenceInterval[];
  accuracyMetrics: ForecastAccuracy;
  model: ForecastingModel;
}

export interface ForecastAccuracy {
  mae: number;
  rmse: number;
  mape: number;
  smape: number;
}

export interface ForecastingModel {
  type: ForecastModelType;
  parameters: any;
  performance: ModelPerformance;
}

export enum ForecastModelType {
  ARIMA = 'arima',
  SARIMA = 'sarima',
  EXPONENTIAL_SMOOTHING = 'exponential_smoothing',
  PROPHET = 'prophet',
  LSTM = 'lstm'
}

export interface ModelPerformance {
  trainingError: number;
  validationError: number;
  overfitting: boolean;
}

export enum AnomalyDetectionMethod {
  Z_SCORE = 'z_score',
  IQR = 'iqr',
  ISOLATION_FOREST = 'isolation_forest',
  LOCAL_OUTLIER_FACTOR = 'local_outlier_factor',
  AUTOENCODER = 'autoencoder',
  PROPHET = 'prophet'
}

export interface AnomalyResult {
  index: number;
  timestamp: number;
  value: number;
  score: number;
  severity: AnomalySeverity;
  confidence: number;
}

export interface TrendAnalysisResult {
  trendType: TrendType;
  parameters: TrendParameters;
  statisticalSignificance: number;
  breakpoints: Breakpoint[];
  forecast: ForecastResult;
}

export interface TrendParameters {
  slope: number;
  intercept: number;
  acceleration?: number;
  rSquared: number;
  pValue: number;
}

export interface StatisticalModeling {
  fitDistribution(data: number[], candidateDistributions: DistributionType[]): DistributionFit[];
  selectBestModel(fits: DistributionFit[], criterion: ModelSelectionCriterion): DistributionFit;
  validateModel(fit: DistributionFit, validationData: number[]): ModelValidation;
  generateSamples(fit: DistributionFit, count: number): number[];
}

export interface DistributionFit {
  distribution: DistributionType;
  parameters: DistributionParameters;
  goodnessOfFit: GoodnessOfFit;
  aic: number;
  bic: number;
}

export enum ModelSelectionCriterion {
  AIC = 'aic',
  BIC = 'bic',
  GOODNESS_OF_FIT = 'goodness_of_fit',
  CROSS_VALIDATION = 'cross_validation'
}

export interface ModelValidation {
  validationMetrics: ValidationMetrics;
  residualAnalysis: ResidualAnalysis;
  predictionIntervals: PredictionInterval[];
}

export interface ValidationMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
}

export interface ResidualAnalysis {
  residuals: number[];
  autocorrelation: number[];
  normalityTest: NormalityTest;
  heteroscedasticity: boolean;
}

export interface NormalityTest {
  testStatistic: number;
  pValue: number;
  normal: boolean;
}

export interface PredictionInterval {
  point: number;
  lowerBound: number;
  upperBound: number;
  confidence: number;
}

export interface RegressionAlerting {
  alertRules: AlertRule[];
  alertEngine: AlertEngine;
  escalationPolicies: EscalationPolicy[];
  notificationChannels: NotificationChannel[];
}

export interface AlertRule {
  id: string;
  name: string;
  condition: AlertCondition;
  severity: AlertSeverity;
  enabled: boolean;
  cooldown: number;
  aggregation: AlertAggregation;
}

export interface AlertCondition {
  metric: string;
  operator: AlertOperator;
  threshold: number;
  duration: number;
  baseline: BaselineReference;
}

export enum AlertOperator {
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than',
  GREATER_THAN_OR_EQUAL = 'greater_than_or_equal',
  LESS_THAN_OR_EQUAL = 'less_than_or_equal',
  EQUAL = 'equal',
  NOT_EQUAL = 'not_equal',
  PERCENTAGE_CHANGE = 'percentage_change',
  STANDARD_DEVIATIONS = 'standard_deviations'
}

export interface BaselineReference {
  type: BaselineType;
  percentile?: number;
  historicalWindow?: number;
  seasonalAdjustment?: boolean;
}

export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

export interface AlertAggregation {
  window: number;
  function: AggregationFunction;
  groupBy: string[];
}

export interface AlertEngine {
  evaluateConditions(metrics: PerformanceMetrics[], rules: AlertRule[]): AlertEvaluation[];
  correlateAlerts(alerts: AlertEvaluation[]): CorrelatedAlert[];
  suppressAlerts(alerts: AlertEvaluation[], suppressionRules: SuppressionRule[]): SuppressedAlert[];
}

export interface AlertEvaluation {
  ruleId: string;
  triggered: boolean;
  value: number;
  threshold: number;
  deviation: number;
  confidence: number;
  context: AlertContext;
}

export interface AlertContext {
  metric: string;
  timestamp: number;
  environment: string;
  baseline: PerformanceBaseline;
  recentHistory: MetricValue[];
}

export interface CorrelatedAlert {
  alerts: AlertEvaluation[];
  correlationStrength: number;
  rootCause: string;
  recommendedAction: string;
}

export interface SuppressionRule {
  condition: SuppressionCondition;
  duration: number;
  reason: string;
}

export interface SuppressionCondition {
  alertTypes: string[];
  timeWindow: number;
  threshold: number;
}

export interface SuppressedAlert {
  alert: AlertEvaluation;
  suppressed: boolean;
  suppressionRule: SuppressionRule;
  reason: string;
}

export interface EscalationPolicy {
  severity: AlertSeverity;
  timeToEscalate: number;
  escalationLevels: EscalationLevel[];
  autoResolution: AutoResolutionRule;
}

export interface EscalationLevel {
  level: number;
  delay: number;
  channels: string[];
  recipients: string[];
  message: string;
}

export interface AutoResolutionRule {
  conditions: AutoResolutionCondition[];
  resolutionAction: string;
}

export interface AutoResolutionCondition {
  metric: string;
  operator: AlertOperator;
  threshold: number;
  duration: number;
}

export interface NotificationChannel {
  id: string;
  type: ChannelType;
  configuration: ChannelConfiguration;
  templates: NotificationTemplate[];
}

export enum ChannelType {
  EMAIL = 'email',
  SLACK = 'slack',
  WEBHOOK = 'webhook',
  SMS = 'sms',
  PAGER_DUTY = 'pager_duty',
  OPSGENIE = 'opsgenie'
}

export interface ChannelConfiguration {
  endpoint: string;
  authentication: AuthenticationConfig;
  rateLimit: RateLimit;
}

export interface AuthenticationConfig {
  type: AuthType;
  credentials: any;
}

export enum AuthType {
  NONE = 'none',
  BASIC = 'basic',
  BEARER = 'bearer',
  API_KEY = 'api_key',
  OAUTH2 = 'oauth2'
}

export interface RateLimit {
  requests: number;
  window: number;
  burst: number;
}

export interface NotificationTemplate {
  name: string;
  subject: string;
  body: string;
  variables: TemplateVariable[];
}

export interface TemplateVariable {
  name: string;
  type: VariableType;
  description: string;
}

export enum VariableType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  DATE = 'date',
  METRIC = 'metric',
  ALERT = 'alert'
}

export interface RegressionReporting {
  reportGenerator: ReportGenerator;
  dashboardManager: DashboardManager;
  exportManager: ExportManager;
  schedulingManager: SchedulingManager;
}

export interface ReportGenerator {
  generateRegressionReport(regressions: RegressionDetection[], context: ReportContext): RegressionReport;
  generateTrendReport(metrics: PerformanceMetrics[], baselines: PerformanceBaseline[]): TrendReport;
  generateImpactReport(impacts: RegressionImpact[]): ImpactReport;
  generateExecutiveSummary(regressions: RegressionDetection[], impacts: RegressionImpact[]): ExecutiveSummary;
}

export interface ReportContext {
  timeRange: TimeRange;
  environment: string;
  stakeholders: string[];
  priority: ReportPriority;
}

export enum ReportPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  EXECUTIVE = 'executive'
}

export interface RegressionReport {
  id: string;
  title: string;
  summary: ReportSummary;
  regressions: DetailedRegression[];
  recommendations: Recommendation[];
  metadata: ReportMetadata;
}

export interface ReportSummary {
  totalRegressions: number;
  criticalRegressions: number;
  affectedMetrics: string[];
  timeRange: TimeRange;
  overallImpact: ImpactPriority;
}

export interface DetailedRegression {
  regression: RegressionDetection;
  classification: RegressionClassification;
  impact: RegressionImpact;
  correlation: RegressionCorrelation;
  investigationStatus: InvestigationStatus;
}

export interface InvestigationStatus {
  status: InvestigationState;
  assignedTo: string;
  priority: InvestigationPriority;
  deadline: number;
  progress: number;
  findings: InvestigationFinding[];
}

export enum InvestigationState {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export enum InvestigationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

export interface InvestigationFinding {
  timestamp: number;
  finding: string;
  evidence: string[];
  confidence: number;
}

export interface Recommendation {
  type: RecommendationType;
  description: string;
  priority: RecommendationPriority;
  effort: EffortEstimate;
  expectedBenefit: BenefitEstimate;
  implementation: ImplementationPlan;
}

export enum RecommendationType {
  IMMEDIATE_FIX = 'immediate_fix',
  SHORT_TERM_IMPROVEMENT = 'short_term_improvement',
  LONG_TERM_OPTIMIZATION = 'long_term_optimization',
  MONITORING_ENHANCEMENT = 'monitoring_enhancement',
  PROCESS_IMPROVEMENT = 'process_improvement'
}

export enum RecommendationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface EffortEstimate {
  developerDays: number;
  complexity: ComplexityLevel;
  risk: RiskLevel;
}

export enum ComplexityLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  VERY_HIGH = 'very_high'
}

export interface BenefitEstimate {
  performanceImprovement: number;
  costSavings: number;
  riskReduction: number;
  timeframe: string;
}

export interface ImplementationPlan {
  steps: ImplementationStep[];
  dependencies: string[];
  rollbackPlan: RollbackPlan;
}

export interface ImplementationStep {
  step: string;
  owner: string;
  estimatedTime: number;
  prerequisites: string[];
}

export interface RollbackPlan {
  steps: RollbackStep[];
  conditions: RollbackCondition[];
  impact: string;
}

export interface RollbackStep {
  action: string;
  owner: string;
  estimatedTime: number;
}

export interface RollbackCondition {
  condition: string;
  action: string;
}

export interface ReportMetadata {
  generatedAt: number;
  generatedBy: string;
  version: string;
  dataSources: string[];
  methodology: string;
}

export interface TrendReport {
  id: string;
  title: string;
  metrics: MetricTrend[];
  overallTrend: OverallTrend;
  anomalies: AnomalySummary[];
  forecast: TrendForecast;
  metadata: ReportMetadata;
}

export interface MetricTrend {
  metricName: string;
  trend: TrendAnalysis;
  significance: number;
  anomalies: AnomalyResult[];
  forecast: ForecastResult;
}

export interface OverallTrend {
  direction: TrendDirection;
  magnitude: number;
  confidence: number;
  keyDrivers: string[];
}

export interface AnomalySummary {
  metricName: string;
  totalAnomalies: number;
  severityDistribution: Record<AnomalySeverity, number>;
  mostSevere: AnomalyResult;
}

export interface TrendForecast {
  predictionHorizon: number;
  confidenceLevel: number;
  scenarios: ForecastScenario[];
}

export interface ForecastScenario {
  name: string;
  probability: number;
  forecast: ForecastResult;
  assumptions: string[];
}

export interface ImpactReport {
  id: string;
  title: string;
  businessImpact: BusinessImpactSummary;
  technicalImpact: TechnicalImpactSummary;
  riskAnalysis: RiskAnalysisSummary;
  mitigationStrategies: MitigationStrategy[];
  metadata: ReportMetadata;
}

export interface BusinessImpactSummary {
  totalRevenueImpact: number;
  affectedUsers: number;
  slaViolations: number;
  brandDamage: BrandDamageAssessment;
}

export interface BrandDamageAssessment {
  severity: ImpactMagnitude;
  duration: number;
  recoveryEffort: number;
  longTermImpact: number;
}

export interface TechnicalImpactSummary {
  stabilityDegradation: number;
  performanceRegression: number;
  scalabilityImpact: number;
  maintenanceOverhead: number;
}

export interface RiskAnalysisSummary {
  overallRiskScore: number;
  riskDistribution: Record<RiskLevel, number>;
  criticalPaths: string[];
  singlePointsOfFailure: string[];
}

export interface MitigationStrategy {
  strategy: string;
  effectiveness: number;
  cost: number;
  timeline: string;
  prerequisites: string[];
}

export interface ExecutiveSummary {
  id: string;
  title: string;
  keyFindings: KeyFinding[];
  recommendations: ExecutiveRecommendation[];
  nextSteps: NextStep[];
  metadata: ReportMetadata;
}

export interface KeyFinding {
  finding: string;
  impact: ImpactMagnitude;
  evidence: string;
  priority: ImpactPriority;
}

export interface ExecutiveRecommendation {
  recommendation: string;
  businessCase: string;
  timeline: string;
  responsibleParty: string;
}

export interface NextStep {
  step: string;
  owner: string;
  deadline: number;
  dependencies: string[];
}

export interface DashboardManager {
  createDashboard(config: DashboardConfig): Dashboard;
  updateDashboard(dashboardId: string, updates: DashboardUpdate): Dashboard;
  getDashboard(dashboardId: string): Dashboard;
  deleteDashboard(dashboardId: string): void;
  shareDashboard(dashboardId: string, permissions: DashboardPermissions): void;
}

export interface DashboardConfig {
  title: string;
  description: string;
  widgets: WidgetConfig[];
  layout: DashboardLayout;
  filters: DashboardFilter[];
  refreshInterval: number;
}

export interface WidgetConfig {
  type: WidgetType;
  title: string;
  dataSource: DataSourceConfig;
  visualization: VisualizationConfig;
  size: WidgetSize;
  position: WidgetPosition;
}

export enum WidgetType {
  METRIC_CHART = 'metric_chart',
  TREND_CHART = 'trend_chart',
  REGRESSION_TABLE = 'regression_table',
  ALERT_SUMMARY = 'alert_summary',
  BASELINE_COMPARISON = 'baseline_comparison',
  FORECAST_CHART = 'forecast_chart'
}

export interface DataSourceConfig {
  metrics: string[];
  timeRange: TimeRange;
  filters: DataFilter[];
  aggregation: AggregationConfig;
}

export interface DataFilter {
  field: string;
  operator: FilterOperator;
  value: any;
}

export enum FilterOperator {
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  CONTAINS = 'contains',
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than',
  IN = 'in',
  NOT_IN = 'not_in'
}

export interface AggregationConfig {
  function: AggregationFunction;
  groupBy: string[];
  interval: string;
}

export interface VisualizationConfig {
  chartType: ChartType;
  colors: string[];
  axes: AxisConfig[];
  legend: LegendConfig;
  annotations: AnnotationConfig[];
}

export enum ChartType {
  LINE = 'line',
  BAR = 'bar',
  AREA = 'area',
  SCATTER = 'scatter',
  HEATMAP = 'heatmap',
  GAUGE = 'gauge',
  TABLE = 'table'
}

export interface AxisConfig {
  field: string;
  label: string;
  scale: ScaleType;
  format: string;
}

export enum ScaleType {
  LINEAR = 'linear',
  LOGARITHMIC = 'logarithmic',
  TIME = 'time',
  CATEGORY = 'category'
}

export interface LegendConfig {
  enabled: boolean;
  position: LegendPosition;
  format: string;
}

export enum LegendPosition {
  TOP = 'top',
  BOTTOM = 'bottom',
  LEFT = 'left',
  RIGHT = 'right'
}

export interface AnnotationConfig {
  type: AnnotationType;
  position: AnnotationPosition;
  text: string;
  style: AnnotationStyle;
}

export enum AnnotationType {
  LINE = 'line',
  RECTANGLE = 'rectangle',
  TEXT = 'text',
  POINT = 'point'
}

export interface AnnotationPosition {
  x: number;
  y: number;
}

export interface AnnotationStyle {
  color: string;
  opacity: number;
  size: number;
}

export interface WidgetSize {
  width: number;
  height: number;
}

export interface WidgetPosition {
  x: number;
  y: number;
}

export interface DashboardLayout {
  type: LayoutType;
  columns: number;
  rows: number;
  gap: number;
}

export enum LayoutType {
  GRID = 'grid',
  FLEXIBLE = 'flexible',
  RESPONSIVE = 'responsive'
}

export interface DashboardFilter {
  field: string;
  type: FilterType;
  defaultValue: any;
  options: FilterOption[];
}

export enum FilterType {
  DROPDOWN = 'dropdown',
  MULTISELECT = 'multiselect',
  DATE_RANGE = 'date_range',
  TEXT_INPUT = 'text_input'
}

export interface FilterOption {
  label: string;
  value: any;
}

export interface Dashboard {
  id: string;
  config: DashboardConfig;
  createdAt: number;
  updatedAt: number;
  owner: string;
  permissions: DashboardPermissions;
  metadata: DashboardMetadata;
}

export interface DashboardPermissions {
  public: boolean;
  viewers: string[];
  editors: string[];
  admins: string[];
}

export interface DashboardMetadata {
  viewCount: number;
  lastViewed: number;
  favoriteCount: number;
  tags: string[];
}

export interface DashboardUpdate {
  title?: string;
  description?: string;
  widgets?: WidgetUpdate[];
  layout?: DashboardLayout;
  filters?: DashboardFilter[];
  refreshInterval?: number;
}

export interface WidgetUpdate {
  id: string;
  config: Partial<WidgetConfig>;
}

export interface ExportManager {
  exportReport(report: RegressionReport, format: ExportFormat): Promise<ExportedReport>;
  exportDashboard(dashboard: Dashboard, format: ExportFormat): Promise<ExportedDashboard>;
  scheduleExport(config: ExportSchedule): Promise<ScheduledExport>;
  getExportHistory(userId: string): ExportHistory[];
}

export interface ExportedReport {
  id: string;
  reportId: string;
  format: ExportFormat;
  content: any;
  size: number;
  generatedAt: number;
  expiresAt: number;
}

export interface ExportedDashboard {
  id: string;
  dashboardId: string;
  format: ExportFormat;
  content: any;
  size: number;
  generatedAt: number;
  expiresAt: number;
}

export interface ExportSchedule {
  name: string;
  type: ExportType;
  targetId: string;
  format: ExportFormat;
  schedule: ScheduleConfig;
  recipients: string[];
  retention: number;
}

export enum ExportType {
  REPORT = 'report',
  DASHBOARD = 'dashboard'
}

export interface ScheduleConfig {
  frequency: ScheduleFrequency;
  time: string;
  timezone: string;
}

export enum ScheduleFrequency {
  HOURLY = 'hourly',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly'
}

export interface ScheduledExport {
  id: string;
  schedule: ExportSchedule;
  nextRun: number;
  status: ScheduleStatus;
  lastResult?: ExportResult;
}

export enum ScheduleStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  DISABLED = 'disabled'
}

export interface ExportResult {
  success: boolean;
  exportedAt: number;
  size: number;
  error?: string;
}

export interface ExportHistory {
  exportId: string;
  type: ExportType;
  format: ExportFormat;
  exportedAt: number;
  size: number;
  status: ExportStatus;
}

export enum ExportStatus {
  SUCCESS = 'success',
  FAILED = 'failed',
  IN_PROGRESS = 'in_progress'
}

export interface SchedulingManager {
  scheduleReport(config: ReportSchedule): Promise<ScheduledReport>;
  updateSchedule(scheduleId: string, updates: ScheduleUpdate): Promise<ScheduledReport>;
  cancelSchedule(scheduleId: string): void;
  getScheduledReports(userId: string): ScheduledReport[];
  executeScheduledReport(scheduleId: string): Promise<ReportExecution>;
}

export interface ReportSchedule {
  name: string;
  reportType: ReportType;
  config: ReportConfig;
  schedule: ScheduleConfig;
  recipients: string[];
  format: ExportFormat;
  retention: number;
}

export interface ReportConfig {
  timeRange: TimeRange;
  filters: ReportFilter[];
  aggregations: string[];
  includeCharts: boolean;
  includeRawData: boolean;
}

export interface ReportFilter {
  field: string;
  operator: FilterOperator;
  value: any;
}

export interface ScheduledReport {
  id: string;
  schedule: ReportSchedule;
  createdAt: number;
  nextRun: number;
  lastRun?: number;
  status: ScheduleStatus;
  executionHistory: ReportExecution[];
}

export interface ScheduleUpdate {
  name?: string;
  schedule?: Partial<ScheduleConfig>;
  recipients?: string[];
  format?: ExportFormat;
  retention?: number;
  enabled?: boolean;
}

export interface ReportExecution {
  id: string;
  scheduleId: string;
  startedAt: number;
  completedAt?: number;
  status: ExecutionStatus;
  result?: RegressionReport;
  error?: string;
  size?: number;
}

export enum ExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}
