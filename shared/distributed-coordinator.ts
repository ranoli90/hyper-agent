import { TestCase, TestResult, ResourceAllocation } from './test-isolation';

export interface DistributedCoordinator {
  nodeCluster: NodeCluster;
  loadBalancer: IntelligentLoadBalancer;
  faultDetector: FaultDetector;
  resultAggregator: ResultAggregator;
}

export interface NodeCluster {
  nodes: WorkerNode[];
  coordinator: ClusterCoordinator;
  discovery: ServiceDiscovery;
  health: ClusterHealth;
}

export interface WorkerNode {
  id: string;
  hostname: string;
  capabilities: NodeCapabilities;
  status: NodeStatus;
  lastHeartbeat: number;
  activeTests: string[];
  resourceUsage: ResourceAllocation;
}

export enum NodeStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  MAINTENANCE = 'maintenance',
  OVERLOADED = 'overloaded',
  FAILED = 'failed'
}

export interface NodeCapabilities {
  cpu: number;
  memory: number;
  network: number;
  storage: number;
  supportedBrowsers: string[];
  supportedOS: string[];
  maxConcurrentTests: number;
  specialHardware: string[];
}

export interface ClusterCoordinator {
  id: string;
  address: string;
  status: CoordinatorStatus;
  leadership: LeadershipInfo;
}

export enum CoordinatorStatus {
  ACTIVE = 'active',
  STANDBY = 'standby',
  FAILING = 'failing'
}

export interface LeadershipInfo {
  leaderId: string;
  term: number;
  lastElection: number;
}

export interface ServiceDiscovery {
  registry: NodeRegistry;
  heartbeat: HeartbeatManager;
  failure: FailureDetector;
}

export interface NodeRegistry {
  nodes: Map<string, WorkerNode>;
  addNode(node: WorkerNode): void;
  removeNode(nodeId: string): void;
  getNode(nodeId: string): WorkerNode | undefined;
  getAllNodes(): WorkerNode[];
  getActiveNodes(): WorkerNode[];
}

export interface HeartbeatManager {
  interval: number;
  timeout: number;
  sendHeartbeat(node: WorkerNode): Promise<void>;
  handleHeartbeat(nodeId: string, heartbeat: Heartbeat): void;
}

export interface Heartbeat {
  nodeId: string;
  timestamp: number;
  status: NodeStatus;
  resourceUsage: ResourceAllocation;
  activeTests: number;
}

export interface FailureDetector {
  phiAccrual: PhiAccrualFailureDetector;
  gossip: GossipFailureDetector;
  detectFailures(): FailureEvent[];
}

export interface PhiAccrualFailureDetector {
  suspicionThreshold: number;
  calculateSuspicion(nodeId: string): number;
}

export interface GossipFailureDetector {
  protocol: GossipProtocol;
  disseminateFailure(failure: FailureEvent): void;
}

export interface FailureEvent {
  nodeId: string;
  type: FailureType;
  timestamp: number;
  reason: string;
}

export enum FailureType {
  NETWORK_PARTITION = 'network_partition',
  NODE_CRASH = 'node_crash',
  HEARTBEAT_TIMEOUT = 'heartbeat_timeout',
  RESOURCE_EXHAUSTION = 'resource_exhaustion'
}

export interface ClusterHealth {
  overall: HealthStatus;
  nodeHealth: Map<string, HealthStatus>;
  metrics: ClusterMetrics;
}

export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy'
}

export interface ClusterMetrics {
  totalNodes: number;
  activeNodes: number;
  failedNodes: number;
  averageLoad: number;
  networkLatency: number;
  testThroughput: number;
}

export interface IntelligentLoadBalancer {
  strategy: LoadBalancingStrategy;
  monitor: LoadMonitor;
  optimizer: LoadOptimizer;
}

export interface LoadBalancingStrategy {
  algorithm: BalancingAlgorithm;
  parameters: BalancingParameters;
  distributeLoad(tests: TestCase[], nodes: WorkerNode[]): LoadDistribution;
}

export enum BalancingAlgorithm {
  ROUND_ROBIN = 'round_robin',
  LEAST_CONNECTIONS = 'least_connections',
  RESOURCE_BASED = 'resource_based',
  CAPABILITY_BASED = 'capability_based',
  PREDICTIVE = 'predictive'
}

export interface BalancingParameters {
  weightByCPU: boolean;
  weightByMemory: boolean;
  considerNetworkLatency: boolean;
  maxLoadPerNode: number;
  failoverThreshold: number;
}

export interface LoadDistribution {
  assignments: TestAssignment[];
  efficiency: number;
  estimatedCompletion: number;
}

export interface TestAssignment {
  testId: string;
  nodeId: string;
  priority: number;
  estimatedDuration: number;
  resourceRequirements: ResourceAllocation;
}

export interface LoadMonitor {
  trackNodeLoad(nodeId: string, metrics: LoadMetrics): void;
  getNodeLoad(nodeId: string): LoadMetrics;
  detectImbalance(): LoadImbalance[];
}

export interface LoadMetrics {
  cpuUsage: number;
  memoryUsage: number;
  networkUsage: number;
  activeTests: number;
  queueLength: number;
  responseTime: number;
}

export interface LoadImbalance {
  nodeId: string;
  severity: ImbalanceSeverity;
  suggestedActions: LoadBalancingAction[];
}

export enum ImbalanceSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface LoadBalancingAction {
  type: ActionType;
  targetNode?: string;
  parameters: any;
}

export enum ActionType {
  REDISTRIBUTE_TESTS = 'redistribute_tests',
  SCALE_UP_NODE = 'scale_up_node',
  SCALE_DOWN_NODE = 'scale_down_node',
  FAILOVER = 'failover'
}

export interface LoadOptimizer {
  analyzePerformance(history: LoadHistory[]): OptimizationRecommendation[];
  predictOptimalDistribution(futureLoad: LoadPrediction): OptimalDistribution;
}

export interface LoadHistory {
  timestamp: number;
  nodeLoads: Map<string, LoadMetrics>;
  distribution: LoadDistribution;
}

export interface LoadPrediction {
  timeframe: number;
  expectedTests: number;
  resourceRequirements: ResourceAllocation;
}

export interface OptimizationRecommendation {
  type: OptimizationType;
  description: string;
  expectedImprovement: number;
  priority: RecommendationPriority;
}

export enum OptimizationType {
  REBALANCE_LOAD = 'rebalance_load',
  ADD_NODES = 'add_nodes',
  REMOVE_NODES = 'remove_nodes',
  OPTIMIZE_SCHEDULING = 'optimize_scheduling'
}

export enum RecommendationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface OptimalDistribution {
  nodeAllocations: Map<string, ResourceAllocation>;
  expectedEfficiency: number;
}

export interface FaultDetector {
  detection: FailureDetection;
  recovery: FaultRecovery;
  monitoring: FaultMonitoring;
}

export interface FailureDetection {
  detectNetworkPartition(): NetworkPartitionEvent[];
  detectNodeFailure(): NodeFailureEvent[];
  detectResourceExhaustion(): ResourceExhaustionEvent[];
}

export interface NetworkPartitionEvent {
  affectedNodes: string[];
  partitionId: string;
  timestamp: number;
}

export interface NodeFailureEvent {
  nodeId: string;
  failureType: FailureType;
  timestamp: number;
  recoverable: boolean;
}

export interface ResourceExhaustionEvent {
  nodeId: string;
  resourceType: string;
  threshold: number;
  currentUsage: number;
  timestamp: number;
}

export interface FaultRecovery {
  handleNetworkPartition(partition: NetworkPartitionEvent): RecoveryAction[];
  handleNodeFailure(failure: NodeFailureEvent): RecoveryAction[];
  handleResourceExhaustion(exhaustion: ResourceExhaustionEvent): RecoveryAction[];
}

export interface RecoveryAction {
  type: RecoveryType;
  targetNode?: string;
  parameters: any;
  priority: RecoveryPriority;
}

export enum RecoveryType {
  RESTART_NODE = 'restart_node',
  MIGRATE_TESTS = 'migrate_tests',
  REDISTRIBUTE_LOAD = 'redistribute_load',
  SCALE_RESOURCES = 'scale_resources',
  ISOLATE_NODE = 'isolate_node'
}

export enum RecoveryPriority {
  IMMEDIATE = 'immediate',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

export interface FaultMonitoring {
  trackRecoveryActions(actions: RecoveryAction[]): void;
  monitorRecoveryProgress(actionId: string): RecoveryProgress;
  generateFailureReports(): FailureReport[];
}

export interface RecoveryProgress {
  actionId: string;
  status: RecoveryStatus;
  progress: number;
  estimatedCompletion: number;
  issues: RecoveryIssue[];
}

export enum RecoveryStatus {
  INITIATED = 'initiated',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  ROLLED_BACK = 'rolled_back'
}

export interface RecoveryIssue {
  type: IssueType;
  description: string;
  severity: IssueSeverity;
  timestamp: number;
}

export enum IssueType {
  TIMEOUT = 'timeout',
  DEPENDENCY_FAILURE = 'dependency_failure',
  RESOURCE_UNAVAILABLE = 'resource_unavailable',
  CONFIGURATION_ERROR = 'configuration_error'
}

export enum IssueSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface FailureReport {
  period: TimeRange;
  totalFailures: number;
  failureBreakdown: Map<FailureType, number>;
  recoverySuccessRate: number;
  averageRecoveryTime: number;
  topFailureCauses: FailureCause[];
}

export interface TimeRange {
  start: number;
  end: number;
}

export interface FailureCause {
  type: FailureType;
  frequency: number;
  impact: FailureImpact;
  mitigation: MitigationStrategy;
}

export interface FailureImpact {
  affectedTests: number;
  downtime: number;
  resourceWaste: number;
}

export interface MitigationStrategy {
  description: string;
  effectiveness: number;
  implementationCost: number;
}

export interface ResultAggregator {
  collection: ResultCollection;
  processing: ResultProcessing;
  storage: ResultStorage;
  reporting: ResultReporting;
}

export interface ResultCollection {
  collectFromNodes(nodes: WorkerNode[]): Promise<NodeResults[]>;
  handlePartialResults(partial: PartialResults): void;
  retryFailedCollections(failed: FailedCollection[]): Promise<RetryResults>;
}

export interface NodeResults {
  nodeId: string;
  testResults: TestResult[];
  collectionTime: number;
  quality: ResultQuality;
}

export interface ResultQuality {
  completeness: number;
  accuracy: number;
  timeliness: number;
}

export interface PartialResults {
  nodeId: string;
  availableResults: TestResult[];
  missingTests: string[];
  estimatedCompletion: number;
}

export interface FailedCollection {
  nodeId: string;
  failedTests: string[];
  error: string;
  retryCount: number;
}

export interface RetryResults {
  successful: TestResult[];
  stillFailed: FailedCollection[];
}

export interface ResultProcessing {
  validateResults(results: TestResult[]): ValidationResult[];
  deduplicateResults(results: TestResult[]): DeduplicationResult;
  mergeResults(results: TestResult[]): MergedResults;
  calculateAggregates(results: TestResult[]): AggregateMetrics;
}

export interface ValidationResult {
  testId: string;
  isValid: boolean;
  issues: ValidationIssue[];
}

export interface ValidationIssue {
  type: IssueType;
  description: string;
  severity: IssueSeverity;
}

export interface DeduplicationResult {
  uniqueResults: TestResult[];
  duplicates: DuplicateGroup[];
  removedCount: number;
}

export interface DuplicateGroup {
  testId: string;
  results: TestResult[];
  resolution: DuplicateResolution;
}

export enum DuplicateResolution {
  KEEP_FIRST = 'keep_first',
  KEEP_LAST = 'keep_last',
  MERGE = 'merge',
  DISCARD_ALL = 'discard_all'
}

export interface MergedResults {
  consolidated: TestResult[];
  conflicts: ResultConflict[];
  mergeStatistics: MergeStatistics;
}

export interface ResultConflict {
  testId: string;
  conflictingResults: TestResult[];
  resolution: ConflictResolution;
}

export enum ConflictResolution {
  MANUAL_REVIEW = 'manual_review',
  AUTOMATIC_MERGE = 'automatic_merge',
  PRIORITIZE_NODE = 'prioritize_node',
  DISCARD_CONFLICTS = 'discard_conflicts'
}

export interface MergeStatistics {
  totalResults: number;
  mergedResults: number;
  conflictsResolved: number;
  conflictsPending: number;
}

export interface AggregateMetrics {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  averageExecutionTime: number;
  successRate: number;
  performanceDistribution: PerformanceDistribution;
}

export interface PerformanceDistribution {
  p50: number;
  p90: number;
  p95: number;
  p99: number;
}

export interface ResultStorage {
  storeResults(results: TestResult[]): Promise<StorageResult>;
  retrieveResults(query: ResultQuery): Promise<RetrievedResults>;
  archiveResults(results: TestResult[], retention: RetentionPolicy): Promise<ArchiveResult>;
}

export interface StorageResult {
  stored: number;
  failed: number;
  storageIds: string[];
  errors: StorageError[];
}

export interface StorageError {
  testId: string;
  error: string;
  retryable: boolean;
}

export interface ResultQuery {
  timeRange: TimeRange;
  testIds?: string[];
  nodeIds?: string[];
  status?: string[];
  tags?: string[];
}

export interface RetrievedResults {
  results: TestResult[];
  totalCount: number;
  queryTime: number;
  cacheHit: boolean;
}

export interface RetentionPolicy {
  duration: number;
  compression: boolean;
  archival: boolean;
}

export interface ArchiveResult {
  archived: number;
  failed: number;
  archiveLocation: string;
  errors: ArchiveError[];
}

export interface ArchiveError {
  testId: string;
  error: string;
}

export interface ResultReporting {
  generateReports(query: ReportQuery): Promise<GeneratedReports>;
  scheduleReports(schedule: ReportSchedule): Promise<ScheduledReport>;
  exportReports(reports: GeneratedReports, format: ExportFormat): Promise<ExportedReports>;
}

export interface ReportQuery {
  type: ReportType;
  timeRange: TimeRange;
  filters: ReportFilter[];
  aggregations: string[];
}

export enum ReportType {
  EXECUTION_SUMMARY = 'execution_summary',
  PERFORMANCE_ANALYSIS = 'performance_analysis',
  FAILURE_ANALYSIS = 'failure_analysis',
  TREND_ANALYSIS = 'trend_analysis',
  CAPACITY_REPORT = 'capacity_report'
}

export interface ReportFilter {
  field: string;
  operator: string;
  value: any;
}

export interface GeneratedReports {
  reports: Report[];
  generationTime: number;
  dataPoints: number;
}

export interface Report {
  id: string;
  type: ReportType;
  title: string;
  summary: ReportSummary;
  details: ReportDetails;
  generatedAt: number;
}

export interface ReportSummary {
  keyMetrics: KeyMetric[];
  highlights: string[];
  recommendations: string[];
}

export interface KeyMetric {
  name: string;
  value: number;
  unit: string;
  trend: TrendDirection;
}

export enum TrendDirection {
  UP = 'up',
  DOWN = 'down',
  STABLE = 'stable',
  VOLATILE = 'volatile'
}

export interface ReportDetails {
  charts: ChartData[];
  tables: TableData[];
  insights: Insight[];
}

export interface ChartData {
  type: ChartType;
  title: string;
  data: any;
  config: ChartConfig;
}

export enum ChartType {
  LINE = 'line',
  BAR = 'bar',
  PIE = 'pie',
  HEATMAP = 'heatmap',
  SCATTER = 'scatter'
}

export interface ChartConfig {
  xAxis: string;
  yAxis: string;
  colors: string[];
  options: any;
}

export interface TableData {
  headers: string[];
  rows: any[][];
  sortable: boolean;
}

export interface Insight {
  type: InsightType;
  title: string;
  description: string;
  confidence: number;
  impact: InsightImpact;
}

export enum InsightType {
  PERFORMANCE = 'performance',
  RELIABILITY = 'reliability',
  EFFICIENCY = 'efficiency',
  CAPACITY = 'capacity',
  ANOMALY = 'anomaly'
}

export enum InsightImpact {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface ReportSchedule {
  frequency: ScheduleFrequency;
  time: string;
  recipients: string[];
  formats: ExportFormat[];
}

export enum ScheduleFrequency {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly'
}

export interface ScheduledReport {
  id: string;
  schedule: ReportSchedule;
  nextRun: number;
  status: ScheduleStatus;
}

export enum ScheduleStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  CANCELLED = 'cancelled'
}

export enum ExportFormat {
  PDF = 'pdf',
  CSV = 'csv',
  JSON = 'json',
  XML = 'xml'
}

export interface ExportedReports {
  exports: ReportExport[];
  totalSize: number;
  downloadUrls: string[];
}

export interface ReportExport {
  reportId: string;
  format: ExportFormat;
  size: number;
  url: string;
  expiresAt: number;
}

export interface GossipProtocol {
  version: number;
  dissemination: DisseminationStrategy;
}

export interface GossipFailureDetector {
  protocol: GossipProtocol;
  disseminateFailure(failure: FailureEvent): void;
}

export interface PhiAccrualFailureDetector {
  suspicionThreshold: number;
  calculateSuspicion(nodeId: string): number;
}
