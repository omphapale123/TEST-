/**
 * @fileoverview This file is the entrypoint for all Genkit flow requests.
 */
import { genkit } from 'genkit';
import { openAI } from 'genkitx-openai';
import { env } from '@/lib/env';
import { findMatchingSuppliers } from '@/ai/flows/supplier-matching-flow';
import { extractRequirementDetails } from '@/ai/flows/requirement-flow';
import { NextRequest } from 'next/server';

const GENKIT_CLIENT_HEADER = 'x-genkit-client';

// This is a SERVER-SIDE instance of Genkit. It's separate from the one in src/ai/genkit.ts
export const ai = genkit({
  plugins: [
    openAI({
      apiKey: env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
    }),
  ],
});

const allFlows: Record<string, Function> = {
  findMatchingSuppliers: findMatchingSuppliers,
  extractRequirementDetails: extractRequirementDetails,
};

export async function POST(req: NextRequest) {
  const flowName = req.headers.get(GENKIT_CLIENT_HEADER);
  if (!flowName) {
    return new Response('Flow name is missing', { status: 400 });
  }

  const flow = allFlows[flowName];
  if (!flow) {
    return new Response(`Flow not found: ${flowName}`, { status: 404 });
  }

  const requestJson = await req.json();

  try {
    const result = await flow(requestJson);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    if (err && typeof err === 'object' && 'message' in err) {
      return new Response(err.message, { status: 500 });
    }
    return new Response('An unexpected error occurred', { status: 500 });
  }
}
