// models/Project.js
const mongoose = require('mongoose');
const tagsConfig = require('../config/tags');

const projectSchema = new mongoose.Schema({
    // CORE FIELDS
    title: { 
        type: String, 
        required: [true, 'Project Title is required'],
        trim: true
    },
    description: { 
        type: String, 
        default: '',
        required: [function() { return this.isPublished; }, 'Description is required for published projects'],
        trim: true
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
    projectType: { 
        type: String,
        enum: tagsConfig.types,
        default: 'Other',
        required: [function() { return this.isPublished; }, 'Project Type is required for published projects']
    },
    year: { 
        type: String, 
        enum: tagsConfig.years.concat(''), // Allow empty for drafts
        default: '' 
    },
    department: { 
        type: String, 
        enum: tagsConfig.departments.concat(''), // Allow empty for drafts
        default: '' 
    },
    category: { 
        type: String, 
        enum: tagsConfig.categories.concat(''), // Allow empty for drafts
        default: '' 
    },
    
    // BASIC METADATA & TEXT
    problemStatement: { 
        type: String, 
        default: '',
        trim: true
    },
    tags: { 
        type: [String],
        validate: {
            validator: function(tags) { 
                const essentialTags = [this.year, this.department, this.category].filter(t => t);
                return !this.isPublished || tags.length > 0 || essentialTags.length > 0; 
            },
            message: 'At least one descriptive tag (or Course/Year/Dept/Category) is required for published projects'
        }
    },
    
    // COLLABORATORS & RESOURCES
    collaborators: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User',
        validate: {
            validator: async function(ids) {
                if (!ids.length) return true;
                const users = await mongoose.model('User').find({ _id: { $in: ids } });
                return users.length === ids.length;
            },
            message: 'Invalid collaborator IDs'
        }
    }],
    otherContributors: [{ 
        type: String,
        trim: true,
        validate: {
            validator: function(v) { return !v || v.length <= 100; },
            message: 'Other contributors must be 100 characters or less'
        }
    }],
    resources: [{ 
        type: String,
        trim: true,
        validate: {
            validator: function(v) { return !v || /^https?:\/\/.+$/.test(v); },
            message: 'Resources must be valid URLs'
        }
    }],

    // INTERACTION
    likes: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    viewedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    points: { type: Number, default: 0 },
    comments: [
        {
            userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
            userName: { type: String, required: true, trim: true },
            userProfilePic: { type: String, default: 'https://res.cloudinary.com/dphfedhek/image/upload/default-profile.jpg' },
            text: { type: String, required: true, trim: true },
            timestamp: { type: Date, default: Date.now }
        }
    ],
    likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    // SYSTEM & AUTH
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true, trim: true },
    userProfilePic: { type: String, default: 'https://res.cloudinary.com/dphfedhek/image/upload/default-profile.jpg' },
    isPublished: { type: Boolean, default: false },

    // PROJECT TYPE-SPECIFIC DETAILS
    projectDetails: {
        // Engineering Fields
        CADFileLink: { 
            type: String, 
            default: '',
            validate: {
                validator: function(v) { return !v || /^https?:\/\/.+$/.test(v); },
                message: 'CAD file link must be a valid URL'
            }
        },
        technicalDescription: { type: String, default: '', trim: true },
        toolsSoftwareUsed: [{ 
            type: String, 
            enum: tagsConfig.tools.concat(''), // Allow custom tools
            default: [] 
        }],
        functionalGoals: { type: String, default: '', trim: true },

        // Art Fields
        artworkImage: { 
            type: String, 
            default: '',
            validate: {
                validator: function(v) { return !v || /^https?:\/\/.+$/.test(v); },
                message: 'Artwork image must be a valid URL'
            }
        },
        mediumTechnique: { type: String, default: '', trim: true },
        artistStatement: { type: String, default: '', trim: true },
        exhibitionHistory: { type: String, default: '', trim: true }
    }
}, { timestamps: true });

module.exports = mongoose.model('Project', projectSchema);