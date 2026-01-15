'use server';

import { z } from 'zod';
import { getActiveCategories } from '@/lib/categories';
import { callOpenRouterWithReasoning, AI_MODEL } from '@/lib/openrouter-reasoning';

const RequirementDetailsInputSchema = z.object({
  text: z.string().describe("The user's conversational input describing their product need."),
  image: z.string().optional().describe('An optional image data URI provided by the user for context.'),
  pdf: z
    .object({
      name: z.string(),
      content: z.string(),
    })
    .optional()
    .describe('An optional PDF data URI provided by the user for context.'),
});
export type RequirementDetailsInput = z.infer<typeof RequirementDetailsInputSchema>;

const RequirementDetailsOutputSchema = z.object({
  title: z.string().describe('A concise, descriptive title for the product requirement.'),
  productCategory: z.string().describe('The most fitting product category for the described item.'),
  quantity: z.number().describe('The number of units required.'),
  targetPrice: z.number().describe('The target price per unit.'),
  destinationCountry: z.string().describe('The final destination country for the goods.'),
  description: z.string().describe('A detailed summary of the product specifications and requirements.'),
});
export type RequirementDetailsOutput = z.infer<typeof RequirementDetailsOutputSchema>;

export async function extractRequirementDetails(
  input: RequirementDetailsInput
): Promise<RequirementDetailsOutput> {
  console.log('Running extractRequirementDetails with input:', JSON.stringify(input, null, 2));

  try {
    const categories = await getActiveCategories();
    const categoriesList = categories.map(c => c.label).join(', ');

    const prompt = `
    You are an expert at parsing product requirements from conversational text. Extract the details from the user's input.

    User input: ${input.text}
    ${input.image ? `The user also provided an image (base64 data available).` : ''}
    ${input.pdf ? `The user also provided a PDF: ${input.pdf.name}` : ''}

    Infer the destination country as Germany unless specified otherwise. 

    STRICT CATEGORY MAPPING:
    You MUST choose the most relevant category from this list: [${categoriesList}].
    If the requirement does not clearly fit into any of these categories, you MUST use "Other".
    Do NOT invent new categories.

    Return the output as a valid JSON object matching this schema:
    {
      "title": "string",
      "productCategory": "string",
      "quantity": number,
      "targetPrice": number,
      "destinationCountry": "string",
      "description": "string"
    }
    
    IMPORTANT: Return ONLY the JSON object. Do not wrap it in markdown code blocks like \`\`\`json.
    `;

    const messages: any[] = [
      {
        role: 'user',
        content: input.image
          ? [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: input.image } }
          ]
          : prompt
      }
    ];

    console.log('Calling OpenRouter (Reasoning)...');
    const response = await callOpenRouterWithReasoning({
      model: AI_MODEL,
      messages: messages,
      reasoning: { enabled: true }
    });

    if (!response.choices || response.choices.length === 0) {
      throw new Error('No response from AI');
    }

    let content = response.choices[0].message.content || '';
    console.log('AI Raw Output:', content);

    // Clean up markdown code blocks if present
    content = content.replace(/```json\n?|\n?```/g, '').trim();

    const parsed = JSON.parse(content);
    return RequirementDetailsOutputSchema.parse(parsed);

  } catch (e) {
    console.error('AI Flow Error in extractRequirementDetails:', e);
    throw e;
  }
}
