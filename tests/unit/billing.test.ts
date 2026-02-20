import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock chrome APIs before importing billing module
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

import { BillingManager, PRICING_PLANS, type SubscriptionTier } from '../../shared/billing';

describe('BillingManager', () => {
  let billing: BillingManager;

  beforeEach(() => {
    Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
    vi.clearAllMocks();
    billing = new BillingManager();
  });

  describe('initialization', () => {
    it('starts with free tier', () => {
      expect(billing.getTier()).toBe('free');
      expect(billing.isActive()).toBe(true);
    });

    it('loads saved state from storage', async () => {
      mockStorage['hyperagent_subscription'] = {
        tier: 'premium',
        status: 'active',
        customerId: 'cus_123',
      };
      const manager = new BillingManager();
      await manager.initialize();
      expect(manager.getTier()).toBe('premium');
      expect(manager.getState().customerId).toBe('cus_123');
    });

    it('checks for pending payment success on init', async () => {
      mockStorage['stripe_payment_success'] = {
        tier: 'unlimited',
        customerId: 'cus_456',
        subscriptionId: 'sub_789',
      };
      const manager = new BillingManager();
      await manager.initialize();
      expect(manager.getTier()).toBe('unlimited');
      expect(mockStorage['stripe_payment_success']).toBeUndefined();
    });
  });

  describe('subscription management', () => {
    it('updates subscription tier and saves', async () => {
      await billing.updateSubscription('premium', 'cus_test', 'sub_test');
      expect(billing.getTier()).toBe('premium');
      expect(billing.getState().customerId).toBe('cus_test');
      expect(billing.getState().status).toBe('active');
      expect(chrome.storage.local.set).toHaveBeenCalled();
    });

    it('cancels subscription at period end', async () => {
      await billing.updateSubscription('premium');
      await billing.cancelSubscription();
      expect(billing.getState().cancelAtPeriodEnd).toBe(true);
      expect(billing.getTier()).toBe('premium');
    });
  });

  describe('license key activation', () => {
    it('activates with valid premium key', async () => {
      const result = await billing.activateWithLicenseKey('HA-PREMIUM-12345678-ABCDEFGH');
      expect(result.success).toBe(true);
      expect(billing.getTier()).toBe('premium');
    });

    it('activates with valid unlimited key', async () => {
      const result = await billing.activateWithLicenseKey('HA-UNLIMITED-12345678-ABCDEFGH');
      expect(result.success).toBe(true);
      expect(billing.getTier()).toBe('unlimited');
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
  });

  describe('feature gating', () => {
    it('allows basic features for free tier', () => {
      expect(billing.isFeatureAllowed('autonomous_mode')).toBe(true);
    });

    it('blocks unlimited_actions for free tier', () => {
      expect(billing.isFeatureAllowed('unlimited_actions')).toBe(false);
    });

    it('blocks api_access for free tier', () => {
      expect(billing.isFeatureAllowed('api_access')).toBe(false);
    });

    it('allows advanced_workflows for premium', async () => {
      await billing.updateSubscription('premium');
      expect(billing.isFeatureAllowed('advanced_workflows')).toBe(true);
    });

    it('allows everything for unlimited', async () => {
      await billing.updateSubscription('unlimited');
      expect(billing.isFeatureAllowed('unlimited_actions')).toBe(true);
      expect(billing.isFeatureAllowed('api_access')).toBe(true);
      expect(billing.isFeatureAllowed('team_collaboration')).toBe(true);
    });
  });

  describe('usage limits', () => {
    it('returns correct limits for free tier', () => {
      const limits = billing.getUsageLimit();
      expect(limits.actions).toBe(100);
      expect(limits.sessions).toBe(3);
    });

    it('returns correct limits for premium tier', async () => {
      await billing.updateSubscription('premium');
      const limits = billing.getUsageLimit();
      expect(limits.actions).toBe(1000);
      expect(limits.sessions).toBe(50);
    });

    it('returns unlimited for unlimited tier', async () => {
      await billing.updateSubscription('unlimited');
      const limits = billing.getUsageLimit();
      expect(limits.actions).toBe(-1);
      expect(limits.sessions).toBe(-1);
    });

    it('reports within limits correctly', () => {
      const result = billing.isWithinLimits(50, 2);
      expect(result.allowed).toBe(true);
    });

    it('reports over action limit', () => {
      const result = billing.isWithinLimits(100, 2);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('action limit');
    });

    it('reports over session limit', () => {
      const result = billing.isWithinLimits(50, 3);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('session limit');
    });

    it('unlimited tier always within limits', async () => {
      await billing.updateSubscription('unlimited');
      const result = billing.isWithinLimits(999999, 999999);
      expect(result.allowed).toBe(true);
    });
  });

  describe('usage percentage', () => {
    it('calculates correct percentages', () => {
      const pct = billing.getUsagePercentage(50, 1);
      expect(pct.actions).toBe(50);
      expect(pct.sessions).toBeCloseTo(33.33, 0);
    });

    it('caps at 100%', () => {
      const pct = billing.getUsagePercentage(200, 10);
      expect(pct.actions).toBe(100);
      expect(pct.sessions).toBe(100);
    });

    it('returns 0% for unlimited tier', async () => {
      await billing.updateSubscription('unlimited');
      const pct = billing.getUsagePercentage(5000, 500);
      expect(pct.actions).toBe(0);
      expect(pct.sessions).toBe(0);
    });
  });

  describe('checkout', () => {
    it('opens checkout with correct URL', async () => {
      await billing.openCheckout('premium', 'month');
      expect(chrome.tabs.create).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('buy.stripe.com'),
        })
      );
    });

    it('stores pending checkout info', async () => {
      await billing.openCheckout('unlimited', 'year');
      expect(mockStorage['stripe_pending_checkout']).toBeDefined();
      expect(mockStorage['stripe_pending_checkout'].tier).toBe('unlimited');
      expect(mockStorage['stripe_pending_checkout'].interval).toBe('year');
    });
  });
});

describe('PRICING_PLANS', () => {
  it('has 3 plans', () => {
    expect(PRICING_PLANS).toHaveLength(3);
  });

  it('has free, premium, and unlimited tiers', () => {
    const tiers = PRICING_PLANS.map(p => p.tier);
    expect(tiers).toContain('free');
    expect(tiers).toContain('premium');
    expect(tiers).toContain('unlimited');
  });

  it('free plan costs $0', () => {
    const free = PRICING_PLANS.find(p => p.tier === 'free');
    expect(free?.priceMonthly).toBe(0);
    expect(free?.priceYearly).toBe(0);
  });

  it('yearly pricing has discount', () => {
    const premium = PRICING_PLANS.find(p => p.tier === 'premium');
    expect(premium!.priceYearly).toBeLessThan(premium!.priceMonthly * 12);
  });

  it('premium plan has Stripe price IDs', () => {
    const premium = PRICING_PLANS.find(p => p.tier === 'premium');
    expect(premium?.stripePriceIdMonthly).toBeTruthy();
    expect(premium?.stripePaymentLinkMonthly).toBeTruthy();
  });

  it('all plans have features', () => {
    PRICING_PLANS.forEach(plan => {
      expect(plan.features.length).toBeGreaterThan(0);
    });
  });

  it('all plans have limits defined', () => {
    PRICING_PLANS.forEach(plan => {
      expect(plan.limits).toBeDefined();
      expect(typeof plan.limits.actions).toBe('number');
      expect(typeof plan.limits.sessions).toBe('number');
    });
  });
});
