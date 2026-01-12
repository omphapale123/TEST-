/**
 * @fileoverview This file initializes the Genkit AI object with plugins for Google GenAI and Next.js integration.
 * It exports a single `ai` object that is used throughout the application to define and run AI flows.
 */
import { genkit } from 'genkit';
import { openAI } from 'genkitx-openai';
import { env } from '@/lib/env';

export const ai = genkit({
  plugins: [
    openAI({
      apiKey: env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
    }),
  ],
});
