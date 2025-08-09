const mongoose = require('mongoose');
const tagsConfig = require('../config/tags');

const projectSchema = new mongoose.Schema({
    title: { 
        type: String, 
        required: [true, 'Project Title is required'] 
    },
    description: { 
        type: String, 
        default: '',
        required: [function() { return this.isPublished; }, 'Description is required for published projects']
    },
    image: { 
        type: String, 
        default: 'https://res.cloudinary.com/dphfedhek/image/upload/default-project.jpg',
        validate: {
            validator: function(value) { 
                return !this.isPublished || value !== 'https://res.cloudinary.com/dphfedhek/image/upload/default-project.jpg'; 
            },
            message: 'A non-default image is required for published projects'
        }
    },
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    userName: { 
        type: String, 
        required: true 
    },
    userProfilePic: { 
        type: String, 
        default: 'https://res.cloudinary.com/dphfedhek/image/upload/default-profile.jpg' 
    },
    problemStatement: { 
        type: String, 
        default: '' 
    },
    tags: { 
        type: [String],
        validate: {
            validator: function(tags) { 
                return !this.isPublished || tags.length > 0; 
            },
            message: 'At least one tag is required for published projects'
        }
    },
    collaborators: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    }],
    otherCollaborators: [{ 
        type: String 
    }],
    resources: [{ 
        type: String 
    }],
    likes: { 
        type: Number, 
        default: 0 
    },
    views: { 
        type: Number, 
        default: 0 
    },
    viewedBy: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    }], // New field to track unique viewers
    projectType: { 
        type: String,
        enum: tagsConfig.types,
        default: 'Other',
        required: [function() { return this.isPublished; }, 'Project Type is required for published projects']
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
    likedBy: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    }],
    isPublished: { 
        type: Boolean, 
        default: false 
    }
}, { timestamps: true });

module.exports = mongoose.model('Project', projectSchema);