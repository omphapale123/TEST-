import { env } from './env';

export interface OpenRouterMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
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

    if (!apiKey) {
        throw new Error('OPENROUTER_API_KEY is missing in environment variables');
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://offshorebrucke.com",
            "X-Title": "Offshore Brucke Reasoning",
        },
        body: JSON.stringify(request)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    return result;
}
