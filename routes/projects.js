// routes/projects.js

const express = require('express');
const cloudinary = require('cloudinary').v2;
const Project = require('../models/Project');
const { isAuthenticated, isProfileComplete } = require('../middleware/auth');
const PDFDocument = require('pdfkit');
const User = require('../models/User'); // User model is needed for points updates
const https = require('https');
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
const tagsConfig = require('../config/tags');
const upload = require('../middleware/upload');
const pointsCalculator = require('../utils/pointsCalculator'); // --- NEW: Import points calculator ---

const router = express.Router();

// Add Project (Updated for Multer and Points)
router.post('/add-project', isAuthenticated, isProfileComplete, upload.single('image'), async (req, res) => {
    try {
        const { title, description, tags, problemStatement, collaboratorIds, otherCollaborators, resources, isPublished } = req.body;

        if (!title) {
            return res.status(400).json({ error: 'Title is required' });
        }

        const parsedTags = tags ? tags.split(',').map(t => t.trim()) : [];
        const parsedCollaboratorIds = collaboratorIds
            ? collaboratorIds.split(',').map(id => id.trim()).filter(id => id && ObjectId.isValid(id)).map(id => new ObjectId(id))
            : [];
        const parsedOtherCollaborators = otherCollaborators
            ? otherCollaborators.split(',').map(c => c.trim()).filter(c => c !== '')
            : [];

        let imageUrl = 'https://res.cloudinary.com/dphfedhek/image/upload/default-project.jpg';
        if (req.file && req.file.path) {
            imageUrl = req.file.path;
            console.log('New project image URL assigned from Multer:', imageUrl);
        } else {
            console.log('No project image uploaded. Using default or existing.');
        }

        const project = new Project({
            title,
            description,
            tags: parsedTags,
            image: imageUrl,
            userId: req.session.userId,
            userName: req.session.userName || 'Anonymous',
            problemStatement: problemStatement || '',
            collaborators: parsedCollaboratorIds,
            otherCollaborators: parsedOtherCollaborators,
            resources: resources ? resources.split(',').map(r => r.trim()) : [],
            isPublished: isPublished === 'true',
            projectType: 'Engineering', // Default for now, will be dynamic in Milestone 2
            points: pointsCalculator.calculateUploadPoints() // --- NEW: Assign points for upload ---
        });

        await project.save();

        // --- NEW: Award points to the Uploader's User document ---
        await User.findByIdAndUpdate(
            req.session.userId,
            { $inc: { totalPoints: pointsCalculator.calculateUploadPoints() } } // Assuming a 'totalPoints' field on User model
        );
        // --- END NEW ---

        if (parsedCollaboratorIds.length > 0) {
            await User.updateMany(
                { _id: { $in: parsedCollaboratorIds } },
                { $addToSet: { projectsCollaboratedOn: project._id } }
            );
        }

        res.redirect('/index.html');
    } catch (error) {
        console.error('Add project error:', error);
        // Ensure multer is defined or imported if used here
        // if (error instanceof multer.MulterError) {
        //     console.error('Multer Error during add-project:', error.message);
        //     return res.status(400).json({ error: `File upload error: ${error.message}` });
        // }
        res.status(500).json({ error: 'Server error', details: error.message });
    }
});

// GET route to fetch dynamic filter options/tags (Keep this here, as it uses tagsConfig)
router.get('/dynamic-filter-options', isAuthenticated, isProfileComplete, async (req, res) => {
    try {
        res.json(tagsConfig);
    } catch (error) {
        console.error('Error fetching dynamic filter options:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Fetch All Projects
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
            views: p.views || 0,
            points: p.points || 0 // Include points in response
        })));
    } catch (error) {
        console.error('Fetch projects error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Consolidated Search Projects AND Users
router.get('/search', isAuthenticated, async (req, res) => {
    try {
        const { q, course, year, type, department, category } = req.query;
        const projectQuery = {};
        const userQuery = {};

        if (q) {
            projectQuery.$or = [
                { title: { $regex: q, $options: 'i' } },
                { description: { $regex: q, $options: 'i' } },
                { problemStatement: { $regex: q, $options: 'i' } },
                { tags: { $regex: q, $options: 'i' } }
            ];
        }

        const filterTags = [course, year, type, department, category].filter(t => t && t !== 'All');
        if (filterTags.length > 0) {
            projectQuery.tags = { $all: filterTags };
        }

        projectQuery.isPublished = true;

        if (q) {
            userQuery.$or = [
                { name: { $regex: q, $options: 'i' } },
                { email: { $regex: q, $options: 'i' } },
                { major: { $regex: q, $options: 'i' } },
                { department: { $regex: q, $options: 'i' } }
            ];
        }
        userQuery.isProfileComplete = true;

        const [projects, users] = await Promise.all([
            Project.find(projectQuery)
                   .populate('userId', 'name profilePic')
                   .limit(20),
            User.find(userQuery)
                .select('name major department profilePic linkedin')
                .limit(10)
        ]);

        const formattedProjects = projects.map(p => ({
            id: p._id,
            title: p.title,
            description: p.description,
            image: p.image || 'https://res.cloudinary.com/dphfedhek/image/upload/default-project.jpg',
            userId: p.userId ? p.userId._id : null,
            userName: p.userId ? p.userId.name : 'Unknown',
            userProfilePic: p.userId ? (p.userId.profilePic || 'https://res.cloudinary.com/dphfedhek/image/upload/default-profile.jpg') : 'https://res.cloudinary.com/dphfedhek/image/upload/default-profile.jpg',
            likes: p.likes || 0,
            views: p.views || 0,
            points: p.points || 0,
            tags: p.tags || [],
            isPublished: p.isPublished
        }));

        const formattedUsers = users.map(u => ({
            _id: u._id,
            name: u.name,
            major: u.major || 'N/A',
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

// Filter Options
router.get('/filter-options', isAuthenticated, isProfileComplete, async (req, res) => {
    try {
        const projects = await Project.find();
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

// Fetch User Projects
router.get('/user-projects', isAuthenticated, isProfileComplete, async (req, res) => {
    try {
        const userId = req.session.userId;

        const projects = await Project.find({
            $or: [
                { userId: userId },
                { collaborators: userId }
            ]
        })
        .select('title description image isPublished likes views points');

        res.json(projects.map(p => ({
            id: p._id,
            title: p.title,
            image: p.image || 'https://res.cloudinary.com/dphfedhek/image/upload/default-project.jpg',
            description: p.description,
            isPublished: p.isPublished,
            likes: p.likes || 0,
            views: p.views || 0,
            points: p.points || 0
        })));
    } catch (error) {
        console.error('Fetch user projects error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Post Comment
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

        // --- NEW: Award points to project and user for commenting ---
        project.points = (project.points || 0) + pointsCalculator.calculateCommentPoints();
        await project.save(); // Save project again to update points

        await User.findByIdAndUpdate(
            req.session.userId,
            { $inc: { totalPoints: pointsCalculator.calculateCommentPoints() } } // Award points to commenter
        );
        // --- END NEW ---

        res.json({ success: true });
    } catch (error) {
        console.error('Post comment error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /project/:projectId/comment/:commentId
router.delete('/project/:projectId/comment/:commentId', isAuthenticated, async (req, res) => {
    try {
        const { projectId, commentId } = req.params;
        const currentUserId = req.session.userId;

        const project = await Project.findById(projectId);

        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        const comment = project.comments.id(commentId);
        if (!comment) {
            return res.status(404).json({ message: 'Comment not found' });
        }

        const isCommenter = comment.userId.toString() === currentUserId;
        const isProjectOwner = project.userId.toString() === currentUserId;

        if (!isCommenter && !isProjectOwner) {
            return res.status(403).json({ message: 'Unauthorized to delete this comment' });
        }

        // --- NEW: Deduct points from project and user for deleting a comment ---
        // Need to ensure points are deducted from the *original commenter* if possible,
        // but for simplicity here, we'll deduct from the project and the deleter (if they are commenter).
        // A more robust system might store points per comment to deduct accurately.
        // For now, if the deleter is the commenter, deduct from their total points.
        if (isCommenter) {
            await User.findByIdAndUpdate(
                currentUserId,
                { $inc: { totalPoints: -pointsCalculator.calculateCommentPoints() } }
            );
        }
        project.points = Math.max(0, (project.points || 0) - pointsCalculator.calculateCommentPoints());
        await project.save();
        // --- END NEW ---

        comment.remove();
        await project.save();

        res.json({ success: true, message: 'Comment deleted successfully' });

    } catch (error) {
        console.error('Error deleting comment:', error);
        res.status(500).json({ message: 'Server error during comment deletion' });
    }
});

// Delete Project
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
        
        // --- NEW: Deduct points from the uploader when a project is deleted ---
        await User.findByIdAndUpdate(
            project.userId,
            { $inc: { totalPoints: -project.points } } // Deduct all points associated with the project
        );
        // --- END NEW ---

        await project.deleteOne();
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Delete project error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Edit Project
router.put('/project/:id', isAuthenticated, isProfileComplete, upload.single('image'), async (req, res) => {
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
        if (req.file && req.file.path) {
            if (imageUrl && !imageUrl.includes('default-project.jpg')) {
                const publicId = imageUrl.split('/').pop().split('.')[0];
                await cloudinary.uploader.destroy(`sharecase/projects/${publicId}`);
            }
            imageUrl = req.file.path;
            console.log('New project image URL assigned from Multer during edit:', imageUrl);
        } else {
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

// Like/Unlike Project (Updated for Points)
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
            // --- NEW: Deduct points from project and user for unlike ---
            project.points = Math.max(0, (project.points || 0) - pointsCalculator.calculateLikePoints());
            await User.findByIdAndUpdate(
                project.userId, // Award points to the project owner
                { $inc: { totalPoints: -pointsCalculator.calculateLikePoints() } }
            );
        } else {
            project.likedBy.push(userId);
            // --- NEW: Add points to project and user for like ---
            project.points = (project.points || 0) + pointsCalculator.calculateLikePoints();
             await User.findByIdAndUpdate(
                project.userId, // Award points to the project owner
                { $inc: { totalPoints: pointsCalculator.calculateLikePoints() } }
            );
        }
        project.likes = project.likedBy.length;
        await project.save();
        res.json({ success: true, likes: project.likes, hasLiked: !hasLiked });
    } catch (error) {
        console.error('Like project error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Generate Portfolio
router.post('/generate-portfolio', isAuthenticated, isProfileComplete, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        const projects = await Project.find({ userId: req.session.userId, isPublished: true });
        const doc = new PDFDocument({ size: 'A4', margin: 40 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=portfolio.pdf');
        doc.pipe(res);

        // Fonts
        doc.registerFont('Roboto', 'public/fonts/Roboto-Regular.ttf');
        doc.registerFont('Roboto-Bold', 'public/fonts/Roboto-Bold.ttf');

        // Header
        doc.fillColor('#212529').font('Roboto-Bold').fontSize(28).text(user.name, { align: 'center' });
        doc.moveDown(0.2);
        doc.fillColor('#000000').font('Roboto').fontSize(12).text(user.email || '', { align: 'center' });
        if (user.linkedin) {
            doc.moveDown(0.2);
            let linkedinUrl = user.linkedin;
            if (!linkedinUrl.startsWith('http://') && !linkedinUrl.startsWith('https://')) {
                linkedinUrl = `https://${linkedinUrl}`;
            }
            doc.fillColor('#000000').font('Roboto').fontSize(12).text(`LinkedIn: ${linkedinUrl}`, { align: 'center', link: linkedinUrl });
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
                        const imageUrl = new URL(p.image);
                        const imageBuffer = await new Promise((resolve, reject) => {
                            const request = https.get(imageUrl, (response) => {
                                if (response.statusCode < 200 || response.statusCode >= 300) {
                                    return reject(new Error(`HTTP Error: ${response.statusCode} for ${imageUrl.href}`));
                                }
                                const chunks = [];
                                response.on('data', (chunk) => chunks.push(chunk));
                                response.on('end', () => resolve(Buffer.concat(chunks)));
                            });
                            request.on('error', (err) => reject(err));
                            request.end();
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
            .populate('userId', 'name profilePic')
            .populate('collaborators', 'name email profilePic');

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Increment views and award points
        // To prevent multiple points for same user on refresh, consider tracking unique views per session/user
        // For now, simple increment:
        project.views = (project.views || 0) + 1;
        project.points = (project.points || 0) + pointsCalculator.calculateViewPoints(); // --- NEW: Award points for view ---
        await project.save();

        // --- NEW: Award points to the project owner for views ---
        await User.findByIdAndUpdate(
            project.userId,
            { $inc: { totalPoints: pointsCalculator.calculateViewPoints() } } // Award points to project owner
        );
        // --- END NEW ---

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
            userProfilePic: project.userId.profilePic || 'https://res.cloudinary.com/dphfedhek/image/upload/default-profile.jpg',
            problemStatement: project.problemStatement || '',
            collaborators: formattedCollaborators,
            otherCollaborators: project.otherCollaborators || [],
            tags: project.tags || [],
            resources: project.resources || [],
            likes: project.likes || 0,
            views: project.views || 0,
            points: project.points || 0,
            comments: project.comments || [],
            likedBy: project.likedBy || [],
            isPublished: project.isPublished
        });
    } catch (error) {
        console.error('Fetch project error:', error);
        res.status(500).json({ error: 'Server error', details: error.message });
    }
});

// NEW ROUTE: Fetch Projects by User ID (Corrected to include collaborations)
router.get('/projects-by-user/:userId', isAuthenticated, async (req, res) => {
    try {
        const userId = req.params.userId;

        const projects = await Project.find({
            isPublished: true,
            $or: [
                { userId: userId },
                { collaborators: userId }
            ]
        })
        .populate('userId', 'name profilePic')
        .populate('collaborators', 'name profilePic')
        .select('title description image tags likes views points');

        if (!projects) {
            return res.status(200).json([]);
        }

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
            views: project.views || 0,
            points: project.points || 0
        }));

        res.json(formattedProjects);

    } catch (error) {
        console.error('Error fetching projects by user:', error);
        res.status(500).json({ error: 'Server error', details: error.message });
    }
});

// --- NEW ROUTE: Get Overall Project Analytics (for Admins/ShareCase Workers) ---
router.get('/admin/analytics/projects', isAuthenticated, async (req, res) => {
    try {
        // --- Authorization Check: Only 'admin' or 'sharecase_worker' can access ---
        // This will be handled by a new middleware in middleware/auth.js (e.g., isAdminOrShareCaseWorker)
        // For now, it's just isAuthenticated, but we'll refine this.
        if (req.session.userRole !== 'admin' && req.session.userRole !== 'sharecase_worker') {
            return res.status(403).json({ message: 'Access denied. Insufficient privileges.' });
        }

        const totalProjects = await Project.countDocuments();
        const totalPublishedProjects = await Project.countDocuments({ isPublished: true });
        const projectsByType = await Project.aggregate([
            { $group: { _id: "$projectType", count: { $sum: 1 } } }
        ]);
        const projectsByTag = await Project.aggregate([
            { $unwind: "$tags" },
            { $group: { _id: "$tags", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 } // Top 10 tags
        ]);
        const topProjectsByViews = await Project.find({ isPublished: true })
            .sort({ views: -1 })
            .limit(5)
            .select('title views userId userName');
        const topProjectsByPoints = await Project.find({ isPublished: true })
            .sort({ points: -1 })
            .limit(5)
            .select('title points userId userName');

        res.json({
            totalProjects,
            totalPublishedProjects,
            projectsByType,
            projectsByTag,
            topProjectsByViews,
            topProjectsByPoints
        });

    } catch (error) {
        console.error('Error fetching project analytics:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
