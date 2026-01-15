'use server';

import { z } from 'zod';
import { callOpenRouterWithReasoning, AI_MODEL } from '@/lib/openrouter-reasoning';
import { getActiveCategories } from '@/lib/categories';



const ExtractCategoriesInputSchema = z.object({
    text: z.string().describe("The supplier's company description or extracted catalog text."),
});

const ExtractCategoriesOutputSchema = z.object({
    suggestedCategoryIds: z.array(z.string()).describe("A list of category IDs that best match the supplier's profile."),
    justification: z.string().describe("A brief explanation of why these categories were suggested."),
});

export type ExtractCategoriesInput = z.infer<typeof ExtractCategoriesInputSchema>;
export type ExtractCategoriesOutput = z.infer<typeof ExtractCategoriesOutputSchema>;

export async function extractSupplierCategories(input: ExtractCategoriesInput): Promise<ExtractCategoriesOutput> {
    console.log('Running extractSupplierCategories...');

    try {
        const categories = await getActiveCategories();
        console.log(`Found ${categories.length} active categories.`);

        if (categories.length === 0) {
            return {
                suggestedCategoryIds: [],
                justification: "No active categories were found in the system. Please contact the administrator to set up product categories."
            };
        }

        const categoriesJson = JSON.stringify(categories, null, 2);

        const prompt = `
    You are an expert industrial sourcing agent. Your task is to analyze a supplier's company description and map it to the MOST RELEVANT Specialized Categories.

    Supplier Description: 
    "${input.text}"

    Available Categories:
    ${categoriesJson}

    Strict Instructions:
    1. Only select categories that have a CLEAR and DIRECT match with the supplier's stated expertise or products.
    2. If the description is vague, do not guess; return fewer, more certain matches.
    3. You can select multiple categories if the supplier operates in multiple fields.
    4. For each category selected, you must be able to justify it based on specific keywords in the description.

    Return the output as a valid JSON object:
    {
      "suggestedCategoryIds": ["id1", "id2"],
      "justification": "A concise explanation of why these specific categories were chosen based on the text."
    }

    IMPORTANT: Return ONLY the JSON object.
    `;

        console.log('Calling OpenRouter (Reasoning)...');
        const response = await callOpenRouterWithReasoning({
            model: AI_MODEL,
            messages: [{ role: 'user', content: prompt }],
            reasoning: { enabled: true }
        });

        if (!response.choices || response.choices.length === 0) {
            console.error('OpenRouter returned no choices:', response);
            throw new Error('No response from AI');
        }

        let content = response.choices[0].message.content || '';
        console.log('AI Raw Output:', content);

        // Clean up markdown code blocks if present
        content = content.replace(/```json\n?|\n?```/g, '').trim();

        try {
            const parsed = JSON.parse(content);
            return ExtractCategoriesOutputSchema.parse(parsed);
        } catch (parseError) {
            console.error('Failed to parse AI response as JSON:', content, parseError);
            throw new Error('AI returned invalid JSON');
        }

    } catch (e: any) {
        console.error('AI Flow Error in extractSupplierCategories:', e);
        return {
            suggestedCategoryIds: [],
            justification: `Error processing request: ${e.message || 'Unknown error'}`
        };
    }
}
