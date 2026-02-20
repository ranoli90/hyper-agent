export interface DataSchema {
  fields: SchemaField[];
  constraints?: DataConstraint[];
}

export interface SchemaField {
  name: string;
  type: FieldType;
  required: boolean;
  nullable: boolean;
  defaultValue?: any;
  pattern?: string;
  min?: number;
  max?: number;
  enum?: any[];
  children?: SchemaField[];
}

export enum FieldType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  DATE = 'date',
  EMAIL = 'email',
  URL = 'url',
  PHONE = 'phone',
  ADDRESS = 'address',
  NAME = 'name',
  ARRAY = 'array',
  OBJECT = 'object',
  UUID = 'uuid',
  INTEGER = 'integer',
  FLOAT = 'float',
  CURRENCY = 'currency',
  PARAGRAPH = 'paragraph',
}

export interface DataConstraint {
  type: 'unique' | 'foreign_key' | 'check' | 'not_null';
  fields: string[];
  expression?: string;
  referenceTable?: string;
  referenceField?: string;
}

export interface GeneratedDataset {
  id: string;
  schema: DataSchema;
  records: Record<string, any>[];
  metadata: DatasetMetadata;
}

export interface DatasetMetadata {
  generatedAt: number;
  recordCount: number;
  schemaVersion: string;
  generator: string;
  seed?: number;
}

export interface MaskingRule {
  field: string;
  strategy: MaskingStrategy;
  preserveFormat?: boolean;
  preserveLength?: boolean;
}

export enum MaskingStrategy {
  REDACT = 'redact',
  HASH = 'hash',
  RANDOMIZE = 'randomize',
  SUBSTITUTE = 'substitute',
  PARTIAL_MASK = 'partial_mask',
  TOKENIZE = 'tokenize',
}

export interface DataQualityReport {
  completeness: number;
  accuracy: number;
  consistency: number;
  uniqueness: number;
  validity: number;
  overallScore: number;
  issues: DataQualityIssue[];
}

export interface DataQualityIssue {
  field: string;
  type: 'missing' | 'invalid' | 'duplicate' | 'inconsistent' | 'outlier';
  count: number;
  severity: 'low' | 'medium' | 'high';
  description: string;
}

const FIRST_NAMES = ['James', 'Mary', 'Robert', 'Patricia', 'John', 'Jennifer', 'Michael', 'Linda', 'David', 'Elizabeth', 'William', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Christopher', 'Karen'];
const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin'];
const DOMAINS = ['gmail.com', 'yahoo.com', 'outlook.com', 'protonmail.com', 'icloud.com'];
const STREETS = ['Main St', 'Oak Ave', 'Elm Dr', 'Maple Ln', 'Cedar Rd', 'Pine Way', 'Birch Ct', 'Walnut Pl', 'Cherry Blvd', 'Willow St'];
const CITIES = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'San Jose'];
const LOREM_WORDS = ['lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit', 'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'ut', 'labore', 'et', 'dolore', 'magna', 'aliqua'];

class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 16807 + 0) % 2147483647;
    return this.seed / 2147483647;
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
}

export class DataGenerator {
  private rng: SeededRandom;
  private generatedEmails = new Set<string>();
  private generatedUuids = new Set<string>();

  constructor(seed?: number) {
    this.rng = new SeededRandom(seed ?? Date.now());
  }

  generate(schema: DataSchema, count: number): GeneratedDataset {
    const records: Record<string, any>[] = [];

    for (let i = 0; i < count; i++) {
      const record: Record<string, any> = {};
      for (const field of schema.fields) {
        record[field.name] = this.generateFieldValue(field, i);
      }
      records.push(record);
    }

    return {
      id: `dataset_${Date.now()}_${this.rng.nextInt(1000, 9999)}`,
      schema,
      records,
      metadata: {
        generatedAt: Date.now(),
        recordCount: count,
        schemaVersion: '1.0',
        generator: 'HyperAgent DataGenerator',
      },
    };
  }

  generateFieldValue(field: SchemaField, index: number): any {
    if (field.nullable && this.rng.next() < 0.05) return null;

    if (field.enum && field.enum.length > 0) {
      return this.rng.pick(field.enum);
    }

    switch (field.type) {
      case FieldType.STRING:
        return this.generateString(field);
      case FieldType.NUMBER:
      case FieldType.FLOAT:
        return this.generateNumber(field);
      case FieldType.INTEGER:
        return Math.floor(this.generateNumber(field));
      case FieldType.BOOLEAN:
        return this.rng.next() > 0.5;
      case FieldType.DATE:
        return this.generateDate(field);
      case FieldType.EMAIL:
        return this.generateEmail();
      case FieldType.URL:
        return this.generateUrl();
      case FieldType.PHONE:
        return this.generatePhone();
      case FieldType.ADDRESS:
        return this.generateAddress();
      case FieldType.NAME:
        return this.generateName();
      case FieldType.UUID:
        return this.generateUuid();
      case FieldType.CURRENCY:
        return parseFloat((this.rng.next() * (field.max || 10000)).toFixed(2));
      case FieldType.PARAGRAPH:
        return this.generateParagraph();
      case FieldType.ARRAY:
        return this.generateArray(field);
      case FieldType.OBJECT:
        return this.generateObject(field);
      default:
        return `value_${index}`;
    }
  }

  generateEdgeCases(field: SchemaField): any[] {
    const cases: any[] = [];

    if (field.nullable) cases.push(null);
    cases.push(undefined);

    switch (field.type) {
      case FieldType.STRING:
        cases.push('', ' ', 'a'.repeat(field.max || 255), '<script>alert(1)</script>', "O'Brien", 'user@example.com', '日本語テスト');
        break;
      case FieldType.NUMBER:
      case FieldType.FLOAT:
        cases.push(0, -1, Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER, NaN, Infinity, -Infinity);
        if (field.min !== undefined) cases.push(field.min, field.min - 1);
        if (field.max !== undefined) cases.push(field.max, field.max + 1);
        break;
      case FieldType.INTEGER:
        cases.push(0, -1, 2147483647, -2147483648, 1.5);
        break;
      case FieldType.BOOLEAN:
        cases.push(true, false, 0, 1, '', 'true', 'false');
        break;
      case FieldType.DATE:
        cases.push(new Date(0).toISOString(), new Date('2099-12-31').toISOString(), 'invalid-date', '');
        break;
      case FieldType.EMAIL:
        cases.push('', 'invalid', '@invalid.com', 'user@', 'user@.com', 'a@b.c', 'very.long.email.address@extremely.long.domain.name.example.com');
        break;
      case FieldType.URL:
        cases.push('', 'not-a-url', 'http://', 'ftp://files.example.com', 'javascript:alert(1)');
        break;
    }

    return cases;
  }

  private generateString(field: SchemaField): string {
    if (field.pattern) return this.generateFromPattern(field.pattern);
    const length = this.rng.nextInt(field.min || 1, field.max || 50);
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars[Math.floor(this.rng.next() * chars.length)];
    }
    return result;
  }

  private generateNumber(field: SchemaField): number {
    const min = field.min ?? 0;
    const max = field.max ?? 1000;
    return min + this.rng.next() * (max - min);
  }

  private generateDate(field: SchemaField): string {
    const minDate = field.min ? new Date(field.min).getTime() : Date.now() - 365 * 24 * 60 * 60 * 1000;
    const maxDate = field.max ? new Date(field.max).getTime() : Date.now();
    const timestamp = minDate + this.rng.next() * (maxDate - minDate);
    return new Date(timestamp).toISOString();
  }

  private generateEmail(): string {
    let email: string;
    let attempts = 0;
    do {
      const first = this.rng.pick(FIRST_NAMES).toLowerCase();
      const last = this.rng.pick(LAST_NAMES).toLowerCase();
      const num = this.rng.nextInt(1, 999);
      const domain = this.rng.pick(DOMAINS);
      email = `${first}.${last}${num}@${domain}`;
      attempts++;
    } while (this.generatedEmails.has(email) && attempts < 100);
    this.generatedEmails.add(email);
    return email;
  }

  private generateUrl(): string {
    const protocols = ['https://'];
    const tlds = ['com', 'org', 'net', 'io', 'dev'];
    const protocol = this.rng.pick(protocols);
    const domain = this.generateString({ name: '', type: FieldType.STRING, required: true, nullable: false, min: 3, max: 10 }).toLowerCase();
    const tld = this.rng.pick(tlds);
    return `${protocol}www.${domain}.${tld}`;
  }

  private generatePhone(): string {
    const area = this.rng.nextInt(200, 999);
    const exchange = this.rng.nextInt(200, 999);
    const subscriber = this.rng.nextInt(1000, 9999);
    return `(${area}) ${exchange}-${subscriber}`;
  }

  private generateAddress(): string {
    const num = this.rng.nextInt(1, 9999);
    const street = this.rng.pick(STREETS);
    const city = this.rng.pick(CITIES);
    const zip = this.rng.nextInt(10000, 99999);
    return `${num} ${street}, ${city} ${zip}`;
  }

  private generateName(): string {
    return `${this.rng.pick(FIRST_NAMES)} ${this.rng.pick(LAST_NAMES)}`;
  }

  private generateUuid(): string {
    const hex = () => this.rng.nextInt(0, 15).toString(16);
    let uuid: string;
    let attempts = 0;
    do {
      uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = c === 'x' ? hex() : (parseInt(hex(), 16) & 0x3 | 0x8).toString(16);
        return r;
      });
      attempts++;
    } while (this.generatedUuids.has(uuid) && attempts < 100);
    this.generatedUuids.add(uuid);
    return uuid;
  }

  private generateParagraph(): string {
    const sentenceCount = this.rng.nextInt(2, 5);
    const sentences: string[] = [];
    for (let i = 0; i < sentenceCount; i++) {
      const wordCount = this.rng.nextInt(5, 15);
      const words: string[] = [];
      for (let j = 0; j < wordCount; j++) {
        words.push(this.rng.pick(LOREM_WORDS));
      }
      words[0] = words[0].charAt(0).toUpperCase() + words[0].slice(1);
      sentences.push(words.join(' ') + '.');
    }
    return sentences.join(' ');
  }

  private generateArray(field: SchemaField): any[] {
    const length = this.rng.nextInt(field.min || 1, field.max || 5);
    if (!field.children || field.children.length === 0) {
      return Array.from({ length }, (_, i) => `item_${i}`);
    }
    return Array.from({ length }, (_, i) => this.generateFieldValue(field.children![0], i));
  }

  private generateObject(field: SchemaField): Record<string, any> {
    const obj: Record<string, any> = {};
    if (field.children) {
      for (const child of field.children) {
        obj[child.name] = this.generateFieldValue(child, 0);
      }
    }
    return obj;
  }

  private generateFromPattern(pattern: string): string {
    return pattern.replace(/\[([^\]]+)\]\{(\d+)\}/g, (_match, chars, count) => {
      let result = '';
      for (let i = 0; i < parseInt(count); i++) {
        result += chars.charAt(Math.floor(this.rng.next() * chars.length));
      }
      return result;
    });
  }
}

export class DataMasker {
  mask(data: Record<string, any>[], rules: MaskingRule[]): Record<string, any>[] {
    return data.map(record => {
      const masked = { ...record };
      for (const rule of rules) {
        if (rule.field in masked && masked[rule.field] != null) {
          masked[rule.field] = this.applyMask(masked[rule.field], rule);
        }
      }
      return masked;
    });
  }

  private applyMask(value: any, rule: MaskingRule): any {
    const str = String(value);

    switch (rule.strategy) {
      case MaskingStrategy.REDACT:
        return rule.preserveLength ? '*'.repeat(str.length) : '***REDACTED***';

      case MaskingStrategy.HASH: {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
          hash = (hash << 5) - hash + str.charCodeAt(i);
          hash = hash & hash;
        }
        return `hash_${Math.abs(hash).toString(36)}`;
      }

      case MaskingStrategy.RANDOMIZE:
        if (typeof value === 'number') return Math.random() * value;
        return this.randomizeString(str, rule.preserveFormat ?? false);

      case MaskingStrategy.SUBSTITUTE:
        if (str.includes('@')) return 'user@example.com';
        return 'SUBSTITUTED';

      case MaskingStrategy.PARTIAL_MASK:
        if (str.length <= 4) return '*'.repeat(str.length);
        return str.slice(0, 2) + '*'.repeat(str.length - 4) + str.slice(-2);

      case MaskingStrategy.TOKENIZE:
        return `TOKEN_${Math.random().toString(36).substr(2, 8)}`;

      default:
        return '***';
    }
  }

  private randomizeString(str: string, preserveFormat: boolean): string {
    if (!preserveFormat) {
      return Array.from({ length: str.length }, () =>
        String.fromCharCode(97 + Math.floor(Math.random() * 26))
      ).join('');
    }
    return str.replace(/[a-zA-Z]/g, () =>
      String.fromCharCode(97 + Math.floor(Math.random() * 26))
    ).replace(/[0-9]/g, () =>
      String(Math.floor(Math.random() * 10))
    );
  }
}

export class DataQualityChecker {
  check(data: Record<string, any>[], schema: DataSchema): DataQualityReport {
    const issues: DataQualityIssue[] = [];

    const completeness = this.checkCompleteness(data, schema, issues);
    const validity = this.checkValidity(data, schema, issues);
    const uniqueness = this.checkUniqueness(data, schema, issues);
    const consistency = this.checkConsistency(data, schema, issues);

    const overallScore = (completeness + validity + uniqueness + consistency) / 4;

    return {
      completeness,
      accuracy: validity,
      consistency,
      uniqueness,
      validity,
      overallScore,
      issues,
    };
  }

  private checkCompleteness(data: Record<string, any>[], schema: DataSchema, issues: DataQualityIssue[]): number {
    if (data.length === 0) return 0;

    let totalFields = 0;
    let nonNullFields = 0;

    for (const record of data) {
      for (const field of schema.fields) {
        totalFields++;
        if (record[field.name] != null && record[field.name] !== '') {
          nonNullFields++;
        } else if (field.required) {
          issues.push({
            field: field.name,
            type: 'missing',
            count: 1,
            severity: 'high',
            description: `Required field '${field.name}' is missing`,
          });
        }
      }
    }

    return totalFields > 0 ? nonNullFields / totalFields : 0;
  }

  private checkValidity(data: Record<string, any>[], schema: DataSchema, issues: DataQualityIssue[]): number {
    if (data.length === 0) return 0;

    let totalChecks = 0;
    let validChecks = 0;

    for (const record of data) {
      for (const field of schema.fields) {
        const value = record[field.name];
        if (value == null) continue;

        totalChecks++;
        if (this.isValidValue(value, field)) {
          validChecks++;
        } else {
          issues.push({
            field: field.name,
            type: 'invalid',
            count: 1,
            severity: 'medium',
            description: `Invalid value for field '${field.name}': ${String(value).slice(0, 50)}`,
          });
        }
      }
    }

    return totalChecks > 0 ? validChecks / totalChecks : 1;
  }

  private checkUniqueness(data: Record<string, any>[], schema: DataSchema, issues: DataQualityIssue[]): number {
    if (data.length === 0) return 1;

    const uniqueConstraints = schema.constraints?.filter(c => c.type === 'unique') || [];
    if (uniqueConstraints.length === 0) return 1;

    let totalChecks = 0;
    let uniqueChecks = 0;

    for (const constraint of uniqueConstraints) {
      totalChecks++;
      const values = new Set<string>();
      let duplicates = 0;

      for (const record of data) {
        const key = constraint.fields.map(f => String(record[f])).join('|');
        if (values.has(key)) {
          duplicates++;
        } else {
          values.add(key);
        }
      }

      if (duplicates === 0) {
        uniqueChecks++;
      } else {
        issues.push({
          field: constraint.fields.join(', '),
          type: 'duplicate',
          count: duplicates,
          severity: 'high',
          description: `${duplicates} duplicate(s) found for unique constraint on ${constraint.fields.join(', ')}`,
        });
      }
    }

    return totalChecks > 0 ? uniqueChecks / totalChecks : 1;
  }

  private checkConsistency(data: Record<string, any>[], _schema: DataSchema, issues: DataQualityIssue[]): number {
    if (data.length < 2) return 1;

    let totalChecks = 0;
    let consistentChecks = 0;

    const fields = Object.keys(data[0] || {});
    for (const field of fields) {
      totalChecks++;
      const types = new Set(data.map(r => typeof r[field]));
      if (types.size <= 2) {
        consistentChecks++;
      } else {
        issues.push({
          field,
          type: 'inconsistent',
          count: types.size,
          severity: 'medium',
          description: `Field '${field}' has ${types.size} different types`,
        });
      }
    }

    return totalChecks > 0 ? consistentChecks / totalChecks : 1;
  }

  private isValidValue(value: any, field: SchemaField): boolean {
    switch (field.type) {
      case FieldType.NUMBER:
      case FieldType.FLOAT:
      case FieldType.INTEGER:
      case FieldType.CURRENCY:
        if (typeof value !== 'number' || isNaN(value)) return false;
        if (field.min !== undefined && value < field.min) return false;
        if (field.max !== undefined && value > field.max) return false;
        if (field.type === FieldType.INTEGER && !Number.isInteger(value)) return false;
        return true;
      case FieldType.STRING:
      case FieldType.PARAGRAPH:
        if (typeof value !== 'string') return false;
        if (field.min !== undefined && value.length < field.min) return false;
        if (field.max !== undefined && value.length > field.max) return false;
        if (field.pattern && !new RegExp(field.pattern).test(value)) return false;
        return true;
      case FieldType.BOOLEAN:
        return typeof value === 'boolean';
      case FieldType.EMAIL:
        return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      case FieldType.URL:
        try { new URL(String(value)); return true; } catch { return false; }
      case FieldType.DATE:
        return !isNaN(new Date(value).getTime());
      default:
        return true;
    }
  }
}

export const dataGenerator = new DataGenerator();
export const dataMasker = new DataMasker();
export const dataQualityChecker = new DataQualityChecker();
