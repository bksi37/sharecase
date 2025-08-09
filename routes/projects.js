const express = require('express');
const cloudinary = require('cloudinary').v2;
const Project = require('../models/Project');
const { isAuthenticated, isProfileComplete } = require('../middleware/auth');
const User = require('../models/User');
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
const tagsConfig = require('../config/tags');
const upload = require('../middleware/upload');
const pointsCalculator = require('../utils/pointsCalculator');

const router = express.Router();

// Add Project
router.post('/add-project', isAuthenticated, isProfileComplete, upload.single('image'), async (req, res) => {
    try {
        const { title, description, tags, problemStatement, collaboratorIds, otherCollaborators, resources, isPublished, projectType } = req.body;

        if (!title || title.trim() === '') {
            return res.status(400).json({ error: 'Project Title is required.' });
        }

        if (isPublished === 'true') {
            if (!projectType || !tagsConfig.types.includes(projectType)) {
                return res.status(400).json({ error: 'Valid Project Type is required to publish.' });
            }
            if (!description || description.trim() === '') {
                return res.status(400).json({ error: 'Description is required to publish.' });
            }
            if (!req.file) {
                return res.status(400).json({ error: 'Project Image is required to publish.' });
            }
            if (!tags || tags.split(',').filter(t => t.trim()).length === 0) {
                return res.status(400).json({ error: 'At least one tag is required to publish.' });
            }
        }

        const parsedTags = tags ? tags.split(',').map(t => t.trim()).filter(t => t) : [];
        const parsedCollaboratorIds = collaboratorIds
            ? collaboratorIds.split(',').map(id => id.trim()).filter(id => id && ObjectId.isValid(id)).map(id => new ObjectId(id))
            : [];
        const parsedOtherCollaborators = otherCollaborators
            ? otherCollaborators.split(',').map(c => c.trim()).filter(c => c)
            : [];

        const imageUrl = req.file ? req.file.path : 'https://res.cloudinary.com/dphfedhek/image/upload/default-project.jpg';

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
            userProfilePic: req.session.userProfilePic || 'https://res.cloudinary.com/dphfedhek/image/upload/default-profile.jpg',
            problemStatement: problemStatement || '',
            collaborators: parsedCollaboratorIds,
            otherCollaborators: parsedOtherCollaborators,
            resources: resources ? resources.split(',').map(r => r.trim()) : [],
            isPublished: isPublished === 'true',
            projectType: projectType || 'Other',
            points: projectPoints
        });

        await project.save();

        if (isPublished === 'true') {
            await User.findByIdAndUpdate(
                req.session.userId,
                { 
                    $inc: { totalPoints: projectPoints },
                    $push: { activityLog: { action: `Published project: ${project.title} (+${projectPoints} points)` } }
                }
            );
        }

        if (parsedCollaboratorIds.length > 0) {
            await User.updateMany(
                { _id: { $in: parsedCollaboratorIds } },
                { $addToSet: { projectsCollaboratedOn: project._id } }
            );
        }

        const message = isPublished === 'true' ? 'Project uploaded successfully!' : 'Project saved as draft!';
        const redirectPath = isPublished === 'true' ? '/index.html' : '/profile.html?tab=drafts';
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

// GET route to fetch dynamic filter options/tags
router.get('/dynamic-filter-options', isAuthenticated, isProfileComplete, async (req, res) => {
    try {
        res.json({
            courses: tagsConfig.courses,
            categories: tagsConfig.courses,
            years: tagsConfig.years,
            types: tagsConfig.types,
            departments: tagsConfig.departments
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

        const filterTags = [course, year, type, department, category].filter(t => t && t !== 'All');
        if (filterTags.length > 0) {
            projectQuery.tags = { $all: filterTags };
        }
        if (projectType && projectType !== 'All') {
            projectQuery.projectType = projectType;
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

// Filter Options
router.get('/filter-options', isAuthenticated, isProfileComplete, async (req, res) => {
    try {
        res.json({
            courses: tagsConfig.courses,
            years: tagsConfig.years,
            types: tagsConfig.types,
            departments: tagsConfig.departments,
            categories: tagsConfig.courses,
        });
    } catch (error) {
        console.error('Filter options error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Fetch Single Project
router.get('/project/:id', isAuthenticated, isProfileComplete, async (req, res) => {
    try {
        const project = await Project.findById(req.params.id)
            .populate('userId', 'name profilePic')
            .populate('collaborators', 'name email profilePic')
            .populate({
                path: 'comments.userId',
                select: 'name profilePic'
            });

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const userId = req.session.userId;
        let pointsToAdd = 0;
        let viewerPointsToAdd = 0;

        // Check if this is a unique view and within cooldown
        const viewer = await User.findById(userId);
        if (viewer && !project.viewedBy.includes(userId)) {
            const lastViewLog = viewer.activityLog
                .filter(log => log.action.includes(`Viewed project: ${project._id}`))
                .sort((a, b) => b.timestamp - a.timestamp)[0];

            if (!lastViewLog || pointsCalculator.canAwardViewPoints(lastViewLog.timestamp)) {
                project.views = (project.views || 0) + 1;
                project.viewedBy.push(userId);
                const uniqueViewCount = project.viewedBy.length;
                pointsToAdd = pointsCalculator.calculateViewPoints(uniqueViewCount);

                viewer.viewedProjects = viewer.viewedProjects || [];
                if (!viewer.viewedProjects.includes(project._id)) {
                    viewer.viewedProjects.push(project._id);
                    viewerPointsToAdd = pointsCalculator.calculateViewerPoints(viewer.viewedProjects.length);
                }

                // Update viewer
                await User.findByIdAndUpdate(
                    userId,
                    { 
                        $addToSet: { viewedProjects: project._id },
                        $inc: { totalPoints: viewerPointsToAdd },
                        $push: { activityLog: { action: `Viewed project: ${project._id} (+${viewerPointsToAdd} points)` } }
                    }
                );
            }
        }

        if (pointsToAdd > 0 && project.points < pointsCalculator.MAX_VIEW_POINTS_PER_PROJECT) {
            project.points = Math.min((project.points || 0) + pointsToAdd, pointsCalculator.MAX_VIEW_POINTS_PER_PROJECT);
            await User.findByIdAndUpdate(
                project.userId,
                { 
                    $inc: { totalPoints: pointsToAdd },
                    $push: { activityLog: { action: `Project ${project._id} viewed (+${pointsToAdd} points)` } }
                }
            );
        }

        await project.save();

        const formattedComments = project.comments.map(comment => {
            const commenter = comment.userId;
            return {
                _id: comment._id,
                userId: commenter ? commenter._id : null,
                userName: commenter ? commenter.name : comment.userName || 'Unknown',
                userProfilePic: commenter ? (commenter.profilePic || 'https://res.cloudinary.com/dphfedhek/image/upload/default-profile.jpg') : 'https://res.cloudinary.com/dphfedhek/image/upload/default-profile.jpg',
                text: comment.text,
                timestamp: comment.timestamp
            };
        });

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
            comments: formattedComments,
            likedBy: project.likedBy || [],
            isPublished: project.isPublished,
            projectType: project.projectType || 'Other'
        });
    } catch (error) {
        console.error('Fetch project error:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid project ID format.' });
        }
        res.status(500).json({ error: 'Server error', details: error.message });
    }
});

// Like/Unlike Project
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
            project.points = Math.max(0, (project.points || 0) - pointsCalculator.calculateLikePoints());
            await User.findByIdAndUpdate(
                project.userId,
                { 
                    $inc: { totalPoints: -pointsCalculator.calculateLikePoints() },
                    $push: { activityLog: { action: `Unliked project: ${project._id} (-${pointsCalculator.calculateLikePoints()} points)` } }
                }
            );
        } else {
            project.likedBy.push(userId);
            project.points = (project.points || 0) + pointsCalculator.calculateLikePoints();
            await User.findByIdAndUpdate(
                project.userId,
                { 
                    $inc: { totalPoints: pointsCalculator.calculateLikePoints() },
                    $push: { activityLog: { action: `Liked project: ${project._id} (+${pointsCalculator.calculateLikePoints()} points)` } }
                }
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

// Post Comment
router.post('/project/:id/comment', isAuthenticated, isProfileComplete, async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }
        const currentUser = await User.findById(req.session.userId).select('name profilePic');
        if (!currentUser) {
            return res.status(404).json({ error: 'Current user not found for commenting' });
        }

        project.comments = project.comments || [];
        const newComment = {
            userId: req.session.userId,
            userName: currentUser.name || 'Anonymous',
            userProfilePic: currentUser.profilePic || 'https://res.cloudinary.com/dphfedhek/image/upload/default-profile.jpg',
            text: req.body.text,
            timestamp: new Date()
        };
        project.comments.push(newComment);

        project.points = (project.points || 0) + pointsCalculator.calculateCommentPoints();
        await project.save();

        await User.findByIdAndUpdate(
            project.userId,
            { 
                $inc: { totalPoints: pointsCalculator.calculateCommentPoints() },
                $push: { activityLog: { action: `Received comment on project: ${project._id} (+${pointsCalculator.calculateCommentPoints()} points)` } }
            }
        );
        await User.findByIdAndUpdate(
            req.session.userId,
            { 
                $inc: { totalPoints: pointsCalculator.calculateCommenterPoints() },
                $push: { activityLog: { action: `Commented on project: ${project._id} (+${pointsCalculator.calculateCommenterPoints()} points)` } }
            }
        );

        res.json({ success: true, comments: project.comments });
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

        if (isCommenter) {
            await User.findByIdAndUpdate(
                currentUserId,
                { 
                    $inc: { totalPoints: -pointsCalculator.calculateCommenterPoints() },
                    $push: { activityLog: { action: `Deleted comment on project: ${project._id} (-${pointsCalculator.calculateCommenterPoints()} points)` } }
                }
            );
        }
        if (isProjectOwner || isCommenter) {
            project.points = Math.max(0, (project.points || 0) - pointsCalculator.calculateCommentPoints());
            await User.findByIdAndUpdate(
                project.userId,
                { 
                    $inc: { totalPoints: -pointsCalculator.calculateCommentPoints() },
                    $push: { activityLog: { action: `Comment deleted on project: ${project._id} (-${pointsCalculator.calculateCommentPoints()} points)` } }
                }
            );
        }

        comment.remove();
        await project.save();

        res.json({ success: true, message: 'Comment deleted successfully', comments: project.comments });
    } catch (error) {
        console.error('Error deleting comment:', error);
        res.status(500).json({ message: 'Server error during comment deletion' });
    }
});

// DELETE /project/:id
router.delete('/project/:id', isAuthenticated, isProfileComplete, async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }
        if (project.userId.toString() !== req.session.userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        if (project.points > 0) {
            await User.findByIdAndUpdate(
                project.userId,
                { 
                    $inc: { totalPoints: -project.points },
                    $push: { activityLog: { action: `Deleted project: ${project.title} (-${project.points} points)` } }
                }
            );
        }

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

        const { title, description, tags, problemStatement, collaboratorIds, otherCollaborators, resources, isPublished, projectType } = req.body;

        if (!title || title.trim() === '') {
            return res.status(400).json({ error: 'Project Title is required.' });
        }

        const newIsPublished = isPublished === 'true';

        if (newIsPublished) {
            if (!projectType || !tagsConfig.types.includes(projectType)) {
                return res.status(400).json({ error: 'Valid Project Type is required to publish.' });
            }
            if (!description || description.trim() === '') {
                return res.status(400).json({ error: 'Description is required to publish.' });
            }
            if (!req.file && (!project.image || project.image.includes('default-project.jpg'))) {
                return res.status(400).json({ error: 'Project Image is required to publish.' });
            }
            if (!tags || tags.split(',').filter(t => t.trim()).length === 0) {
                return res.status(400).json({ error: 'At least one tag is required to publish.' });
            }
        }

        if (!project.isPublished && newIsPublished && project.points === 0) {
            const uploadPoints = pointsCalculator.calculateUploadPoints();
            project.points = project.points + uploadPoints;
            await User.findByIdAndUpdate(
                project.userId,
                { 
                    $inc: { totalPoints: uploadPoints },
                    $push: { activityLog: { action: `Published project: ${project.title} (+${uploadPoints} points)` } }
                }
            );
        }

        project.title = title.trim();
        project.description = description || '';
        project.problemStatement = problemStatement || '';
        project.tags = tags ? tags.split(',').map(t => t.trim()).filter(t => t) : [];
        project.collaborators = collaboratorIds ? collaboratorIds.split(',').map(id => new ObjectId(id)) : [];
        project.otherCollaborators = otherCollaborators ? otherCollaborators.split(',').map(c => c.trim()) : [];
        project.resources = resources ? resources.split(',').map(r => r.trim()) : [];
        project.isPublished = newIsPublished;
        project.projectType = projectType || project.projectType || 'Other';

        let imageUrl = project.image;
        if (req.file) {
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
        const redirectPath = newIsPublished ? '/index.html' : '/profile.html?tab=drafts';
        res.json({ success: true, message: 'Project updated successfully', redirect: redirectPath });
    } catch (error) {
        console.error('Edit project error:', error);
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ error: 'Validation Error', details: messages.join(', ') });
        }
        res.status(500).json({ error: 'Server error', details: error.message });
    }
});

// Fetch Projects by User ID
router.get('/projects-by-user/:userId', async (req, res) => {
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
        .select('title description image tags likes views projectType');

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
            points: project.points || 0,
            projectType: project.projectType || 'Other'
        }));

        res.json(formattedProjects);

    } catch (error) {
        console.error('Error fetching projects by user:', error);
        res.status(500).json({ error: 'Server error', details: error.message });
    }
});

module.exports = router;