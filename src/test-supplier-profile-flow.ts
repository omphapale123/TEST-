import { extractSupplierCategories } from './src/ai/flows/supplier-profile-flow';

async function runTest() {
    console.log('Testing AI Category Extraction...');

    const testCases = [
        {
            name: 'Machinery Supplier',
            text: 'We are a leading manufacturer of industrial CNC machines, hydraulic presses, and automated assembly lines for the automotive industry.'
        },
        {
            name: 'Apparel Supplier',
            text: 'Our factory specializes in high-quality organic cotton t-shirts, hoodies, and sustainable activewear for global brands.'
        },
        {
            name: 'Food/Mixed',
            text: 'We process and export premium basmati rice, organic spices, and also have a small division for eco-friendly jute packaging bags.'
        }
    ];

    for (const testCase of testCases) {
        console.log(`\n--- Test Case: ${testCase.name} ---`);
        console.log(`Input: "${testCase.text}"`);
        try {
            const result = await extractSupplierCategories({ text: testCase.text });
            console.log('Suggested Category IDs:', result.suggestedCategoryIds);
            console.log('Justification:', result.justification);
        } catch (error) {
            console.error('Test failed:', error);
        }
    }
}

runTest();
