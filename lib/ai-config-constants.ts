// ============================================================================
// AI Configuration Constants
// ============================================================================

/**
 * Model options for different AI providers
 * These are static lists of supported models for each provider
 */
export const MODEL_OPTIONS = {
  openai: ["gpt-4-turbo", "gpt-4", "gpt-3.5-turbo"] as string[],
  google: [
    "gemini-2.5-flash-preview-05-20",
    "gemini-2.5-pro",
    "gemini-pro",
  ] as string[],
  bedrock: [
    "global.anthropic.claude-sonnet-4-5-20250929-v1:0",
    "anthropic.claude-sonnet-4-20250514-v1:0",
    "anthropic.claude-3-5-sonnet-20240620-v1:0",
  ] as string[],
  openrouter: [
    "anthropic/claude-3.5-sonnet",
    "google/gemini-pro",
    "openai/gpt-4-turbo",
  ] as string[],
};

/**
 * Built-in provider types that don't require custom configuration
 */
export const BUILT_IN_PROVIDERS = [
  "openai",
  "google",
  "bedrock",
  "openrouter"
] as const;

/**
 * Default configuration for environment-based setup
 */
export function getEnvConfig() {
  // Default to bedrock with environment variables
  return {
    provider: "bedrock" as const,
    model: "global.anthropic.claude-sonnet-4-5-20250929-v1:0",
    region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION,
    apiKey: process.env.AWS_ACCESS_KEY_ID,
    secretKey: process.env.AWS_SECRET_ACCESS_KEY,
    parameters: {
      temperature: 0,
    },
  };
}