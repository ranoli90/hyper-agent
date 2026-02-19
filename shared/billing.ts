import { STORAGE_KEYS } from './config';

export type SubscriptionTier = 'free' | 'premium' | 'unlimited';

export interface SubscriptionState {
  tier: SubscriptionTier;
  customerId?: string;
  subscriptionId?: string;
  currentPeriodStart?: number;
  currentPeriodEnd?: number;
  cancelAtPeriodEnd?: boolean;
  status: 'active' | 'canceled' | 'past_due' | 'incomplete' | 'trialing';
}

export interface PricingPlan {
  id: string;
  name: string;
  tier: SubscriptionTier;
  price: number;
  interval: 'month' | 'year';
  features: string[];
  stripePriceId?: string;
  stripePaymentLink?: string;
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'free',
    name: 'Free',
    tier: 'free',
    price: 0,
    interval: 'month',
    features: [
      '100 actions per month',
      '3 autonomous sessions',
      'Basic automation',
      'Community support',
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    tier: 'premium',
    price: 19,
    interval: 'month',
    features: [
      '1,000 actions per month',
      '50 autonomous sessions',
      'Advanced workflows',
      'Priority support',
      'Custom macros',
    ],
    stripePriceId: 'price_premium_monthly',
    stripePaymentLink: 'https://buy.stripe.com/14kdT25p9gDq5Ww5kl',
  },
  {
    id: 'unlimited',
    name: 'Unlimited',
    tier: 'unlimited',
    price: 49,
    interval: 'month',
    features: [
      'Unlimited actions',
      'Unlimited autonomous sessions',
      'All advanced features',
      'Priority support',
      'API access',
      'Team collaboration',
    ],
    stripePriceId: 'price_unlimited_monthly',
    stripePaymentLink: 'https://buy.stripe.com/6oE8xB5p9fCK7KM9AC',
  },
];

const SUBSCRIPTION_STORAGE_KEY = 'hyperagent_subscription';

export class BillingManager {
  private state: SubscriptionState = {
    tier: 'free',
    status: 'active',
  };

  async initialize(): Promise<void> {
    await this.loadState();
    await this.checkForPaymentSuccess();
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

  getTier(): SubscriptionTier {
    return this.state.tier;
  }

  getState(): SubscriptionState {
    return { ...this.state };
  }

  isActive(): boolean {
    return this.state.status === 'active';
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

  getUpgradeUrl(tier: 'premium' | 'unlimited'): string {
    const plan = this.getPlan(tier);
    return plan?.stripePaymentLink || `https://hyperagent.ai/pricing`;
  }

  async openCheckout(tier: 'premium' | 'unlimited'): Promise<void> {
    const url = this.getUpgradeUrl(tier);

    const clientReferenceId = `hyperagent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await chrome.storage.local.set({
      stripe_pending_checkout: {
        tier,
        clientReferenceId,
        timestamp: Date.now(),
      },
    });

    chrome.tabs.create({ url: `${url}?client_reference_id=${clientReferenceId}` });
  }

  isFeatureAllowed(feature: string): boolean {
    const featureTiers: Record<string, SubscriptionTier[]> = {
      autonomous_mode: ['premium', 'unlimited'],
      unlimited_actions: ['unlimited'],
      advanced_workflows: ['premium', 'unlimited'],
      custom_macros: ['premium', 'unlimited'],
      api_access: ['unlimited'],
      team_collaboration: ['unlimited'],
    };

    const allowedTiers = featureTiers[feature] || ['free', 'premium', 'unlimited'];
    return allowedTiers.includes(this.state.tier);
  }

  getUsageLimit(): { actions: number; sessions: number } {
    const limits: Record<SubscriptionTier, { actions: number; sessions: number }> = {
      free: { actions: 100, sessions: 3 },
      premium: { actions: 1000, sessions: 50 },
      unlimited: { actions: -1, sessions: -1 },
    };
    return limits[this.state.tier];
  }
}

export const billingManager = new BillingManager();
