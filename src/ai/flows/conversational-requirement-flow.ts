'use server';

import { z } from 'zod';
import { callOpenRouterWithReasoning } from '@/lib/openrouter-reasoning';
import { getActiveCategories } from '@/lib/categories';
import * as pdfjs from 'pdfjs-dist';

// Set worker for pdfjs-dist
if (typeof window === 'undefined') {
    // Server side
    const workerPath = require.resolve('pdfjs-dist/build/pdf.worker.mjs');
    (pdfjs as any).GlobalWorkerOptions.workerSrc = workerPath;
}


/**
 * Extracts text from a base64 PDF Data URI.
 */
async function extractTextFromPdf(dataUri: string): Promise<string> {
    try {
        const base64 = dataUri.split(',')[1];
        const buffer = Buffer.from(base64, 'base64');

        // Use pdfjs-dist to extract text
        const loadingTask = pdfjs.getDocument({
            data: new Uint8Array(buffer),
            useSystemFonts: true,
            disableFontFace: true,
        });

        const doc = await loadingTask.promise;
        let fullText = "";

        for (let i = 1; i <= doc.numPages; i++) {
            const page = await doc.getPage(i);
            const content = await page.getTextContent();
            // @ts-ignore - items has different shapes in different types versions
            const pageText = content.items
                .map((item: any) => item.str)
                .filter((s: any) => s !== undefined)
                .join(' ');
            fullText += pageText + "\n";
        }

        return fullText;
    } catch (e) {
        console.error('Error extracting text from PDF with pdfjs-dist:', e);
        return '';
    }
}

// Conversation state schema
const ConversationStateSchema = z.object({
    step: z.enum(['greeting', 'selection', 'category', 'title', 'quantity', 'price', 'destination', 'description', 'confirmation', 'complete']),
    collectedData: z.object({
        title: z.string().optional(),
        productCategory: z.string().optional(),
        quantity: z.number().optional(),
        targetPrice: z.number().optional(),
        destinationCountry: z.string().optional(),
        description: z.string().optional(),
        potentialRequirements: z.array(z.object({
            title: z.string(),
            productCategory: z.string(),
            description: z.string(),
        })).optional(),
    }),
    conversationHistory: z.array(z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
    })),
});
export type ConversationState = z.infer<typeof ConversationStateSchema>;

// Input schema for the conversational flow
const ConversationalInputSchema = z.object({
    userMessage: z.string().describe("The user's message in the conversation"),
    currentState: ConversationStateSchema.optional().describe("The current conversation state, if any"),
    pdf: z.object({
        name: z.string(),
        content: z.string(),
    }).optional(),
    spreadsheet: z.object({
        name: z.string(),
        data: z.string(),
    }).optional(),
    image: z.string().optional(),
});
export type ConversationalInput = z.infer<typeof ConversationalInputSchema>;

// Output schema
const ConversationalOutputSchema = z.object({
    botMessage: z.string().describe("The AI's response to the user"),
    updatedState: ConversationStateSchema.describe("The updated conversation state"),
    isComplete: z.boolean().describe("Whether all required information has been collected"),
});
export type ConversationalOutput = z.infer<typeof ConversationalOutputSchema>;

// Helper function to determine next step
function getNextStep(collectedData: ConversationState['collectedData']): ConversationState['step'] {
    if (collectedData.potentialRequirements && collectedData.potentialRequirements.length > 1 && !collectedData.title) return 'selection';
    if (!collectedData.productCategory) return 'category';
    if (!collectedData.title) return 'title';
    if (!collectedData.quantity) return 'quantity';
    if (!collectedData.targetPrice) return 'price';
    if (!collectedData.destinationCountry) return 'destination';
    if (!collectedData.description) return 'description';
    return 'confirmation';
}

// Helper function to generate question for current step
function getQuestionForStep(step: ConversationState['step']): string {
    const questions = {
        greeting: "Hello! I'm here to help you create a product requirement. What product are you looking to source?",
        selection: "I found multiple requirements in the document you provided. Which one would you like to fulfill?\n",
        category: "What category does this product fall under? (e.g., Apparel, Machinery, Food & Beverage, Accessories, or specify your own)",
        title: "Great! What would you like to call this requirement? Please provide a short, descriptive title.",
        quantity: "How many units do you need?",
        price: "What's your target price per unit? (in EUR €)",
        destination: "Where should the goods be delivered? (Country name, default is Germany)",
        description: "Perfect! Please provide detailed specifications for this product. Include any important details like materials, sizes, colors, quality standards, etc.",
        confirmation: "Let me confirm all the details. Please review and type 'confirm' to proceed, or tell me what you'd like to change.",
        complete: "All set! Your requirement is ready to be created.",
    };
    return (questions as any)[step];
}

// Main conversational flow function
export async function handleConversation(
    input: ConversationalInput
): Promise<ConversationalOutput> {
    console.log('Running handleConversation with input:', JSON.stringify({ ...input, userMessage: input.userMessage.substring(0, 100) + '...' }, null, 2));

    try {
        // Initialize state if this is the first message
        const currentState: ConversationState = input.currentState || {
            step: 'greeting',
            collectedData: {},
            conversationHistory: [],
        };

        // Extract context from PDF or spreadsheet
        let extraContext = "";
        let hasStructuredData = false;

        const pdfFile = input.pdf;
        if (pdfFile && pdfFile.content) {
            console.log('PDF detected, extracting text...');
            const pdfText = await extractTextFromPdf(pdfFile.content);
            extraContext = `\n\nPDF Content (${pdfFile.name}):\n${pdfText}`;
        }

        const spreadsheetFile = input.spreadsheet;
        if (spreadsheetFile && spreadsheetFile.data) {
            console.log('Spreadsheet detected:', spreadsheetFile.name);
            extraContext = `\n\nSpreadsheet Content (${spreadsheetFile.name}):\n${spreadsheetFile.data}`;
            hasStructuredData = true;
        }

        // Add user message to history
        const updatedHistory = [
            ...currentState.conversationHistory,
            { role: 'user' as const, content: input.userMessage },
        ];

        // Use AI to extract any relevant information from the user's message
        const categories = await getActiveCategories();
        const categoriesList = categories.map(c => c.label).join(', ');

        const extractionPrompt = `
You are an AI assistant helping to extract product requirement information from user messages and documents.

Current conversation step: ${currentState.step}
Already collected data: ${JSON.stringify(currentState.collectedData, null, 2)}

User's latest message: "${input.userMessage}"
${extraContext}

CATEGORIES: [${categoriesList}]

Your task:
1. Extract any relevant product requirement information.

2. DETECTION OF MULTIPLE REQUIREMENTS:
   ${hasStructuredData ? '**SPREADSHEET/TABLE DATA DETECTED** - Each row likely represents a SEPARATE requirement!' : ''}
   - If the user provides a document, spreadsheet, or text describing MULTIPLE different product requirements, DO NOT try to merge them.
   - Instead, extract a list of these requirements into "potentialRequirements".
   - Each potential requirement should have:
     * "title": A descriptive name for the product
     * "productCategory": Match to CATEGORIES list or use "Other"
     * "description": Brief description of the product
   - For SPREADSHEET data: Look for column headers and treat each data row as a separate requirement.
   - Common spreadsheet columns: Title, Product, Category, Description, Quantity, Price, Destination, etc.

3. SELECTION HANDLING:
   - If the user is responding to a list of requirements (step is "selection"), check if they're choosing one.
   - User might say: "1", "number 2", "the first one", "Sports Goods", etc.
   - Set userIntent to "select_requirement" and extract the selected index (0-based).

4. Update specific fields if the user is providing info for a SINGLE requirement or has SELECTED one from a previous list.

5. STRICT CATEGORY MAPPING:
   - Map to CATEGORIES list or "Other".

Return a JSON object:
{
  "extractedData": {
    "title": "string or null",
    "productCategory": "string or null",
    "quantity": "number or null",
    "targetPrice": "number or null",
    "destinationCountry": "string or null",
    "description": "string or null",
    "potentialRequirements": [
       {"title": "...", "productCategory": "...", "description": "..."}
    ] | null,
    "selectedIndex": "number or null (0-based index if user is selecting from a list)"
  },
  "userIntent": "provide_info | select_requirement | confirm | change_field | unclear"
}

IMPORTANT: Return ONLY the JSON object.
`;

        console.log('Calling OpenRouter (Reasoning)...');
        const extractionResponse = await callOpenRouterWithReasoning({
            model: 'deepseek/deepseek-r1',
            messages: [{ role: 'user', content: extractionPrompt }],
            reasoning: { enabled: true }
        });

        if (!extractionResponse.choices || extractionResponse.choices.length === 0) {
            throw new Error('No response from AI during extraction');
        }

        let extractionContent = extractionResponse.choices[0].message.content || '{}';
        extractionContent = extractionContent.replace(/```json\n?|\n?```/g, '').trim();
        const extraction = JSON.parse(extractionContent);

        console.log('Extraction result:', extraction);

        // Initialize updatedCollectedData with current state
        let updatedCollectedData = { ...currentState.collectedData };

        // Handle requirement selection
        if (extraction.userIntent === 'select_requirement' && currentState.collectedData.potentialRequirements) {
            const selectedIndex = extraction.extractedData.selectedIndex;
            const requirements = currentState.collectedData.potentialRequirements;

            if (selectedIndex !== null && selectedIndex >= 0 && selectedIndex < requirements.length) {
                const selected = requirements[selectedIndex];
                console.log('User selected requirement:', selected);

                // Copy selected requirement to main fields and clear potentialRequirements
                updatedCollectedData = {
                    ...currentState.collectedData,
                    title: selected.title,
                    productCategory: selected.productCategory,
                    description: selected.description,
                    potentialRequirements: undefined, // Clear the list
                };
            }
        }

        // Merge extracted data
        updatedCollectedData = {
            ...updatedCollectedData,
            ...(extraction.extractedData.title && { title: extraction.extractedData.title }),
            ...(extraction.extractedData.productCategory && { productCategory: extraction.extractedData.productCategory }),
            ...(extraction.extractedData.quantity && { quantity: extraction.extractedData.quantity }),
            ...(extraction.extractedData.targetPrice && { targetPrice: extraction.extractedData.targetPrice }),
            ...(extraction.extractedData.destinationCountry && { destinationCountry: extraction.extractedData.destinationCountry }),
            ...(extraction.extractedData.description && { description: extraction.extractedData.description }),
            ...(extraction.extractedData.potentialRequirements && { potentialRequirements: extraction.extractedData.potentialRequirements }),
        };

        // Determine next step
        let nextStep = getNextStep(updatedCollectedData);

        let isComplete = false;
        let botMessage = '';

        // Bot Logic
        if (nextStep === 'selection') {
            const options = updatedCollectedData.potentialRequirements?.map((r: any, i: number) => `${i + 1}. **${r.title}** (${r.productCategory})\n   ${r.description.substring(0, 100)}...`).join('\n\n');
            botMessage = `I found multiple product requirements in the document:\n\n${options}\n\nWhich one would you like to fulfill? Please type the number (e.g., "1", "2") or the product name.`;
        } else if (nextStep === 'confirmation') {
            if (extraction.userIntent === 'confirm') {
                nextStep = 'complete';
                isComplete = true;
                botMessage = "Perfect! All details have been confirmed. You can now create your requirement.";
            } else {
                botMessage = `Great! I've collected all the information. Here's what I have:
 
📦 **Title:** ${updatedCollectedData.title}
📂 **Category:** ${updatedCollectedData.productCategory}
🔢 **Quantity:** ${updatedCollectedData.quantity?.toLocaleString()} units
💰 **Target Price:** €${updatedCollectedData.targetPrice?.toFixed(2)} per unit
🌍 **Destination:** ${updatedCollectedData.destinationCountry}
📝 **Description:** ${updatedCollectedData.description}
 
Does everything look correct? Type 'confirm' to proceed, or tell me what you'd like to change.`;
            }
        } else if (nextStep === 'complete') {
            isComplete = true;
            botMessage = "All set! Your requirement is ready to be created.";
        } else {
            if (nextStep === 'category') {
                const someCategories = categories.slice(0, 5).map(c => c.label).join(', ');
                botMessage = `What category does this product fall under? (e.g., ${someCategories}, or specify your own)`;
            } else {
                botMessage = getQuestionForStep(nextStep);
            }
        }

        // Add bot message to history
        const finalHistory = [
            ...updatedHistory,
            { role: 'assistant' as const, content: botMessage },
        ];

        const updatedState: ConversationState = {
            step: nextStep,
            collectedData: updatedCollectedData,
            conversationHistory: finalHistory,
        };

        return {
            botMessage,
            updatedState,
            isComplete,
        };

    } catch (e) {
        console.error('AI Flow Error in handleConversation:', e);
        // ... error handling
        return {
            botMessage: "I'm sorry, I had trouble processing that. Could you please try again?",
            updatedState: input.currentState || { step: 'greeting', collectedData: {}, conversationHistory: [] },
            isComplete: false,
        };
    }
}
