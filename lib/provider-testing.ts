import { CustomProvider, ModelConfig } from "./ai-config-types";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";

export interface TestResult {
  success: boolean;
  message: string;
  latency?: number;
}

/**
 * Test provider connection
 */
export async function testProviderConnection(
  provider: CustomProvider
): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    // Create a test provider instance
    const testProvider = createOpenAICompatible({
      name: provider.name,
      apiKey: provider.apiKey || '',
      baseURL: provider.baseURL,
    });

    // Use the first available model for testing
    if (provider.models.length === 0) {
      return {
        success: false,
        message: "No models configured for this provider"
      };
    }

    const testModel = testProvider(provider.models[0].name);

    // Send a simple test message
    await generateText({
      model: testModel,
      prompt: "Hi",
    });

    const latency = Date.now() - startTime;

    return {
      success: true,
      message: "Connection successful",
      latency
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Connection failed"
    };
  }
}

/**
 * Test specific model availability
 */
export async function testModelAvailability(
  provider: CustomProvider,
  modelId: string
): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    const testProvider = createOpenAICompatible({
      name: provider.name,
      apiKey: provider.apiKey || '',
      baseURL: provider.baseURL,
    });

    const model = provider.models.find(m => m.id === modelId || m.name === modelId);
    if (!model) {
      return {
        success: false,
        message: "Model not found in provider configuration"
      };
    }

    const testModel = testProvider(model.name);

    await generateText({
      model: testModel,
      prompt: "Hi",
    });

    const latency = Date.now() - startTime;

    return {
      success: true,
      message: "Model is available",
      latency
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Model test failed"
    };
  }
}