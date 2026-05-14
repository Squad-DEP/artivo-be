import 'dotenv/config'; 
import { identityCardService } from "../../src/services/business_card/hybrid"; 
import fs from "fs";
import path from "path";

const runTest = async () => {
    const mockArtisans = [
        {
            // CASE: The Long Name (Tests your drawName wrap & shrink logic)
            username: "tech_titan",
            artisan_name: "Oluwaseun Christopher-Janus Abdulsalam-Okonkwo", 
            trade: "teacher",
            location: "Lekki Free Trade Zone, Block A14, Phase 2",
            contact: "+234 901 000 0000",
            headshot_url: "https://xsgames.co/randomusers/assets/avatars/male/1.jpg"
        }/*,
        {
            // CASE: The Fallback King (No image + Unknown trade)
            // Tests drawInitialsAvatar and THEME_PROMPTS['default']
            username: "ghost_builder",
            artisan_name: "Musa Yar'Adua",
            trade: "cobbler", // Not in your TRADE_ACCENTS or THEME_PROMPTS
            location: "Kano Pillars Way",
            contact: "080-NO-IMAGE",
            headshot_url: "" // Empty string to trigger catch block
        },
        {
            // CASE: Special Characters & Short Name
            username: "dr_k",
            artisan_name: "Dr. K",
            trade: "tailoring",
            location: "Surulere, Lagos",
            contact: "+234 810 555 2222",
            headshot_url: "https://xsgames.co/randomusers/assets/avatars/female/5.jpg"
        },
        {
            // CASE: Heavy Industrial Theme (Testing flux prompt complexity)
            username: "grease_monkey",
            artisan_name: "Chidi 'The Wrench' Eze",
            trade: "mechanic",
            location: "Ladipo Auto Market, Mushin",
            contact: "0803- Ladipo - 1",
            headshot_url: "https://xsgames.co/randomusers/assets/avatars/male/70.jpg"
        },
        {
            // CASE: High-End Minimalist (Testing "Cleaning" white/silver theme)
            username: "pure_aura",
            artisan_name: "Amina Yusuf",
            trade: "cleaning",
            location: "Eko Atlantic City",
            contact: "Direct Line: 0900",
            headshot_url: "https://xsgames.co/randomusers/assets/avatars/female/25.jpg"
        }*/
    ];
    

    console.log(`🚀 Starting batch generation for ${mockArtisans.length} randomized artisans...`);

    for (const artisan of mockArtisans) {
        try {
            console.log(`-----------------------------------`);
            console.log(`🎴 Generating: ${artisan.artisan_name.toUpperCase()} (${artisan.trade})`);
            
            const buffer = await identityCardService.createIdentityCard(artisan as any);
            
            // Generate unique filename based on username and trade
            const filename = `card_${artisan.trade}_${artisan.username}.png`;
            const outputPath = path.join(__dirname, filename);
            
            fs.writeFileSync(outputPath, buffer);
            
            console.log(`✅ File ready: ${filename}`);
        } catch (error) {
            console.error(`❌ Error for ${artisan.artisan_name}:`, error);
        }
    }
    
    console.log(`\n✨ Batch complete! Open the test folder to see the variety.`);
};

runTest();
