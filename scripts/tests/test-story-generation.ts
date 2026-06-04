import { generateSocialContent, generateSocialImage } from '../../src/services/social-content.service';

async function run() {
    try {
        console.log("Generating copy...");
        const content = await generateSocialContent({
            platform: 'INSTAGRAM',
            format: 'STORY',
            sourceType: 'FREE',
            topic: 'Lentes de sol para verano',
            imageStyle: 'PLACA_TEXTO',
            goal: 'Inspirar con moda y tendencias'
        });
        
        console.log("Copy generated:", content.copy);
        console.log("Image Prompt:", content.imagePrompt);
        
        console.log("\nGenerating image...");
        const image = await generateSocialImage(content.id);
        console.log("Image generated:", image.imageUrl);
    } catch (e) {
        console.error("Error:", e);
    }
}

run();
