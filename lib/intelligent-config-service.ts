// {{CODE-Cycle-Integration:
//   Task_ID: [IMPL-008-1]
//   Timestamp: 2025-01-12T00:00:00Z
//   Phase: [D-Develop]
//   Context-Analysis: "Analyzing existing provider registry, model discovery, and config testing services to implement intelligent configuration management with auto-switching, load balancing, and cost optimization features."
//   Principle_Applied: "Aether-Engineering-SOLID-S, Aether-Engineering-OCP, Aether-Engineering-SRP, Aether-Engineering-Strategy-Pattern"
// }}
// {{START_MODIFICATIONS}}

import { ProviderConfig, ModelConfig, UserPreferences } from './types/provider-config';
import { configTestingService, ProviderTestResult, TestType } from './config-testing';
import { modelDiscoveryService, ModelDiscoveryResult } from './model-discovery';
import { providerRegistry } from './provider-registry';
import { AIConfig, createModelFromConfig } from './ai-config-utils';

// ============================================================================
// Intelligent Configuration Interfaces
// ============================================================================

export interface ProviderPerformanceMetrics {
  providerId: string;
  modelId: string;
  responseTime: number; // Average response time in milliseconds
  successRate: number; // Percentage of successful requests (0-100)
  errorRate: number; // Percentage of failed requests (0-100)
  requestCount: number; // Total number of requests
  lastRequestTime: Date; // Timestamp of last request
  consecutiveFailures: number; // Number of consecutive failures
  averageLatency: number; // Weighted average latency
  reliabilityScore: number; // Composite reliability score (0-100)
}

export interface LoadBalancingStrategy {
  name: string;
  description: string;
  selectProvider(
    providers: ProviderConfig[],
    metrics: Map<string, ProviderPerformanceMetrics>,
    requirements?: ProviderRequirements
  ): ProviderConfig | null;
}

export interface ProviderRequirements {
  capabilities: string[];
  maxLatency?: number; // Maximum acceptable latency in ms
  minReliability?: number; // Minimum reliability score (0-100)
  maxCostPerToken?: number; // Maximum cost per 1M tokens
  preferredProviders?: string[]; // Preferred provider IDs
  excludedProviders?: string[]; // Excluded provider IDs
}

export interface CostOptimizationInsight {
  type: 'model_substitution' | 'provider_switch' | 'parameter_tuning' | 'batch_optimization';
  title: string;
  description: string;
  potentialSavings: number; // Estimated monthly savings in USD
  impact: 'low' | 'medium' | 'high';
  effort: 'easy' | 'moderate' | 'complex';
  recommendation: string;
  currentValue: any;
  suggestedValue: any;
}

export interface UsageAnalytics {
  period: 'hourly' | 'daily' | 'weekly' | 'monthly';
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  totalTokens: {
    input: number;
    output: number;
    total: number;
  };
  totalCost: number;
  costByProvider: Map<string, number>;
  costByModel: Map<string, number>;
  requestDistribution: Map<string, number>; // provider -> request count
  latencyDistribution: {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
  };
  errorAnalysis: Map<string, number>; // error type -> count
}

export interface IntelligentConfigOptions {
  autoSwitching: boolean;
  loadBalancing: boolean;
  costOptimization: boolean;
  performanceMonitoring: boolean;
  fallbackEnabled: boolean;
  maxRetries: number;
  circuitBreakerThreshold: number; // Number of failures before circuit breaking
  healthCheckInterval: number; // Health check interval in milliseconds
  metricsRetentionDays: number;
  enablePredictiveScaling: boolean;
}

// ============================================================================
// Load Balancing Strategies
// ============================================================================

export class RoundRobinStrategy implements LoadBalancingStrategy {
  name = 'Round Robin';
  description = 'Distributes requests evenly across all available providers';

  private currentIndex = 0;

  selectProvider(providers: ProviderConfig[]): ProviderConfig | null {
    if (providers.length === 0) return null;

    // Filter enabled providers
    const enabledProviders = providers.filter(p => p.enabled);
    if (enabledProviders.length === 0) return null;

    const selectedProvider = enabledProviders[this.currentIndex % enabledProviders.length];
    this.currentIndex = (this.currentIndex + 1) % enabledProviders.length;

    return selectedProvider;
  }
}

export class WeightedResponseTimeStrategy implements LoadBalancingStrategy {
  name = 'Weighted Response Time';
  description = 'Prioritizes providers with better response times';

  selectProvider(
    providers: ProviderConfig[],
    metrics: Map<string, ProviderPerformanceMetrics>
  ): ProviderConfig | null {
    const enabledProviders = providers.filter(p => p.enabled);
    if (enabledProviders.length === 0) return null;

    // Calculate weights based on inverse response time (lower time = higher weight)
    const providersWithWeights = enabledProviders.map(provider => {
      const metric = metrics.get(provider.id);
      const responseTime = metric?.averageLatency || 1000; // Default to 1s if no data
      const weight = 1 / Math.max(responseTime, 1); // Avoid division by zero
      return { provider, weight };
    });

    // Select provider based on weighted random selection
    const totalWeight = providersWithWeights.reduce((sum, { weight }) => sum + weight, 0);
    const random = Math.random() * totalWeight;

    let currentWeight = 0;
    for (const { provider, weight } of providersWithWeights) {
      currentWeight += weight;
      if (random <= currentWeight) {
        return provider;
      }
    }

    // Fallback to first provider
    return enabledProviders[0];
  }
}

export class ReliabilityFirstStrategy implements LoadBalancingStrategy {
  name = 'Reliability First';
  description = 'Prioritizes providers with highest reliability scores';

  selectProvider(
    providers: ProviderConfig[],
    metrics: Map<string, ProviderPerformanceMetrics>
  ): ProviderConfig | null {
    const enabledProviders = providers.filter(p => p.enabled);
    if (enabledProviders.length === 0) return null;

    // Sort by reliability score (descending)
    const sortedProviders = enabledProviders
      .map(provider => ({
        provider,
        reliability: metrics.get(provider.id)?.reliabilityScore || 0
      }))
      .sort((a, b) => b.reliability - a.reliability);

    return sortedProviders[0]?.provider || null;
  }
}

export class CostOptimizedStrategy implements LoadBalancingStrategy {
  name = 'Cost Optimized';
  description = 'Selects the most cost-effective provider that meets requirements';

  selectProvider(
    providers: ProviderConfig[],
    metrics: Map<string, ProviderPerformanceMetrics>,
    requirements?: ProviderRequirements
  ): ProviderConfig | null {
    const enabledProviders = providers.filter(p => p.enabled);
    if (enabledProviders.length === 0) return null;

    // Filter by requirements
    let candidateProviders = enabledProviders;

    if (requirements) {
      candidateProviders = enabledProviders.filter(provider => {
        const metric = metrics.get(provider.id);

        // Check latency requirement
        if (requirements.maxLatency && metric && metric.averageLatency > requirements.maxLatency) {
          return false;
        }

        // Check reliability requirement
        if (requirements.minReliability && metric && metric.reliabilityScore < requirements.minReliability) {
          return false;
        }

        // Check excluded providers
        if (requirements.excludedProviders?.includes(provider.id)) {
          return false;
        }

        return true;
      });
    }

    if (candidateProviders.length === 0) return null;

    // Sort by cost (lowest first) based on model metadata
    const sortedByCost = candidateProviders
      .map(provider => {
        const defaultModel = provider.models.find(m => m.isDefault) || provider.models[0];
        const costPerToken = defaultModel?.metadata.inputCost || 0;
        return { provider, costPerToken };
      })
      .sort((a, b) => a.costPerToken - b.costPerToken);

    return sortedByCost[0]?.provider || null;
  }
}

// ============================================================================
// Main Intelligent Configuration Service
// ============================================================================

export class IntelligentConfigService {
  private static instance: IntelligentConfigService;
  private performanceMetrics: Map<string, ProviderPerformanceMetrics> = new Map();
  private loadBalancingStrategies: Map<string, LoadBalancingStrategy> = new Map();
  private currentStrategy: LoadBalancingStrategy;
  private options: IntelligentConfigOptions;
  private healthCheckTimer?: NodeJS.Timeout;
  private metricsHistory: Map<string, ProviderPerformanceMetrics[]> = new Map();

  private constructor(options: Partial<IntelligentConfigOptions> = {}) {
    this.options = {
      autoSwitching: true,
      loadBalancing: true,
      costOptimization: true,
      performanceMonitoring: true,
      fallbackEnabled: true,
      maxRetries: 3,
      circuitBreakerThreshold: 5,
      healthCheckInterval: 60000, // 1 minute
      metricsRetentionDays: 30,
      enablePredictiveScaling: false,
      ...options
    };

    this.initializeStrategies();
    this.currentStrategy = this.loadBalancingStrategies.get('Reliability First')!;

    if (this.options.performanceMonitoring) {
      this.startHealthMonitoring();
    }
  }

  public static getInstance(options?: Partial<IntelligentConfigOptions>): IntelligentConfigService {
    if (!IntelligentConfigService.instance) {
      IntelligentConfigService.instance = new IntelligentConfigService(options);
    }
    return IntelligentConfigService.instance;
  }

  private initializeStrategies(): void {
    this.loadBalancingStrategies.set('Round Robin', new RoundRobinStrategy());
    this.loadBalancingStrategies.set('Weighted Response Time', new WeightedResponseTimeStrategy());
    this.loadBalancingStrategies.set('Reliability First', new ReliabilityFirstStrategy());
    this.loadBalancingStrategies.set('Cost Optimized', new CostOptimizedStrategy());
  }

  // ============================================================================
  // Provider Selection and Auto-Switching
  // ============================================================================

  /**
   * Select the best provider for the given requirements
   */
  public selectProvider(
    providers: ProviderConfig[],
    requirements?: ProviderRequirements
  ): ProviderConfig | null {
    if (!this.options.loadBalancing) {
      // Return default provider if load balancing is disabled
      return providers.find(p => p.enabled) || null;
    }

    return this.currentStrategy.selectProvider(providers, this.performanceMetrics, requirements);
  }

  /**
   * Get the current active provider with fallback logic
   */
  public async getActiveProvider(
    providers: ProviderConfig[],
    preferences: UserPreferences,
    requirements?: ProviderRequirements
  ): Promise<ProviderConfig | null> {
    // Try preferred provider first
    if (preferences.defaultProviderId) {
      const preferredProvider = providers.find(p => p.id === preferences.defaultProviderId);
      if (preferredProvider && preferredProvider.enabled) {
        const isHealthy = await this.isProviderHealthy(preferredProvider);
        if (isHealthy) {
          return preferredProvider;
        }
      }
    }

    // Use intelligent selection
    const selectedProvider = this.selectProvider(providers, requirements);
    if (selectedProvider) {
      const isHealthy = await this.isProviderHealthy(selectedProvider);
      if (isHealthy) {
        return selectedProvider;
      }
    }

    // Fallback to any healthy provider
    for (const provider of providers.filter(p => p.enabled)) {
      const isHealthy = await this.isProviderHealthy(provider);
      if (isHealthy) {
        return provider;
      }
    }

    // No healthy providers available
    return null;
  }

  /**
   * Check if a provider is healthy based on recent performance metrics
   */
  private async isProviderHealthy(provider: ProviderConfig): Promise<boolean> {
    const metrics = this.performanceMetrics.get(provider.id);

    if (!metrics) {
      // No metrics available, perform quick health check
      return this.performQuickHealthCheck(provider);
    }

    // Check circuit breaker condition
    if (metrics.consecutiveFailures >= this.options.circuitBreakerThreshold) {
      return false;
    }

    // Check reliability score
    if (metrics.reliabilityScore < 50) { // Less than 50% reliability
      return false;
    }

    // Check if provider was recently tested successfully
    const timeSinceLastTest = Date.now() - metrics.lastRequestTime.getTime();
    if (timeSinceLastTest > 300000) { // 5 minutes
      return this.performQuickHealthCheck(provider);
    }

    return true;
  }

  private async performQuickHealthCheck(provider: ProviderConfig): Promise<boolean> {
    try {
      // Convert ProviderConfig to AIConfig for testing
      const aiConfig: AIConfig = {
        provider: provider.type as any,
        model: provider.models[0]?.name || 'default',
        apiKey: provider.authentication.apiKey
      };

      const testResult = await configTestingService.testAIConfig(aiConfig);
      this.updateMetrics(provider.id, provider.models[0]?.name || 'default', testResult);

      return testResult.success;
    } catch (error) {
      console.warn(`Health check failed for provider ${provider.id}:`, error);
      return false;
    }
  }

  // ============================================================================
  // Performance Monitoring and Metrics
  // ============================================================================

  /**
   * Record a request completion and update performance metrics
   */
  public recordRequest(
    providerId: string,
    modelId: string,
    success: boolean,
    responseTime: number,
    tokenCount?: { input: number; output: number; total: number }
  ): void {
    if (!this.options.performanceMonitoring) return;

    const existingMetrics = this.performanceMetrics.get(providerId);
    const now = new Date();

    if (existingMetrics) {
      // Update existing metrics
      const totalRequests = existingMetrics.requestCount + 1;
      const successCount = success ? existingMetrics.requestCount * (existingMetrics.successRate / 100) + 1 :
                         existingMetrics.requestCount * (existingMetrics.successRate / 100);

      const newSuccessRate = (successCount / totalRequests) * 100;
      const newErrorRate = 100 - newSuccessRate;

      // Update weighted average response time
      const newAverageLatency = (existingMetrics.averageLatency * existingMetrics.requestCount + responseTime) / totalRequests;

      // Update consecutive failures
      const newConsecutiveFailures = success ? 0 : existingMetrics.consecutiveFailures + 1;

      // Calculate reliability score (weighted combination of success rate and latency)
      const latencyScore = Math.max(0, 100 - (newAverageLatency / 50)); // 50ms = 0 points, 0ms = 100 points
      const newReliabilityScore = (newSuccessRate * 0.7) + (latencyScore * 0.3);

      const updatedMetrics: ProviderPerformanceMetrics = {
        providerId,
        modelId,
        responseTime: newAverageLatency,
        successRate: newSuccessRate,
        errorRate: newErrorRate,
        requestCount: totalRequests,
        lastRequestTime: now,
        consecutiveFailures: newConsecutiveFailures,
        averageLatency: newAverageLatency,
        reliabilityScore: newReliabilityScore
      };

      this.performanceMetrics.set(providerId, updatedMetrics);
      this.addToMetricsHistory(providerId, updatedMetrics);
    } else {
      // Create new metrics entry
      const reliabilityScore = success ? 80 : 20; // Initial reliability score

      const newMetrics: ProviderPerformanceMetrics = {
        providerId,
        modelId,
        responseTime,
        successRate: success ? 100 : 0,
        errorRate: success ? 0 : 100,
        requestCount: 1,
        lastRequestTime: now,
        consecutiveFailures: success ? 0 : 1,
        averageLatency: responseTime,
        reliabilityScore
      };

      this.performanceMetrics.set(providerId, newMetrics);
      this.addToMetricsHistory(providerId, newMetrics);
    }
  }

  private updateMetrics(providerId: string, modelId: string, testResult: ProviderTestResult): void {
    this.recordRequest(providerId, modelId, testResult.success, testResult.duration);
  }

  private addToMetricsHistory(providerId: string, metrics: ProviderPerformanceMetrics): void {
    if (!this.metricsHistory.has(providerId)) {
      this.metricsHistory.set(providerId, []);
    }

    const history = this.metricsHistory.get(providerId)!;
    history.push(metrics);

    // Trim old history based on retention policy
    const maxAge = Date.now() - (this.options.metricsRetentionDays * 24 * 60 * 60 * 1000);
    const filteredHistory = history.filter(m => m.lastRequestTime.getTime() > maxAge);

    this.metricsHistory.set(providerId, filteredHistory);
  }

  /**
   * Get performance metrics for all providers
   */
  public getPerformanceMetrics(): Map<string, ProviderPerformanceMetrics> {
    return new Map(this.performanceMetrics);
  }

  /**
   * Get performance metrics for a specific provider
   */
  public getProviderMetrics(providerId: string): ProviderPerformanceMetrics | undefined {
    return this.performanceMetrics.get(providerId);
  }

  // ============================================================================
  // Load Balancing Configuration
  // ============================================================================

  /**
   * Set the load balancing strategy
   */
  public setLoadBalancingStrategy(strategyName: string): boolean {
    const strategy = this.loadBalancingStrategies.get(strategyName);
    if (strategy) {
      this.currentStrategy = strategy;
      return true;
    }
    return false;
  }

  /**
   * Get available load balancing strategies
   */
  public getAvailableStrategies(): LoadBalancingStrategy[] {
    return Array.from(this.loadBalancingStrategies.values());
  }

  /**
   * Get current load balancing strategy
   */
  public getCurrentStrategy(): LoadBalancingStrategy {
    return this.currentStrategy;
  }

  // ============================================================================
  // Cost Optimization
  // ============================================================================

  /**
   * Generate cost optimization insights
   */
  public async generateCostOptimizationInsights(
    providers: ProviderConfig[],
    usageAnalytics: UsageAnalytics
  ): Promise<CostOptimizationInsight[]> {
    const insights: CostOptimizationInsight[] = [];

    // Analyze provider usage and costs
    for (const [providerId, cost] of usageAnalytics.costByProvider) {
      const provider = providers.find(p => p.id === providerId);
      if (!provider) continue;

      const providerRequests = usageAnalytics.requestDistribution.get(providerId) || 0;
      const averageCostPerRequest = cost / Math.max(providerRequests, 1);

      // Check if there are cheaper alternatives
      const cheaperProviders = providers
        .filter(p => p.id !== providerId && p.enabled)
        .filter(p => {
          const pCost = usageAnalytics.costByProvider.get(p.id) || 0;
          const pRequests = usageAnalytics.requestDistribution.get(p.id) || 0;
          const pAvgCost = pCost / Math.max(pRequests, 1);
          return pAvgCost < averageCostPerRequest;
        })
        .sort((a, b) => {
          const costA = usageAnalytics.costByProvider.get(a.id) || 0;
          const costB = usageAnalytics.costByProvider.get(b.id) || 0;
          const reqA = usageAnalytics.requestDistribution.get(a.id) || 1;
          const reqB = usageAnalytics.requestDistribution.get(b.id) || 1;
          return (costA / reqA) - (costB / reqB);
        });

      if (cheaperProviders.length > 0) {
        const cheapestAlternative = cheaperProviders[0];
        const altCost = usageAnalytics.costByProvider.get(cheapestAlternative.id) || 0;
        const altRequests = usageAnalytics.requestDistribution.get(cheapestAlternative.id) || 1;
        const altAvgCost = altCost / Math.max(altRequests, 1);

        const potentialSavings = (averageCostPerRequest - altAvgCost) * providerRequests * 30; // Monthly estimate

        insights.push({
          type: 'provider_switch',
          title: `Switch to ${cheapestAlternative.name}`,
          description: `${provider.name} costs $${averageCostPerRequest.toFixed(4)} per request on average, while ${cheapestAlternative.name} costs $${altAvgCost.toFixed(4)}`,
          potentialSavings,
          impact: potentialSavings > 10 ? 'high' : potentialSavings > 5 ? 'medium' : 'low',
          effort: 'easy',
          recommendation: `Consider switching from ${provider.name} to ${cheapestAlternative.name} for better cost efficiency`,
          currentValue: provider.name,
          suggestedValue: cheapestAlternative.name
        });
      }
    }

    // Model substitution insights
    for (const provider of providers) {
      for (const model of provider.models) {
        if (!model.enabled) continue;

        const modelCost = model.metadata.inputCost || 0;
        const modelRequests = usageAnalytics.costByModel.get(model.id) || 0;

        // Find cheaper models with similar capabilities
        const cheaperModels = provider.models
          .filter(m => m.id !== model.id && m.enabled)
          .filter(m => (m.metadata.inputCost || 0) < modelCost)
          .filter(m => this.haveSimilarCapabilities(model, m))
          .sort((a, b) => (a.metadata.inputCost || 0) - (b.metadata.inputCost || 0));

        if (cheaperModels.length > 0 && modelRequests > 0) {
          const cheapestModel = cheaperModels[0];
          const potentialSavings = (modelCost - (cheapestModel.metadata.inputCost || 0)) * modelRequests * 30;

          insights.push({
            type: 'model_substitution',
            title: `Use ${cheapestModel.name} instead of ${model.name}`,
            description: `${model.name} costs $${modelCost.toFixed(4)} per 1M input tokens, while ${cheapestModel.name} costs $${(cheapestModel.metadata.inputCost || 0).toFixed(4)}`,
            potentialSavings,
            impact: potentialSavings > 20 ? 'high' : potentialSavings > 10 ? 'medium' : 'low',
            effort: 'easy',
            recommendation: `Consider switching from ${model.name} to ${cheapestModel.name} for similar capabilities at lower cost`,
            currentValue: model.name,
            suggestedValue: cheapestModel.name
          });
        }
      }
    }

    // Parameter tuning insights
    const averageTemperature = this.calculateAverageTemperature(usageAnalytics);
    if (averageTemperature > 0.8) {
      insights.push({
        type: 'parameter_tuning',
        title: 'Reduce temperature for cost savings',
        description: 'High temperature values (>0.8) increase output length and cost',
        potentialSavings: usageAnalytics.totalCost * 0.15, // Estimated 15% savings
        impact: 'medium',
        effort: 'easy',
        recommendation: 'Consider reducing temperature to 0.7 or lower for more concise responses',
        currentValue: averageTemperature,
        suggestedValue: 0.7
      });
    }

    return insights.sort((a, b) => b.potentialSavings - a.potentialSavings);
  }

  private haveSimilarCapabilities(model1: ModelConfig, model2: ModelConfig): boolean {
    const caps1 = new Set(model1.metadata.capabilities);
    const caps2 = new Set(model2.metadata.capabilities);

    // Check if models share at least 75% of capabilities
    const intersection = new Set([...caps1].filter(cap => caps2.has(cap)));
    const union = new Set([...caps1, ...caps2]);

    return intersection.size / union.size > 0.75;
  }

  private calculateAverageTemperature(analytics: UsageAnalytics): number {
    // This is a simplified calculation - in a real implementation,
    // you'd track actual parameter values used in requests
    return 0.7; // Placeholder
  }

  // ============================================================================
  // Health Monitoring
  // ============================================================================

  private startHealthMonitoring(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    this.healthCheckTimer = setInterval(async () => {
      await this.performRoutineHealthChecks();
    }, this.options.healthCheckInterval);
  }

  private async performRoutineHealthChecks(): Promise<void> {
    // This would check all configured providers periodically
    // Implementation depends on available provider configurations
    // For now, this is a placeholder that would be integrated with the config system
  }

  /**
   * Stop health monitoring
   */
  public stopHealthMonitoring(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }
  }

  // ============================================================================
  // Usage Analytics
  // ============================================================================

  /**
   * Generate usage analytics for a time period
   */
  public generateUsageAnalytics(period: UsageAnalytics['period']): UsageAnalytics {
    const now = new Date();
    const history = Array.from(this.metricsHistory.values()).flat();

    // Filter metrics by time period
    const periodStart = this.getPeriodStart(now, period);
    const relevantMetrics = history.filter(m => m.lastRequestTime >= periodStart);

    if (relevantMetrics.length === 0) {
      return this.getEmptyAnalytics(period);
    }

    const totalRequests = relevantMetrics.reduce((sum, m) => sum + m.requestCount, 0);
    const successfulRequests = relevantMetrics.reduce((sum, m) => sum + (m.requestCount * m.successRate / 100), 0);
    const failedRequests = totalRequests - successfulRequests;
    const averageResponseTime = relevantMetrics.reduce((sum, m) => sum + m.averageLatency, 0) / relevantMetrics.length;

    const costByProvider = new Map<string, number>();
    const costByModel = new Map<string, number>();
    const requestDistribution = new Map<string, number>();

    // This is simplified - actual cost calculation would require token usage data
    relevantMetrics.forEach(m => {
      costByProvider.set(m.providerId, (costByProvider.get(m.providerId) || 0) + m.requestCount * 0.001); // Placeholder cost
      costByModel.set(m.modelId, (costByModel.get(m.modelId) || 0) + m.requestCount * 0.001);
      requestDistribution.set(m.providerId, (requestDistribution.get(m.providerId) || 0) + m.requestCount);
    });

    const totalCost = Array.from(costByProvider.values()).reduce((sum, cost) => sum + cost, 0);

    return {
      period,
      totalRequests,
      successfulRequests,
      failedRequests,
      averageResponseTime,
      totalTokens: {
        input: 0, // Would be calculated from actual token usage
        output: 0,
        total: 0
      },
      totalCost,
      costByProvider,
      costByModel,
      requestDistribution,
      latencyDistribution: {
        p50: averageResponseTime * 0.8,
        p90: averageResponseTime * 1.2,
        p95: averageResponseTime * 1.5,
        p99: averageResponseTime * 2.0
      },
      errorAnalysis: new Map() // Would be populated from actual error data
    };
  }

  private getPeriodStart(now: Date, period: UsageAnalytics['period']): Date {
    const start = new Date(now);

    switch (period) {
      case 'hourly':
        start.setHours(start.getHours() - 1);
        break;
      case 'daily':
        start.setDate(start.getDate() - 1);
        break;
      case 'weekly':
        start.setDate(start.getDate() - 7);
        break;
      case 'monthly':
        start.setMonth(start.getMonth() - 1);
        break;
    }

    return start;
  }

  private getEmptyAnalytics(period: UsageAnalytics['period']): UsageAnalytics {
    return {
      period,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      totalTokens: { input: 0, output: 0, total: 0 },
      totalCost: 0,
      costByProvider: new Map(),
      costByModel: new Map(),
      requestDistribution: new Map(),
      latencyDistribution: { p50: 0, p90: 0, p95: 0, p99: 0 },
      errorAnalysis: new Map()
    };
  }

  // ============================================================================
  // Configuration Management
  // ============================================================================

  /**
   * Update intelligent configuration options
   */
  public updateOptions(newOptions: Partial<IntelligentConfigOptions>): void {
    this.options = { ...this.options, ...newOptions };

    if (this.options.performanceMonitoring && !this.healthCheckTimer) {
      this.startHealthMonitoring();
    } else if (!this.options.performanceMonitoring && this.healthCheckTimer) {
      this.stopHealthMonitoring();
    }
  }

  /**
   * Get current configuration options
   */
  public getOptions(): IntelligentConfigOptions {
    return { ...this.options };
  }

  /**
   * Reset all performance metrics
   */
  public resetMetrics(): void {
    this.performanceMetrics.clear();
    this.metricsHistory.clear();
  }

  /**
   * Export performance data
   */
  public exportPerformanceData(): {
    metrics: ProviderPerformanceMetrics[];
    history: { [providerId: string]: ProviderPerformanceMetrics[] };
    options: IntelligentConfigOptions;
  } {
    return {
      metrics: Array.from(this.performanceMetrics.values()),
      history: Object.fromEntries(this.metricsHistory),
      options: this.options
    };
  }

  /**
   * Import performance data
   */
  public importPerformanceData(data: {
    metrics?: ProviderPerformanceMetrics[];
    history?: { [providerId: string]: ProviderPerformanceMetrics[] };
    options?: IntelligentConfigOptions;
  }): void {
    if (data.metrics) {
      this.performanceMetrics.clear();
      data.metrics.forEach(metric => {
        this.performanceMetrics.set(metric.providerId, metric);
      });
    }

    if (data.history) {
      this.metricsHistory.clear();
      Object.entries(data.history).forEach(([providerId, history]) => {
        this.metricsHistory.set(providerId, history);
      });
    }

    if (data.options) {
      this.updateOptions(data.options);
    }
  }
}

// ============================================================================
// Export singleton instance and convenience functions
// ============================================================================

export const intelligentConfigService = IntelligentConfigService.getInstance();

export const selectBestProvider = (
  providers: ProviderConfig[],
  requirements?: ProviderRequirements
): ProviderConfig | null => {
  return intelligentConfigService.selectProvider(providers, requirements);
};

export const recordProviderRequest = (
  providerId: string,
  modelId: string,
  success: boolean,
  responseTime: number,
  tokenCount?: { input: number; output: number; total: number }
): void => {
  intelligentConfigService.recordRequest(providerId, modelId, success, responseTime, tokenCount);
};

export const getCostOptimizationInsights = async (
  providers: ProviderConfig[],
  usageAnalytics: UsageAnalytics
): Promise<CostOptimizationInsight[]> => {
  return intelligentConfigService.generateCostOptimizationInsights(providers, usageAnalytics);
};

// ============================================================================
// Re-export types for convenience
// ============================================================================

export type { UserPreferences } from './types/provider-config';

// {{END_MODIFICATIONS}}