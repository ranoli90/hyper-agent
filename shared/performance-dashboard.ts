export interface PerformanceDashboard {
  realTimeMetrics: RealTimeMetricsStream;
  historicalAnalytics: HistoricalAnalytics;
  predictiveInsights: PredictiveInsights;
  alertingSystem: AlertingSystem;
  exportCapabilities: ExportCapabilities;
}

export interface RealTimeMetricsStream {
  metrics: WebSocketStream;
  filters: MetricsFilters;
  subscriptions: SubscriptionManager;
  buffer: MetricsBuffer;
}

export interface HistoricalAnalytics {
  storage: TimeSeriesStorage;
  queries: AnalyticsQueries;
  aggregations: DataAggregations;
  trends: TrendAnalysis;
}

export interface PredictiveInsights {
  models: PredictionModels;
  forecasting: ForecastingEngine;
  anomalyDetection: AnomalyDetector;
  recommendations: RecommendationEngine;
}

export interface AlertingSystem {
  rules: AlertRules;
  notifications: NotificationManager;
  escalations: EscalationManager;
  thresholds: ThresholdManager;
}

export interface ExportCapabilities {
  formats: ExportFormats;
  scheduling: ExportScheduler;
  templates: ReportTemplates;
  delivery: DeliveryManager;
}

export interface WebSocketStream {
  connection: WebSocket;
  heartbeat: HeartbeatManager;
  reconnection: ReconnectionManager;
  compression: DataCompression;
}

export interface MetricsFilters {
  timeRange: TimeRange;
  dimensions: DimensionFilters;
  aggregations: AggregationRules;
  sampling: SamplingRules;
}

export interface SubscriptionManager {
  activeSubscriptions: Map<string, Subscription>;
  priorityQueue: PriorityQueue;
  rateLimiting: RateLimiter;
}

export interface MetricsBuffer {
  circularBuffer: CircularBuffer;
  compression: BufferCompression;
  overflowHandling: OverflowStrategy;
}

export interface TimeSeriesStorage {
  database: TimeSeriesDatabase;
  indexing: IndexManager;
  retention: RetentionPolicy;
  partitioning: PartitionManager;
}

export interface AnalyticsQueries {
  builder: QueryBuilder;
  executor: QueryExecutor;
  caching: QueryCache;
  optimization: QueryOptimizer;
}

export interface DataAggregations {
  realTime: RealTimeAggregation;
  batch: BatchAggregation;
  custom: CustomAggregation;
}

export interface TrendAnalysis {
  algorithms: TrendAlgorithms;
  seasonality: SeasonalityDetection;
  forecasting: TrendForecasting;
}

export interface PredictionModels {
  regression: RegressionModels;
  neural: NeuralNetworkModels;
  ensemble: EnsembleModels;
}

export interface ForecastingEngine {
  shortTerm: ShortTermForecaster;
  longTerm: LongTermForecaster;
  uncertainty: UncertaintyEstimator;
}

export interface AnomalyDetector {
  statistical: StatisticalAnomalyDetection;
  machineLearning: MLAnomalyDetection;
  threshold: ThresholdAnomalyDetection;
}

export interface RecommendationEngine {
  optimization: OptimizationRecommender;
  capacity: CapacityPlanner;
  alerting: AlertRecommender;
}

export interface AlertRules {
  static: StaticRules;
  dynamic: DynamicRules;
  composite: CompositeRules;
}

export interface NotificationManager {
  channels: NotificationChannels;
  templates: NotificationTemplates;
  scheduling: NotificationScheduler;
}

export interface EscalationManager {
  policies: EscalationPolicies;
  timelines: EscalationTimelines;
  stakeholders: StakeholderManager;
}

export interface ThresholdManager {
  adaptive: AdaptiveThresholds;
  historical: HistoricalBaselines;
  contextual: ContextualThresholds;
}

export interface ExportFormats {
  json: JSONExporter;
  csv: CSVExporter;
  pdf: PDFExporter;
  excel: ExcelExporter;
}

export interface ExportScheduler {
  recurring: RecurringExports;
  triggered: TriggeredExports;
  queued: ExportQueue;
}

export interface ReportTemplates {
  standard: StandardTemplates;
  custom: CustomTemplates;
  parameterized: ParameterizedTemplates;
}

export interface DeliveryManager {
  email: EmailDelivery;
  webhook: WebhookDelivery;
  sftp: SFTPDelivery;
}

export interface TimeRange {
  start: number;
  end: number;
  granularity: Granularity;
}

export interface DimensionFilters {
  metrics: string[];
  tags: Record<string, string[]>;
  aggregations: string[];
}

export interface AggregationRules {
  functions: AggregationFunction[];
  groupings: string[];
  timeWindows: TimeWindow[];
}

export interface SamplingRules {
  rate: number;
  strategy: SamplingStrategy;
  filters: SamplingFilters;
}

export interface Subscription {
  id: string;
  filters: MetricsFilters;
  callback: (data: any) => void;
  priority: Priority;
  active: boolean;
}

export enum Priority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface PriorityQueue {
  enqueue(item: Subscription, priority: Priority): void;
  dequeue(): Subscription | undefined;
  peek(): Subscription | undefined;
}

export interface RateLimiter {
  tokens: number;
  refillRate: number;
  burstCapacity: number;
}

export interface CircularBuffer {
  size: number;
  data: any[];
  writeIndex: number;
  readIndex: number;
}

export interface BufferCompression {
  algorithm: CompressionAlgorithm;
  threshold: number;
  ratio: number;
}

export enum CompressionAlgorithm {
  LZ4 = 'lz4',
  GZIP = 'gzip',
  SNAPPY = 'snappy'
}

export interface OverflowStrategy {
  dropOldest: boolean;
  compress: boolean;
  archive: boolean;
}

export interface TimeSeriesDatabase {
  connection: DatabaseConnection;
  schema: DatabaseSchema;
  optimizations: DatabaseOptimizations;
}

export interface IndexManager {
  primary: PrimaryIndexes;
  secondary: SecondaryIndexes;
  composite: CompositeIndexes;
}

export interface RetentionPolicy {
  policies: RetentionRule[];
  enforcement: RetentionEnforcer;
}

export interface PartitionManager {
  strategy: PartitionStrategy;
  maintenance: PartitionMaintenance;
}

export interface QueryBuilder {
  fluent: FluentBuilder;
  sql: SQLBuilder;
  json: JSONBuilder;
}

export interface QueryExecutor {
  parallel: ParallelExecutor;
  distributed: DistributedExecutor;
  caching: CacheExecutor;
}

export interface QueryCache {
  lru: LRUCache;
  ttl: TTLCache;
  invalidation: CacheInvalidation;
}

export interface QueryOptimizer {
  costBased: CostBasedOptimizer;
  ruleBased: RuleBasedOptimizer;
  learning: LearningOptimizer;
}

export interface RealTimeAggregation {
  windows: SlidingWindows;
  functions: AggregationFunctions;
  state: AggregationState;
}

export interface BatchAggregation {
  jobs: BatchJobs;
  scheduling: BatchScheduling;
  checkpointing: CheckpointManager;
}

export interface CustomAggregation {
  scripts: AggregationScripts;
  plugins: AggregationPlugins;
}

export interface TrendAlgorithms {
  linear: LinearRegression;
  exponential: ExponentialSmoothing;
  arima: ARIMAModel;
}

export interface SeasonalityDetection {
  fourier: FourierAnalysis;
  stl: STLDecomposition;
  autocorrelation: AutocorrelationAnalysis;
}

export interface TrendForecasting {
  confidence: ConfidenceIntervals;
  scenarios: ScenarioAnalysis;
  sensitivity: SensitivityAnalysis;
}

export interface RegressionModels {
  linear: LinearRegression;
  polynomial: PolynomialRegression;
  ridge: RidgeRegression;
}

export interface NeuralNetworkModels {
  lstm: LSTMNetwork;
  cnn: ConvolutionalNetwork;
  transformer: TransformerModel;
}

export interface EnsembleModels {
  randomForest: RandomForest;
  gradientBoosting: GradientBoosting;
  stacking: StackingEnsemble;
}

export interface ShortTermForecaster {
  horizon: number;
  models: ForecastingModels;
  accuracy: AccuracyMetrics;
}

export interface LongTermForecaster {
  horizon: number;
  models: ForecastingModels;
  uncertainty: UncertaintyQuantification;
}

export interface UncertaintyEstimator {
  monteCarlo: MonteCarloSimulation;
  bootstrap: BootstrapAnalysis;
  bayesian: BayesianEstimation;
}

export interface StatisticalAnomalyDetection {
  zscore: ZScoreDetection;
  iqr: IQROutlierDetection;
  mad: MedianAbsoluteDeviation;
}

export interface MLAnomalyDetection {
  isolationForest: IsolationForest;
  autoencoder: AutoencoderNetwork;
  svm: OneClassSVM;
}

export interface ThresholdAnomalyDetection {
  static: StaticThresholds;
  dynamic: DynamicThresholds;
  contextual: ContextualThresholds;
}

export interface OptimizationRecommender {
  resource: ResourceOptimization;
  performance: PerformanceOptimization;
  cost: CostOptimization;
}

export interface CapacityPlanner {
  forecasting: CapacityForecasting;
  provisioning: ProvisioningStrategy;
  scaling: AutoScaling;
}

export interface AlertRecommender {
  sensitivity: SensitivityTuning;
  coverage: CoverageAnalysis;
  reduction: AlertReduction;
}

export interface StaticRules {
  thresholds: StaticThresholds;
  conditions: StaticConditions;
}

export interface DynamicRules {
  adaptive: AdaptiveRules;
  learning: LearningRules;
}

export interface CompositeRules {
  combinations: RuleCombinations;
  dependencies: RuleDependencies;
}

export interface NotificationChannels {
  email: EmailChannel;
  slack: SlackChannel;
  webhook: WebhookChannel;
}

export interface NotificationTemplates {
  standard: StandardTemplates;
  custom: CustomTemplates;
  localized: LocalizedTemplates;
}

export interface NotificationScheduler {
  immediate: ImmediateDelivery;
  batched: BatchedDelivery;
  throttled: ThrottledDelivery;
}

export interface EscalationPolicies {
  timeBased: TimeBasedEscalation;
  severityBased: SeverityBasedEscalation;
  stakeholderBased: StakeholderEscalation;
}

export interface EscalationTimelines {
  stages: EscalationStages;
  timeouts: EscalationTimeouts;
}

export interface StakeholderManager {
  mapping: StakeholderMapping;
  preferences: StakeholderPreferences;
}

export interface AdaptiveThresholds {
  algorithms: AdaptiveAlgorithms;
  learning: LearningThresholds;
}

export interface HistoricalBaselines {
  calculation: BaselineCalculation;
  updating: BaselineUpdates;
}

export interface ContextualThresholds {
  environment: EnvironmentContext;
  workload: WorkloadContext;
}

export interface JSONExporter {
  schema: JSONSchema;
  formatting: JSONFormatting;
}

export interface CSVExporter {
  delimiter: string;
  quoting: QuotingStrategy;
  headers: HeaderHandling;
}

export interface PDFExporter {
  templates: PDFTemplates;
  charts: ChartEmbedding;
  layout: PDFLayout;
}

export interface ExcelExporter {
  worksheets: WorksheetManager;
  formatting: ExcelFormatting;
  formulas: FormulaSupport;
}

export interface RecurringExports {
  schedules: ExportSchedules;
  automation: ExportAutomation;
}

export interface TriggeredExports {
  events: EventTriggers;
  conditions: ExportConditions;
}

export interface ExportQueue {
  priority: PriorityQueue;
  concurrency: ExportConcurrency;
}

export interface StandardTemplates {
  executive: ExecutiveReports;
  technical: TechnicalReports;
  operational: OperationalReports;
}

export interface CustomTemplates {
  builder: TemplateBuilder;
  library: TemplateLibrary;
}

export interface ParameterizedTemplates {
  variables: TemplateVariables;
  logic: TemplateLogic;
}

export interface EmailDelivery {
  smtp: SMTPConfiguration;
  templates: EmailTemplates;
  attachments: AttachmentHandling;
}

export interface WebhookDelivery {
  endpoints: WebhookEndpoints;
  authentication: WebhookAuth;
  retry: WebhookRetry;
}

export interface SFTPDelivery {
  connections: SFTPConnections;
  paths: SFTPPaths;
  security: SFTPSecurity;
}

export enum Granularity {
  SECOND = 'second',
  MINUTE = 'minute',
  HOUR = 'hour',
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month'
}

export interface AggregationFunction {
  name: string;
  implementation: (values: number[]) => number;
}

export interface TimeWindow {
  size: number;
  unit: TimeUnit;
  sliding: boolean;
}

export enum TimeUnit {
  SECONDS = 'seconds',
  MINUTES = 'minutes',
  HOURS = 'hours',
  DAYS = 'days'
}

export enum SamplingStrategy {
  RANDOM = 'random',
  SYSTEMATIC = 'systematic',
  STRATIFIED = 'stratified'
}

export interface SamplingFilters {
  include: string[];
  exclude: string[];
  conditions: SamplingCondition[];
}

export interface DatabaseConnection {
  host: string;
  port: number;
  database: string;
  credentials: DatabaseCredentials;
}

export interface DatabaseSchema {
  tables: TableDefinitions;
  indexes: IndexDefinitions;
  constraints: ConstraintDefinitions;
}

export interface DatabaseOptimizations {
  partitioning: PartitionOptimization;
  caching: CacheOptimization;
  compression: DataCompression;
}

export interface PrimaryIndexes {
  timeBased: TimeBasedIndexes;
  metricBased: MetricBasedIndexes;
}

export interface SecondaryIndexes {
  tagBased: TagBasedIndexes;
  composite: CompositeIndexDefinitions;
}

export interface CompositeIndexes {
  definitions: CompositeIndexDefinition[];
}

export interface RetentionRule {
  pattern: string;
  duration: number;
  action: RetentionAction;
}

export enum RetentionAction {
  DELETE = 'delete',
  ARCHIVE = 'archive',
  COMPRESS = 'compress'
}

export interface RetentionEnforcer {
  scheduler: RetentionScheduler;
  executor: RetentionExecutor;
}

export interface PartitionStrategy {
  timeBased: TimeBasedPartitioning;
  sizeBased: SizeBasedPartitioning;
}

export interface PartitionMaintenance {
  splitting: PartitionSplitting;
  merging: PartitionMerging;
}

export interface FluentBuilder {
  select(): FluentBuilder;
  where(condition: any): FluentBuilder;
  groupBy(fields: string[]): FluentBuilder;
  orderBy(fields: string[]): FluentBuilder;
  limit(count: number): FluentBuilder;
  build(): Query;
}

export interface SQLBuilder {
  buildQuery(query: QuerySpecification): string;
  validateQuery(sql: string): ValidationResult;
}

export interface JSONBuilder {
  buildQuery(spec: JSONQuerySpec): JSONQuery;
  optimizeQuery(query: JSONQuery): OptimizedQuery;
}

export interface ParallelExecutor {
  workers: number;
  distribution: QueryDistribution;
  coordination: ResultCoordination;
}

export interface DistributedExecutor {
  nodes: string[];
  routing: QueryRouting;
  aggregation: ResultAggregation;
}

export interface CacheExecutor {
  hitRatio: number;
  invalidation: CacheInvalidationStrategy;
}

export interface LRUCache {
  capacity: number;
  evictionPolicy: EvictionPolicy;
}

export interface TTLCache {
  defaultTTL: number;
  refreshStrategy: RefreshStrategy;
}

export interface CacheInvalidation {
  strategies: InvalidationStrategy[];
  triggers: InvalidationTrigger[];
}

export interface CostBasedOptimizer {
  costModel: CostModel;
  planEnumeration: PlanEnumeration;
}

export interface RuleBasedOptimizer {
  transformationRules: TransformationRule[];
  heuristics: OptimizationHeuristic[];
}

export interface LearningOptimizer {
  feedbackLoop: FeedbackLoop;
  adaptation: AdaptationStrategy;
}

export interface SlidingWindows {
  size: number;
  slide: number;
  alignment: WindowAlignment;
}

export interface AggregationFunctions {
  sum: SumFunction;
  avg: AverageFunction;
  min: MinFunction;
  max: MaxFunction;
  count: CountFunction;
  percentile: PercentileFunction;
}

export interface AggregationState {
  windows: WindowState[];
  functions: FunctionState[];
}

export interface BatchJobs {
  queue: JobQueue;
  scheduler: JobScheduler;
  monitor: JobMonitor;
}

export interface BatchScheduling {
  cron: CronScheduler;
  dependencies: DependencyScheduler;
}

export interface CheckpointManager {
  frequency: number;
  storage: CheckpointStorage;
}

export interface AggregationScripts {
  javascript: JavaScriptScripts;
  python: PythonScripts;
}

export interface AggregationPlugins {
  registry: PluginRegistry;
  loader: PluginLoader;
}

export interface LinearRegression {
  fit(data: DataPoint[]): RegressionModel;
  predict(model: RegressionModel, input: number[]): number;
}

export interface ExponentialSmoothing {
  alpha: number;
  fit(data: number[]): SmoothingModel;
  forecast(model: SmoothingModel, steps: number): number[];
}

export interface ARIMAModel {
  p: number;
  d: number;
  q: number;
  fit(data: number[]): ARIMAModel;
  forecast(steps: number): number[];
}

export interface FourierAnalysis {
  frequencies: number[];
  analyze(data: number[]): FrequencyComponents;
}

export interface STLDecomposition {
  seasonal: number;
  trend: number;
  residual: number;
  decompose(data: number[]): DecomposedSeries;
}

export interface AutocorrelationAnalysis {
  lags: number;
  compute(data: number[]): number[];
}

export interface ConfidenceIntervals {
  level: number;
  calculate(predictions: number[], errors: number[]): Interval[];
}

export interface ScenarioAnalysis {
  scenarios: Scenario[];
  runAnalysis(data: any): ScenarioResult[];
}

export interface SensitivityAnalysis {
  parameters: string[];
  ranges: ParameterRange[];
  analyze(): SensitivityResult[];
}

export interface LSTMNetwork {
  layers: number;
  units: number;
  train(data: DataPoint[][]): LSTMModel;
  predict(model: LSTMModel, input: number[]): number;
}

export interface ConvolutionalNetwork {
  layers: ConvolutionalLayer[];
  train(data: DataPoint[][]): CNNModel;
  predict(model: CNNModel, input: number[]): number;
}

export interface TransformerModel {
  heads: number;
  layers: number;
  train(data: DataPoint[][]): TransformerModel;
  predict(model: TransformerModel, input: number[]): number;
}

export interface RandomForest {
  trees: number;
  maxDepth: number;
  train(data: DataPoint[]): RandomForestModel;
  predict(model: RandomForestModel, input: number[]): number;
}

export interface GradientBoosting {
  estimators: number;
  learningRate: number;
  train(data: DataPoint[]): GBModel;
  predict(model: GBModel, input: number[]): number;
}

export interface StackingEnsemble {
  baseModels: Model[];
  metaModel: Model;
  train(data: DataPoint[]): StackingModel;
  predict(model: StackingModel, input: number[]): number;
}

export interface ForecastingModels {
  statistical: StatisticalModels;
  machineLearning: MLModels;
}

export interface AccuracyMetrics {
  mae: number;
  rmse: number;
  mape: number;
  calculate(actual: number[], predicted: number[]): AccuracyMetrics;
}

export interface UncertaintyQuantification {
  intervals: ConfidenceIntervals;
  scenarios: ScenarioAnalysis;
}

export interface MonteCarloSimulation {
  iterations: number;
  run(model: any, inputs: any[]): SimulationResult;
}

export interface BootstrapAnalysis {
  samples: number;
  confidence: number;
  resample(data: number[]): BootstrapResult;
}

export interface BayesianEstimation {
  prior: Distribution;
  likelihood: LikelihoodFunction;
  posterior: PosteriorDistribution;
}

export interface ZScoreDetection {
  threshold: number;
  detect(data: number[]): Anomaly[];
}

export interface IQROutlierDetection {
  multiplier: number;
  detect(data: number[]): Anomaly[];
}

export interface MedianAbsoluteDeviation {
  threshold: number;
  detect(data: number[]): Anomaly[];
}

export interface IsolationForest {
  trees: number;
  contamination: number;
  train(data: DataPoint[]): IFModel;
  predict(model: IFModel, input: number[]): number;
}

export interface AutoencoderNetwork {
  encodingDim: number;
  train(data: DataPoint[]): AutoencoderModel;
  reconstruct(model: AutoencoderModel, input: number[]): number[];
}

export interface OneClassSVM {
  kernel: string;
  nu: number;
  train(data: DataPoint[]): SVMModel;
  predict(model: SVMModel, input: number[]): number;
}

export interface StaticThresholds {
  upper: number;
  lower: number;
}

export interface DynamicThresholds {
  algorithm: DynamicAlgorithm;
  window: number;
}

export interface ContextualThresholds {
  context: ContextDefinition;
  rules: ThresholdRule[];
}

export interface ResourceOptimization {
  allocation: AllocationOptimizer;
  utilization: UtilizationAnalyzer;
}

export interface PerformanceOptimization {
  bottlenecks: BottleneckAnalyzer;
  improvements: ImprovementSuggester;
}

export interface CostOptimization {
  efficiency: EfficiencyAnalyzer;
  tradeoffs: TradeoffAnalyzer;
}

export interface CapacityForecasting {
  models: ForecastingModels;
  scenarios: CapacityScenario[];
}

export interface ProvisioningStrategy {
  onDemand: OnDemandProvisioning;
  reserved: ReservedProvisioning;
}

export interface AutoScaling {
  policies: ScalingPolicy[];
  triggers: ScalingTrigger[];
}

export interface SensitivityTuning {
  falsePositives: FPMinimizer;
  falseNegatives: FNMinimizer;
}

export interface CoverageAnalysis {
  gapAnalysis: GapAnalyzer;
  overlapAnalysis: OverlapAnalyzer;
}

export interface AlertReduction {
  correlation: AlertCorrelator;
  deduplication: AlertDeduplicator;
}

export interface StaticThresholds {
  rules: ThresholdRule[];
}

export interface StaticConditions {
  logical: LogicalCondition[];
}

export interface AdaptiveRules {
  learning: AdaptiveLearning;
  feedback: FeedbackLoop;
}

export interface LearningRules {
  patterns: PatternLearning;
  adaptation: RuleAdaptation;
}

export interface RuleCombinations {
  and: ANDCombination;
  or: ORCombination;
  not: NOTCombination;
}

export interface RuleDependencies {
  prerequisites: RulePrerequisite[];
  conflicts: RuleConflict[];
}

export interface EmailChannel {
  smtp: SMTPConfig;
  templates: EmailTemplate[];
}

export interface SlackChannel {
  webhook: string;
  channels: SlackChannelConfig[];
}

export interface WebhookChannel {
  endpoints: WebhookEndpoint[];
  authentication: WebhookAuth;
}

export interface StandardTemplates {
  critical: CriticalAlertTemplate;
  warning: WarningAlertTemplate;
  info: InfoAlertTemplate;
}

export interface CustomTemplates {
  builder: TemplateBuilder;
  library: TemplateLibrary;
}

export interface LocalizedTemplates {
  languages: string[];
  translations: TranslationMap;
}

export interface ImmediateDelivery {
  queue: DeliveryQueue;
  retry: RetryPolicy;
}

export interface BatchedDelivery {
  batchSize: number;
  interval: number;
  aggregator: BatchAggregator;
}

export interface ThrottledDelivery {
  rateLimit: number;
  burstCapacity: number;
}

export interface TimeBasedEscalation {
  levels: EscalationLevel[];
  intervals: number[];
}

export interface SeverityBasedEscalation {
  mappings: SeverityEscalationMap;
}

export interface StakeholderEscalation {
  stakeholders: Stakeholder[];
  assignments: EscalationAssignment[];
}

export interface EscalationStages {
  stage1: EscalationStage;
  stage2: EscalationStage;
  stage3: EscalationStage;
}

export interface EscalationTimeouts {
  stage1: number;
  stage2: number;
  stage3: number;
}

export interface StakeholderMapping {
  alerts: AlertStakeholderMap;
  roles: RoleStakeholderMap;
}

export interface StakeholderPreferences {
  channels: StakeholderChannel[];
  schedules: StakeholderSchedule[];
}

export interface AdaptiveAlgorithms {
  ewma: ExponentiallyWeightedMovingAverage;
  kalman: KalmanFilter;
}

export interface LearningThresholds {
  reinforcement: ReinforcementLearning;
  supervised: SupervisedLearning;
}

export interface BaselineCalculation {
  methods: BaselineMethod[];
  periods: BaselinePeriod[];
}

export interface BaselineUpdates {
  frequency: UpdateFrequency;
  triggers: UpdateTrigger[];
}

export interface EnvironmentContext {
  factors: EnvironmentFactor[];
  weights: FactorWeight[];
}

export interface WorkloadContext {
  patterns: WorkloadPattern[];
  intensities: WorkloadIntensity[];
}

export interface JSONSchema {
  version: string;
  definitions: JSONDefinition[];
}

export interface JSONFormatting {
  pretty: boolean;
  indent: number;
}

export interface QuotingStrategy {
  always: boolean;
  whenNeeded: boolean;
}

export interface HeaderHandling {
  include: boolean;
  custom: string[];
}

export interface PDFTemplates {
  reports: ReportTemplate[];
  dashboards: DashboardTemplate[];
}

export interface ChartEmbedding {
  supported: ChartType[];
  renderer: ChartRenderer;
}

export interface PDFLayout {
  margins: MarginSettings;
  orientation: Orientation;
}

export interface WorksheetManager {
  sheets: WorksheetDefinition[];
  relationships: SheetRelationship[];
}

export interface ExcelFormatting {
  styles: CellStyle[];
  conditional: ConditionalFormatting[];
}

export interface FormulaSupport {
  functions: ExcelFunction[];
  calculation: CalculationEngine;
}

export interface ExportSchedules {
  daily: DailySchedule;
  weekly: WeeklySchedule;
  monthly: MonthlySchedule;
}

export interface ExportAutomation {
  triggers: AutomationTrigger[];
  conditions: AutomationCondition[];
}

export interface EventTriggers {
  events: ExportEvent[];
  handlers: EventHandler[];
}

export interface ExportConditions {
  metrics: MetricCondition[];
  thresholds: ThresholdCondition[];
}

export interface PriorityQueue {
  items: QueuedExport[];
  comparator: ExportComparator;
}

export interface ExportConcurrency {
  maxConcurrent: number;
  queue: ExportQueue;
}

export interface ExecutiveReports {
  summary: SummaryReport;
  trends: TrendReport;
  kpis: KPIReport;
}

export interface TechnicalReports {
  metrics: MetricsReport;
  performance: PerformanceReport;
  anomalies: AnomalyReport;
}

export interface OperationalReports {
  status: StatusReport;
  incidents: IncidentReport;
  capacity: CapacityReport;
}

export interface TemplateBuilder {
  components: TemplateComponent[];
  assembler: TemplateAssembler;
}

export interface TemplateLibrary {
  templates: ReportTemplate[];
  categories: TemplateCategory[];
}

export interface TemplateVariables {
  global: GlobalVariable[];
  local: LocalVariable[];
}

export interface TemplateLogic {
  conditions: LogicCondition[];
  loops: LogicLoop[];
}

export interface SMTPConfiguration {
  host: string;
  port: number;
  secure: boolean;
  auth: SMTPAuth;
}

export interface EmailTemplates {
  html: HTMLTemplate;
  text: TextTemplate;
}

export interface AttachmentHandling {
  maxSize: number;
  types: string[];
  compression: boolean;
}

export interface WebhookEndpoints {
  urls: string[];
  methods: HTTPMethod[];
}

export interface WebhookAuth {
  type: AuthType;
  credentials: AuthCredentials;
}

export interface WebhookRetry {
  attempts: number;
  backoff: BackoffStrategy;
}

export interface SFTPConnections {
  servers: SFTPServer[];
  credentials: SFTPCredentials;
}

export interface SFTPPaths {
  remote: string;
  local: string;
}

export interface SFTPSecurity {
  encryption: EncryptionType;
  keyExchange: KeyExchangeAlgorithm;
}

export interface SamplingCondition {
  field: string;
  operator: string;
  value: any;
}

export interface TableDefinitions {
  metrics: TableDefinition;
  tags: TableDefinition;
  aggregations: TableDefinition;
}

export interface IndexDefinitions {
  primary: IndexDefinition[];
  secondary: IndexDefinition[];
}

export interface ConstraintDefinitions {
  foreignKeys: ForeignKeyDefinition[];
  unique: UniqueConstraintDefinition[];
}

export interface PartitionOptimization {
  strategies: PartitionStrategy[];
  maintenance: MaintenanceSchedule;
}

export interface CacheOptimization {
  policies: CachePolicy[];
  eviction: EvictionStrategy[];
}

export interface DataCompression {
  algorithms: CompressionAlgorithm[];
  levels: CompressionLevel[];
}

export interface TimeBasedIndexes {
  definitions: IndexDefinition[];
}

export interface MetricBasedIndexes {
  definitions: IndexDefinition[];
}

export interface TagBasedIndexes {
  definitions: IndexDefinition[];
}

export interface CompositeIndexDefinitions {
  definitions: CompositeIndexDefinition[];
}

export interface CompositeIndexDefinition {
  fields: string[];
  type: IndexType;
}

export interface TimeBasedPartitioning {
  interval: string;
  retention: number;
}

export interface SizeBasedPartitioning {
  maxSize: number;
  growthFactor: number;
}

export interface PartitionSplitting {
  threshold: number;
  strategy: SplittingStrategy;
}

export interface PartitionMerging {
  threshold: number;
  strategy: MergingStrategy;
}

export interface Query {
  select: string[];
  from: string;
  where: any;
  groupBy: string[];
  orderBy: string[];
  limit: number;
}

export interface QuerySpecification {
  select: SelectClause;
  from: FromClause;
  where: WhereClause;
  groupBy: GroupByClause;
  orderBy: OrderByClause;
  limit: LimitClause;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface JSONQuerySpec {
  collection: string;
  filter: any;
  projection: any;
  sort: any;
  limit: number;
}

export interface JSONQuery {
  collection: string;
  pipeline: any[];
}

export interface OptimizedQuery {
  original: JSONQuery;
  optimized: JSONQuery;
  improvements: QueryImprovement[];
}

export interface EvictionPolicy {
  algorithm: EvictionAlgorithm;
  parameters: EvictionParameter[];
}

export interface RefreshStrategy {
  interval: number;
  triggers: RefreshTrigger[];
}

export interface InvalidationStrategy {
  type: InvalidationType;
  scope: InvalidationScope;
}

export interface InvalidationTrigger {
  event: string;
  action: InvalidationAction;
}

export interface CostModel {
  cpuCost: number;
  ioCost: number;
  memoryCost: number;
}

export interface PlanEnumeration {
  strategies: EnumerationStrategy[];
  limits: EnumerationLimit[];
}

export interface TransformationRule {
  pattern: string;
  replacement: string;
  conditions: RuleCondition[];
}

export interface OptimizationHeuristic {
  name: string;
  weight: number;
  application: HeuristicApplication;
}

export interface FeedbackLoop {
  metrics: FeedbackMetric[];
  adaptation: AdaptationRule[];
}

export interface AdaptationStrategy {
  triggers: AdaptationTrigger[];
  actions: AdaptationAction[];
}

export interface WindowAlignment {
  type: AlignmentType;
  offset: number;
}

export interface SumFunction {
  precision: number;
  overflow: OverflowHandling;
}

export interface AverageFunction {
  precision: number;
  nullHandling: NullHandling;
}

export interface MinFunction {
  type: DataType;
}

export interface MaxFunction {
  type: DataType;
}

export interface CountFunction {
  distinct: boolean;
  nullHandling: NullHandling;
}

export interface PercentileFunction {
  percentile: number;
  algorithm: PercentileAlgorithm;
}

export interface WindowState {
  id: string;
  start: number;
  end: number;
  values: number[];
}

export interface FunctionState {
  name: string;
  state: any;
}

export interface JobQueue {
  jobs: BatchJob[];
  priority: JobPriority;
}

export interface JobScheduler {
  cron: string;
  timezone: string;
}

export interface JobMonitor {
  status: JobStatus[];
  progress: JobProgress[];
}

export interface CronScheduler {
  expressions: CronExpression[];
}

export interface DependencyScheduler {
  dependencies: JobDependency[];
}

export interface CheckpointStorage {
  location: string;
  format: CheckpointFormat;
}

export interface JavaScriptScripts {
  functions: JSScriptFunction[];
}

export interface PythonScripts {
  functions: PythonScriptFunction[];
}

export interface PluginRegistry {
  plugins: AggregationPlugin[];
}

export interface PluginLoader {
  paths: string[];
  dependencies: PluginDependency[];
}

export interface RegressionModel {
  coefficients: number[];
  intercept: number;
  rSquared: number;
}

export interface DataPoint {
  x: number[];
  y: number;
}

export interface SmoothingModel {
  alpha: number;
  level: number[];
}

export interface FrequencyComponents {
  frequencies: number[];
  amplitudes: number[];
  phases: number[];
}

export interface DecomposedSeries {
  seasonal: number[];
  trend: number[];
  residual: number[];
}

export interface Interval {
  lower: number;
  upper: number;
  confidence: number;
}

export interface Scenario {
  name: string;
  parameters: ScenarioParameter[];
}

export interface ScenarioResult {
  scenario: Scenario;
  result: any;
}

export interface ParameterRange {
  parameter: string;
  min: number;
  max: number;
  steps: number;
}

export interface SensitivityResult {
  parameter: string;
  impact: number[];
  sensitivity: number;
}

export interface ConvolutionalLayer {
  filters: number;
  kernelSize: number;
  activation: string;
}

export interface LSTMModel {
  weights: any;
  biases: any;
}

export interface CNNModel {
  layers: ConvolutionalLayer[];
  dense: any;
}

export interface TransformerModel {
  encoder: any;
  decoder: any;
}

export interface RandomForestModel {
  trees: any[];
}

export interface GBModel {
  estimators: any[];
}

export interface StackingModel {
  baseModels: any[];
  metaModel: any;
}

export interface Model {
  predict(input: number[]): number;
}

export interface StatisticalModels {
  arima: ARIMAModel;
  exponential: ExponentialSmoothing;
}

export interface MLModels {
  neural: NeuralNetworkModels;
  ensemble: EnsembleModels;
}

export interface SimulationResult {
  values: number[];
  statistics: SimulationStatistics;
}

export interface BootstrapResult {
  estimates: number[];
  confidenceInterval: Interval;
}

export interface Distribution {
  type: string;
  parameters: any;
}

export interface LikelihoodFunction {
  evaluate(data: number[], parameters: any): number;
}

export interface PosteriorDistribution {
  samples: number[];
  statistics: DistributionStatistics;
}

export interface Anomaly {
  index: number;
  value: number;
  score: number;
  severity: AnomalySeverity;
}

export enum AnomalySeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface IFModel {
  trees: any[];
}

export interface AutoencoderModel {
  encoder: any;
  decoder: any;
}

export interface SVMModel {
  supportVectors: number[][];
  weights: number[];
}

export interface DynamicAlgorithm {
  type: string;
  parameters: any;
}

export interface ContextDefinition {
  dimensions: string[];
  rules: ThresholdRule[];
}

export interface ThresholdRule {
  condition: string;
  threshold: number;
  action: string;
}

export interface AllocationOptimizer {
  algorithms: AllocationAlgorithm[];
}

export interface UtilizationAnalyzer {
  metrics: UtilizationMetric[];
}

export interface BottleneckAnalyzer {
  algorithms: BottleneckAlgorithm[];
}

export interface ImprovementSuggester {
  strategies: ImprovementStrategy[];
}

export interface EfficiencyAnalyzer {
  metrics: EfficiencyMetric[];
}

export interface TradeoffAnalyzer {
  dimensions: string[];
}

export interface CapacityScenario {
  name: string;
  growth: number;
  duration: number;
}

export interface OnDemandProvisioning {
  thresholds: ProvisioningThreshold[];
}

export interface ReservedProvisioning {
  commitments: ReservationCommitment[];
}

export interface ScalingPolicy {
  metric: string;
  threshold: number;
  action: ScalingAction;
}

export interface ScalingTrigger {
  event: string;
  condition: string;
}

export interface FPMinimizer {
  techniques: MinimizationTechnique[];
}

export interface FNMinimizer {
  techniques: MinimizationTechnique[];
}

export interface GapAnalyzer {
  algorithms: GapAnalysisAlgorithm[];
}

export interface OverlapAnalyzer {
  algorithms: OverlapAnalysisAlgorithm[];
}

export interface AlertCorrelator {
  algorithms: CorrelationAlgorithm[];
}

export interface AlertDeduplicator {
  rules: DeduplicationRule[];
}

export interface ThresholdRule {
  metric: string;
  operator: string;
  value: number;
}

export interface LogicalCondition {
  left: Condition;
  operator: LogicalOperator;
  right: Condition;
}

export interface AdaptiveLearning {
  algorithms: LearningAlgorithm[];
}

export interface FeedbackLoop {
  metrics: FeedbackMetric[];
}

export interface PatternLearning {
  algorithms: PatternAlgorithm[];
}

export interface RuleAdaptation {
  triggers: AdaptationTrigger[];
}

export interface ANDCombination {
  rules: string[];
}

export interface ORCombination {
  rules: string[];
}

export interface NOTCombination {
  rule: string;
}

export interface RulePrerequisite {
  rule: string;
  requires: string[];
}

export interface RuleConflict {
  rule1: string;
  rule2: string;
  resolution: ConflictResolution;
}

export interface SMTPConfig {
  server: string;
  port: number;
  secure: boolean;
}

export interface EmailTemplate {
  subject: string;
  body: string;
}

export interface SlackChannelConfig {
  name: string;
  webhook: string;
}

export interface WebhookEndpoint {
  url: string;
  method: string;
}

export interface CriticalAlertTemplate {
  subject: string;
  body: string;
}

export interface WarningAlertTemplate {
  subject: string;
  body: string;
}

export interface InfoAlertTemplate {
  subject: string;
  body: string;
}

export interface TemplateLibrary {
  categories: TemplateCategory[];
}

export interface TranslationMap {
  language: Record<string, string>;
}

export interface DeliveryQueue {
  items: DeliveryItem[];
}

export interface RetryPolicy {
  attempts: number;
  backoff: BackoffStrategy;
}

export interface BatchAggregator {
  rules: AggregationRule[];
}

export interface EscalationLevel {
  name: string;
  stakeholders: string[];
}

export interface SeverityEscalationMap {
  critical: EscalationLevel;
  high: EscalationLevel;
  medium: EscalationLevel;
  low: EscalationLevel;
}

export interface Stakeholder {
  id: string;
  name: string;
  contact: ContactInfo;
}

export interface EscalationAssignment {
  alertType: string;
  stakeholders: string[];
}

export interface EscalationStage {
  timeout: number;
  actions: EscalationAction[];
}

export interface AlertStakeholderMap {
  alertType: string;
  stakeholders: string[];
}

export interface RoleStakeholderMap {
  role: string;
  stakeholders: string[];
}

export interface StakeholderChannel {
  stakeholder: string;
  channels: string[];
}

export interface StakeholderSchedule {
  stakeholder: string;
  availability: AvailabilityWindow[];
}

export interface ExponentiallyWeightedMovingAverage {
  alpha: number;
  adjust: boolean;
}

export interface KalmanFilter {
  processNoise: number;
  measurementNoise: number;
}

export interface ReinforcementLearning {
  algorithm: RLAlgorithm;
  reward: RewardFunction;
}

export interface SupervisedLearning {
  algorithm: SLAlgorithm;
  features: FeatureDefinition[];
}

export interface BaselineMethod {
  algorithm: BaselineAlgorithm;
  parameters: any;
}

export interface BaselinePeriod {
  start: number;
  end: number;
  weight: number;
}

export interface UpdateFrequency {
  interval: number;
  unit: TimeUnit;
}

export interface UpdateTrigger {
  event: string;
  condition: string;
}

export interface EnvironmentFactor {
  name: string;
  value: any;
  weight: number;
}

export interface FactorWeight {
  factor: string;
  weight: number;
}

export interface WorkloadPattern {
  type: string;
  frequency: number;
  intensity: number;
}

export interface WorkloadIntensity {
  level: string;
  threshold: number;
  duration: number;
}

export interface JSONDefinition {
  name: string;
  type: string;
  properties: any;
}

export interface ReportTemplate {
  name: string;
  sections: ReportSection[];
}

export interface DashboardTemplate {
  name: string;
  widgets: DashboardWidget[];
}

export interface ChartType {
  name: string;
  renderer: ChartRenderer;
}

export interface ChartRenderer {
  render(data: any): string;
}

export interface MarginSettings {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export enum Orientation {
  PORTRAIT = 'portrait',
  LANDSCAPE = 'landscape'
}

export interface WorksheetDefinition {
  name: string;
  columns: ColumnDefinition[];
}

export interface SheetRelationship {
  from: string;
  to: string;
  type: RelationshipType;
}

export interface CellStyle {
  name: string;
  properties: StyleProperty[];
}

export interface ConditionalFormatting {
  rule: FormattingRule;
  style: CellStyle;
}

export interface ExcelFunction {
  name: string;
  implementation: FunctionImplementation;
}

export interface CalculationEngine {
  functions: ExcelFunction[];
  dependencies: FunctionDependency[];
}

export interface DailySchedule {
  time: string;
  timezone: string;
}

export interface WeeklySchedule {
  dayOfWeek: number;
  time: string;
}

export interface MonthlySchedule {
  dayOfMonth: number;
  time: string;
}

export interface AutomationTrigger {
  event: string;
  condition: string;
}

export interface AutomationCondition {
  metric: string;
  operator: string;
  value: number;
}

export interface ExportEvent {
  type: string;
  data: any;
}

export interface EventHandler {
  event: string;
  action: string;
}

export interface MetricCondition {
  metric: string;
  operator: string;
  value: number;
}

export interface ThresholdCondition {
  threshold: string;
  operator: string;
  value: number;
}

export interface QueuedExport {
  id: string;
  type: string;
  priority: Priority;
}

export interface ExportComparator {
  compare(a: QueuedExport, b: QueuedExport): number;
}

export interface ExportQueue {
  items: QueuedExport[];
}

export interface SummaryReport {
  metrics: string[];
  charts: string[];
}

export interface TrendReport {
  periods: string[];
  metrics: string[];
}

export interface KPIReport {
  indicators: string[];
  targets: KPITarget[];
}

export interface MetricsReport {
  metrics: string[];
  aggregations: string[];
}

export interface PerformanceReport {
  benchmarks: string[];
  comparisons: string[];
}

export interface AnomalyReport {
  detections: string[];
  analysis: string[];
}

export interface StatusReport {
  components: string[];
  health: string[];
}

export interface IncidentReport {
  incidents: string[];
  resolution: string[];
}

export interface CapacityReport {
  utilization: string[];
  projections: string[];
}

export interface TemplateComponent {
  type: string;
  properties: any;
}

export interface TemplateAssembler {
  assemble(components: TemplateComponent[]): ReportTemplate;
}

export interface TemplateCategory {
  name: string;
  templates: ReportTemplate[];
}

export interface GlobalVariable {
  name: string;
  value: any;
}

export interface LocalVariable {
  name: string;
  value: any;
}

export interface LogicCondition {
  variable: string;
  operator: string;
  value: any;
}

export interface LogicLoop {
  variable: string;
  items: any[];
}

export interface SMTPAuth {
  user: string;
  pass: string;
}

export interface HTMLTemplate {
  content: string;
}

export interface TextTemplate {
  content: string;
}

export interface HTTPMethod {
  name: string;
}

export enum AuthType {
  BASIC = 'basic',
  BEARER = 'bearer',
  API_KEY = 'api_key'
}

export interface AuthCredentials {
  username?: string;
  password?: string;
  token?: string;
  key?: string;
}

export interface BackoffStrategy {
  type: string;
  initialDelay: number;
  maxDelay: number;
}

export interface SFTPServer {
  host: string;
  port: number;
}

export interface SFTPCredentials {
  username: string;
  password?: string;
  key?: string;
}

export enum EncryptionType {
  AES256 = 'aes256',
  AES128 = 'aes128'
}

export enum KeyExchangeAlgorithm {
  ECDH = 'ecdh',
  DH = 'dh'
}

export interface SelectClause {
  fields: string[];
}

export interface FromClause {
  table: string;
}

export interface WhereClause {
  conditions: any[];
}

export interface GroupByClause {
  fields: string[];
}

export interface OrderByClause {
  fields: string[];
  direction: string;
}

export interface LimitClause {
  count: number;
}

export interface ValidationError {
  message: string;
  position: number;
}

export interface QueryImprovement {
  type: string;
  description: string;
  benefit: number;
}

export interface EvictionParameter {
  name: string;
  value: any;
}

export interface RefreshTrigger {
  event: string;
  condition: string;
}

export enum InvalidationType {
  IMMEDIATE = 'immediate',
  DELAYED = 'delayed'
}

export enum InvalidationScope {
  SINGLE = 'single',
  ALL = 'all'
}

export enum InvalidationAction {
  INVALIDATE = 'invalidate',
  REFRESH = 'refresh'
}

export interface EnumerationStrategy {
  name: string;
  cost: number;
}

export interface EnumerationLimit {
  type: string;
  value: number;
}

export interface RuleCondition {
  type: string;
  value: any;
}

export interface HeuristicApplication {
  conditions: string[];
}

export interface FeedbackMetric {
  name: string;
  value: number;
}

export interface AdaptationRule {
  condition: string;
  action: string;
}

export interface AdaptationTrigger {
  metric: string;
  threshold: number;
}

export interface AdaptationAction {
  type: string;
  parameters: any;
}

export enum AlignmentType {
  START = 'start',
  END = 'end',
  CENTER = 'center'
}

export enum DataType {
  NUMBER = 'number',
  STRING = 'string',
  DATE = 'date'
}

export enum OverflowHandling {
  WRAP = 'wrap',
  CLAMP = 'clamp',
  ERROR = 'error'
}

export enum NullHandling {
  IGNORE = 'ignore',
  ZERO = 'zero',
  AVERAGE = 'average'
}

export enum PercentileAlgorithm {
  NEAREST = 'nearest',
  LINEAR = 'linear'
}

export interface BatchJob {
  id: string;
  name: string;
  status: JobStatus;
}

export enum JobStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export interface JobProgress {
  jobId: string;
  completed: number;
  total: number;
}

export interface CronExpression {
  expression: string;
}

export interface JobDependency {
  jobId: string;
  dependsOn: string[];
}

export enum CheckpointFormat {
  JSON = 'json',
  BINARY = 'binary'
}

export interface JSScriptFunction {
  name: string;
  code: string;
}

export interface PythonScriptFunction {
  name: string;
  code: string;
}

export interface AggregationPlugin {
  name: string;
  version: string;
  functions: string[];
}

export interface PluginDependency {
  name: string;
  version: string;
}

export interface SimulationStatistics {
  mean: number;
  std: number;
  min: number;
  max: number;
}

export interface DistributionStatistics {
  mean: number;
  variance: number;
  quantiles: number[];
}

export interface AllocationAlgorithm {
  name: string;
  efficiency: number;
}

export interface UtilizationMetric {
  name: string;
  formula: string;
}

export interface BottleneckAlgorithm {
  name: string;
  sensitivity: number;
}

export interface ImprovementStrategy {
  name: string;
  impact: number;
}

export interface EfficiencyMetric {
  name: string;
  baseline: number;
}

export interface ProvisioningThreshold {
  metric: string;
  value: number;
}

export interface ReservationCommitment {
  resource: string;
  amount: number;
  duration: number;
}

export interface ScalingAction {
  type: string;
  parameters: any;
}

export interface MinimizationTechnique {
  name: string;
  effectiveness: number;
}

export interface GapAnalysisAlgorithm {
  name: string;
  coverage: number;
}

export interface OverlapAnalysisAlgorithm {
  name: string;
  precision: number;
}

export interface CorrelationAlgorithm {
  name: string;
  threshold: number;
}

export interface DeduplicationRule {
  pattern: string;
  window: number;
}

export interface Condition {
  type: string;
  value: any;
}

export enum LogicalOperator {
  AND = 'and',
  OR = 'or',
  NOT = 'not'
}

export interface LearningAlgorithm {
  name: string;
  parameters: any;
}

export interface PatternAlgorithm {
  name: string;
  threshold: number;
}

export interface ConflictResolution {
  strategy: string;
  priority: number;
}

export interface ContactInfo {
  email: string;
  phone: string;
  slack: string;
}

export interface EscalationAction {
  type: string;
  target: string;
  message: string;
}

export interface AvailabilityWindow {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface RLAlgorithm {
  type: string;
  parameters: any;
}

export interface SLAlgorithm {
  type: string;
  parameters: any;
}

export interface FeatureDefinition {
  name: string;
  type: string;
}

export enum BaselineAlgorithm {
  MEAN = 'mean',
  MEDIAN = 'median',
  PERCENTILE = 'percentile'
}

export interface ColumnDefinition {
  name: string;
  type: string;
  width: number;
}

export enum RelationshipType {
  LINK = 'link',
  REFERENCE = 'reference'
}

export interface StyleProperty {
  name: string;
  value: any;
}

export interface FormattingRule {
  condition: string;
  style: string;
}

export interface FunctionImplementation {
  signature: string;
  body: string;
}

export interface FunctionDependency {
  function: string;
  dependencies: string[];
}

export interface KPITarget {
  metric: string;
  target: number;
  tolerance: number;
}

export interface ReportSection {
  title: string;
  content: any;
}

export interface DashboardWidget {
  type: string;
  config: any;
}

export interface DeliveryItem {
  id: string;
  type: string;
  content: any;
}

export interface AggregationRule {
  pattern: string;
  action: string;
}
