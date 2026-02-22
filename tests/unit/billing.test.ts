import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockStorage: Record<string, any> = {};
(globalThis as any).chrome = {
  storage: {
    local: {
      get: vi.fn(async (keys: string | string[]) => {
        if (typeof keys === 'string') return { [keys]: mockStorage[keys] };
        if (Array.isArray(keys)) {
          const result: Record<string, any> = {};
          keys.forEach(k => { result[k] = mockStorage[k]; });
          return result;
        }
        return mockStorage;
      }),
      set: vi.fn(async (items: Record<string, any>) => {
        Object.assign(mockStorage, items);
      }),
      remove: vi.fn(async (keys: string | string[]) => {
        const arr = Array.isArray(keys) ? keys : [keys];
        arr.forEach(k => delete mockStorage[k]);
      }),
    },
  },
  tabs: {
    create: vi.fn(async () => ({ id: 1 })),
  },
};

import { BillingManager, SUBSCRIPTION_PLANS, type SubscriptionPlanId } from '../../shared/billing';

describe('BillingManager', () => {
  let billing: BillingManager;

  beforeEach(() => {
    Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
    vi.clearAllMocks();
    billing = new BillingManager();
  });

  describe('initialization', () => {
    it('starts with community tier', () => {
      expect(billing.getTier()).toBe('community');
      expect(billing.isActive()).toBe(true);
    });

    it('loads saved state from storage', async () => {
      mockStorage['hyperagent_subscription'] = {
        plan: 'beta',
        status: 'active',
        stripeCustomerId: 'cus_123',
      };
      const manager = new BillingManager();
      await manager.initialize();
      expect(manager.getTier()).toBe('beta');
      expect(manager.getState().stripeCustomerId).toBe('cus_123');
    });

    it('checks for pending payment success on init', async () => {
      mockStorage['hyperagent_payment_success'] = {
        type: 'stripe',
        plan: 'beta',
        customerId: 'cus_456',
        subscriptionId: 'sub_789',
      };
      const manager = new BillingManager();
      await manager.initialize();
      expect(manager.getTier()).toBe('beta');
      expect(mockStorage['hyperagent_payment_success']).toBeUndefined();
    });
  });

  describe('subscription management', () => {
    it('updates subscription tier and saves', async () => {
      await billing.updateSubscription('beta', {
        stripeCustomerId: 'cus_test',
        subscriptionId: 'sub_test',
      });
      expect(billing.getTier()).toBe('beta');
      expect(billing.getState().stripeCustomerId).toBe('cus_test');
      expect(billing.getState().status).toBe('active');
      expect(chrome.storage.local.set).toHaveBeenCalled();
    });

    it('cancels subscription at period end', async () => {
      await billing.updateSubscription('beta');
      await billing.cancelSubscription();
      expect(billing.getState().cancelAtPeriodEnd).toBe(true);
      expect(billing.getTier()).toBe('beta');
    });
  });

  describe('license key activation', () => {
    it('activates with valid beta key', async () => {
      const key = billing.generateTestKey('beta');
      const result = await billing.activateWithLicenseKey(key);
      expect(result.success).toBe(true);
      expect(billing.getTier()).toBe('beta');
    });

    it('activates with valid premium key (maps to beta)', async () => {
      const key = billing.generateTestKey('premium');
      const result = await billing.activateWithLicenseKey(key);
      expect(result.success).toBe(true);
      expect(billing.getTier()).toBe('beta');
    });

    it('activates with valid unlimited key (maps to beta)', async () => {
      const key = billing.generateTestKey('unlimited');
      const result = await billing.activateWithLicenseKey(key);
      expect(result.success).toBe(true);
      expect(billing.getTier()).toBe('beta');
    });

    it('rejects invalid key format', async () => {
      const result = await billing.activateWithLicenseKey('INVALID-KEY');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid');
    });

    it('rejects key with invalid tier', async () => {
      const result = await billing.activateWithLicenseKey('HA-INVALID-12345678-ABCDEFGH');
      expect(result.success).toBe(false);
    });

    it('rejects empty key', async () => {
      const result = await billing.activateWithLicenseKey('');
      expect(result.success).toBe(false);
    });

    it('rejects key with wrong checksum', async () => {
      const result = await billing.activateWithLicenseKey('HA-BETA-12345678-12345678');
      expect(result.success).toBe(false);
    });

    it('rejects forged key without proper checksum', async () => {
      const result = await billing.activateWithLicenseKey('HA-BETA-AAAAAAAA-BBBBBBBB');
      expect(result.success).toBe(false);
    });

    it('rate limits after 5 failed attempts', async () => {
      for (let i = 0; i < 5; i++) {
        await billing.activateWithLicenseKey('HA-BETA-AAAAAAAA-BBBBBBBB');
      }
      const result = await billing.activateWithLicenseKey('HA-BETA-AAAAAAAA-BBBBBBBB');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Too many failed attempts');
    });

    it('clears rate limit after successful activation', async () => {
      for (let i = 0; i < 3; i++) {
        await billing.activateWithLicenseKey('HA-BETA-AAAAAAAA-BBBBBBBB');
      }
      const key = billing.generateTestKey('beta');
      const result = await billing.activateWithLicenseKey(key);
      expect(result.success).toBe(true);
      
      const newBilling = new BillingManager();
      const key2 = newBilling.generateTestKey('premium');
      const result2 = await newBilling.activateWithLicenseKey(key2);
      expect(result2.success).toBe(true);
    });
  });

  describe('feature gating', () => {
    it('allows basic features for community tier', () => {
      expect(billing.isFeatureAllowed('automation')).toBe(true);
      expect(billing.isFeatureAllowed('extract')).toBe(true);
    });

    it('blocks priority_ai for community tier', () => {
      expect(billing.isFeatureAllowed('priority_ai')).toBe(false);
    });

    it('blocks no_watermark for community tier', () => {
      expect(billing.isFeatureAllowed('no_watermark')).toBe(false);
    });

    it('allows priority_ai for beta', async () => {
      await billing.updateSubscription('beta');
      expect(billing.isFeatureAllowed('priority_ai')).toBe(true);
    });

    it('allows all features for beta', async () => {
      await billing.updateSubscription('beta');
      expect(billing.isFeatureAllowed('priority_ai')).toBe(true);
      expect(billing.isFeatureAllowed('no_watermark')).toBe(true);
      expect(billing.isFeatureAllowed('unlimited_workflows')).toBe(true);
    });
  });

  describe('usage limits', () => {
    it('returns correct limits for community tier', () => {
      const limits = billing.getUsageLimit();
      expect(limits.actions).toBe(500);
      expect(limits.sessions).toBe(10);
    });

    it('returns unlimited for beta tier', async () => {
      await billing.updateSubscription('beta');
      const limits = billing.getUsageLimit();
      expect(limits.actions).toBe(-1);
      expect(limits.sessions).toBe(-1);
    });

    it('reports within limits correctly', () => {
      const result = billing.isWithinLimits(50, 2);
      expect(result.allowed).toBe(true);
    });

    it('reports over action limit', () => {
      const result = billing.isWithinLimits(500, 2);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('action limit');
    });

    it('reports over session limit', () => {
      const result = billing.isWithinLimits(50, 10);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Session limit');
    });

    it('beta tier always within limits', async () => {
      await billing.updateSubscription('beta');
      const result = billing.isWithinLimits(999999, 999999);
      expect(result.allowed).toBe(true);
    });
  });

  describe('usage percentage', () => {
    it('calculates correct percentages', () => {
      const pct = billing.getUsagePercentage(250);
      expect(pct).toBe(50);
    });

    it('caps at 100%', () => {
      const pct = billing.getUsagePercentage(1000);
      expect(pct).toBe(100);
    });

    it('returns 0% for beta tier', async () => {
      await billing.updateSubscription('beta');
      const pct = billing.getUsagePercentage(5000);
      expect(pct).toBe(0);
    });
  });

  describe('checkout', () => {
    it('opens checkout with correct URL', async () => {
      mockStorage['hyperagent_payment_config'] = {
        stripePaymentLinkBeta: 'https://buy.stripe.com/test',
      };
      await billing.initialize();
      const result = await billing.openCheckout('beta');
      expect(result.success).toBe(true);
      expect(chrome.tabs.create).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('buy.stripe.com'),
        })
      );
    });

    it('stores pending checkout info', async () => {
      mockStorage['hyperagent_payment_config'] = {
        stripePaymentLinkBeta: 'https://buy.stripe.com/test',
      };
      await billing.initialize();
      await billing.openCheckout('beta');
      expect(mockStorage['hyperagent_pending_checkout']).toBeDefined();
      expect(mockStorage['hyperagent_pending_checkout'].plan).toBe('beta');
    });
  });
});

describe('SUBSCRIPTION_PLANS', () => {
  it('has 2 plans', () => {
    expect(SUBSCRIPTION_PLANS).toHaveLength(2);
  });

  it('has community and beta plans', () => {
    const ids = SUBSCRIPTION_PLANS.map(p => p.id);
    expect(ids).toContain('community');
    expect(ids).toContain('beta');
  });

  it('community plan costs $0', () => {
    const community = SUBSCRIPTION_PLANS.find(p => p.id === 'community');
    expect(community?.price).toBe(0);
  });

  it('beta plan costs $5', () => {
    const beta = SUBSCRIPTION_PLANS.find(p => p.id === 'beta');
    expect(beta?.price).toBe(5);
  });

  it('all plans have features', () => {
    SUBSCRIPTION_PLANS.forEach(plan => {
      expect(plan.features.length).toBeGreaterThan(0);
    });
  });

  it('all plans have workflow limits defined', () => {
    SUBSCRIPTION_PLANS.forEach(plan => {
      expect(typeof plan.workflowLimit).toBe('number');
    });
  });

  it('community has watermark', () => {
    const community = SUBSCRIPTION_PLANS.find(p => p.id === 'community');
    expect(community?.watermark).toBe(true);
  });

  it('beta has no watermark', () => {
    const beta = SUBSCRIPTION_PLANS.find(p => p.id === 'beta');
    expect(beta?.watermark).toBe(false);
  });
});
