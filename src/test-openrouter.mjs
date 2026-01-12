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
                        content: "What is the meaning of life?"
                    }
                ]
            })
        });

        const data = await response.json();
        console.log('OpenRouter Response Status:', response.status);

        if (data.choices && data.choices.length > 0) {
            console.log('\nAI Answer:');
            console.log(data.choices[0].message.content);
        } else {
            console.log('OpenRouter Response Payload:');
            console.log(JSON.stringify(data, null, 2));
        }
    } catch (error) {
        console.error('Test failed:', error);
    }
}

testOpenRouter();
