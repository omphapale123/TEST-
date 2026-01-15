import fs from 'fs';
import path from 'path';

function loadEnv() {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        const lines = content.split('\n');
        for (const line of lines) {
            if (line.startsWith('OPENROUTER_API_KEY=')) {
                const key = line.replace('OPENROUTER_API_KEY=', '').trim().replace(/^["']|["']$/g, '');
                process.env.OPENROUTER_API_KEY = key;
                return key;
            }
        }
    }
    return null;
}

const key = loadEnv();



async function testOpenRouter() {
    console.log('Testing OpenRouter connection...');

    if (!process.env.OPENROUTER_API_KEY) {
        console.error('OPENROUTER_API_KEY is missing in .env.local');
        return;
    }

    try {
        const prompt = `
    You are an expert at parsing product requirements from conversational text. Extract the details from the user's input.

    User input: I need 5000 units of blue ballpoint pens delivered to Germany. Target price 0.50 Euro.

    Infer the destination country as Germany unless specified otherwise. 

    STRICT CATEGORY MAPPING:
    You MUST choose the most relevant category from this list: [Office Supplies, Industrial, Electronics, Other].
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

        console.log('Sending complex prompt to OpenRouter...');
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                "HTTP-Referer": "https://offshorebrucke.com",
                "X-Title": "Offshore Brucke Test",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "deepseek/deepseek-r1-0528:free",
                messages: [
                    {
                        role: "user",
                        content: prompt
                    }
                ]
            })
        });

        const data = await response.json();

        if (data.choices && data.choices.length > 0) {
            let content = data.choices[0].message.content;
            console.log('\nAI Raw Output:');
            console.log(content);

            // Simulation of app logic
            const cleaned = content.replace(/```json\n?|\n?```/g, '').trim();
            try {
                const parsed = JSON.parse(cleaned);
                console.log('\nSUCCESS: Parsed JSON:');
                console.log(JSON.stringify(parsed, null, 2));
            } catch (e) {
                console.error('\nFAIL: Could not parse JSON:', e.message);
            }
        } else {
            console.error('No choices returned:', JSON.stringify(data, null, 2));
        }

    } catch (error) {
        console.error('Test failed:', error);
    }
}

testOpenRouter();
