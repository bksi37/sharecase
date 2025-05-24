// routes/projects.js

const express = require('express');
const cloudinary = require('cloudinary').v2;
const Project = require('../models/Project');
const { isAuthenticated, isProfileComplete } = require('../middleware/auth');
const PDFDocument = require('pdfkit');
const User = require('../models/User');
const https = require('https');
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
const tagsConfig = require('../config/tags');
const upload = require('../middleware/upload');
const router = express.Router();

// Add Project (Updated for Multer)
router.post('/add-project', isAuthenticated, isProfileComplete, upload.single('image'), async (req, res) => {
    try {
        const { title, description, tags, problemStatement, collaboratorIds, otherCollaborators, resources, isPublished } = req.body;

        if (!title) {
            return res.status(400).json({ error: 'Title is required' });
        }

        const parsedCollaboratorIds = collaboratorIds
            ? collaboratorIds.split(',').map(id => id.trim()).filter(id => id && ObjectId.isValid(id)).map(id => new ObjectId(id))
            : [];

        const parsedOtherCollaborators = otherCollaborators
            ? otherCollaborators.split(',').map(c => c.trim()).filter(c => c !== '')
            : [];

        let imageUrl = 'https://res.cloudinary.com/dphfedhek/image/upload/default-project.jpg';
        // Handle project image upload using req.file (from Multer)
        if (req.file && req.file.path) {
            imageUrl = req.file.path; // Multer's CloudinaryStorage already gives you the secure_url
            console.log('New project image URL assigned from Multer:', imageUrl);
        } else {
            console.log('No project image uploaded. Using default or existing.');
        }


        const project = new Project({
            title,
            description,
            tags: tags ? tags.split(',').map(t => t.trim()) : [],
            image: imageUrl,
            userId: req.session.userId,
            userName: req.session.userName || 'Anonymous',
            problemStatement: problemStatement || '',
            collaborators: parsedCollaboratorIds,
            otherCollaborators: parsedOtherCollaborators,
            resources: resources ? resources.split(',').map(r => r.trim()) : [],
            isPublished: isPublished === 'true'
        });

        await project.save();

        if (parsedCollaboratorIds.length > 0) {
            await User.updateMany(
                { _id: { $in: parsedCollaboratorIds } },
                { $addToSet: { projectsCollaboratedOn: project._id } }
            );
        }

        res.redirect('/index.html'); // Or res.status(200).json({ success: true, projectId: project._id }); if frontend expects JSON
    } catch (error) {
        console.error('Add project error:', error);
        // Handle Multer errors specifically
        if (error instanceof multer.MulterError) {
             console.error('Multer Error during add-project:', error.message);
             return res.status(400).json({ error: `File upload error: ${error.message}` });
        }
        res.status(500).json({ error: 'Server error', details: error.message });
    }
});

// GET route to fetch dynamic filter options/tags
router.get('/dynamic-filter-options', isAuthenticated, isProfileComplete, async (req, res) => {
    try {
        res.json(tagsConfig);
    } catch (error) {
        console.error('Error fetching dynamic filter options:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Fetch All Projects (Keeping your existing code for this route)
router.get('/projects', isAuthenticated, isProfileComplete, async (req, res) => {
    try {
        const projects = await Project.find({ isPublished: true }).populate('userId', 'name');
        res.json(projects.map(p => ({
            id: p._id,
            title: p.title,
            description: p.description,
            image: p.image || 'https://res.cloudinary.com/dphfedhek/image/upload/default-project.jpg',
            userId: p.userId._id,
            userName: p.userId.name,
            likes: p.likes || 0,
            views: p.views || 0
        })));
    } catch (error) {
        console.error('Fetch projects error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Consolidated Search Projects AND Users (Robust version)
router.get('/search', isAuthenticated, async (req, res) => { // Removed isProfileComplete to allow broader search
    try {
        const { q, course, year, type, department, category } = req.query;
        const projectQuery = {};
        const userQuery = {};

        // Build project search query (using the assumption that 'tags' is an array of strings)
        if (q) {
            projectQuery.$or = [
                { title: { $regex: q, $options: 'i' } },
                { description: { $regex: q, $options: 'i' } },
                { problemStatement: { $regex: q, $options: 'i' } },
                { tags: { $regex: q, $options: 'i' } } // Search within the tags array
            ];
        }

        // Add specific filter parameters if they are provided and not 'All'
        // This assumes these filter values are also stored as strings within the 'tags' array.
        const filterTags = [course, year, type, department, category].filter(t => t && t !== 'All');
        if (filterTags.length > 0) {
            projectQuery.tags = { $all: filterTags }; // Requires all specified tags to be present
        }

        projectQuery.isPublished = true; // Only show published projects in search results

        // Build user search query
        if (q) {
            userQuery.$or = [
                { name: { $regex: q, $options: 'i' } },
                { major: { $regex: q, $options: 'i' } },
                // Assuming User schema has a department field, if not, remove this:
                { department: { $regex: q, $options: 'i' } }
            ];
        }
        // Only fetch users whose profiles are complete (optional, but good for meaningful search results)
        userQuery.isProfileComplete = true;

        // Execute both queries concurrently
        const [projects, users] = await Promise.all([
            Project.find(projectQuery)
                   .populate('userId', 'name profilePic') // Corrected to userId
                   .limit(20), // Limit project results for performance
            User.find(userQuery)
                .select('name major department profilePic linkedin') // Select relevant user fields
                .limit(10) // Limit user results
        ]);

        // Format projects for consistent frontend consumption
        const formattedProjects = projects.map(p => ({
            id: p._id,
            title: p.title,
            description: p.description,
            image: p.image || 'https://res.cloudinary.com/dphfedhek/image/upload/default-project.jpg',
            userId: p.userId ? p.userId._id : null, // Handle case where userId might not be populated (though it should be)
            userName: p.userId ? p.userId.name : 'Unknown',
            userProfilePic: p.userId ? (p.userId.profilePic || 'https://res.cloudinary.com/dphfedhek/image/upload/default-profile.jpg') : 'https://res.cloudinary.com/dphfedhek/image/upload/default-profile.jpg',
            likes: p.likes || 0,
            views: p.views || 0,
            tags: p.tags || [], // Include tags in the response
            isPublished: p.isPublished // Include publish status
        }));

        // Format users for frontend consumption
        const formattedUsers = users.map(u => ({
            _id: u._id,
            name: u.name,
            major: u.major || 'N/A',
            // Department might not exist, handle gracefully
            department: u.department || 'N/A',
            profilePic: u.profilePic || 'https://res.cloudinary.com/dphfedhek/image/upload/default-profile.jpg',
            linkedin: u.linkedin || ''
        }));

        res.json({
            success: true,
            results: {
                projects: formattedProjects,
                users: formattedUsers
            }
        });

    } catch (error) {
        console.error('Global search error:', error);
        res.status(500).json({ error: 'Server error during search' });
    }
});

// Filter Options (Keeping your existing code for this route, ensure tags are consistent)
router.get('/filter-options', isAuthenticated, isProfileComplete, async (req, res) => {
    try {
        const projects = await Project.find();
        // These filters assume specific tag values are present in the 'tags' array
        const courses = [...new Set(projects.flatMap(p => p.tags.filter(t => t.startsWith('MECH') || t.startsWith('CS'))))];
        const years = [...new Set(projects.flatMap(p => p.tags.filter(t => /^\d{4}$/.test(t))))];
        const types = [...new Set(projects.flatMap(p => p.tags.filter(t => ['Robotics', 'Software', 'Hardware'].includes(t))))];
        const departments = [...new Set(projects.flatMap(p => p.tags.filter(t => ['CS', 'MECH', 'EE'].includes(t))))];
        const projectCategories = [...new Set(projects.flatMap(p => p.tags.filter(t => ['AI', 'IoT', 'Mechanics'].includes(t))))];
        res.json({ courses, years, types, departments, projectCategories });
    } catch (error) {
        console.error('Filter options error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Fetch User Projects (Corrected to include collaborated projects)
router.get('/user-projects', isAuthenticated, isProfileComplete, async (req, res) => {
    try {
        const userId = req.session.userId;

        const projects = await Project.find({
            $or: [
                { userId: userId }, // Projects uploaded by the user
                { collaborators: userId } // Projects where the user is a collaborator
            ]
        })
        .select('title description image isPublished likes views'); // Select necessary fields

        res.json(projects.map(p => ({
            id: p._id,
            title: p.title,
            image: p.image || 'https://res.cloudinary.com/dphfedhek/image/upload/default-project.jpg',
            description: p.description,
            isPublished: p.isPublished,
            likes: p.likes || 0,
            views: p.views || 0
        })));
    } catch (error) {
        console.error('Fetch user projects error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});
// Post Comment (Keeping your existing code for this route)
router.post('/project/:id/comment', isAuthenticated, isProfileComplete, async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }
        project.comments = project.comments || [];
        project.comments.push({
            userId: req.session.userId,
            userName: req.session.userName || 'Anonymous',
            text: req.body.text,
            timestamp: new Date()
        });
        await project.save();
        res.json({ success: true });
    } catch (error) {
        console.error('Post comment error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete Project (Keeping your existing code for this route)
router.delete('/project/:id', isAuthenticated, isProfileComplete, async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }
        if (project.userId.toString() !== req.session.userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        if (project.image && !project.image.includes('default-project.jpg')) {
            const publicId = project.image.split('/').pop().split('.')[0];
            await cloudinary.uploader.destroy(`sharecase/projects/${publicId}`);
        }
        await project.deleteOne();
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Delete project error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Edit Project (Modified for Multer)
router.put('/project/:id', isAuthenticated, isProfileComplete, upload.single('image'), async (req, res) => { // <--- Apply Multer here
    try {
        const project = await Project.findById(req.params.id);
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const isUploader = project.userId.toString() === req.session.userId;
        const isCollaborator = project.collaborators.some(collabId => collabId.toString() === req.session.userId);

        if (!isUploader && !isCollaborator) {
            return res.status(403).json({ error: 'Unauthorized to edit this project.' });
        }

        const { title, description, tags, problemStatement, collaboratorIds, otherCollaborators, resources, isPublished } = req.body;

        if (!title) {
            return res.status(400).json({ error: 'Title is required' });
        }

        const newCollaboratorIds = collaboratorIds
            ? collaboratorIds.split(',').map(id => id.trim()).filter(id => id && ObjectId.isValid(id)).map(id => new ObjectId(id))
            : [];

        const newOtherCollaborators = otherCollaborators
            ? otherCollaborators.split(',').map(c => c.trim()).filter(c => c !== '')
            : [];

        let imageUrl = project.image;
        // Handle project image upload using req.file (from Multer)
        if (req.file && req.file.path) {
            // If a new image is uploaded, destroy the old one (if it's not the default)
            if (imageUrl && !imageUrl.includes('default-project.jpg')) {
                const publicId = imageUrl.split('/').pop().split('.')[0];
                await cloudinary.uploader.destroy(`sharecase/projects/${publicId}`); // Ensure public ID matches Cloudinary setup
            }
            imageUrl = req.file.path; // Multer's CloudinaryStorage already gives you the secure_url
            console.log('New project image URL assigned from Multer during edit:', imageUrl);
        } else {
            // If no new image, keep the existing one.
            console.log('No new project image uploaded during edit. Retaining existing.');
        }


        const oldCollaboratorIds = project.collaborators.map(id => id.toString());
        const addedCollaborators = newCollaboratorIds.filter(id => !oldCollaboratorIds.includes(id.toString()));
        const removedCollaborators = oldCollaboratorIds.filter(id => !newCollaboratorIds.map(oId => oId.toString()).includes(id));

        if (addedCollaborators.length > 0) {
            await User.updateMany(
                { _id: { $in: addedCollaborators } },
                { $addToSet: { projectsCollaboratedOn: project._id } }
            );
        }

        if (removedCollaborators.length > 0) {
            await User.updateMany(
                { _id: { $in: removedCollaborators.map(id => new ObjectId(id)) } },
                { $pull: { projectsCollaboratedOn: project._id } }
            );
        }

        project.title = title;
        project.description = description || '';
        project.problemStatement = problemStatement || '';
        project.tags = tags ? tags.split(',').map(t => t.trim()) : [];
        project.collaborators = newCollaboratorIds;
        project.otherCollaborators = newOtherCollaborators;
        project.resources = resources ? resources.split(',').map(r => r.trim()) : [];
        project.isPublished = isPublished === 'true';
        project.image = imageUrl;

        await project.save();
        res.json({ success: true });

    } catch (error) {
        console.error('Edit project error:', error);
        if (error instanceof multer.MulterError) {
             console.error('Multer Error during edit-project:', error.message);
             return res.status(400).json({ error: `File upload error: ${error.message}` });
        }
        res.status(500).json({ error: 'Server error', details: error.message });
    }
});

// Like/Unlike Project (Keeping your existing code for this route)
router.post('/project/:id/like', isAuthenticated, isProfileComplete, async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }
        const userId = req.session.userId;
        const hasLiked = project.likedBy.includes(userId);
        if (hasLiked) {
            project.likedBy = project.likedBy.filter(id => id.toString() !== userId);
        } else {
            project.likedBy.push(userId);
        }
        project.likes = project.likedBy.length;
        await project.save();
        res.json({ success: true, likes: project.likes, hasLiked: !hasLiked });
    } catch (error) {
        console.error('Like project error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Generate Portfolio (FINAL ATTEMPT FIX for ReferenceError: https is not defined)
router.post('/generate-portfolio', isAuthenticated, isProfileComplete, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        const projects = await Project.find({ userId: req.session.userId, isPublished: true });
        const doc = new PDFDocument({ size: 'A4', margin: 40 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=portfolio.pdf'); // Or 'inline' if you prefer
        doc.pipe(res);

        // Fonts
        doc.registerFont('Roboto', 'public/fonts/Roboto-Regular.ttf');
        doc.registerFont('Roboto-Bold', 'public/fonts/Roboto-Bold.ttf');

        // Header
        doc.fillColor('#007bff').font('Roboto-Bold').fontSize(28).text(user.name, { align: 'center' });
        doc.moveDown(0.2);
        doc.fillColor('#000000').font('Roboto').fontSize(12).text(user.email || '', { align: 'center' });
        if (user.linkedin) {
            doc.moveDown(0.2);
            let linkedinUrl = user.linkedin;
            // Ensure proper absolute URL for LinkedIn in PDF
            if (!linkedinUrl.startsWith('http://') && !linkedinUrl.startsWith('https://')) {
                linkedinUrl = `https://${linkedinUrl}`;
            }
            doc.fillColor('#000000').font('Roboto').fontSize(12).text(`LinkedIn: ${user.linkedin}`, { align: 'center', link: linkedinUrl });
        }
        doc.moveDown(1);
        doc.lineWidth(2).strokeColor('#212529').moveTo(40, doc.y).lineTo(552, doc.y).stroke();
        doc.moveDown(1);

        // Projects Section Title
        doc.fillColor('#212529').font('Roboto-Bold').fontSize(22).text('My Projects', { align: 'left' });
        doc.moveDown(.5);

        if (projects.length === 0) {
            doc.font('Roboto').fontSize(12).text('No projects available to display.', { align: 'center' });
        } else {
            for (const [index, p] of projects.entries()) {
                if (index > 0) doc.addPage();

                // Project Title
                doc.fillColor('#212529').font('Roboto-Bold').fontSize(18).text(p.title, { align: 'left' });
                doc.moveDown(0.5);

                // Image
                if (p.image && !p.image.includes('default-project.jpg')) {
                    try {
                        const imageUrl = new URL(p.image); // Parse URL to get hostname and path
                        const imageBuffer = await new Promise((resolve, reject) => {
                            const request = https.get(imageUrl, (response) => { // <<< This is the 'https' that must be defined
                                if (response.statusCode < 200 || response.statusCode >= 300) {
                                    return reject(new Error(`HTTP Error: ${response.statusCode} for ${imageUrl.href}`));
                                }
                                const chunks = [];
                                response.on('data', (chunk) => chunks.push(chunk));
                                response.on('end', () => resolve(Buffer.concat(chunks)));
                            });
                            request.on('error', (err) => reject(err));
                            request.end(); // Important to end the request
                        });

                        doc.image(imageBuffer, { width: 350, align: 'center', valign: 'center' });
                        doc.moveDown(0.5);
                    } catch (error) {
                        console.error('Image download error:', error);
                        doc.fontSize(10).fillColor('#e74c3c').text('Image not available or failed to download', { align: 'left' });
                        doc.moveDown(0.5);
                    }
                }

                // Problem Statement
                doc.fillColor('#000000').font('Roboto-Bold').fontSize(12).text('Problem Statement:', { align: 'left' });
                doc.font('Roboto').fontSize(10).text(p.problemStatement || 'Not provided', { align: 'left', indent: 10 });
                doc.moveDown(0.5);

                // Description
                doc.font('Roboto-Bold').fontSize(12).text('Description:', { align: 'left' });
                doc.font('Roboto').fontSize(10).text(p.description || 'Not provided', { align: 'left', indent: 10 });
                doc.moveDown(0.5);

                // Tags
                doc.font('Roboto-Bold').fontSize(12).text('Tags:', { align: 'left' });
                doc.font('Roboto').fontSize(10).text(p.tags && p.tags.length ? p.tags.join(', ') : 'None', { align: 'left', indent: 10 });
                doc.moveDown(0.5);

                // Collaborators
                doc.font('Roboto-Bold').fontSize(12).text('Collaborators:', { align: 'left' });
                doc.font('Roboto').fontSize(10).text(p.collaborators && p.collaborators.length ? p.collaborators.join(', ') : 'None', { align: 'left', indent: 10 });
                doc.moveDown(1);
            }
        }

        // Footer
        doc.fontSize(10).fillColor('#666666').text('Generated by ShareCase © 2025', 40, doc.page.height - 60, { align: 'center' });
        doc.end();
    } catch (error) {
        console.error('Generate portfolio error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});



// Fetch Single Project
router.get('/project/:id', isAuthenticated, isProfileComplete, async (req, res) => {
    try {
        const project = await Project.findById(req.params.id)
            .populate('userId', 'name profilePic') // Populate uploader's name and profilePic
            .populate('collaborators', 'name email profilePic'); // Populate collaborators' details

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Increment views
        project.views = (project.views || 0) + 1;
        await project.save();

        // Format populated collaborators for frontend ease
        const formattedCollaborators = project.collaborators.map(collab => ({
            _id: collab._id,
            name: collab.name,
            email: collab.email,
            profilePic: collab.profilePic || 'https://res.cloudinary.com/dphfedhek/image/upload/default-profile.jpg'
        }));

        res.json({
            id: project._id,
            title: project.title,
            description: project.description,
            image: project.image || 'https://res.cloudinary.com/dphfedhek/image/upload/default-project.jpg',
            userId: project.userId._id,
            userName: project.userId.name,
            // --- FIX HERE: Ensure userProfilePic is correctly passed from populated userId ---
            userProfilePic: project.userId.profilePic || 'https://res.cloudinary.com/dphfedhek/image/upload/default-profile.jpg', // <-- This line ensures the uploader's profile pic is sent
            // --- END FIX ---
            problemStatement: project.problemStatement || '',
            collaborators: formattedCollaborators, // Now contains populated user objects
            otherCollaborators: project.otherCollaborators || [], // New field
            tags: project.tags || [],
            resources: project.resources || [],
            likes: project.likes || 0,
            views: project.views || 0,
            comments: project.comments || [],
            likedBy: project.likedBy || [],
            isPublished: project.isPublished
        });
    } catch (error) {
        console.error('Fetch project error:', error);
        res.status(500).json({ error: 'Server error', details: error.message });
    }
});

// routes/projects.js

// NEW ROUTE: Fetch Projects by User ID (Corrected to include collaborations)
router.get('/projects-by-user/:userId', isAuthenticated, async (req, res) => {
    try {
        const userId = req.params.userId;

        // Find projects where the user is the uploader OR a collaborator
        const projects = await Project.find({
            isPublished: true,
            $or: [
                { userId: userId }, // User is the uploader
                { collaborators: userId } // User is in the collaborators array
            ]
        })
        .populate('userId', 'name profilePic') // Populate uploader details
        .populate('collaborators', 'name profilePic') // Populate collaborator details
        .select('title description image tags likes views'); // Select relevant fields

        if (!projects) {
            return res.status(200).json([]); // Return empty array if no projects found
        }

        // Format the projects for the frontend
        const formattedProjects = projects.map(project => ({
            id: project._id,
            title: project.title,
            description: project.description,
            image: project.image || 'https://res.cloudinary.com/dphfedhek/image/upload/default-project.jpg',
            userId: project.userId._id,
            userName: project.userId.name,
            userProfilePic: project.userId.profilePic || 'https://res.cloudinary.com/dphfedhek/image/upload/default-profile.jpg',
            tags: project.tags || [],
            likes: project.likes || 0,
            views: project.views || 0
        }));

        res.json(formattedProjects);

    } catch (error) {
        console.error('Error fetching projects by user:', error);
        res.status(500).json({ error: 'Server error', details: error.message });
    }
});

module.exports = router;