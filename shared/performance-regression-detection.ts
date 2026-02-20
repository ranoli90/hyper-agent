export interface PerformanceBaseline {
  id: string;
  metric: string;
  mean: number;
  stddev: number;
  min: number;
  max: number;
  p50: number;
  p95: number;
  p99: number;
  sampleCount: number;
  createdAt: number;
  updatedAt: number;
  windowSize: number;
}

export interface RegressionResult {
  metric: string;
  detected: boolean;
  severity: RegressionSeverity;
  currentValue: number;
  baselineValue: number;
  deviation: number;
  deviationPercent: number;
  confidence: number;
  message: string;
  timestamp: number;
}

export enum RegressionSeverity {
  NONE = 'none',
  MINOR = 'minor',
  MODERATE = 'moderate',
  MAJOR = 'major',
  CRITICAL = 'critical',
}

export interface DetectionConfig {
  significanceLevel: number;
  minSampleSize: number;
  windowSize: number;
  sensitivityMultiplier: number;
  cooldownMs: number;
}

export interface ChangePoint {
  index: number;
  timestamp: number;
  metric: string;
  beforeMean: number;
  afterMean: number;
  changePercent: number;
  confidence: number;
}

export interface TrendAnalysis {
  metric: string;
  direction: 'improving' | 'degrading' | 'stable';
  slope: number;
  r_squared: number;
  forecast: number[];
  confidence: number;
}

const STORAGE_KEY = 'hyperagent_perf_baselines';
const MAX_SAMPLES_PER_BASELINE = 1000;

export class RegressionDetector {
  private baselines: Map<string, PerformanceBaseline> = new Map();
  private sampleBuffers: Map<string, { timestamp: number; value: number }[]> = new Map();
  private regressionHistory: RegressionResult[] = [];
  private config: DetectionConfig;
  private lastAlertTime: Map<string, number> = new Map();
  private listeners: ((result: RegressionResult) => void)[] = [];

  constructor(config?: Partial<DetectionConfig>) {
    this.config = {
      significanceLevel: config?.significanceLevel ?? 0.05,
      minSampleSize: config?.minSampleSize ?? 10,
      windowSize: config?.windowSize ?? 50,
      sensitivityMultiplier: config?.sensitivityMultiplier ?? 2,
      cooldownMs: config?.cooldownMs ?? 60000,
    };
  }

  addSample(metric: string, value: number): RegressionResult | null {
    let buffer = this.sampleBuffers.get(metric);
    if (!buffer) {
      buffer = [];
      this.sampleBuffers.set(metric, buffer);
    }

    buffer.push({ timestamp: Date.now(), value });
    if (buffer.length > MAX_SAMPLES_PER_BASELINE) {
      buffer.shift();
    }

    if (buffer.length >= this.config.minSampleSize) {
      this.updateBaseline(metric, buffer);
    }

    return this.checkRegression(metric, value);
  }

  addBatchSamples(metric: string, values: number[]): RegressionResult[] {
    const results: RegressionResult[] = [];
    for (const value of values) {
      const result = this.addSample(metric, value);
      if (result) results.push(result);
    }
    return results;
  }

  getBaseline(metric: string): PerformanceBaseline | undefined {
    return this.baselines.get(metric);
  }

  getAllBaselines(): PerformanceBaseline[] {
    return Array.from(this.baselines.values());
  }

  setBaseline(metric: string, baseline: Omit<PerformanceBaseline, 'id' | 'createdAt' | 'updatedAt'>): void {
    this.baselines.set(metric, {
      id: `baseline_${metric}_${Date.now()}`,
      ...baseline,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  resetBaseline(metric: string): void {
    this.baselines.delete(metric);
    this.sampleBuffers.delete(metric);
  }

  checkRegression(metric: string, currentValue: number): RegressionResult | null {
    const baseline = this.baselines.get(metric);
    if (!baseline) return null;

    const lastAlert = this.lastAlertTime.get(metric) || 0;
    if (Date.now() - lastAlert < this.config.cooldownMs) return null;

    const deviation = currentValue - baseline.mean;
    const deviationPercent = baseline.mean !== 0 ? (deviation / baseline.mean) * 100 : 0;
    const zScore = baseline.stddev > 0 ? Math.abs(deviation) / baseline.stddev : 0;

    const threshold = this.config.sensitivityMultiplier;
    const detected = zScore > threshold;

    const severity = this.classifySeverity(zScore, deviationPercent);
    const confidence = Math.min(1, zScore / (threshold * 2));

    const result: RegressionResult = {
      metric,
      detected,
      severity,
      currentValue,
      baselineValue: baseline.mean,
      deviation,
      deviationPercent,
      confidence,
      message: detected
        ? `Regression detected for ${metric}: ${currentValue.toFixed(2)} vs baseline ${baseline.mean.toFixed(2)} (${deviationPercent.toFixed(1)}% deviation)`
        : `${metric} within normal range`,
      timestamp: Date.now(),
    };

    if (detected) {
      this.regressionHistory.push(result);
      if (this.regressionHistory.length > 500) {
        this.regressionHistory.shift();
      }
      this.lastAlertTime.set(metric, Date.now());

      for (const listener of this.listeners) {
        try {
          listener(result);
        } catch (err) {
          console.error('[RegressionDetector] Listener error:', err);
        }
      }
    }

    return detected ? result : null;
  }

  detectChangePoints(metric: string): ChangePoint[] {
    const buffer = this.sampleBuffers.get(metric);
    if (!buffer || buffer.length < 20) return [];

    const values = buffer.map(b => b.value);
    const changePoints: ChangePoint[] = [];
    const windowSize = Math.max(5, Math.floor(values.length / 10));

    for (let i = windowSize; i < values.length - windowSize; i++) {
      const before = values.slice(i - windowSize, i);
      const after = values.slice(i, i + windowSize);

      const beforeMean = before.reduce((s, v) => s + v, 0) / before.length;
      const afterMean = after.reduce((s, v) => s + v, 0) / after.length;

      const changePercent = beforeMean !== 0 ? ((afterMean - beforeMean) / beforeMean) * 100 : 0;

      if (Math.abs(changePercent) > 15) {
        const beforeStd = this.standardDeviation(before);
        const pooledStd = (beforeStd + this.standardDeviation(after)) / 2;
        const tStat = pooledStd > 0 ? Math.abs(afterMean - beforeMean) / (pooledStd * Math.sqrt(2 / windowSize)) : 0;
        const confidence = Math.min(1, tStat / 3);

        if (confidence > 0.5) {
          changePoints.push({
            index: i,
            timestamp: buffer[i].timestamp,
            metric,
            beforeMean,
            afterMean,
            changePercent,
            confidence,
          });
        }
      }
    }

    return this.deduplicateChangePoints(changePoints, windowSize);
  }

  analyzeTrend(metric: string, periods: number = 10): TrendAnalysis | null {
    const buffer = this.sampleBuffers.get(metric);
    if (!buffer || buffer.length < 5) return null;

    const values = buffer.slice(-Math.min(buffer.length, 100)).map(b => b.value);
    const n = values.length;

    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += values[i];
      sumXY += i * values[i];
      sumX2 += i * i;
    }

    const denom = n * sumX2 - sumX * sumX;
    if (denom === 0) return null;

    const slope = (n * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slope * sumX) / n;

    const meanY = sumY / n;
    let ssRes = 0, ssTot = 0;
    for (let i = 0; i < n; i++) {
      const predicted = intercept + slope * i;
      ssRes += Math.pow(values[i] - predicted, 2);
      ssTot += Math.pow(values[i] - meanY, 2);
    }
    const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;

    const forecast: number[] = [];
    for (let i = 1; i <= periods; i++) {
      forecast.push(intercept + slope * (n + i));
    }

    const slopePercent = meanY !== 0 ? (slope / meanY) * 100 : 0;
    let direction: 'improving' | 'degrading' | 'stable';
    if (Math.abs(slopePercent) < 1) {
      direction = 'stable';
    } else {
      direction = slope > 0 ? 'degrading' : 'improving';
    }

    return {
      metric,
      direction,
      slope,
      r_squared: rSquared,
      forecast,
      confidence: Math.min(1, rSquared * (n / 20)),
    };
  }

  getRegressionHistory(metric?: string): RegressionResult[] {
    if (metric) {
      return this.regressionHistory.filter(r => r.metric === metric);
    }
    return [...this.regressionHistory];
  }

  onRegression(listener: (result: RegressionResult) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  async persist(): Promise<void> {
    try {
      if (!chrome?.storage?.local) return;
      const data = {
        baselines: Array.from(this.baselines.entries()),
        history: this.regressionHistory.slice(-100),
      };
      await chrome.storage.local.set({ [STORAGE_KEY]: data });
    } catch (err) {
      console.error('[RegressionDetector] Persist failed:', err);
    }
  }

  async restore(): Promise<void> {
    try {
      if (!chrome?.storage?.local) return;
      const result = await chrome.storage.local.get(STORAGE_KEY);
      const data = result[STORAGE_KEY];
      if (!data) return;

      if (Array.isArray(data.baselines)) {
        for (const [metric, baseline] of data.baselines) {
          this.baselines.set(metric, baseline);
        }
      }
      if (Array.isArray(data.history)) {
        this.regressionHistory = data.history;
      }
    } catch (err) {
      console.error('[RegressionDetector] Restore failed:', err);
    }
  }

  private updateBaseline(metric: string, buffer: { timestamp: number; value: number }[]): void {
    const recent = buffer.slice(-this.config.windowSize);
    const values = recent.map(b => b.value).sort((a, b) => a - b);
    const n = values.length;

    const sum = values.reduce((s, v) => s + v, 0);
    const mean = sum / n;
    const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / n;

    const existing = this.baselines.get(metric);

    if (existing) {
      const alpha = 0.1;
      existing.mean = existing.mean * (1 - alpha) + mean * alpha;
      existing.stddev = existing.stddev * (1 - alpha) + Math.sqrt(variance) * alpha;
      existing.min = Math.min(existing.min, values[0]);
      existing.max = Math.max(existing.max, values[n - 1]);
      existing.p50 = values[Math.floor(n * 0.5)];
      existing.p95 = values[Math.floor(n * 0.95)];
      existing.p99 = values[Math.floor(n * 0.99)];
      existing.sampleCount += n;
      existing.updatedAt = Date.now();
    } else {
      this.baselines.set(metric, {
        id: `baseline_${metric}_${Date.now()}`,
        metric,
        mean,
        stddev: Math.sqrt(variance),
        min: values[0],
        max: values[n - 1],
        p50: values[Math.floor(n * 0.5)],
        p95: values[Math.floor(n * 0.95)],
        p99: values[Math.floor(n * 0.99)],
        sampleCount: n,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        windowSize: this.config.windowSize,
      });
    }
  }

  private classifySeverity(zScore: number, deviationPercent: number): RegressionSeverity {
    const absDeviation = Math.abs(deviationPercent);
    if (zScore > 4 || absDeviation > 50) return RegressionSeverity.CRITICAL;
    if (zScore > 3 || absDeviation > 30) return RegressionSeverity.MAJOR;
    if (zScore > 2.5 || absDeviation > 20) return RegressionSeverity.MODERATE;
    if (zScore > 2 || absDeviation > 10) return RegressionSeverity.MINOR;
    return RegressionSeverity.NONE;
  }

  private standardDeviation(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private deduplicateChangePoints(points: ChangePoint[], windowSize: number): ChangePoint[] {
    if (points.length <= 1) return points;

    const result: ChangePoint[] = [points[0]];
    for (let i = 1; i < points.length; i++) {
      const last = result[result.length - 1];
      if (points[i].index - last.index >= windowSize) {
        result.push(points[i]);
      } else if (points[i].confidence > last.confidence) {
        result[result.length - 1] = points[i];
      }
    }
    return result;
  }
}

export const regressionDetector = new RegressionDetector();
