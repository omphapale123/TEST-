import { env } from './env';

export const AI_MODEL = 'deepseek/deepseek-r1-0528:free'; // DeepSeek R1 with unlimited free usage

export interface OpenRouterMessage {
    role: 'user' | 'assistant' | 'system';
    content: string | Array<{
        type: 'text' | 'image_url';
        text?: string;
        image_url?: {
            url: string;
        };
    }>;
    reasoning_details?: any; // Preserved across turns
}

export interface OpenRouterReasoningRequest {
    model: string;
    messages: OpenRouterMessage[];
    reasoning?: {
        enabled: boolean;
    };
}

/**
 * Utility function to call OpenRouter API with reasoning support.
 */
export async function callOpenRouterWithReasoning(request: OpenRouterReasoningRequest) {
    const apiKey = env.OPENROUTER_API_KEY;
    console.log(`[OpenRouter] using key: ${apiKey ? (apiKey.slice(0, 4) + '...') : 'MISSING'}`);

    if (!apiKey) {
        throw new Error('OPENROUTER_API_KEY is missing in environment variables');
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { reasoning, ...requestBody } = request;

    // Enhance request body for reasoning models if specified
    const enrichedBody = {
        ...requestBody,
        ...(reasoning?.enabled && {
            include_reasoning: true
        }),
        // Add provider fallbacks for better reliability with free endpoints
        provider: {
            allow_fallbacks: true
        }
    };

    let attempts = 0;
    const maxAttempts = 3;
    let baseDelay = 2000;

    while (attempts < maxAttempts) {
        try {
            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://offshorebrucke.com",
                    "X-Title": "Offshore Brucke Reasoning",
                },
                body: JSON.stringify(enrichedBody)
            });

            if (response.status === 429) {
                attempts++;
                const delay = baseDelay * Math.pow(2, attempts - 1);
                console.warn(`[OpenRouter] Rate limited (429). Retrying in ${delay}ms... (Attempt ${attempts}/${maxAttempts})`);

                if (attempts === maxAttempts) {
                    const errorText = await response.text();
                    throw new Error(`OpenRouter API rate limit exceeded (429) after ${maxAttempts} attempts: ${errorText}`);
                }

                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`OpenRouter API Error Details:`, errorText);
                throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
            }

            const result = await response.json();
            return result;

        } catch (error: any) {
            // Re-throw if it's our custom error or if we've run out of attempts
            if (attempts === maxAttempts || error.message.includes('OpenRouter API')) {
                throw error;
            }
            // For network errors etc, we could optionally retry, but keeping it simple for now focusing on 429
            console.error('[OpenRouter] Network/Unknown error:', error);
            throw error;
        }
    }
}
