
'use server';

import { z } from 'zod';
import { getFirebaseAdmin } from '@/firebase/firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { callOpenRouterWithReasoning } from '@/lib/openrouter-reasoning';

// Input Schema: A simplified version of the Requirement entity
const RequirementSchema = z.object({
  title: z.string(),
  productCategory: z.string(),
  quantity: z.number(),
  targetPrice: z.number(),
  description: z.string(),
});
export type MatchingSuppliersInput = z.infer<typeof RequirementSchema>;

// Output Schema: A list of matched suppliers with justification
const SupplierMatchSchema = z.object({
  supplierId: z.string().describe('The unique ID of the supplier.'),
  companyName: z.string().describe('The name of the supplier company.'),
  matchScore: z.number().min(0).max(100).describe('A score from 0-100 indicating the quality of the match.'),
  justification: z.string().describe('A brief, one-sentence explanation of why this supplier is a good match.'),
});

const MatchingSuppliersOutputSchema = z.object({
  matches: z.array(SupplierMatchSchema),
});
export type MatchingSuppliersOutput = z.infer<typeof MatchingSuppliersOutputSchema>;

async function getVerifiedSuppliers() {
  console.log('Fetching verified suppliers from Firestore...');
  const adminApp = getFirebaseAdmin();
  const adminDb = getFirestore(adminApp);

  const snapshot = await adminDb.collection('users')
    .where('role', '==', 'supplier')
    .where('verificationStatus', '==', 'verified')
    .get();
  if (snapshot.empty) {
    console.log('No verified suppliers found.');
    return [];
  }

  const suppliers = snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      companyName: data.companyName || '',
      companyDescription: data.companyDescription || '',
      specializedCategories: data.specializedCategories || [],
    };
  });
  console.log(`Found ${suppliers.length} suppliers.`);
  return suppliers;
}

// The main exported function that client components will call.
export async function findMatchingSuppliers(input: MatchingSuppliersInput): Promise<MatchingSuppliersOutput> {
  console.log('Starting supplier matching flow for:', input.title);

  try {
    // 1. Get Suppliers
    const suppliers = await getVerifiedSuppliers();

    // 2. Construct Prompt
    const suppliersJson = JSON.stringify(suppliers, null, 2);
    const prompt = `
    You are an expert B2B sourcing agent. Your task is to find the best Indian suppliers for a German buyer's product requirement.

    Here is a list of available, verified suppliers:
    ${suppliersJson}

    Carefully analyze the buyer's requirement:
    - Requirement Title: ${input.title}
    - Product Category: ${input.productCategory}
    - Description: ${input.description}
    - Quantity: ${input.quantity}
    - Target Price: ${input.targetPrice}

    3. Compare the requirement against each supplier's profile, description, and specialized categories.
    4. Identify the top 3 to 5 suppliers that are the best fit.
    5. For each match, you MUST include the supplier's ID and their company name.
    6. For each match, provide a matchScore from 0 to 100. A higher score means a better match. A score over 85 is excellent. A score below 60 is a poor match.
    7. Provide a concise, one-sentence justification for why you chose each supplier. Focus on the most relevant positive attribute.
    
    Return your findings in the specified JSON format:
    {
      "matches": [
        {
          "supplierId": "string",
          "companyName": "string",
          "matchScore": number,
          "justification": "string"
        }
      ]
    }

    IMPORTANT: Return ONLY the JSON object. Do not wrap it in markdown code blocks.
    `;

    // 3. Call AI
    const response = await callOpenRouterWithReasoning({
      model: 'nvidia/nemotron-nano-12b-v2-vl:free',
      messages: [
        { role: 'user', content: prompt }
      ],
      reasoning: { enabled: true }
    });

    if (!response.choices || response.choices.length === 0) {
      console.error('AI did not return an output.');
      return { matches: [] };
    }

    let content = response.choices[0].message.content || '';
    console.log('AI Raw Output:', content);

    // Clean up markdown code blocks if present
    content = content.replace(/```json\n?|\n?```/g, '').trim();

    const parsed = JSON.parse(content);
    const validated = MatchingSuppliersOutputSchema.parse(parsed);

    console.log(`AI returned ${validated.matches.length} matches.`);
    return validated;

  } catch (error) {
    console.error('Error in findMatchingSuppliers:', error);
    // Return empty matches on error to prevent crashing UI
    return { matches: [] };
  }
}
