const mongoose = require('mongoose');

const ProjectSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String },
    image: { type: String },
    tags: [{ type: String }], // Already present
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now },
    problemStatement: { type: String }, // Added for project details
    collaborators: [{ type: String }], // Added for collaborators list
    resources: [{ type: String }], // Added for resource links
    likes: { type: Number, default: 0 }, // Added for like count
    views: { type: Number, default: 0 }, // Added for view count
    comments: [{ // Added for comments
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        userName: { type: String },
        text: { type: String, required: true },
        timestamp: { type: Date, default: Date.now }
    }],
    isPublished: { type: Boolean, default: true } // Added to distinguish drafts
});

module.exports = mongoose.model('Project', ProjectSchema);