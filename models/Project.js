const mongoose = require('mongoose');
const tagsConfig = require('../config/tags'); // <--- ADD THIS LINE to import tagsConfig

const projectSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, default: '' },
    image: { type: String, default: 'https://res.cloudinary.com/dphfedhek/image/upload/default-project.jpg' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true },
    userProfilePic: { type: String, default: 'https://res.cloudinary.com/dphfedhek/image/upload/default-profile.jpg' }, // Added from previous advice
    problemStatement: { type: String, default: '' },
    tags: [{ type: String }],
    
    collaborators: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    otherCollaborators: [{ type: String }],
    resources: [{ type: String }],
    
    likes: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    
    projectType: { 
        type: String,
        // CRITICAL FIX: Use the types from your config/tags.js
        enum: tagsConfig.types, // <--- THIS IS THE CHANGE
        default: 'Other' // Set a default that is definitely in your tagsConfig.types
    },
    points: { 
        type: Number,
        default: 0
    },
    
    comments: [
        {
            userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
            userName: { type: String, required: true },
            userProfilePic: { type: String, default: 'https://res.cloudinary.com/dphfedhek/image/upload/default-profile.jpg' },
            text: { type: String, required: true },
            timestamp: { type: Date, default: Date.now }
        }
    ],
    likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    isPublished: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Project', projectSchema);