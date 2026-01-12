
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local BEFORE importing app code
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function testRequirementFlow() {
    console.log('Testing Requirement Flow...');
    try {
        // Dynamic import to ensure env vars are loaded first
        const { extractRequirementDetails } = await import('./ai/flows/requirement-flow');

        const input = {
            text: "I need 5000 units of 100% cotton t-shirts, black and white, sizes S-XXL. Target price is $3 per unit.",
        };

        const result = await extractRequirementDetails(input);

        console.log('Flow Result:');
        console.log(JSON.stringify(result, null, 2));

    } catch (error) {
        console.error('Test failed:', error);
    }
}

testRequirementFlow();
