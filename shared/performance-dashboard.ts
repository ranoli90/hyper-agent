export interface MetricDataPoint {
  timestamp: number;
  value: number;
  label?: string;
  tags?: Record<string, string>;
}

export interface MetricSeries {
  name: string;
  unit: string;
  dataPoints: MetricDataPoint[];
  aggregation: AggregationType;
}

export enum AggregationType {
  SUM = 'sum',
  AVG = 'avg',
  MIN = 'min',
  MAX = 'max',
  COUNT = 'count',
  P50 = 'p50',
  P95 = 'p95',
  P99 = 'p99',
}

export interface DashboardWidget {
  id: string;
  title: string;
  type: WidgetType;
  series: string[];
  timeRange: TimeRange;
  refreshInterval: number;
  config: Record<string, any>;
}

export enum WidgetType {
  LINE_CHART = 'line_chart',
  BAR_CHART = 'bar_chart',
  PIE_CHART = 'pie_chart',
  GAUGE = 'gauge',
  TABLE = 'table',
  STAT = 'stat',
  HEATMAP = 'heatmap',
}

export interface TimeRange {
  start: number;
  end: number;
  label?: string;
}

export interface AlertRule {
  id: string;
  name: string;
  metric: string;
  condition: AlertCondition;
  threshold: number;
  duration: number;
  severity: AlertSeverity;
  enabled: boolean;
  lastTriggered?: number;
  cooldown: number;
}

export enum AlertCondition {
  ABOVE = 'above',
  BELOW = 'below',
  CHANGE_RATE = 'change_rate',
  ANOMALY = 'anomaly',
}

export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

export interface Alert {
  id: string;
  ruleId: string;
  metric: string;
  value: number;
  threshold: number;
  severity: AlertSeverity;
  message: string;
  timestamp: number;
  acknowledged: boolean;
}

export interface DashboardSnapshot {
  timestamp: number;
  metrics: Record<string, number>;
  alerts: Alert[];
  summary: string;
}

const STORAGE_KEY = 'hyperagent_perf_dashboard';
const MAX_DATA_POINTS = 2000;
const MAX_ALERTS = 500;

export class PerformanceDashboard {
  private series: Map<string, MetricSeries> = new Map();
  private widgets: Map<string, DashboardWidget> = new Map();
  private alertRules: Map<string, AlertRule> = new Map();
  private activeAlerts: Alert[] = [];
  private snapshots: DashboardSnapshot[] = [];
  private maxSnapshots = 100;
  private listeners: ((alert: Alert) => void)[] = [];

  recordMetric(seriesName: string, value: number, tags?: Record<string, string>): void {
    let series = this.series.get(seriesName);
    if (!series) {
      series = {
        name: seriesName,
        unit: '',
        dataPoints: [],
        aggregation: AggregationType.AVG,
      };
      this.series.set(seriesName, series);
    }

    series.dataPoints.push({
      timestamp: Date.now(),
      value,
      tags,
    });

    if (series.dataPoints.length > MAX_DATA_POINTS) {
      series.dataPoints = this.downsample(series.dataPoints, MAX_DATA_POINTS / 2);
    }

    this.evaluateAlerts(seriesName, value);
  }

  createSeries(name: string, unit: string, aggregation: AggregationType = AggregationType.AVG): MetricSeries {
    const series: MetricSeries = {
      name,
      unit,
      dataPoints: [],
      aggregation,
    };
    this.series.set(name, series);
    return series;
  }

  getSeries(name: string): MetricSeries | undefined {
    return this.series.get(name);
  }

  getAllSeries(): MetricSeries[] {
    return Array.from(this.series.values());
  }

  query(seriesName: string, timeRange: TimeRange, aggregation?: AggregationType): MetricDataPoint[] {
    const series = this.series.get(seriesName);
    if (!series) return [];

    const filtered = series.dataPoints.filter(
      dp => dp.timestamp >= timeRange.start && dp.timestamp <= timeRange.end
    );

    if (!aggregation || aggregation === AggregationType.AVG) return filtered;

    return this.aggregate(filtered, aggregation, timeRange);
  }

  getLatestValue(seriesName: string): number | null {
    const series = this.series.get(seriesName);
    if (!series || series.dataPoints.length === 0) return null;
    return series.dataPoints[series.dataPoints.length - 1].value;
  }

  computeStatistics(seriesName: string, timeRange?: TimeRange): {
    min: number;
    max: number;
    avg: number;
    median: number;
    stddev: number;
    count: number;
    p95: number;
    p99: number;
  } | null {
    const series = this.series.get(seriesName);
    if (!series || series.dataPoints.length === 0) return null;

    let points = series.dataPoints;
    if (timeRange) {
      points = points.filter(dp => dp.timestamp >= timeRange.start && dp.timestamp <= timeRange.end);
    }
    if (points.length === 0) return null;

    const values = points.map(p => p.value).sort((a, b) => a - b);
    const sum = values.reduce((s, v) => s + v, 0);
    const avg = sum / values.length;
    const variance = values.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / values.length;

    return {
      min: values[0],
      max: values[values.length - 1],
      avg,
      median: values[Math.floor(values.length / 2)],
      stddev: Math.sqrt(variance),
      count: values.length,
      p95: values[Math.floor(values.length * 0.95)],
      p99: values[Math.floor(values.length * 0.99)],
    };
  }

  addWidget(widget: DashboardWidget): void {
    this.widgets.set(widget.id, widget);
  }

  removeWidget(widgetId: string): boolean {
    return this.widgets.delete(widgetId);
  }

  getWidgets(): DashboardWidget[] {
    return Array.from(this.widgets.values());
  }

  addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule);
  }

  removeAlertRule(ruleId: string): boolean {
    return this.alertRules.delete(ruleId);
  }

  getAlertRules(): AlertRule[] {
    return Array.from(this.alertRules.values());
  }

  getActiveAlerts(): Alert[] {
    return this.activeAlerts.filter(a => !a.acknowledged);
  }

  acknowledgeAlert(alertId: string): boolean {
    const alert = this.activeAlerts.find(a => a.id === alertId);
    if (!alert) return false;
    alert.acknowledged = true;
    return true;
  }

  onAlert(listener: (alert: Alert) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  takeSnapshot(): DashboardSnapshot {
    const metrics: Record<string, number> = {};
    for (const [name, series] of this.series) {
      if (series.dataPoints.length > 0) {
        metrics[name] = series.dataPoints[series.dataPoints.length - 1].value;
      }
    }

    const snapshot: DashboardSnapshot = {
      timestamp: Date.now(),
      metrics,
      alerts: [...this.activeAlerts.filter(a => !a.acknowledged)],
      summary: this.generateSummary(),
    };

    this.snapshots.push(snapshot);
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }

    return snapshot;
  }

  getSnapshots(): DashboardSnapshot[] {
    return [...this.snapshots];
  }

  detectAnomalies(seriesName: string, sensitivity: number = 2): MetricDataPoint[] {
    const series = this.series.get(seriesName);
    if (!series || series.dataPoints.length < 10) return [];

    const values = series.dataPoints.map(dp => dp.value);
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const stddev = Math.sqrt(
      values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length
    );

    return series.dataPoints.filter(dp =>
      Math.abs(dp.value - mean) > sensitivity * stddev
    );
  }

  forecast(seriesName: string, periods: number): MetricDataPoint[] {
    const series = this.series.get(seriesName);
    if (!series || series.dataPoints.length < 3) return [];

    const values = series.dataPoints.slice(-20).map(dp => dp.value);
    const trend = this.calculateTrend(values);
    const lastTimestamp = series.dataPoints[series.dataPoints.length - 1].timestamp;
    const interval = series.dataPoints.length > 1
      ? (lastTimestamp - series.dataPoints[Math.max(0, series.dataPoints.length - 10)].timestamp) /
        Math.min(10, series.dataPoints.length - 1)
      : 60000;

    const forecasted: MetricDataPoint[] = [];
    const lastValue = values[values.length - 1];

    for (let i = 1; i <= periods; i++) {
      forecasted.push({
        timestamp: lastTimestamp + interval * i,
        value: lastValue + trend * i,
        label: 'forecast',
      });
    }

    return forecasted;
  }

  async persist(): Promise<void> {
    try {
      if (!chrome?.storage?.local) return;
      const data = {
        series: Array.from(this.series.entries()).map(([name, s]) => ({
          name,
          unit: s.unit,
          aggregation: s.aggregation,
          dataPoints: s.dataPoints.slice(-200),
        })),
        alerts: this.activeAlerts.slice(-100),
        snapshots: this.snapshots.slice(-20),
      };
      await chrome.storage.local.set({ [STORAGE_KEY]: data });
    } catch (err) {
      console.error('[PerformanceDashboard] Persist failed:', err);
    }
  }

  async restore(): Promise<void> {
    try {
      if (!chrome?.storage?.local) return;
      const result = await chrome.storage.local.get(STORAGE_KEY);
      const data = result[STORAGE_KEY];
      if (!data) return;

      if (Array.isArray(data.series)) {
        for (const s of data.series) {
          this.series.set(s.name, {
            name: s.name,
            unit: s.unit || '',
            aggregation: s.aggregation || AggregationType.AVG,
            dataPoints: s.dataPoints || [],
          });
        }
      }
      if (Array.isArray(data.alerts)) {
        this.activeAlerts = data.alerts;
      }
      if (Array.isArray(data.snapshots)) {
        this.snapshots = data.snapshots;
      }
    } catch (err) {
      console.error('[PerformanceDashboard] Restore failed:', err);
    }
  }

  private evaluateAlerts(seriesName: string, value: number): void {
    for (const rule of this.alertRules.values()) {
      if (!rule.enabled || rule.metric !== seriesName) continue;

      if (rule.lastTriggered && Date.now() - rule.lastTriggered < rule.cooldown) continue;

      let triggered = false;
      switch (rule.condition) {
        case AlertCondition.ABOVE:
          triggered = value > rule.threshold;
          break;
        case AlertCondition.BELOW:
          triggered = value < rule.threshold;
          break;
        case AlertCondition.CHANGE_RATE: {
          const series = this.series.get(seriesName);
          if (series && series.dataPoints.length >= 2) {
            const prev = series.dataPoints[series.dataPoints.length - 2].value;
            const rate = prev !== 0 ? Math.abs((value - prev) / prev) : 0;
            triggered = rate > rule.threshold;
          }
          break;
        }
        case AlertCondition.ANOMALY: {
          const anomalies = this.detectAnomalies(seriesName, rule.threshold);
          triggered = anomalies.length > 0 &&
            anomalies[anomalies.length - 1].timestamp === Date.now();
          break;
        }
      }

      if (triggered) {
        const alert: Alert = {
          id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          ruleId: rule.id,
          metric: seriesName,
          value,
          threshold: rule.threshold,
          severity: rule.severity,
          message: `${rule.name}: ${seriesName} = ${value} (threshold: ${rule.threshold})`,
          timestamp: Date.now(),
          acknowledged: false,
        };

        this.activeAlerts.push(alert);
        if (this.activeAlerts.length > MAX_ALERTS) {
          this.activeAlerts.shift();
        }

        rule.lastTriggered = Date.now();

        for (const listener of this.listeners) {
          try {
            listener(alert);
          } catch (err) {
            console.error('[PerformanceDashboard] Alert listener error:', err);
          }
        }
      }
    }
  }

  private downsample(points: MetricDataPoint[], targetCount: number): MetricDataPoint[] {
    if (points.length <= targetCount) return points;

    const bucketSize = Math.ceil(points.length / targetCount);
    const result: MetricDataPoint[] = [];

    for (let i = 0; i < points.length; i += bucketSize) {
      const bucket = points.slice(i, i + bucketSize);
      const avg = bucket.reduce((s, p) => s + p.value, 0) / bucket.length;
      result.push({
        timestamp: bucket[Math.floor(bucket.length / 2)].timestamp,
        value: avg,
        tags: bucket[0].tags,
      });
    }

    return result;
  }

  private aggregate(points: MetricDataPoint[], type: AggregationType, timeRange: TimeRange): MetricDataPoint[] {
    if (points.length === 0) return [];

    const bucketCount = 50;
    const bucketDuration = (timeRange.end - timeRange.start) / bucketCount;
    const buckets: MetricDataPoint[][] = Array.from({ length: bucketCount }, () => []);

    for (const point of points) {
      const idx = Math.min(
        Math.floor((point.timestamp - timeRange.start) / bucketDuration),
        bucketCount - 1
      );
      if (idx >= 0) buckets[idx].push(point);
    }

    return buckets
      .filter(b => b.length > 0)
      .map(bucket => {
        const values = bucket.map(p => p.value).sort((a, b) => a - b);
        let value: number;

        switch (type) {
          case AggregationType.SUM:
            value = values.reduce((s, v) => s + v, 0);
            break;
          case AggregationType.MIN:
            value = values[0];
            break;
          case AggregationType.MAX:
            value = values[values.length - 1];
            break;
          case AggregationType.COUNT:
            value = values.length;
            break;
          case AggregationType.P50:
            value = values[Math.floor(values.length * 0.5)];
            break;
          case AggregationType.P95:
            value = values[Math.floor(values.length * 0.95)];
            break;
          case AggregationType.P99:
            value = values[Math.floor(values.length * 0.99)];
            break;
          default:
            value = values.reduce((s, v) => s + v, 0) / values.length;
        }

        return {
          timestamp: bucket[Math.floor(bucket.length / 2)].timestamp,
          value,
        };
      });
  }

  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;
    const n = values.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += values[i];
      sumXY += i * values[i];
      sumX2 += i * i;
    }

    const denominator = n * sumX2 - sumX * sumX;
    if (denominator === 0) return 0;
    return (n * sumXY - sumX * sumY) / denominator;
  }

  private generateSummary(): string {
    const parts: string[] = [];
    const alertCount = this.activeAlerts.filter(a => !a.acknowledged).length;

    if (alertCount > 0) {
      parts.push(`${alertCount} active alert(s)`);
    }

    parts.push(`${this.series.size} metric series tracked`);

    return parts.join(', ') || 'No activity';
  }
}

export const performanceDashboard = new PerformanceDashboard();
