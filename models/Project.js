// models/Project.js
const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true },
    userProfilePic: { type: String }, // Added based on route usage, assume it's part of the User model
    title: { type: String, required: true },
    projectType: { type: String, default: 'Other' },
    description: { type: String, required: function() {return this.isPublished === true; } },
    problemStatement: { type: String },
    image: { type: String },
    
    // 🛑 FIX 1: Rename to 'collaborators' for Mongoose population
    collaborators: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User',
        default: [] 
    }],
    otherContributors: { type: String },
    resources: [{ type: String }],
    tags: [{ type: String }],

    // Fields moved under projectDetails in routes/projects.js 
    // They are defined here but were accessed via nested objects in the route
    // If you intend to use a nested object structure, you must define it explicitly:
    projectDetails: {
        CADFileLink: { type: String }, // Assuming this is the correct field name from the migration fix
        technicalDescription: { type: String },
        toolsSoftware: [{ type: String }],
        functionalGoals: { type: String },
        artworkImage: { type: String },
        mediumTechnique: { type: String },
        artistStatement: { type: String },
        exhibitionHistory: { type: String },
    },
    
    // Core data and metrics
    isPublished: { type: Boolean, default: true },
    views: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Added based on like logic
    viewedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Added based on view logic
    points: { type: Number, default: 0 }, // Added based on point logic
    comments: [{ 
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        userName: { type: String },
        userProfilePic: { type: String },
        text: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
    }],


    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }

});

// Update the updatedAt timestamp on save
projectSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('Project', projectSchema);