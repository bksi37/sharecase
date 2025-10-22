// migrate.js (Revised for specific socialLinks structure change)

const mongoose = require('mongoose');
require('dotenv').config();

// Load the User model (assuming it correctly defines socialLinks as a nested object)
const User = require('./models/User'); 

// *** NOTE: SET THIS TO YOUR ACTUAL MONGODB URL ***
const dbUri = process.env.MONGO_URL; 

async function runMigration() {
    console.log("Starting MongoDB migration script (v2.0)...");
    console.log("Connecting to:", dbUri.substring(0, 30) + '...');

    try {
        await mongoose.connect(dbUri, { useNewUrlParser: true, useUnifiedTopology: true });
        console.log("Successfully connected to MongoDB.");

        // --- MIGRATION LOGIC ---

        const updateResult = await User.updateMany(
            { 
                // Only target documents that are missing the new structure
                $or: [
                    { socialLinks: { $exists: false } }, 
                    { linkedin: { $exists: true } } // Documents still have old fields
                ]
            }, 
            [
                { 
                    $set: {
                        // 1. **MIGRATE SOCIAL LINKS**: If the old fields exist, move them into the new nested structure.
                        socialLinks: {
                            linkedin: { $ifNull: ["$linkedin", ""] },
                            github: { $ifNull: ["$github", ""] },
                            website: { $ifNull: ["$personalWebsite", ""] }
                        },
                        
                        // 2. **STANDARDIZE EMAIL**: Use the existing 'universityEmail' data if available, or initialize 'schoolEmail' to a blank string.
                        // Assuming the new schema uses 'schoolEmail' based on your settings page form data.
                        schoolEmail: { $ifNull: ["$universityEmail", "$schoolEmail", ""] },
                        
                        // 3. **INITIALIZE NEW PRIMITIVES** (If not already initialized):
                        totalPoints: { $ifNull: ["$totalPoints", 0] },
                        followers: { $ifNull: ["$followers", []] },
                        following: { $ifNull: ["$following", []] },
                        twoFactorAuth: { $ifNull: ["$twoFactorAuth", false] },
                        notifications: { $ifNull: ["$notifications", "all"] },
                        theme: { $ifNull: ["$theme", "light"] },
                        privacy: { $ifNull: ["$privacy", "public"] },
                    } 
                },
                { 
                    // 4. **CLEANUP OLD FIELDS**: Remove the deprecated top-level social fields.
                    $unset: ["linkedin", "github", "personalWebsite", "universityEmail"] 
                }
            ]
        );

        console.log(`Migration complete! Modified ${updateResult.modifiedCount} user accounts.`);
        
        // --- End of MIGRATION LOGIC ---

    } catch (error) {
        console.error("Migration failed:", error);
    } finally {
        await mongoose.disconnect();
        console.log("MongoDB connection closed. Script finished.");
    }
}

runMigration();