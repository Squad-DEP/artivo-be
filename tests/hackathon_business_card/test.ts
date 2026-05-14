import 'dotenv/config'; 
import { createIdentityCard } from "../../src/services/business_card/hybrid"; 
import fs from "fs";
import path from "path";

const runTest = async () => {
    const mockArtisans = [
        {
            username: "iron_man_99",
            artisan_name: "Babatunde 'The Forge' Lawal",
            trade: "welding",
            location: "Oshodi Industrial Scheme",
            tagline: "Precision arcs and structural integrity",
            contact: "+234 803 999 8888",
            verified_by: ["Lagos Welders Guild", "Artivo"],
            headshot_url: "https://xsgames.co/randomusers/assets/avatars/male/22.jpg" 
        },
        {
            username: "green_thumb_ng",
            artisan_name: "Amaka Onyebuchi",
            trade: "landscaping",
            location: "Banana Island, Ikoyi",
            tagline: "Transforming spaces into lush paradises",
            contact: "+234 701 222 3333",
            verified_by: ["Horticulture Society"],
            headshot_url: "https://xsgames.co/randomusers/assets/avatars/female/18.jpg" 
        },
        {
            username: "cool_air_pro",
            artisan_name: "Segun Arinze",
            trade: "hvac",
            location: "Gbagada Phase 2",
            tagline: "Industrial chilling & maintenance",
            contact: "+234 905 444 5555",
            verified_by: ["Council of Engineers"],
            headshot_url: "https://xsgames.co/randomusers/assets/avatars/male/51.jpg" 
        },
        {
            username: "chef_k",
            artisan_name: "Korede 'Five-Star' Bello",
            trade: "cooking",
            location: "Victoria Island",
            tagline: "Gourmet local & continental dishes",
            contact: "+234 812 666 7777",
            verified_by: ["Culinary Arts Hub"],
            headshot_url: "https://xsgames.co/randomusers/assets/avatars/male/65.jpg" 
        },
        {
            username: "clean_queen",
            artisan_name: "Folashade Tinubu-Ojo",
            trade: "cleaning",
            location: "Ikeja GRA",
            tagline: "Spotless finishes for corporate offices",
            contact: "+234 808 000 1111",
            verified_by: ["Standard Organization"],
            headshot_url: "https://xsgames.co/randomusers/assets/avatars/female/44.jpg" 
        }
    ];

    console.log(`🚀 Starting batch generation for ${mockArtisans.length} randomized artisans...`);

    for (const artisan of mockArtisans) {
        try {
            console.log(`-----------------------------------`);
            console.log(`🎴 Generating: ${artisan.artisan_name.toUpperCase()} (${artisan.trade})`);
            
            const buffer = await createIdentityCard(artisan as any);
            
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
