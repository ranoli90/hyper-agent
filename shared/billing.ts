import { STORAGE_KEYS } from './config';

export type SubscriptionTier = 'free' | 'premium' | 'unlimited';
export type BillingInterval = 'month' | 'year';

export interface SubscriptionState {
  tier: SubscriptionTier;
  customerId?: string;
  subscriptionId?: string;
  currentPeriodStart?: number;
  currentPeriodEnd?: number;
  cancelAtPeriodEnd?: boolean;
  status: 'active' | 'canceled' | 'past_due' | 'incomplete' | 'trialing';
  licenseKey?: string;
  lastVerified?: number;
}

export interface PricingPlan {
  id: string;
  name: string;
  tier: SubscriptionTier;
  priceMonthly: number;
  priceYearly: number;
  features: string[];
  limits: { actions: number; sessions: number };
  stripePriceIdMonthly?: string;
  stripePriceIdYearly?: string;
  stripePaymentLinkMonthly?: string;
  stripePaymentLinkYearly?: string;
  popular?: boolean;
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'free',
    name: 'Free',
    tier: 'free',
    priceMonthly: 0,
    priceYearly: 0,
    features: [
      '100 actions per month',
      '3 autonomous sessions',
      'Basic automation',
      'Community support',
    ],
    limits: { actions: 100, sessions: 3 },
  },
  {
    id: 'premium',
    name: 'Premium',
    tier: 'premium',
    priceMonthly: 19,
    priceYearly: 190,
    features: [
      '1,000 actions per month',
      '50 autonomous sessions',
      'Advanced workflows & macros',
      'Priority support',
      'Vision mode',
      'Swarm intelligence',
    ],
    limits: { actions: 1000, sessions: 50 },
    stripePriceIdMonthly: 'price_premium_monthly',
    stripePriceIdYearly: 'price_premium_yearly',
    stripePaymentLinkMonthly: 'https://buy.stripe.com/14kdT25p9gDq5Ww5kl',
    stripePaymentLinkYearly: 'https://buy.stripe.com/14kdT25p9gDq5Ww5km',
    popular: true,
  },
  {
    id: 'unlimited',
    name: 'Unlimited',
    tier: 'unlimited',
    priceMonthly: 49,
    priceYearly: 490,
    features: [
      'Unlimited actions',
      'Unlimited autonomous sessions',
      'All premium features',
      'API access',
      'Team collaboration',
      'Custom workflows',
      'Dedicated support',
    ],
    limits: { actions: -1, sessions: -1 },
    stripePriceIdMonthly: 'price_unlimited_monthly',
    stripePriceIdYearly: 'price_unlimited_yearly',
    stripePaymentLinkMonthly: 'https://buy.stripe.com/6oE8xB5p9fCK7KM9AC',
    stripePaymentLinkYearly: 'https://buy.stripe.com/6oE8xB5p9fCK7KM9AD',
  },
];

const SUBSCRIPTION_STORAGE_KEY = 'hyperagent_subscription';
const LICENSE_VERIFICATION_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

export class BillingManager {
  private state: SubscriptionState = {
    tier: 'free',
    status: 'active',
  };
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    await this.loadState();
    await this.checkForPaymentSuccess();
    await this.verifySubscriptionIfNeeded();
  }

  private async loadState(): Promise<void> {
    try {
      const data = await chrome.storage.local.get(SUBSCRIPTION_STORAGE_KEY);
      if (data[SUBSCRIPTION_STORAGE_KEY]) {
        this.state = { ...this.state, ...data[SUBSCRIPTION_STORAGE_KEY] };
      }
    } catch (err) {
      console.warn('[Billing] Failed to load state:', err);
    }
  }

  private async saveState(): Promise<void> {
    try {
      await chrome.storage.local.set({ [SUBSCRIPTION_STORAGE_KEY]: this.state });
    } catch (err) {
      console.warn('[Billing] Failed to save state:', err);
    }
  }

  private async checkForPaymentSuccess(): Promise<void> {
    try {
      const result = await chrome.storage.local.get('stripe_payment_success');
      if (result.stripe_payment_success) {
        const { tier, customerId, subscriptionId } = result.stripe_payment_success;
        await this.updateSubscription(tier, customerId, subscriptionId);
        await chrome.storage.local.remove('stripe_payment_success');
      }
    } catch (err) {
      console.warn('[Billing] Failed to check payment success:', err);
    }
  }

  private async verifySubscriptionIfNeeded(): Promise<void> {
    if (this.state.tier === 'free') return;
    if (!this.state.lastVerified) return;

    const timeSinceVerification = Date.now() - this.state.lastVerified;
    if (timeSinceVerification > LICENSE_VERIFICATION_INTERVAL) {
      await this.verifySubscription();
    }
  }

  async verifySubscription(): Promise<boolean> {
    if (this.state.tier === 'free') return true;

    // Check if the current period has expired
    if (this.state.currentPeriodEnd && Date.now() > this.state.currentPeriodEnd) {
      if (this.state.cancelAtPeriodEnd) {
        await this.downgradeToFree();
        return false;
      }
    }

    // Verify via license key if available
    if (this.state.licenseKey) {
      try {
        const isValid = await this.verifyLicenseKey(this.state.licenseKey);
        if (!isValid) {
          await this.downgradeToFree();
          return false;
        }
        this.state.lastVerified = Date.now();
        await this.saveState();
        return true;
      } catch {
        // Network error during verification - grace period
        return true;
      }
    }

    this.state.lastVerified = Date.now();
    await this.saveState();
    return true;
  }

  private async verifyLicenseKey(key: string): Promise<boolean> {
    // License key format: HA-TIER-XXXXXXXX-XXXXXXXX
    const parts = key.split('-');
    if (parts.length < 4 || parts[0] !== 'HA') return false;

    const tier = parts[1].toLowerCase();
    if (tier !== 'premium' && tier !== 'unlimited') return false;

    return true;
  }

  private async downgradeToFree(): Promise<void> {
    this.state = {
      tier: 'free',
      status: 'active',
    };
    await this.saveState();
    console.log('[Billing] Subscription expired, downgraded to free tier');
  }

  getTier(): SubscriptionTier {
    return this.state.tier;
  }

  getState(): SubscriptionState {
    return { ...this.state };
  }

  isActive(): boolean {
    return this.state.status === 'active' || this.state.status === 'trialing';
  }

  async activateWithLicenseKey(key: string): Promise<{ success: boolean; error?: string }> {
    const parts = key.trim().split('-');
    if (parts.length < 4 || parts[0] !== 'HA') {
      return { success: false, error: 'Invalid license key format' };
    }

    const tier = parts[1].toLowerCase() as SubscriptionTier;
    if (tier !== 'premium' && tier !== 'unlimited') {
      return { success: false, error: 'Invalid tier in license key' };
    }

    const isValid = await this.verifyLicenseKey(key);
    if (!isValid) {
      return { success: false, error: 'License key verification failed' };
    }

    this.state = {
      tier,
      status: 'active',
      licenseKey: key,
      currentPeriodStart: Date.now(),
      currentPeriodEnd: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year
      lastVerified: Date.now(),
    };
    await this.saveState();
    return { success: true };
  }

  async updateSubscription(
    tier: SubscriptionTier,
    customerId?: string,
    subscriptionId?: string
  ): Promise<void> {
    this.state = {
      ...this.state,
      tier,
      customerId,
      subscriptionId,
      status: 'active',
      currentPeriodStart: Date.now(),
      currentPeriodEnd: Date.now() + 30 * 24 * 60 * 60 * 1000,
      lastVerified: Date.now(),
    };
    await this.saveState();
  }

  async cancelSubscription(): Promise<void> {
    this.state = {
      ...this.state,
      cancelAtPeriodEnd: true,
    };
    await this.saveState();
  }

  getPlan(tier: SubscriptionTier): PricingPlan | undefined {
    return PRICING_PLANS.find(p => p.tier === tier);
  }

  getAllPlans(): PricingPlan[] {
    return PRICING_PLANS;
  }

  getUpgradeUrl(tier: 'premium' | 'unlimited', interval: BillingInterval = 'month'): string {
    const plan = this.getPlan(tier);
    if (!plan) return 'https://hyperagent.ai/pricing';
    return interval === 'year'
      ? plan.stripePaymentLinkYearly || plan.stripePaymentLinkMonthly || 'https://hyperagent.ai/pricing'
      : plan.stripePaymentLinkMonthly || 'https://hyperagent.ai/pricing';
  }

  async openCheckout(tier: 'premium' | 'unlimited', interval: BillingInterval = 'month'): Promise<void> {
    const url = this.getUpgradeUrl(tier, interval);

    const clientReferenceId = `hyperagent_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

    await chrome.storage.local.set({
      stripe_pending_checkout: {
        tier,
        interval,
        clientReferenceId,
        timestamp: Date.now(),
      },
    });

    try {
      const checkoutUrl = new URL(url);
      checkoutUrl.searchParams.set('client_reference_id', clientReferenceId);
      chrome.tabs.create({ url: checkoutUrl.toString() });
    } catch {
      chrome.tabs.create({ url: `${url}?client_reference_id=${clientReferenceId}` });
    }
  }

  isFeatureAllowed(feature: string): boolean {
    const featureTiers: Record<string, SubscriptionTier[]> = {
      autonomous_mode: ['free', 'premium', 'unlimited'],
      unlimited_actions: ['unlimited'],
      advanced_workflows: ['premium', 'unlimited'],
      custom_macros: ['premium', 'unlimited'],
      api_access: ['unlimited'],
      team_collaboration: ['unlimited'],
      vision_mode: ['premium', 'unlimited'],
      swarm_intelligence: ['premium', 'unlimited'],
    };

    const allowedTiers = featureTiers[feature] || ['free', 'premium', 'unlimited'];
    return allowedTiers.includes(this.state.tier);
  }

  getUsageLimit(): { actions: number; sessions: number } {
    const plan = this.getPlan(this.state.tier);
    return plan?.limits || { actions: 100, sessions: 3 };
  }

  isWithinLimits(currentActions: number, currentSessions: number): { allowed: boolean; reason?: string } {
    const limits = this.getUsageLimit();

    if (limits.actions !== -1 && currentActions >= limits.actions) {
      return {
        allowed: false,
        reason: `Monthly action limit reached (${currentActions}/${limits.actions}). Upgrade to continue.`,
      };
    }

    if (limits.sessions !== -1 && currentSessions >= limits.sessions) {
      return {
        allowed: false,
        reason: `Monthly session limit reached (${currentSessions}/${limits.sessions}). Upgrade to continue.`,
      };
    }

    return { allowed: true };
  }

  getUsagePercentage(currentActions: number, currentSessions: number): { actions: number; sessions: number } {
    const limits = this.getUsageLimit();
    return {
      actions: limits.actions === -1 ? 0 : Math.min(100, (currentActions / limits.actions) * 100),
      sessions: limits.sessions === -1 ? 0 : Math.min(100, (currentSessions / limits.sessions) * 100),
    };
  }

  getDaysRemaining(): number {
    if (!this.state.currentPeriodEnd) return -1;
    const remaining = this.state.currentPeriodEnd - Date.now();
    return Math.max(0, Math.ceil(remaining / (24 * 60 * 60 * 1000)));
  }
}

export const billingManager = new BillingManager();
