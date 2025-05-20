const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, default: '' },
    image: { type: String, default: 'https://res.cloudinary.com/dphfedhek/image/upload/default-project.jpg' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true }, // Store userName directly for display
    problemStatement: { type: String, default: '' },
    tags: [{ type: String }],
  
    // MODIFIED: Collaborators to reference User IDs (signed-up users)
    collaborators: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  
  // NEW: For non-registered collaborators (the "and others" names)
    otherCollaborators: [{ type: String }],
    resources: [{ type: String }],
    likes: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
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