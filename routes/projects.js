// routes/projects.js

const express = require('express');
const cloudinary = require('cloudinary').v2;
const Project = require('../models/Project');
const { isAuthenticated, isProfileComplete } = require('../middleware/auth');
const PDFDocument = require('pdfkit');
const User = require('../models/User'); // User model is needed for points updates
const https = require('https'); // For fetching images for PDF
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
const tagsConfig = require('../config/tags'); // Import tags configuration
const upload = require('../middleware/upload');
const pointsCalculator = require('../utils/pointsCalculator'); // Import points calculator

const router = express.Router();


// Add Project (Updated for Multer and Conditional Points)
router.post('/add-project', isAuthenticated, isProfileComplete, upload.single('image'), async (req, res) => {
    try {
        const { title, description, tags, problemStatement, collaboratorIds, otherCollaborators, resources, isPublished, projectType } = req.body;

        // CRITICAL CHANGE: Validate required fields based on isPublished status
        if (isPublished === 'true') {
            if (!title || title.trim() === '') {
                return res.status(400).json({ error: 'Project Title is required to publish.' });
            }
            if (!projectType || projectType.trim() === '') {
                return res.status(400).json({ error: 'Project Type is required to publish.' });
            }
        } else {
            if (!title || title.trim() === '') {
                // Return a less severe message or just proceed.
                // You can add a check here if you want to require a title even for drafts.
            }
        }
        
        // Prepare data for project creation
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

        // CONDITIONAL POINT CALCULATION
        let projectPoints = 0;
        if (isPublished === 'true') {
            projectPoints = pointsCalculator.calculateUploadPoints();
        }

        const project = new Project({
            title: title.trim(),
            description: description || '',
            tags: parsedTags,
            image: imageUrl,
            userId: req.session.userId,
            userName: req.session.userName || 'Anonymous',
            problemStatement: problemStatement || '',
            collaborators: parsedCollaboratorIds,
            otherCollaborators: parsedOtherCollaborators,
            resources: resources ? resources.split(',').map(r => r.trim()) : [],
            isPublished: isPublished === 'true',
            projectType: projectType || 'Other',
            points: projectPoints // Assign the calculated points (0 for drafts)
        });

        await project.save();

        // CONDITIONAL POINT AWARDING TO USER
        if (isPublished === 'true') {
            await User.findByIdAndUpdate(
                req.session.userId,
                { $inc: { totalPoints: projectPoints } }
            );
        }

        // Add to collaborators' projects list
        if (parsedCollaboratorIds.length > 0) {
            await User.updateMany(
                { _id: { $in: parsedCollaboratorIds } },
                { $addToSet: { projectsCollaboratedOn: project._id } }
            );
        }

        const message = (isPublished === 'true') ? 'Project uploaded successfully!' : 'Project saved as draft!';
        const redirectPath = (isPublished === 'true') ? '/index.html' : `/profile.html?tab=drafts`; 
        res.status(200).json({ success: true, message: message, projectId: project._id, redirect: redirectPath });

    } catch (error) {
        console.error('Add project error:', error);
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ error: 'Validation Error', details: messages.join(', ') });
        }
        res.status(500).json({ error: 'Server error', details: error.message });
    }
});

// GET route to fetch dynamic filter options/tags (now using tagsConfig)
router.get('/dynamic-filter-options', isAuthenticated, isProfileComplete, async (req, res) => {
    try {
        res.json({
            courses: tagsConfig.courses,
            categories: tagsConfig.categories,
            years: tagsConfig.years,
            types: tagsConfig.types, // Aligns with PROJECT_TYPES in config/tags.js
            departments: tagsConfig.departments // Aligns with ALL_DEPARTMENTS in config/tags.js
        });
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
            // Removed points from general project display: points: p.points || 0,
            projectType: p.projectType || 'Other'
        })));
    } catch (error) {
        console.error('Fetch projects error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Consolidated Search Projects AND Users
router.get('/search', isAuthenticated, async (req, res) => {
    try {
        const { q, course, year, type, department, category, projectType } = req.query;
        const projectQuery = {};
        const userQuery = {};

        if (q) {
            projectQuery.$or = [
                { title: { $regex: q, $options: 'i' } },
                { description: { $regex: q, $options: 'i' } },
                { problemStatement: { $regex: q, $options: 'i' } },
                { tags: { $regex: q, $options: 'i' } }
            ];
            userQuery.$or = [
                { name: { $regex: q, $options: 'i' } },
                { email: { $regex: q, $options: 'i' } },
                { major: { $regex: q, $options: 'i' } },
                { department: { $regex: q, $options: 'i' } }
            ];
        }

        projectQuery.isPublished = true;

        // Apply filters to projectQuery based on existing tags and new projectType
        const filterTags = [course, year, type, department, category].filter(t => t && t !== 'All');
        if (filterTags.length > 0) {
            projectQuery.tags = { $all: filterTags };
        }
        if (projectType && projectType !== 'All') {
            projectQuery.projectType = projectType;
        }

        userQuery.isProfileComplete = true; // Only search complete user profiles

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
            // Removed points from search results: points: p.points || 0,
            tags: p.tags || [],
            isPublished: p.isPublished,
            projectType: p.projectType || 'Other'
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


// Filter Options (Adjusted to use tagsConfig for predefined options)
router.get('/filter-options', isAuthenticated, isProfileComplete, async (req, res) => {
    try {
        // Retrieve options from the central tags configuration
        res.json({
            courses: tagsConfig.courses,
            years: tagsConfig.years,
            types: tagsConfig.types, // Using 'types' from tagsConfig
            departments: tagsConfig.departments,
            categories: tagsConfig.categories, // Using 'categories' from tagsConfig
        });
    } catch (error) {
        console.error('Filter options error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});


// Fetch User Projects (This route is now in routes/profile.js as /my-projects)
// Keeping this comment here for clarity that it was moved.
router.get('/user-projects', isAuthenticated, isProfileComplete, async (req, res) => {
    return res.status(501).json({ message: 'This route has been moved. Please use /profile/my-projects instead.' });
});


// Post Comment
router.post('/project/:id/comment', isAuthenticated, isProfileComplete, async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }
        // Populate userId to get profilePic for comments before saving new comment
        const currentUser = await User.findById(req.session.userId).select('name profilePic');
        if (!currentUser) {
            return res.status(404).json({ error: 'Current user not found for commenting' });
        }

        project.comments = project.comments || [];
        const newComment = {
            userId: req.session.userId,
            userName: currentUser.name || 'Anonymous',
            userProfilePic: currentUser.profilePic || 'https://res.cloudinary.com/dphfedhek/image/upload/default-profile.jpg', // Include profile pic
            text: req.body.text,
            timestamp: new Date()
        };
        project.comments.push(newComment);

        // Award points to project and user for commenting
        project.points = (project.points || 0) + pointsCalculator.calculateCommentPoints();
        await project.save(); // Save project to update points and comments

        await User.findByIdAndUpdate(
            req.session.userId,
            { $inc: { totalPoints: pointsCalculator.calculateCommentPoints() } } // Award points to commenter
        );

        res.json({ success: true, comments: project.comments }); // Return updated comments
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

        // Deduct points from project and user for deleting a comment
        if (isCommenter) {
            await User.findByIdAndUpdate(
                currentUserId,
                { $inc: { totalPoints: -pointsCalculator.calculateCommentPoints() } }
            );
        }
        project.points = Math.max(0, (project.points || 0) - pointsCalculator.calculateCommentPoints());
        await project.save();

        comment.remove();
        await project.save(); // Save project again after comment removal

        res.json({ success: true, message: 'Comment deleted successfully', comments: project.comments }); // Return updated comments list
    } catch (error) {
        console.error('Error deleting comment:', error);
        res.status(500).json({ message: 'Server error during comment deletion' });
    }
});

// DELETE /project/:id
// This route now correctly deducts all points accumulated by the project from the user's total.
router.delete('/project/:id', isAuthenticated, isProfileComplete, async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }
        if (project.userId.toString() !== req.session.userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        
        // --- CRITICAL CHANGE: Deduct ALL project points from the user's total ---
        if (project.points > 0) {
            await User.findByIdAndUpdate(
                project.userId,
                { $inc: { totalPoints: -project.points } }
            );
        }
        // --- END CRITICAL CHANGE ---

        // Also delete points earned from other interactions (likes, comments, views)
        // Note: This logic is a bit more complex and would need to be stored in an activity log.
        // For now, deducting the total project.points is the correct approach.

        // Optional: Delete image from Cloudinary
        if (project.image && !project.image.includes('default-project.jpg')) {
            const publicIdMatch = project.image.match(/sharecase\/projects\/(.+)\.\w+$/);
            if (publicIdMatch && publicIdMatch[1]) {
                const publicId = `sharecase/projects/${publicIdMatch[1]}`;
                await cloudinary.uploader.destroy(publicId);
            }
        }

        await project.deleteOne();
        res.status(200).json({ success: true, message: 'Project deleted successfully' });
    } catch (error) {
        console.error('Delete project error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Edit Project
// This route now awards initial points when a draft is first published.
router.put('/project/:id', isAuthenticated, isProfileComplete, upload.single('image'), async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Check user permissions
        const isUploader = project.userId.toString() === req.session.userId;
        const isCollaborator = project.collaborators.some(collabId => collabId.toString() === req.session.userId);
        if (!isUploader && !isCollaborator) {
            return res.status(403).json({ error: 'Unauthorized to edit this project.' });
        }

        const { title, description, tags, problemStatement, collaboratorIds, otherCollaborators, resources, isPublished, projectType } = req.body;

        const newIsPublished = isPublished === 'true';

        // --- CRITICAL CHANGE: Award initial points only on first publish ---
        // We check if the project was previously a draft and is now being published, AND has no points yet.
        if (!project.isPublished && newIsPublished && project.points === 0) {
            const uploadPoints = pointsCalculator.calculateUploadPoints();
            project.points = project.points + uploadPoints;
            await User.findByIdAndUpdate(
                project.userId,
                { $inc: { totalPoints: uploadPoints } }
            );
        }
        // --- END CRITICAL CHANGE ---

        // Update project fields
        project.title = title || project.title;
        project.description = description || '';
        project.problemStatement = problemStatement || '';
        project.tags = tags ? tags.split(',').map(t => t.trim()) : [];
        project.collaborators = collaboratorIds ? collaboratorIds.split(',').map(id => new ObjectId(id)) : [];
        project.otherCollaborators = otherCollaborators ? otherCollaborators.split(',').map(c => c.trim()) : [];
        project.resources = resources ? resources.split(',').map(r => r.trim()) : [];
        project.isPublished = newIsPublished;
        project.projectType = projectType || project.projectType;

        // Handle image upload logic
        let imageUrl = project.image;
        if (req.file && req.file.path) {
            if (imageUrl && !imageUrl.includes('default-project.jpg')) {
                const publicIdMatch = imageUrl.match(/sharecase\/projects\/(.+)\.\w+$/);
                if (publicIdMatch && publicIdMatch[1]) {
                    const publicId = `sharecase/projects/${publicIdMatch[1]}`;
                    await cloudinary.uploader.destroy(publicId);
                }
            }
            imageUrl = req.file.path;
        }
        project.image = imageUrl;

        // Update collaborators' project lists in User model
        const oldCollaboratorIds = project.collaborators.map(id => id.toString());
        const newCollaboratorIds = collaboratorIds ? collaboratorIds.split(',').map(id => id.trim()).filter(id => id && ObjectId.isValid(id)) : [];
        
        const addedCollaborators = newCollaboratorIds.filter(id => !oldCollaboratorIds.includes(id));
        const removedCollaborators = oldCollaboratorIds.filter(id => !newCollaboratorIds.includes(id));
        
        if (addedCollaborators.length > 0) {
            await User.updateMany(
                { _id: { $in: addedCollaborators } },
                { $addToSet: { projectsCollaboratedOn: project._id } }
            );
        }
        if (removedCollaborators.length > 0) {
            await User.updateMany(
                { _id: { $in: removedCollaborators } },
                { $pull: { projectsCollaboratedOn: project._id } }
            );
        }
        project.collaborators = newCollaboratorIds;

        await project.save();
        res.json({ success: true, message: 'Project updated successfully' });

    } catch (error) {
        console.error('Edit project error:', error);
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
            // Deduct points from project and user for unlike
            project.points = Math.max(0, (project.points || 0) - pointsCalculator.calculateLikePoints());
            await User.findByIdAndUpdate(
                project.userId, // Deduct points from the project owner
                { $inc: { totalPoints: -pointsCalculator.calculateLikePoints() } }
            );
        } else {
            project.likedBy.push(userId);
            // Add points to project and user for like
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
        if (!user) {
            return res.status(404).json({ error: 'User not found for portfolio generation.' });
        }
        // Populate collaborators in projects to get their names for the PDF
        const projects = await Project.find({ userId: req.session.userId, isPublished: true })
                                      .populate('collaborators', 'name'); // Populate collaborator names for PDF
        const doc = new PDFDocument({ size: 'A4', margin: 40 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=portfolio.pdf');
        doc.pipe(res);

        // Fonts - Ensure these paths are correct in your public/fonts directory
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
        doc.moveDown(0.5);

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
                        console.error('Image download error during PDF generation:', error);
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
                const collaboratorNames = p.collaborators && p.collaborators.length > 0
                    ? p.collaborators.map(collab => collab.name).filter(Boolean).join(', ')
                    : 'None';

                doc.font('Roboto-Bold').fontSize(12).text('Collaborators:', { align: 'left' });
                doc.font('Roboto').fontSize(10).text(collaboratorNames, { align: 'left', indent: 10 });
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
            .populate('collaborators', 'name email profilePic')
            // Add this line to populate the userId within each comment
            .populate({
                path: 'comments.userId', // Specify the path to the userId inside comments
                select: 'name profilePic' // Select the fields you need from the User model
            });

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Increment views and award points
        project.views = (project.views || 0) + 1;
        project.points = (project.points || 0) + pointsCalculator.calculateViewPoints(); // Award points for view
        await project.save(); // Save the project to update views and points

        // Award points to the project owner for views
        // Ensure project.userId exists before trying to access its _id
        if (project.userId) {
            await User.findByIdAndUpdate(
                project.userId._id, // Use project.userId._id when it's populated
                { $inc: { totalPoints: pointsCalculator.calculateViewPoints() } }
            );
        }

        // Format comments to include userProfilePic if populated
        const formattedComments = project.comments.map(comment => {
            const commenter = comment.userId; // This will now be a populated User object
            return {
                _id: comment._id,
                userId: commenter ? commenter._id : null,
                userName: commenter ? commenter.name : comment.userName || 'Unknown', // Fallback to comment.userName if populate fails
                userProfilePic: commenter ? (commenter.profilePic || 'https://res.cloudinary.com/dphfedhek/image/upload/default-profile.jpg') : 'https://res.cloudinary.com/dphfedhek/image/upload/default-profile.jpg',
                text: comment.text,
                timestamp: comment.timestamp
            };
        });

        // This is the JSON response sent to the frontend.
        // We need to ensure all fields expected by project.html are present and correctly formatted.
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
            userId: project.userId._id, // Ensure project.userId exists and is populated
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
            comments: formattedComments,
            likedBy: project.likedBy || [],
            isPublished: project.isPublished,
            projectType: project.projectType || 'Other'
        });
    } catch (error) {
        console.error('Fetch project error:', error);
        // Add specific error handling for CastError if the ID format is bad
        if (error.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid project ID format.' });
        }
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
        .select('title description image tags likes views projectType'); // Ensure points are selected here too

        if (!projects) { // Check for projects array, not if it's null (it will be an empty array if no projects)
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
            points: project.points || 0, // Points are included in this API response, handled by frontend's renderProjectCard
            projectType: project.projectType || 'Other'
        }));

        res.json(formattedProjects);

    } catch (error) {
        console.error('Error fetching projects by user:', error);
        res.status(500).json({ error: 'Server error', details: error.message });
    }
});


module.exports = router;