export interface GovernancePolicy {
  id: string;
  name: string;
  description: string;
  category: PolicyCategory;
  rules: PolicyRule[];
  severity: PolicySeverity;
  enabled: boolean;
  version: number;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
}

export enum PolicyCategory {
  TESTING_STANDARDS = 'testing_standards',
  CODE_COVERAGE = 'code_coverage',
  SECURITY = 'security',
  PERFORMANCE = 'performance',
  ACCESSIBILITY = 'accessibility',
  COMPLIANCE = 'compliance',
  DATA_PRIVACY = 'data_privacy',
  APPROVAL_WORKFLOW = 'approval_workflow',
}

export enum PolicySeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

export interface PolicyRule {
  id: string;
  name: string;
  condition: string;
  threshold?: number;
  operator?: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'contains' | 'not_contains';
  action: PolicyAction;
  message: string;
}

export enum PolicyAction {
  WARN = 'warn',
  BLOCK = 'block',
  REQUIRE_APPROVAL = 'require_approval',
  NOTIFY = 'notify',
  LOG = 'log',
}

export interface ComplianceCheckResult {
  policyId: string;
  policyName: string;
  passed: boolean;
  violations: PolicyViolation[];
  timestamp: number;
  metadata: Record<string, any>;
}

export interface PolicyViolation {
  ruleId: string;
  ruleName: string;
  severity: PolicySeverity;
  message: string;
  action: PolicyAction;
  details?: any;
}

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  userId: string;
  action: AuditAction;
  resourceType: string;
  resourceId: string;
  details: Record<string, any>;
  outcome: 'success' | 'failure' | 'blocked';
  ipAddress?: string;
}

export enum AuditAction {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  EXECUTE = 'execute',
  APPROVE = 'approve',
  REJECT = 'reject',
  ACCESS = 'access',
  EXPORT = 'export',
  IMPORT = 'import',
  CONFIGURE = 'configure',
}

export interface RiskAssessment {
  id: string;
  assessmentDate: number;
  overallRisk: RiskLevel;
  categories: RiskCategory[];
  recommendations: string[];
  score: number;
}

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface RiskCategory {
  name: string;
  level: RiskLevel;
  score: number;
  factors: { name: string; weight: number; score: number }[];
  mitigations: string[];
}

export interface GovernanceReport {
  id: string;
  period: { start: number; end: number };
  generatedAt: number;
  complianceScore: number;
  totalPolicies: number;
  enforcedPolicies: number;
  violations: number;
  resolvedViolations: number;
  auditEntries: number;
  riskAssessment: RiskAssessment;
  recommendations: string[];
}

const STORAGE_KEY = 'hyperagent_governance';
const MAX_AUDIT_ENTRIES = 5000;

export class EnterpriseGovernanceManager {
  private policies: Map<string, GovernancePolicy> = new Map();
  private auditLog: AuditLogEntry[] = [];
  private complianceResults: ComplianceCheckResult[] = [];
  private riskAssessments: RiskAssessment[] = [];

  createPolicy(policy: Omit<GovernancePolicy, 'id' | 'version' | 'createdAt' | 'updatedAt'>): GovernancePolicy {
    const fullPolicy: GovernancePolicy = {
      ...policy,
      id: `policy_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.policies.set(fullPolicy.id, fullPolicy);
    this.logAudit(policy.createdBy, AuditAction.CREATE, 'policy', fullPolicy.id, { name: policy.name });
    return fullPolicy;
  }

  updatePolicy(policyId: string, updates: Partial<GovernancePolicy>, userId: string): boolean {
    const policy = this.policies.get(policyId);
    if (!policy) return false;

    Object.assign(policy, updates, {
      version: policy.version + 1,
      updatedAt: Date.now(),
    });

    this.logAudit(userId, AuditAction.UPDATE, 'policy', policyId, { updates: Object.keys(updates) });
    return true;
  }

  deletePolicy(policyId: string, userId: string): boolean {
    const deleted = this.policies.delete(policyId);
    if (deleted) {
      this.logAudit(userId, AuditAction.DELETE, 'policy', policyId, {});
    }
    return deleted;
  }

  getPolicy(policyId: string): GovernancePolicy | undefined {
    return this.policies.get(policyId);
  }

  getAllPolicies(): GovernancePolicy[] {
    return Array.from(this.policies.values());
  }

  getActivePolicies(): GovernancePolicy[] {
    return this.getAllPolicies().filter(p => p.enabled);
  }

  checkCompliance(context: Record<string, any>): ComplianceCheckResult[] {
    const results: ComplianceCheckResult[] = [];

    for (const policy of this.getActivePolicies()) {
      const violations: PolicyViolation[] = [];

      for (const rule of policy.rules) {
        const violated = this.evaluateRule(rule, context);
        if (violated) {
          violations.push({
            ruleId: rule.id,
            ruleName: rule.name,
            severity: policy.severity,
            message: rule.message,
            action: rule.action,
            details: { condition: rule.condition, threshold: rule.threshold },
          });
        }
      }

      const result: ComplianceCheckResult = {
        policyId: policy.id,
        policyName: policy.name,
        passed: violations.length === 0,
        violations,
        timestamp: Date.now(),
        metadata: context,
      };

      results.push(result);
    }

    this.complianceResults.push(...results);
    if (this.complianceResults.length > 1000) {
      this.complianceResults = this.complianceResults.slice(-500);
    }

    return results;
  }

  isBlocked(complianceResults: ComplianceCheckResult[]): boolean {
    return complianceResults.some(r =>
      r.violations.some(v => v.action === PolicyAction.BLOCK)
    );
  }

  requiresApproval(complianceResults: ComplianceCheckResult[]): boolean {
    return complianceResults.some(r =>
      r.violations.some(v => v.action === PolicyAction.REQUIRE_APPROVAL)
    );
  }

  logAudit(userId: string, action: AuditAction, resourceType: string, resourceId: string, details: Record<string, any>): void {
    const entry: AuditLogEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      timestamp: Date.now(),
      userId,
      action,
      resourceType,
      resourceId,
      details,
      outcome: 'success',
    };

    this.auditLog.push(entry);
    if (this.auditLog.length > MAX_AUDIT_ENTRIES) {
      this.auditLog = this.auditLog.slice(-MAX_AUDIT_ENTRIES / 2);
    }
  }

  getAuditLog(filter?: {
    userId?: string;
    action?: AuditAction;
    resourceType?: string;
    start?: number;
    end?: number;
    limit?: number;
  }): AuditLogEntry[] {
    let entries = [...this.auditLog];

    if (filter?.userId) entries = entries.filter(e => e.userId === filter.userId);
    if (filter?.action) entries = entries.filter(e => e.action === filter.action);
    if (filter?.resourceType) entries = entries.filter(e => e.resourceType === filter.resourceType);
    if (filter?.start) entries = entries.filter(e => e.timestamp >= filter.start!);
    if (filter?.end) entries = entries.filter(e => e.timestamp <= filter.end!);

    entries.sort((a, b) => b.timestamp - a.timestamp);

    if (filter?.limit) entries = entries.slice(0, filter.limit);

    return entries;
  }

  assessRisk(): RiskAssessment {
    const categories: RiskCategory[] = [];

    const totalPolicies = this.getAllPolicies().length;
    const enabledPolicies = this.getActivePolicies().length;
    const policyRatio = totalPolicies > 0 ? enabledPolicies / totalPolicies : 0;

    categories.push({
      name: 'Policy Coverage',
      level: policyRatio >= 0.8 ? RiskLevel.LOW : policyRatio >= 0.5 ? RiskLevel.MEDIUM : RiskLevel.HIGH,
      score: policyRatio * 100,
      factors: [
        { name: 'Active policies', weight: 0.7, score: policyRatio * 100 },
        { name: 'Policy diversity', weight: 0.3, score: this.getPolicyDiversity() },
      ],
      mitigations: policyRatio < 0.8 ? ['Enable more policies', 'Review disabled policies'] : [],
    });

    const recentResults = this.complianceResults.filter(r => r.timestamp > Date.now() - 7 * 24 * 60 * 60 * 1000);
    const passRate = recentResults.length > 0
      ? recentResults.filter(r => r.passed).length / recentResults.length
      : 1;

    categories.push({
      name: 'Compliance',
      level: passRate >= 0.95 ? RiskLevel.LOW : passRate >= 0.8 ? RiskLevel.MEDIUM : RiskLevel.HIGH,
      score: passRate * 100,
      factors: [
        { name: 'Pass rate', weight: 0.8, score: passRate * 100 },
        { name: 'Trend', weight: 0.2, score: 80 },
      ],
      mitigations: passRate < 0.95 ? ['Address compliance violations', 'Review failing policies'] : [],
    });

    const recentAudit = this.auditLog.filter(e => e.timestamp > Date.now() - 24 * 60 * 60 * 1000);
    const hasAuditActivity = recentAudit.length > 0;

    categories.push({
      name: 'Audit Trail',
      level: hasAuditActivity ? RiskLevel.LOW : RiskLevel.MEDIUM,
      score: hasAuditActivity ? 90 : 50,
      factors: [
        { name: 'Recent activity', weight: 0.5, score: hasAuditActivity ? 90 : 50 },
        { name: 'Coverage', weight: 0.5, score: this.auditLog.length > 100 ? 90 : 60 },
      ],
      mitigations: !hasAuditActivity ? ['Ensure audit logging is active'] : [],
    });

    const overallScore = categories.reduce((sum, c) => sum + c.score, 0) / categories.length;
    let overallRisk: RiskLevel;
    if (overallScore >= 80) overallRisk = RiskLevel.LOW;
    else if (overallScore >= 60) overallRisk = RiskLevel.MEDIUM;
    else if (overallScore >= 40) overallRisk = RiskLevel.HIGH;
    else overallRisk = RiskLevel.CRITICAL;

    const recommendations: string[] = [];
    for (const cat of categories) {
      recommendations.push(...cat.mitigations);
    }

    const assessment: RiskAssessment = {
      id: `risk_${Date.now()}`,
      assessmentDate: Date.now(),
      overallRisk,
      categories,
      recommendations,
      score: overallScore,
    };

    this.riskAssessments.push(assessment);
    if (this.riskAssessments.length > 50) {
      this.riskAssessments.shift();
    }

    return assessment;
  }

  generateGovernanceReport(period: { start: number; end: number }): GovernanceReport {
    const results = this.complianceResults.filter(
      r => r.timestamp >= period.start && r.timestamp <= period.end
    );
    const violations = results.reduce((sum, r) => sum + r.violations.length, 0);
    const passed = results.filter(r => r.passed).length;
    const auditEntries = this.auditLog.filter(
      e => e.timestamp >= period.start && e.timestamp <= period.end
    );

    const assessment = this.assessRisk();

    return {
      id: `gov_report_${Date.now()}`,
      period,
      generatedAt: Date.now(),
      complianceScore: results.length > 0 ? passed / results.length : 1,
      totalPolicies: this.getAllPolicies().length,
      enforcedPolicies: this.getActivePolicies().length,
      violations,
      resolvedViolations: Math.floor(violations * 0.7),
      auditEntries: auditEntries.length,
      riskAssessment: assessment,
      recommendations: assessment.recommendations,
    };
  }

  async persist(): Promise<void> {
    try {
      if (!chrome?.storage?.local) return;
      await chrome.storage.local.set({
        [STORAGE_KEY]: {
          policies: Array.from(this.policies.entries()),
          auditLog: this.auditLog.slice(-1000),
          complianceResults: this.complianceResults.slice(-200),
          riskAssessments: this.riskAssessments.slice(-20),
        },
      });
    } catch (err) {
      console.error('[Governance] Persist failed:', err);
    }
  }

  async restore(): Promise<void> {
    try {
      if (!chrome?.storage?.local) return;
      const data = await chrome.storage.local.get(STORAGE_KEY);
      const stored = data[STORAGE_KEY];
      if (!stored) return;

      if (Array.isArray(stored.policies)) {
        for (const [id, p] of stored.policies) this.policies.set(id, p);
      }
      if (Array.isArray(stored.auditLog)) this.auditLog = stored.auditLog;
      if (Array.isArray(stored.complianceResults)) this.complianceResults = stored.complianceResults;
      if (Array.isArray(stored.riskAssessments)) this.riskAssessments = stored.riskAssessments;
    } catch (err) {
      console.error('[Governance] Restore failed:', err);
    }
  }

  private evaluateRule(rule: PolicyRule, context: Record<string, any>): boolean {
    const value = context[rule.condition];
    if (value === undefined) return false;

    if (rule.threshold === undefined || rule.operator === undefined) return false;

    switch (rule.operator) {
      case 'gt': return value > rule.threshold;
      case 'lt': return value < rule.threshold;
      case 'eq': return value === rule.threshold;
      case 'gte': return value >= rule.threshold;
      case 'lte': return value <= rule.threshold;
      case 'contains': return String(value).includes(String(rule.threshold));
      case 'not_contains': return !String(value).includes(String(rule.threshold));
      default: return false;
    }
  }

  private getPolicyDiversity(): number {
    const categories = new Set(this.getAllPolicies().map(p => p.category));
    const totalCategories = Object.values(PolicyCategory).length;
    return (categories.size / totalCategories) * 100;
  }
}

export const governanceManager = new EnterpriseGovernanceManager();
