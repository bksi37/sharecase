// routes/projects.js
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

// ---------------------------------------------------------------------
// 1. Add Project
// ---------------------------------------------------------------------
// Other routes (e.g., /projects/add-project, /search)
router.post('/add-project', isAuthenticated, isProfileComplete, upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'artworkImage', maxCount: 1 },
    { name: 'CADFile', maxCount: 1 }
]), async (req, res) => {
    try {
        const { title, projectType, description, problemStatement, year, department, category, tags, collaboratorIds, otherContributors, resources, isPublished } = req.body;
        const user = await User.findById(req.session.userId);
        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        const projectDetails = {};
        if (projectType === 'Engineering') {
            projectDetails.technicalDescription = req.body.technicalDescription || '';
            projectDetails.toolsSoftware = req.body.toolsSoftware || '';
            projectDetails.functionalGoals = req.body.functionalGoals || '';
            if (req.files && req.files.CADFile) {
                projectDetails.CADFile = req.files.CADFile[0].path;
            }
        } else if (projectType === 'Art') {
            projectDetails.mediumTechnique = req.body.mediumTechnique || '';
            projectDetails.artistStatement = req.body.artistStatement || '';
            projectDetails.exhibitionHistory = req.body.exhibitionHistory || '';
            if (req.files && req.files.artworkImage) {
                projectDetails.artworkImage = req.files.artworkImage[0].path;
            }
        }

        const project = new Project({
            title,
            userId: req.session.userId,
            userName: user.name,
            projectType: projectType || 'Other',
            description,
            problemStatement,
            year,
            department,
            category,
            tags: tags ? tags.split(',').map(t => t.trim()).filter(t => t) : [],
            collaboratorIds: collaboratorIds ? collaboratorIds.split(',').filter(id => mongoose.Types.ObjectId.isValid(id)) : [],
            otherContributors,
            resources: resources ? resources.split(',').map(r => r.trim()).filter(r => r) : [],
            image: req.files && req.files.image ? req.files.image[0].path : '',
            projectDetails,
            isPublished: isPublished === 'true'
        });

        await project.save();
        res.json({ message: isPublished === 'true' ? 'Project published successfully' : 'Project saved as draft', redirect: '/profile.html' });
    } catch (error) {
        console.error('Error adding project:', error);
        res.status(500).json({ error: 'Failed to add project', details: error.message });
    }
});



// ---------------------------------------------------------------------
// 2. Fetch Projects (FIXED: Removed Auth, added profilePic/tags to response)
// ---------------------------------------------------------------------
router.get('/projects', async (req, res) => {
    try {
        // 🛑 FIX: Removed authentication middleware to allow public access
        const projects = await Project.find({ isPublished: true }).populate('userId', 'name profilePic');
        res.json(projects.map(p => ({
            id: p._id,
            title: p.title,
            description: p.description,
            image: p.image || 'https://res.cloudinary.com/dphfedhek/image/upload/default-project.jpg',
            userId: p.userId ? p.userId._id : null,
            userName: p.userId ? p.userId.name : 'Deleted User',
            userProfilePic: p.userId ? (p.userId.profilePic || 'https://res.cloudinary.com/dphfedhek/image/upload/default-profile.jpg') : 'https://res.cloudinary.com/dphfedhek/image/upload/default-profile.jpg',
            likes: p.likes || 0,
            views: p.views || 0,
            projectType: p.projectType || 'Other',
            tags: p.tags || [], // 🛑 FIX: Added tags
        })));
    } catch (error) {
        console.error('Fetch projects error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});


// ---------------------------------------------------------------------
// 3. Consolidated Search (FIXED: Added population and formatting for client)
// ---------------------------------------------------------------------
router.get('/search', async (req, res) => {
    try {
        const { q, course, year, type, department, category } = req.query;
        console.log('Search query:', { q, course, year, type, department, category });

        // --- Build Project Query ---
        const projectQuery = { isPublished: true };
        const regex = q ? { $regex: q, $options: 'i' } : null;

        if (regex) {
            projectQuery.$or = [
                { title: regex },
                { description: regex },
                { tags: regex },
                { 'projectDetails.technicalDescription': regex },
                { 'projectDetails.artistStatement': regex },
                { 'projectDetails.toolsSoftware': regex }
            ];
        }
        
        // Filter tags (assuming your filter dropdowns send explicit values, not just 'All')
        if (course && course !== 'All') projectQuery.course = course; 
        if (year && year !== 'All') projectQuery.year = year;
        if (type && type !== 'All') projectQuery.projectType = type;
        if (department && department !== 'All') projectQuery.department = department;
        if (category && category !== 'All') projectQuery.category = category;


        // --- Build User Query ---
        const userQuery = { isProfileComplete: true };
        if (regex) {
            userQuery.$or = [
                { name: regex },
                { email: regex },
                { major: regex },
                { department: regex }
            ];
        }

        // --- Execute Queries ---
        const [rawProjects, rawUsers] = await Promise.all([
            // Use populate to get user details for project card rendering
            Project.find(projectQuery)
                   .populate('userId', 'name profilePic')
                   .select('title userId description image tags views likes projectType')
                   .limit(20),
                   
            User.find(userQuery)
                .select('_id name email profilePic major department')
                .limit(10)
        ]);
        
        // --- Format Project Results for Client ---
        const formattedProjects = rawProjects.map(p => ({
            id: p._id,
            title: p.title,
            description: p.description,
            image: p.image || 'https://res.cloudinary.com/dphfedhek/image/upload/default-project.jpg',
            // Use null checks (p.userId is null if user was deleted)
            userId: p.userId ? p.userId._id : null,
            userName: p.userId ? p.userId.name : 'Deleted User',
            userProfilePic: p.userId ? (p.userId.profilePic || 'https://res.cloudinary.com/dphfedhek/image/upload/default-profile.jpg') : 'https://res.cloudinary.com/dphfedhek/image/upload/default-profile.jpg',
            likes: p.likes || 0,
            views: p.views || 0,
            projectType: p.projectType || 'Other',
            tags: p.tags || [], 
        }));

        // --- Format User Results for Client (The rawUsers from the query are fine, but let's map them for consistency) ---
        const formattedUsers = rawUsers.map(u => ({
            _id: u._id,
            name: u.name,
            major: u.major || '',
            department: u.department || '',
            profilePic: u.profilePic || 'https://res.cloudinary.com/dphfedhek/image/upload/default-profile.jpg',
            // Include email since you use it in renderCollaboratorSearchResults (scripts.js)
            email: u.email
        }));


        res.json({
            success: true,
            results: {
                projects: formattedProjects,
                users: formattedUsers
            }
        });
    } catch (error) {
        console.error('Error in /search:', error);
        res.status(500).json({ error: 'Search failed', message: error.message });
    }
});

// ---------------------------------------------------------------------
// 4. Dynamic Filter Options (FIXED: Removed Auth, kept combined dynamic/filter options)
// GET dynamic filter options
router.get('/dynamic-filter-options', (req, res) => {
    try {
        console.log('Serving /dynamic-filter-options:', JSON.stringify(tagsConfig, null, 2));
        res.json({
            types: tagsConfig.types || [],
            departments: tagsConfig.departments || [],
            categories: tagsConfig.categories || [],
            years: tagsConfig.years || [],
            courses: tagsConfig.courses || [],
            tools: tagsConfig.tools || [],
            projectSchemas: tagsConfig.projectSchemas || { Default: [] }
        });
    } catch (error) {
        console.error('Error in /dynamic-filter-options:', error);
        res.status(500).json({ error: 'Failed to load filter options' });
    }
});

router.get('/filter-options', async (req, res) => {
    try {
        // 🛑 FIX: Removed authentication middleware
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

// ---------------------------------------------------------------------
// 2. Fetch Single Project
// ---------------------------------------------------------------------
router.get('/project/:id', async (req, res) => {
    try {
        const project = await Project.findById(req.params.id)
            .populate('userId', 'name profilePic')
            .populate('collaborators', 'name email profilePic')
            .populate({
                path: 'comments.userId',
                select: 'name profilePic'
            });

        if (!project || !project.isPublished) {
            return res.status(404).json({ error: 'Project not found or is not published' });
        }

        const userId = req.session.userId;
        let pointsToAdd = 0;
        let viewerPointsToAdd = 0;

        if (userId) {
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
        }

        await project.save();

        const formattedComments = project.comments.map(comment => ({
            _id: comment._id,
            userId: comment.userId ? comment.userId._id : null,
            userName: comment.userId ? comment.userId.name : comment.userName || 'Unknown',
            userProfilePic: comment.userId ? (comment.userId.profilePic || 'https://res.cloudinary.com/dphfedhek/image/upload/default-profile.jpg') : 'https://res.cloudinary.com/dphfedhek/image/upload/default-profile.jpg',
            text: comment.text,
            timestamp: comment.timestamp
        }));

        const formattedCollaborators = project.collaborators.map(collab => ({
            _id: collab._id,
            name: collab.name,
            email: collab.email,
            profilePic: collab.profilePic || 'https://res.cloudinary.com/dphfedhek/image/upload/default-profile.jpg'
        }));

        res.json({
            id: project._id,
            title: project.title,
            projectType: project.projectType,
            description: project.description,
            image: project.image,
            year: project.year,
            department: project.department,
            category: project.category,
            problemStatement: project.problemStatement,
            tags: project.tags,
            collaborators: formattedCollaborators,
            otherContributors: project.otherContributors,
            resources: project.resources,
            likes: project.likes,
            views: project.views,
            points: project.points,
            comments: formattedComments,
            likedBy: project.likedBy.map(id => id.toString()),
            isPublished: project.isPublished,
            projectDetails: project.projectDetails
        });
    } catch (error) {
        console.error('Fetch project error:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid project ID format.' });
        }
        res.status(500).json({ error: 'Server error', details: error.message });
    }
});



// ---------------------------------------------------------------------
// 6. Like/Unlike Project (INCORPORATED: Protected Route)
// ---------------------------------------------------------------------
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


// ---------------------------------------------------------------------
// 7. Post Comment (INCORPORATED: Protected Route)
// ---------------------------------------------------------------------
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



// ---------------------------------------------------------------------
// 8. Delete Comment (INCORPORATED: Protected Route)
// ---------------------------------------------------------------------
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


// ---------------------------------------------------------------------
// 9. Delete Project (INCORPORATED: Protected Route)
// ---------------------------------------------------------------------
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

        // Delete image from Cloudinary
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


// ---------------------------------------------------------------------
// 3. Edit Project
// ---------------------------------------------------------------------
router.put('/project/:id', isAuthenticated, isProfileComplete, upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'artworkImage', maxCount: 1 },
    { name: 'CADFile', maxCount: 1 }
]), async (req, res) => {
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

        const {
            title, projectType, description, problemStatement, tags, year, department, category,
            collaboratorIds, otherContributors, resources,
            technicalDescription, toolsSoftwareUsed, functionalGoals,
            mediumTechnique, artistStatement, exhibitionHistory,
            isPublished
        } = req.body;

        // Validation
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
            if (!req.files['image'] && (!project.image || project.image.includes('default-project.jpg'))) {
                return res.status(400).json({ error: 'Project Image is required to publish.' });
            }
            if (!tags || tags.split(',').filter(t => t.trim()).length === 0) {
                return res.status(400).json({ error: 'At least one tag is required to publish.' });
            }
        }

        // Points update
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

        // Update fields
        project.title = title.trim();
        project.projectType = projectType || project.projectType || 'Other';
        project.description = description || '';
        project.year = year || '';
        project.department = department || '';
        project.category = category || '';
        project.problemStatement = problemStatement || '';
        project.tags = tags ? tags.split(',').map(t => t.trim()).filter(t => t) : [];
        project.otherContributors = otherContributors ? otherContributors.split(',').map(c => c.trim()) : [];
        project.resources = resources ? resources.split(',').map(r => r.trim()) : [];
        project.isPublished = newIsPublished;

        // Collaborators
        const newCollaboratorIds = collaboratorIds
            ? collaboratorIds.split(',').map(id => id.trim()).filter(id => id && ObjectId.isValid(id)).map(id => new ObjectId(id))
            : [];
        const oldCollaboratorIds = project.collaborators.map(id => id.toString());
        const newCollaboratorIdStrings = newCollaboratorIds.map(id => id.toString());
        const addedCollaborators = newCollaboratorIdStrings.filter(id => !oldCollaboratorIds.includes(id));
        const removedCollaborators = oldCollaboratorIds.filter(id => !newCollaboratorIdStrings.includes(id));

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

        // Image updates
        let imageUrl = project.image;
        if (req.files['image']) {
            if (imageUrl && !imageUrl.includes('default-project.jpg')) {
                const publicIdMatch = imageUrl.match(/sharecase\/projects\/(.+)\.\w+$/);
                if (publicIdMatch && publicIdMatch[1]) {
                    const publicId = `sharecase/projects/${publicIdMatch[1]}`;
                    await cloudinary.uploader.destroy(publicId);
                }
            }
            const result = await cloudinary.uploader.upload(req.files['image'][0].path, {
                folder: 'sharecase/projects',
                use_filename: true
            });
            imageUrl = result.secure_url;
        }
        project.image = imageUrl;

        let artworkImageUrl = project.projectDetails.artworkImage;
        if (req.files['artworkImage'] && projectType === 'Art') {
            if (artworkImageUrl && !artworkImageUrl.includes('default-project.jpg')) {
                const publicIdMatch = artworkImageUrl.match(/sharecase\/artwork\/(.+)\.\w+$/);
                if (publicIdMatch && publicIdMatch[1]) {
                    const publicId = `sharecase/artwork/${publicIdMatch[1]}`;
                    await cloudinary.uploader.destroy(publicId);
                }
            }
            const result = await cloudinary.uploader.upload(req.files['artworkImage'][0].path, {
                folder: 'sharecase/artwork',
                use_filename: true
            });
            artworkImageUrl = result.secure_url;
        }

        let cadFileUrl = project.projectDetails.CADFileLink;
        if (req.files['CADFile'] && projectType === 'Engineering') {
            if (cadFileUrl && !cadFileUrl.includes('default-project.jpg')) {
                const publicIdMatch = cadFileUrl.match(/sharecase\/cad\/(.+)\.\w+$/);
                if (publicIdMatch && publicIdMatch[1]) {
                    const publicId = `sharecase/cad/${publicIdMatch[1]}`;
                    await cloudinary.uploader.destroy(publicId);
                }
            }
            const result = await cloudinary.uploader.upload(req.files['CADFile'][0].path, {
                folder: 'sharecase/cad',
                use_filename: true
            });
            cadFileUrl = result.secure_url;
        }

        // Project details
        project.projectDetails = {
            CADFileLink: cadFileUrl || project.projectDetails.CADFileLink,
            technicalDescription: technicalDescription || project.projectDetails.technicalDescription,
            toolsSoftwareUsed: toolsSoftwareUsed ? toolsSoftwareUsed.split(',').map(t => t.trim()) : project.projectDetails.toolsSoftwareUsed,
            functionalGoals: functionalGoals || project.projectDetails.functionalGoals,
            artworkImage: artworkImageUrl || project.projectDetails.artworkImage,
            mediumTechnique: mediumTechnique || project.projectDetails.mediumTechnique,
            artistStatement: artistStatement || project.projectDetails.artistStatement,
            exhibitionHistory: exhibitionHistory || project.projectDetails.exhibitionHistory
        };

        await project.save();
        const redirectPath = newIsPublished ? `/project/${project._id}` : '/profile.html?tab=drafts';
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

// ---------------------------------------------------------------------
// 11. Fetch Projects by User ID (UNPROTECTED: Already in both, keeping latest structure)
// ---------------------------------------------------------------------
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