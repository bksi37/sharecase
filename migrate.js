// migrate.js (Revised for structural changes and new fields)

const mongoose = require('mongoose');
require('dotenv').config();

// Load the User model (assuming it correctly defines socialLinks as a nested object)
const User = require('./models/User'); 

// *** CRITICAL STEP: Ensure this points to your ACTUAL PRODUCTION MONGODB URL ***
// You must temporarily change this or use a specific environment variable for the live DB.
const dbUri = process.env.MONGO_URL; 

async function runMigration() {
    console.log("Starting MongoDB migration script (v2.1 - User Schema Update)...");
    console.log("Targeting Database:", dbUri.substring(0, 30) + '...');

    try {
        await mongoose.connect(dbUri, { useNewUrlParser: true, useUnifiedTopology: true });
        console.log("Successfully connected to MongoDB.");

        // --- MIGRATION LOGIC: Using aggregation pipeline for complex updates ---

        const updateResult = await User.updateMany(
            { 
                // Only target documents that are missing the new structure or still have old fields
                $or: [
                    { socialLinks: { $exists: false } }, 
                    { linkedin: { $exists: true } },
                    { activityLog: { $exists: false } } // Target documents missing the activity log
                ]
            }, 
            [
                { 
                    $set: {
                        // 1. **MIGRATE SOCIAL LINKS**: Moves old fields into the new nested structure.
                        socialLinks: {
                            linkedin: { $ifNull: ["$linkedin", ""] },
                            github: { $ifNull: ["$github", ""] },
                            website: { $ifNull: ["$personalWebsite", ""] }
                        },
                        
                        // 2. **STANDARDIZE EMAIL**: Use existing data, default to blank string.
                        schoolEmail: { $ifNull: ["$universityEmail", "$schoolEmail", ""] },
                        
                        // 3. **INITIALIZE NEW FIELDS**: Use $ifNull to set defaults if the field is missing.
                        totalPoints: { $ifNull: ["$totalPoints", 0] },
                        followers: { $ifNull: ["$followers", []] },
                        following: { $ifNull: ["$following", []] },
                        twoFactorAuth: { $ifNull: ["$twoFactorAuth", false] },
                        notifications: { $ifNull: ["$notifications", "all"] },
                        theme: { $ifNull: ["$theme", "light"] },
                        privacy: { $ifNull: ["$privacy", "public"] },
                        
                        // 🚀 CRITICAL FOR NEW FEATURES: Initialize empty array for activityLog
                        activityLog: { $ifNull: ["$activityLog", []] },
                        // 🚀 CRITICAL FOR NEW FEATURES: Initialize empty array for viewedProjects
                        viewedProjects: { $ifNull: ["$viewedProjects", []] }
                    } 
                },
                { 
                    // 4. **CLEANUP OLD FIELDS**: Remove the deprecated top-level fields.
                    $unset: ["linkedin", "github", "personalWebsite", "universityEmail"] 
                }
            ]
        );

        console.log(`Migration complete! Modified ${updateResult.modifiedCount} user accounts.`);
        
    } catch (error) {
        console.error("Migration failed:", error);
    } finally {
        await mongoose.disconnect();
        console.log("MongoDB connection closed. Script finished.");
    }
}

// Ensure you run this script using the LIVE production MONGODB_URI!
runMigration();