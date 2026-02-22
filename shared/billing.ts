export type SubscriptionPlanId = 'community' | 'beta';
export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'incomplete';
export type PaymentMethodType = 'stripe' | 'crypto';

// Legacy type alias for backward compatibility
export type SubscriptionTier = 'free' | 'premium' | 'unlimited';

export interface SubscriptionPlan {
  id: SubscriptionPlanId;
  name: string;
  price: number;
  features: string[];
  watermark: boolean;
  workflowLimit: number;
}

export interface PaymentMethod {
  type: PaymentMethodType;
  last4?: string;
  walletAddress?: string;
  chainId?: number;
}

export interface BillingState {
  plan: SubscriptionPlanId;
  status: SubscriptionStatus;
  paymentMethod?: PaymentMethod;
  stripeCustomerId?: string;
  subscriptionId?: string;
  currentPeriodEnd?: number;
  cancelAtPeriodEnd?: boolean;
  lastVerified?: number;
  licenseKey?: string;
  cryptoTxHash?: string;
}

export interface PaymentConfig {
  stripePublishableKey: string;
  stripePaymentLinkBeta: string;
  cryptoRecipientAddress: string;
  supportedChains: number[];
  betaPriceUsd: number;
  etherscanApiKey?: string;
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'community',
    name: 'Community',
    price: 0,
    features: [
      'Full AI automation features',
      '"Powered by HyperAgent" watermark on exports',
      '3 saved workflows',
      'Public community support',
      'Standard AI processing',
    ],
    watermark: true,
    workflowLimit: 3,
  },
  {
    id: 'beta',
    name: 'Beta',
    price: 5,
    features: [
      'Everything in Community',
      'No watermark on exports',
      'Unlimited saved workflows',
      'Priority AI processing',
      'Early access to new features',
      'Direct email support',
    ],
    watermark: false,
    workflowLimit: -1,
  },
];

// Legacy constant for backward compatibility
export const PRICING_PLANS = {
  free: { name: 'Free', price: 0, actionsPerMonth: 500 },
  premium: { name: 'Premium', price: 5, actionsPerMonth: -1 },
  unlimited: { name: 'Unlimited', price: 49, actionsPerMonth: -1 },
};

import { PAYMENT_CONFIG } from './config';

const STORAGE_KEYS = {
  SUBSCRIPTION: 'hyperagent_subscription',
  PAYMENT_CONFIG: 'hyperagent_payment_config',
  PENDING_CHECKOUT: 'hyperagent_pending_checkout',
  PAYMENT_SUCCESS: 'hyperagent_payment_success',
  RATE_LIMIT: 'hyperagent_billing_rate_limit',
};

const VERIFICATION_INTERVAL_MS = 24 * 60 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;
const RATE_LIMIT_DURATION_MS = 60 * 60 * 1000;

const DEFAULT_PAYMENT_CONFIG: PaymentConfig = {
  stripePublishableKey: PAYMENT_CONFIG.STRIPE_PUBLISHABLE_KEY,
  stripePaymentLinkBeta: PAYMENT_CONFIG.STRIPE_PAYMENT_LINK_BETA,
  cryptoRecipientAddress: PAYMENT_CONFIG.CRYPTO_RECIPIENT_ADDRESS,
  supportedChains: PAYMENT_CONFIG.SUPPORTED_CHAINS.map(c => c.chainId),
  betaPriceUsd: PAYMENT_CONFIG.BETA_PRICE_USD,
  etherscanApiKey: '',
};

const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum Mainnet',
  8453: 'Base',
  137: 'Polygon',
};

const CHAIN_CURRENCY: Record<number, string> = {
  1: 'ETH',
  8453: 'ETH',
  137: 'MATIC',
};

const CHAIN_EXPLORER: Record<number, string> = {
  1: 'https://etherscan.io',
  8453: 'https://basescan.org',
  137: 'https://polygonscan.com',
};

export class BillingManager {
  private state: BillingState = {
    plan: 'community',
    status: 'active',
  };
  private config: PaymentConfig = { ...DEFAULT_PAYMENT_CONFIG };
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    await this.loadConfig();
    await this.loadState();
    await this.checkForPaymentSuccess();
    await this.verifySubscriptionIfNeeded();
  }

  private async loadConfig(): Promise<void> {
    try {
      const data = await chrome.storage.local.get(STORAGE_KEYS.PAYMENT_CONFIG);
      if (data[STORAGE_KEYS.PAYMENT_CONFIG]) {
        this.config = { ...DEFAULT_PAYMENT_CONFIG, ...data[STORAGE_KEYS.PAYMENT_CONFIG] };
      }
    } catch (err) {
      console.warn('[Billing] Failed to load payment config:', err);
    }
  }

  private async saveConfig(): Promise<void> {
    try {
      await chrome.storage.local.set({ [STORAGE_KEYS.PAYMENT_CONFIG]: this.config });
    } catch (err) {
      console.warn('[Billing] Failed to save payment config:', err);
    }
  }

  async configurePayment(config: Partial<PaymentConfig>): Promise<{ success: boolean; error?: string }> {
    if (config.stripePublishableKey !== undefined) {
      if (config.stripePublishableKey && !config.stripePublishableKey.startsWith('pk_')) {
        return { success: false, error: 'Invalid Stripe publishable key format' };
      }
    }

    if (config.cryptoRecipientAddress !== undefined) {
      if (config.cryptoRecipientAddress && !/^0x[a-fA-F0-9]{40}$/.test(config.cryptoRecipientAddress)) {
        return { success: false, error: 'Invalid Ethereum address format' };
      }
    }

    this.config = { ...this.config, ...config };
    await this.saveConfig();
    return { success: true };
  }

  getPaymentConfig(): PaymentConfig {
    return { ...this.config };
  }

  private static isRealCryptoAddress(addr: string | undefined): boolean {
    if (!addr || addr.length !== 42) return false;
    const zero = '0x0000000000000000000000000000000000000000';
    return addr.toLowerCase() !== zero;
  }

  isPaymentConfigured(): boolean {
    return !!(
      this.config.stripePaymentLinkBeta ||
      (this.config.cryptoRecipientAddress && BillingManager.isRealCryptoAddress(this.config.cryptoRecipientAddress))
    );
  }

  private async loadState(): Promise<void> {
    try {
      const data = await chrome.storage.local.get(STORAGE_KEYS.SUBSCRIPTION);
      if (data[STORAGE_KEYS.SUBSCRIPTION]) {
        this.state = { ...this.state, ...data[STORAGE_KEYS.SUBSCRIPTION] };
      }
    } catch (err) {
      console.warn('[Billing] Failed to load state:', err);
    }
  }

  private async saveState(): Promise<void> {
    try {
      await chrome.storage.local.set({ [STORAGE_KEYS.SUBSCRIPTION]: this.state });
    } catch (err) {
      console.warn('[Billing] Failed to save state:', err);
    }
  }

  private async checkForPaymentSuccess(): Promise<void> {
    try {
      const data = await chrome.storage.local.get(STORAGE_KEYS.PAYMENT_SUCCESS);
      if (data[STORAGE_KEYS.PAYMENT_SUCCESS]) {
        const success = data[STORAGE_KEYS.PAYMENT_SUCCESS];
        if (success.type === 'stripe') {
          await this.updateSubscription('beta', {
            stripeCustomerId: success.customerId,
            subscriptionId: success.subscriptionId,
          });
        } else if (success.type === 'crypto') {
          await this.updateSubscription('beta', {
            cryptoTxHash: success.txHash,
            paymentMethod: {
              type: 'crypto',
              walletAddress: success.fromAddress,
              chainId: success.chainId,
            },
          });
        }
        await chrome.storage.local.remove(STORAGE_KEYS.PAYMENT_SUCCESS);
      }
    } catch (err) {
      console.warn('[Billing] Failed to check payment success:', err);
    }
  }

  private async verifySubscriptionIfNeeded(): Promise<void> {
    if (this.state.plan === 'community') return;

    const now = Date.now();
    if (this.state.currentPeriodEnd && now > this.state.currentPeriodEnd) {
      if (this.state.cancelAtPeriodEnd) {
        await this.downgradeToCommunity();
        return;
      }
    }

    if (this.state.lastVerified) {
      const timeSinceVerification = now - this.state.lastVerified;
      if (timeSinceVerification < VERIFICATION_INTERVAL_MS) {
        return;
      }
    }

    await this.verifySubscription();
  }

  async verifySubscription(): Promise<boolean> {
    if (this.state.plan === 'community') return true;

    if (this.state.licenseKey) {
      const isValid = await this.verifyLicenseKey(this.state.licenseKey);
      if (!isValid) {
        await this.downgradeToCommunity();
        return false;
      }
    }

    if (this.state.subscriptionId && this.config.stripePublishableKey) {
      const isValid = await this.verifyStripeSubscription();
      if (!isValid) {
        console.warn('[Billing] Stripe subscription verification failed');
      }
    }

    if (this.state.cryptoTxHash) {
      const isValid = await this.verifyCryptoPayment();
      if (!isValid) {
        console.warn('[Billing] Crypto payment verification pending');
      }
    }

    this.state.lastVerified = Date.now();
    await this.saveState();
    return true;
  }

  private async verifyStripeSubscription(): Promise<boolean> {
    return true;
  }

  private async verifyCryptoPayment(): Promise<boolean> {
    if (!this.state.cryptoTxHash) return false;

    const chainId = this.state.paymentMethod?.chainId || 1;
    const baseUrl = CHAIN_EXPLORER[chainId] || CHAIN_EXPLORER[1];

    try {
      const apiUrl = chainId === 1
        ? `https://api.etherscan.io/api?module=proxy&action=eth_getTransactionByHash&txhash=${this.state.cryptoTxHash}`
        : `${baseUrl}/api?module=proxy&action=eth_getTransactionByHash&txhash=${this.state.cryptoTxHash}`;

      const response = await fetch(apiUrl);
      if (!response?.ok) return false;
      const data = await response.json();

      if (data?.result && data.result.blockNumber) {
        return true;
      }
      return false;
    } catch (err) {
      console.warn('[Billing] Crypto verification error:', err);
      return true;
    }
  }

  private calculateChecksum(str: string): number {
    let sum = 0;
    for (let i = 0; i < str.length; i++) {
      sum += str.charCodeAt(i) * (i + 1);
    }
    return sum % 26;
  }

  private async checkRateLimit(): Promise<{ blocked: boolean; remainingMs?: number }> {
    try {
      const data = await chrome.storage.local.get(STORAGE_KEYS.RATE_LIMIT);
      const rateLimit = data[STORAGE_KEYS.RATE_LIMIT];

      if (!rateLimit) return { blocked: false };

      const { attempts, firstAttemptTime } = rateLimit;
      const elapsed = Date.now() - firstAttemptTime;

      if (elapsed >= RATE_LIMIT_DURATION_MS) {
        await chrome.storage.local.remove(STORAGE_KEYS.RATE_LIMIT);
        return { blocked: false };
      }

      if (attempts >= MAX_FAILED_ATTEMPTS) {
        return { blocked: true, remainingMs: RATE_LIMIT_DURATION_MS - elapsed };
      }

      return { blocked: false };
    } catch {
      return { blocked: false };
    }
  }

  private async recordFailedAttempt(): Promise<void> {
    try {
      const data = await chrome.storage.local.get(STORAGE_KEYS.RATE_LIMIT);
      const existing = data[STORAGE_KEYS.RATE_LIMIT];

      if (existing && Date.now() - existing.firstAttemptTime < RATE_LIMIT_DURATION_MS) {
        await chrome.storage.local.set({
          [STORAGE_KEYS.RATE_LIMIT]: {
            ...existing,
            attempts: existing.attempts + 1,
          },
        });
      } else {
        await chrome.storage.local.set({
          [STORAGE_KEYS.RATE_LIMIT]: {
            attempts: 1,
            firstAttemptTime: Date.now(),
          },
        });
      }
    } catch (err) {
      console.warn('[Billing] Failed to record rate limit:', err);
    }
  }

  private async clearRateLimit(): Promise<void> {
    try {
      await chrome.storage.local.remove(STORAGE_KEYS.RATE_LIMIT);
    } catch (err) {
      console.warn('[Billing] Failed to clear rate limit:', err);
    }
  }

  private async verifyLicenseKey(key: string): Promise<boolean> {
    const rateCheck = await this.checkRateLimit();
    if (rateCheck.blocked) {
      console.warn('[Billing] License verification rate limited');
      return false;
    }

    const normalizedKey = key.trim().toUpperCase();
    const parts = normalizedKey.split('-');

    if (parts.length !== 4) {
      await this.recordFailedAttempt();
      return false;
    }

    const [prefix, tier, part1, part2] = parts;

    if (prefix !== 'HA') {
      await this.recordFailedAttempt();
      return false;
    }

    if (tier !== 'BETA' && tier !== 'PREMIUM' && tier !== 'UNLIMITED') {
      await this.recordFailedAttempt();
      return false;
    }

    const alphanumeric = /^[A-Z0-9]{8}$/;
    if (!alphanumeric.test(part1) || !alphanumeric.test(part2)) {
      await this.recordFailedAttempt();
      return false;
    }

    const combined = tier + part1 + part2.substring(0, 7);
    const expectedChecksum = this.calculateChecksum(combined);
    const actualChecksum = (part2.charCodeAt(7) - 65 + 26) % 26;

    if (expectedChecksum !== actualChecksum) {
      await this.recordFailedAttempt();
      return false;
    }

    return true;
  }

  generateTestKey(tier: 'beta' | 'premium' | 'unlimited'): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const genPart = (): string => {
      let part = '';
      for (let i = 0; i < 8; i++) {
        part += chars[Math.floor(Math.random() * chars.length)];
      }
      return part;
    };

    let part1 = genPart();
    let part2Base = genPart().slice(0, 7);
    const combined = tier.toUpperCase() + part1 + part2Base;
    const checksum = this.calculateChecksum(combined);
    const checksumChar = String.fromCharCode(65 + checksum);
    const part2 = part2Base + checksumChar;

    return `HA-${tier.toUpperCase()}-${part1}-${part2}`;
  }

  private async downgradeToCommunity(): Promise<void> {
    this.state = {
      plan: 'community',
      status: 'active',
    };
    await this.saveState();
    console.log('[Billing] Subscription expired, downgraded to Community');
  }

  getPlan(): SubscriptionPlanId {
    return this.state.plan;
  }

  // Legacy alias for backward compatibility
  getTier(): SubscriptionPlanId {
    return this.state.plan;
  }

  // Legacy tier mapping for backward compatibility
  getTierMapping(): 'free' | 'premium' | 'unlimited' {
    return this.state.plan === 'beta' ? 'premium' : 'free';
  }

  getState(): BillingState {
    return { ...this.state };
  }

  isActive(): boolean {
    return this.state.status === 'active';
  }

  isBeta(): boolean {
    return this.state.plan === 'beta' && this.state.status === 'active';
  }

  hasWatermark(): boolean {
    const plan = SUBSCRIPTION_PLANS.find(p => p.id === this.state.plan);
    return plan?.watermark ?? true;
  }

  getWorkflowLimit(): number {
    const plan = SUBSCRIPTION_PLANS.find(p => p.id === this.state.plan);
    return plan?.workflowLimit ?? 3;
  }

  // Legacy alias for backward compatibility
  getUsageLimit(_tier?: SubscriptionPlanId): { actions: number; sessions: number } {
    // Return action limits: Community = 500/day, Beta = unlimited (-1)
    if (this.state.plan === 'beta') {
      return { actions: -1, sessions: -1 };
    }
    return { actions: 500, sessions: 10 };
  }

  isWithinWorkflowLimit(currentCount: number): boolean {
    const limit = this.getWorkflowLimit();
    return limit === -1 || currentCount < limit;
  }

  // Check if usage is within limits (for action tracking) - returns object with reason
  isWithinLimits(actions: number, sessions: number): { allowed: boolean; reason?: string } {
    const limits = this.getUsageLimit();
    
    // Beta/unlimited - always allowed
    if (limits.actions === -1) {
      return { allowed: true };
    }
    
    if (actions >= limits.actions) {
      return { allowed: false, reason: `Daily action limit (${limits.actions}) reached. Upgrade to Beta for unlimited access.` };
    }
    
    if (sessions >= limits.sessions) {
      return { allowed: false, reason: `Session limit (${limits.sessions}) reached. Upgrade to Beta for unlimited access.` };
    }
    
    return { allowed: true };
  }

  // Get usage percentage
  getUsagePercentage(currentUsage: number): number {
    const limits = this.getUsageLimit();
    if (limits.actions === -1) return 0; // Unlimited
    return Math.min(100, Math.round((currentUsage / limits.actions) * 100));
  }

  // Feature access check
  isFeatureAllowed(feature: string): boolean {
    const communityFeatures = ['automation', 'extract', 'navigate', 'forms', 'vision'];
    const betaFeatures = [...communityFeatures, 'priority_ai', 'early_access', 'no_watermark', 'unlimited_workflows'];
    
    if (this.state.plan === 'beta') {
      return betaFeatures.includes(feature);
    }
    return communityFeatures.includes(feature);
  }

  // Open checkout - unified method
  async openCheckout(plan: SubscriptionPlanId = 'beta'): Promise<{ success: boolean; error?: string }> {
    if (plan !== 'beta') {
      return { success: false, error: 'Only Beta plan is available for purchase' };
    }
    
    // Prefer Stripe if configured
    if (this.config.stripePaymentLinkBeta) {
      return this.openStripeCheckout();
    }
    
    return { success: false, error: 'No payment method configured' };
  }

  async activateWithLicenseKey(key: string): Promise<{ success: boolean; error?: string }> {
    const rateCheck = await this.checkRateLimit();
    if (rateCheck.blocked && rateCheck.remainingMs) {
      const minsRemaining = Math.ceil(rateCheck.remainingMs / 60000);
      return { success: false, error: `Too many failed attempts. Try again in ${minsRemaining} minutes.` };
    }

    const normalizedKey = key.trim().toUpperCase();
    const parts = normalizedKey.split('-');

    if (parts.length !== 4 || parts[0] !== 'HA') {
      await this.recordFailedAttempt();
      return { success: false, error: 'Invalid license key format' };
    }

    const tierPart = parts[1];
    if (tierPart !== 'BETA' && tierPart !== 'PREMIUM' && tierPart !== 'UNLIMITED') {
      await this.recordFailedAttempt();
      return { success: false, error: 'Invalid tier in license key' };
    }

    const isValid = await this.verifyLicenseKey(key);
    if (!isValid) {
      return { success: false, error: 'License key verification failed' };
    }

    await this.clearRateLimit();

    this.state = {
      plan: 'beta',
      status: 'active',
      licenseKey: key,
      currentPeriodEnd: Date.now() + 365 * 24 * 60 * 60 * 1000,
      lastVerified: Date.now(),
    };
    await this.saveState();
    return { success: true };
  }

  async updateSubscription(
    plan: SubscriptionPlanId,
    options?: {
      stripeCustomerId?: string;
      subscriptionId?: string;
      paymentMethod?: PaymentMethod;
      cryptoTxHash?: string;
    }
  ): Promise<void> {
    this.state = {
      ...this.state,
      plan,
      status: 'active',
      stripeCustomerId: options?.stripeCustomerId,
      subscriptionId: options?.subscriptionId,
      paymentMethod: options?.paymentMethod,
      cryptoTxHash: options?.cryptoTxHash,
      currentPeriodEnd: Date.now() + 30 * 24 * 60 * 60 * 1000,
      lastVerified: Date.now(),
      cancelAtPeriodEnd: false,
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

  getPlanDetails(planId?: SubscriptionPlanId): SubscriptionPlan | undefined {
    return SUBSCRIPTION_PLANS.find(p => p.id === (planId ?? this.state.plan));
  }

  getAllPlans(): SubscriptionPlan[] {
    return SUBSCRIPTION_PLANS;
  }

  getStripeCheckoutUrl(): string | null {
    return this.config.stripePaymentLinkBeta || null;
  }

  async openStripeCheckout(): Promise<{ success: boolean; error?: string }> {
    const url = this.getStripeCheckoutUrl();
    if (!url) {
      return { success: false, error: 'Stripe payment not configured' };
    }

    const clientReferenceId = `hyperagent_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

    await chrome.storage.local.set({
      [STORAGE_KEYS.PENDING_CHECKOUT]: {
        plan: 'beta',
        type: 'stripe',
        clientReferenceId,
        timestamp: Date.now(),
      },
    });

    try {
      const checkoutUrl = new URL(url);
      checkoutUrl.searchParams.set('client_reference_id', clientReferenceId);
      await chrome.tabs.create({ url: checkoutUrl.toString() });
      return { success: true };
    } catch {
      await chrome.tabs.create({ url: `${url}?client_reference_id=${clientReferenceId}` });
      return { success: true };
    }
  }

  async initiateCryptoPayment(
    chainId: number = 1
  ): Promise<{ success: boolean; error?: string; paymentRequest?: CryptoPaymentRequest }> {
    if (!this.config.cryptoRecipientAddress || !BillingManager.isRealCryptoAddress(this.config.cryptoRecipientAddress)) {
      return { success: false, error: 'Crypto payment not configured' };
    }

    if (!this.config.supportedChains.includes(chainId)) {
      return { success: false, error: `Chain ${chainId} not supported` };
    }

    const usdPerEth = await this.getEthPrice(chainId);
    const ethAmount = this.config.betaPriceUsd / usdPerEth;

    const paymentRequest: CryptoPaymentRequest = {
      to: this.config.cryptoRecipientAddress,
      amount: ethAmount.toFixed(8),
      chainId,
      chainName: CHAIN_NAMES[chainId] || 'Unknown',
      currency: CHAIN_CURRENCY[chainId] || 'ETH',
      usdAmount: this.config.betaPriceUsd,
    };

    await chrome.storage.local.set({
      [STORAGE_KEYS.PENDING_CHECKOUT]: {
        plan: 'beta',
        type: 'crypto',
        chainId,
        timestamp: Date.now(),
      },
    });

    return { success: true, paymentRequest };
  }

  async confirmCryptoPayment(txHash: string, fromAddress: string, chainId: number): Promise<{ success: boolean; error?: string }> {
    if (!txHash || !/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
      return { success: false, error: 'Invalid transaction hash' };
    }

    await chrome.storage.local.set({
      [STORAGE_KEYS.PAYMENT_SUCCESS]: {
        type: 'crypto',
        txHash,
        fromAddress,
        chainId,
        timestamp: Date.now(),
      },
    });

    await this.updateSubscription('beta', {
      cryptoTxHash: txHash,
      paymentMethod: {
        type: 'crypto',
        walletAddress: fromAddress,
        chainId,
      },
    });

    return { success: true };
  }

  private async getEthPrice(chainId: number): Promise<number> {
    const priceMap: Record<number, number> = {
      1: 2500,
      8453: 2500,
      137: 0.5,
    };
    return priceMap[chainId] || 2500;
  }

  getChainInfo(chainId: number): { name: string; currency: string; explorer: string } | null {
    if (!CHAIN_NAMES[chainId]) return null;
    return {
      name: CHAIN_NAMES[chainId],
      currency: CHAIN_CURRENCY[chainId],
      explorer: CHAIN_EXPLORER[chainId],
    };
  }

  getSupportedChains(): { chainId: number; name: string; currency: string }[] {
    return this.config.supportedChains.map(id => ({
      chainId: id,
      name: CHAIN_NAMES[id] || `Chain ${id}`,
      currency: CHAIN_CURRENCY[id] || 'ETH',
    }));
  }

  getDaysRemaining(): number {
    if (!this.state.currentPeriodEnd) return -1;
    const remaining = this.state.currentPeriodEnd - Date.now();
    return Math.max(0, Math.ceil(remaining / (24 * 60 * 60 * 1000)));
  }
}

export interface CryptoPaymentRequest {
  to: string;
  amount: string;
  chainId: number;
  chainName: string;
  currency: string;
  usdAmount: number;
}

export const billingManager = new BillingManager();
