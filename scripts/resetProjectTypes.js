// scripts/resetProjectTypes.js
require('dotenv').config();
const mongoose = require('mongoose');
// Corrected paths: Use '../' to go up one level from 'scripts'
const Project = require('../models/Project'); // Corrected path
const tagsConfig = require('../config/tags'); // Corrected path

const MONGODB_URI = process.env.MONGO_URL;

async function resetProjectTypes() {
    console.log('Starting projectType reset migration...');

    if (!MONGODB_URI) {
        console.error('MONGO_URL not found in .env. Please set it.');
        process.exit(1);
    }

    try {
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('MongoDB connected for projectType reset.');

        // Get a valid default project type from your config
        const defaultValidProjectType = tagsConfig.types.includes('Other') 
                                        ? 'Other' 
                                        : (tagsConfig.types.length > 0 ? tagsConfig.types[0] : 'Development'); 

        console.log(`Setting all existing projectType values to: "${defaultValidProjectType}"`);

        // Update all projects in the database
        const result = await Project.updateMany(
            {}, // Empty filter: matches all documents
            { $set: { projectType: defaultValidProjectType } }
        );

        console.log(`Successfully updated ${result.modifiedCount} projects.`);
        console.log('ProjectType reset migration completed!');

    } catch (error) {
        console.error('Error during projectType reset migration:', error);
    } finally {
        await mongoose.disconnect();
        console.log('MongoDB disconnected.');
        process.exit(0);
    }
}

resetProjectTypes();