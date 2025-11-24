// routes/projects.js
const express = require('express');
const { v2: cloudinary } = require('cloudinary');
const Project = require('../models/Project');
const { isAuthenticated, isProfileComplete } = require('../middleware/auth');
const User = require('../models/User');
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
const tagsConfig = require('../config/tags');
const { upload } = require('../middleware/upload');
const pointsCalculator = require('../utils/pointsCalculator');
const Notification = require('../models/Notification');

const router = express.Router();
// Utility to handle file URL persistence/deletion (omitted for brevity, assumed correct)
async function handleFileUpdate(req, fieldName, currentUrl, deleteFlag, defaultUrl = null) {
    const newFile = req.files && req.files[fieldName] ? req.files[fieldName][0].path : null;
    const isDeletionRequested = req.body[deleteFlag] === 'true' || req.body[`${fieldName}Current`] === 'DELETED';
    
    if (newFile) {
        if (currentUrl && currentUrl !== defaultUrl) {
            // Cloudinary deletion logic here
        }
        return newFile;
    }

    if (isDeletionRequested) {
        if (currentUrl && currentUrl !== defaultUrl) {
            // Cloudinary deletion logic here
        }
        return defaultUrl || ''; 
    }

    return currentUrl || defaultUrl || '';
}

// ---------------------------------------------------------------------
// 1. Add Project (router.post /add-project) - With Robust Error Logging
// ---------------------------------------------------------------------
router.post('/add-project', isAuthenticated, isProfileComplete, (req, res) => {
    // Wrap the Multer middleware in a promise/callback pattern to catch errors explicitly
    upload.fields([
        { name: 'image', maxCount: 1 },
        { name: 'CADFile', maxCount: 1 },
        { name: 'artworkImage', maxCount: 1 }
    ])(req, res, async (uploadError) => {
        try {
            // --- FILE UPLOAD ERROR CHECK ---
            if (uploadError) {
                if (uploadError instanceof multer.MulterError) {
                    // Multer errors (e.g., file size limit, wrong field name)
                    console.error('🛑 Multer File Error (Client/Validation):', uploadError.message);
                    return res.status(400).json({ error: 'File Upload Validation Failed', details: uploadError.message });
                } else {
                    // Critical Upload/Cloudinary/Stream errors
                    console.error('🛑 Critical Upload Error (Cloudinary/Stream Hang):', uploadError.message, uploadError.stack);
                    return res.status(500).json({ error: 'Server Upload Error', details: 'A critical file upload error occurred on the server.' });
                }
            }

            // --- DESTRUCTURING & INITIAL VALIDATION ---
            const {
                title, projectType, description, problemStatement, tags, year, department, category,
                collaboratorIds, otherContributors, resources, isPublished,
                technicalDescription, toolsSoftware, functionalGoals,
                mediumTechnique, artistStatement, exhibitionHistory
            } = req.body;

            if (!title || title.trim() === '') {
                console.error('Validation Error: Project Title is missing or empty.');
                return res.status(400).json({ error: 'Project Title is required.' });
            }

            if (isPublished === 'true') {
                // TODO: Add Publishing validation logic here if required before data parsing
                // Example: if (!description) { return res.status(400).json({ error: 'Description is required to publish.' }); }
            }
            
            // --- DATA PARSING ---
            const parsedTags = Array.isArray(tags) ? tags.filter(t => t) : tags ? tags.split(',').map(t => t.trim()).filter(t => t) : [];
            const parsedCollaborators = collaboratorIds
                ? collaboratorIds.split(',').map(id => id.trim()).filter(id => id && ObjectId.isValid(id)).map(id => new ObjectId(id))
                : [];
            const parsedOtherContributors = Array.isArray(otherContributors) ? otherContributors.join(', ') : (otherContributors || ''); 
            const parsedResources = resources
                ? resources.split(',').map(r => r.trim()).filter(r => r)
                : [];

            const toolsSoftwareString = typeof toolsSoftware === 'string' ? toolsSoftware : ''; 
            const parsedToolsSoftware = toolsSoftwareString
                .split(',')
                .map(t => t.trim())
                .filter(t => t);
            
            // FIX: Ensure single-string fields are handled correctly on ADD, taking the first element if array is present
            const cleanTechnicalDescription = Array.isArray(technicalDescription) ? technicalDescription[0] : (technicalDescription || '');
            const cleanFunctionalGoals = Array.isArray(functionalGoals) ? functionalGoals[0] : (functionalGoals || '');
            const cleanMediumTechnique = Array.isArray(mediumTechnique) ? mediumTechnique[0] : (mediumTechnique || '');
            const cleanArtistStatement = Array.isArray(artistStatement) ? artistStatement[0] : (artistStatement || '');
            const cleanExhibitionHistory = Array.isArray(exhibitionHistory) ? exhibitionHistory[0] : (exhibitionHistory || '');

            // --- FILE PATHS ---
            let imageUrl = req.files && req.files['image'] && req.files['image'][0] ? req.files['image'][0].path : 'https://res.cloudinary.com/dphfedhek/image/upload/default-project.jpg';
            let cadFileUrl = req.files && req.files['CADFile'] && req.files['CADFile'][0] ? req.files['CADFile'][0].path : '';
            let artworkImageUrl = req.files && req.files['artworkImage'] && req.files['artworkImage'][0] ? req.files['artworkImage'][0].path : '';

            // --- POINT CALCULATION ---
                const pointsEarned = pointsCalculator.calculateUploadPoints();

            // --- CREATE PROJECT ---
            const project = new Project({
                title: title.trim(), projectType: projectType || 'Other', description: description || '',
                image: imageUrl, year, department, category, problemStatement: problemStatement || '',
                tags: [...new Set([...parsedTags, year, department, category].filter(t => t))],
                collaborators: parsedCollaborators, otherContributors: parsedOtherContributors, resources: parsedResources,
                userId: req.session.userId, userName: req.session.userName || 'Anonymous',
                userProfilePic: req.session.userProfilePic || 'https://res.cloudinary.com/dphfedhek/image/upload/default-profile.jpg',
                isPublished: isPublished === 'true',
                points: pointsEarned, // Set calculated points
                projectDetails: {
                    CADFileLink: cadFileUrl, technicalDescription: cleanTechnicalDescription,
                    toolsSoftware: parsedToolsSoftware, functionalGoals: cleanFunctionalGoals,
                    artworkImage: artworkImageUrl, mediumTechnique: cleanMediumTechnique,
                    artistStatement: cleanArtistStatement, exhibitionHistory: cleanExhibitionHistory
                }
            });

            await project.save();

            // --- USER AND COLLABORATOR UPDATE ---
            // TODO: Add User and collaborator update logic here
            // Example: await User.findByIdAndUpdate(req.session.userId, { $push: { projects: project._id }, $inc: { points: pointsEarned } });
            // Example: for (const collabId of parsedCollaborators) { await User.findByIdAndUpdate(collabId, { $push: { collaboratedProjects: project._id } }); }

            // --- SUCCESS RESPONSE ---
            const message = isPublished === 'true' ? 'Project published successfully!' : 'Project saved as draft!';
            const redirectPath = isPublished === 'true' ? `/project.html?id=${project._id}` : '/profile.html?tab=drafts';
            res.status(200).json({ success: true, message, projectId: project._id, redirect: redirectPath });

        } catch (error) {
            // This catch block handles DB/Logic errors (e.g., MongoDB validation, save failure, update failure)
            console.error('❌ Add project DB/Logic Error:', error.message, error.stack);
            const errorMessage = error.message || 'Unknown database/logic error';
            res.status(500).json({ error: 'Server error', details: errorMessage });
        }
    });
});

// ---------------------------------------------------------------------
// 2. Fetch Projects (router.get /)
// ---------------------------------------------------------------------
router.get('/', async (req, res) => {
    try {
        const projects = await Project.find({ isPublished: true }).populate('userId', 'name profilePic');
        const formattedProjects = projects.map(p => {
            if (!p._id) {
                console.warn('Project with missing _id:', p);
                return null;
            }
            return {
                id: p._id.toString(),
                title: p.title,
                description: p.description,
                image: p.image || 'https://res.cloudinary.com/dphfedhek/image/upload/default-project.jpg',
                userId: p.userId._id.toString(),
                userName: p.userId.name,
                userProfilePic: p.userId.profilePic || 'https://res.cloudinary.com/dphfedhek/image/upload/default-profile.jpg',
                likes: p.likes || 0,
                views: p.views || 0,
                projectType: p.projectType || 'Other',
                tags: p.tags || []
            };
        }).filter(p => p !== null);
        console.log('Fetched projects:', formattedProjects.map(p => ({ id: p.id, title: p.title })));
        res.json(formattedProjects);
    } catch (error) {
        console.error('Fetch projects error:', error);
        res.status(500).json({ error: 'Server error', details: error.message });
    }
});

// ---------------------------------------------------------------------
// 3. Consolidated Search (router.get /search)
// ---------------------------------------------------------------------
router.get('/search', async (req, res) => {
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

        const formattedProjects = projects.map(p => {
            if (!p._id) {
                console.warn('Project with missing _id in search:', p);
                return null;
            }
            return {
                id: p._id.toString(),
                title: p.title,
                description: p.description,
                image: p.image || 'https://res.cloudinary.com/dphfedhek/image/upload/default-project.jpg',
                userId: p.userId ? p.userId._id.toString() : null,
                userName: p.userId ? p.userId.name : 'Unknown',
                userProfilePic: p.userId ? (p.userId.profilePic || 'https://res.cloudinary.com/dphfedhek/image/upload/default-profile.jpg') : 'https://res.cloudinary.com/dphfedhek/image/upload/default-profile.jpg',
                likes: p.likes || 0,
                views: p.views || 0,
                tags: p.tags || [],
                isPublished: p.isPublished,
                projectType: p.projectType || 'Other'
            };
        }).filter(p => p !== null);

        const formattedUsers = users.map(u => ({
            _id: u._id.toString(),
            name: u.name,
            major: u.major || 'N/A',
            department: u.department || 'N/A',
            profilePic: u.profilePic || 'https://res.cloudinary.com/dphfedhek/image/upload/default-profile.jpg',
            linkedin: u.socialLinks?.linkedin || ''
        }));

        console.log('Search results:', {
            projects: formattedProjects.map(p => ({ id: p.id, title: p.title })),
            users: formattedUsers.map(u => ({ id: u._id, name: u.name }))
        });

        res.json({
            success: true,
            results: {
                projects: formattedProjects,
                users: formattedUsers
            }
        });
    } catch (error) {
        console.error('Global search error:', error);
        res.status(500).json({ error: 'Server error during search', details: error.message });
    }
});

// ---------------------------------------------------------------------
// 4. Dynamic Filter Options (router.get /dynamic-filter-options)
// ---------------------------------------------------------------------
router.get('/dynamic-filter-options', async (req, res) => {
    try {
        res.json({
            success: true,
            courses: tagsConfig.courses,
            categories: tagsConfig.categories,
            years: tagsConfig.years,
            types: tagsConfig.types,
            departments: tagsConfig.departments,
            tools: tagsConfig.tools || ['SolidWorks', 'Python', 'AutoCAD', 'Photoshop'],
            projectSchemas: {
                Default: [],
                Engineering: [
                    { name: 'CADFile', label: 'CAD File', type: 'file', accept: '.gltf,.glb', required: false, note: 'Upload GLTF, GLB (max 10MB)' },
                    { name: 'technicalDescription', label: 'Technical Description', type: 'textarea', placeholder: 'Describe the technical aspects of your project.', required: false },
                    { name: 'toolsSoftware', label: 'Tools/Software Used', type: 'text', placeholder: 'e.g., SolidWorks, AutoCAD', required: false },
                    { name: 'functionalGoals', label: 'Functional Goals', type: 'textarea', placeholder: 'What are the functional objectives?', required: false }
                ],
                Art: [
                    { name: 'artworkImage', label: 'Artwork Image', type: 'file', accept: 'image/jpeg,image/png,image/gif', required: true, note: 'Upload JPEG, PNG, or GIF (max 2MB)' },
                    { name: 'mediumTechnique', label: 'Medium/Technique', type: 'text', placeholder: 'e.g., Oil on Canvas', required: false },
                    { name: 'artistStatement', label: 'Artist Statement', type: 'textarea', placeholder: 'Describe the concept behind your artwork.', required: false },
                    { name: 'exhibitionHistory', label: 'Exhibition History', type: 'text', placeholder: 'e.g., Exhibited at Art Fair 2023', required: false }
                ]
            }
        });
    } catch (error) {
        console.error('Error fetching dynamic filter options:', error);
        res.status(500).json({ success: false, error: 'Server error', details: error.message });
    }
});
// ---------------------------------------------------------------------
// 5. Fetch Single Project (router.get /project/:id) - UPDATED FOR EXTERNAL VIEWS
// ---------------------------------------------------------------------
router.get('/project/:id', async (req, res) => {
    // NOTE: This route assumes 'pointsCalculator' is available in scope.
    try {
        const projectId = req.params.id;
        const project = await Project.findById(projectId)
            .populate('userId', 'name profilePic')
            .populate('collaborators', 'name email profilePic')
            .populate({
                path: 'comments.userId',
                select: 'name profilePic'
            });

        if (!project || !project.isPublished) {
            return res.status(404).json({ error: 'Project not found or is not published' });
        }
        
        const projectUserId = project.userId?._id?.toString() || project.userId;
        const projectUserName = project.userId?.name || project.userName;

        const userId = req.session.userId;
        
        let pointsToAdd = 0;
        let viewerPointsToAdd = 0;
        let viewIncremented = false; // Flag to check if project.save() is needed

        if (userId) {
            // --- LOGGED-IN USER VIEW LOGIC (Point-Based Cooldown) ---
            const viewer = await User.findById(userId);
            
            // Check if user is the project owner; skip points for self-viewing
            const isOwner = userId === projectUserId;
            
            // Check for Point Eligibility (Relies on Activity Log for 24hr cooldown)
            const activityLog = viewer.activityLog || []; 
            const lastViewLog = activityLog
                .filter(log => log.action.includes(`Viewed project: ${project._id}`))
                .sort((a, b) => b.timestamp - a.timestamp)[0];

            if (!lastViewLog || pointsCalculator.canAwardViewPoints(lastViewLog.timestamp)) {
                
                // 🛑 NEW/FIXED: Increment VIEWS counter on cooldown expiry for logged-in users 🛑
                project.views = (project.views || 0) + 1;
                viewIncremented = true;
                
                // 2. Point Calculation (Only if it's the first *unique* view for points AND not the owner)
                if (!project.viewedBy.includes(userId) && !isOwner) {
                    
                    project.viewedBy.push(userId); // Log user ID for permanent "unique view" check for points

                    // Point logic is complex and remains the same for integrity:
                    const uniqueViewCount = project.viewedBy.length;
                    pointsToAdd = pointsCalculator.calculateViewPoints(uniqueViewCount);

                    viewer.viewedProjects = viewer.viewedProjects || [];
                    if (!viewer.viewedProjects.includes(project._id)) {
                        // viewer.viewedProjects.push(project._id); // Removed redundant push, $addToSet handles it below
                        viewerPointsToAdd = pointsCalculator.calculateViewerPoints(viewer.viewedProjects.length + 1);
                    }

                    // Update VIEWER points and log
                    await User.findByIdAndUpdate(
                        userId,
                        {
                            $addToSet: { viewedProjects: project._id },
                            $inc: { totalPoints: viewerPointsToAdd },
                            // Log the view action for the point cooldown timer
                            $push: { activityLog: { action: `Viewed project: ${project._id} (+${viewerPointsToAdd} points)` } }
                        }
                    );
                }
            }
        } else {
            // --- EXTERNAL/UNAUTHENTICATED VIEW LOGIC (Simple Inflation) ---
            // 🛑 Action: Increment views counter for every external visit. 🛑
            project.views = (project.views || 0) + 1;
            viewIncremented = true;
            console.log(`External view recorded for project: ${projectId}`);
            // No points, no activity log, and no addition to 'viewedBy' array.
            // The logic from the old version using req.session[viewedProjectsKey] is removed.
        }

        // Apply view points to the project owner (Only runs if pointsToAdd > 0 from Logged-in logic)
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

        // Only save project if a change occurred (view was incremented or points were updated)
        if (viewIncremented || pointsToAdd > 0) {
             await project.save();
        }

        // --- Formatting response data (remains the same) ---
        const formattedComments = (project.comments || []).map(comment => ({
            _id: comment._id,
            userId: comment.userId ? comment.userId._id.toString() : null,
            userName: comment.userId ? comment.userId.name : comment.userName || 'Unknown',
            userProfilePic: comment.userId ? (comment.userId.profilePic || 'https://res.cloudinary.com/dphfedhek/image/upload/default-profile.jpg') : 'https://res.cloudinary.com/dphfedhek/image/upload/default-profile.jpg',
            text: comment.text,
            timestamp: comment.timestamp
        }));

        const formattedCollaborators = (project.collaborators || []).map(collab => ({
            _id: collab._id.toString(),
            name: collab.name,
            email: collab.email,
            profilePic: collab.profilePic || 'https://res.cloudinary.com/dphfedhek/image/upload/default-profile.jpg'
        }));

        res.json({
            id: project._id.toString(),
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
            likedBy: (project.likedBy || []).map(id => id.toString()),
            isPublished: project.isPublished,
            projectDetails: project.projectDetails,
            userId: projectUserId,
            userName: projectUserName,
            userProfilePic: project.userId?.profilePic || 'https://res.cloudinary.com/dphfedhek/image/upload/default-profile.jpg'
        });
    } catch (error) {
        console.error('Fetch project error:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid project ID format.', details: error.message });
        }
        res.status(500).json({ error: 'Server error', details: error.message });
    }
});

// ---------------------------------------------------------------------
// 6. Like/Unlike Project (router.post /project/:id/like)
// ---------------------------------------------------------------------
router.post('/project/:id/like', isAuthenticated, async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ error: 'Project not found' });

        const currentUserId = req.session.userId.toString();
        const projectOwnerId = project.userId.toString();
        
        // Ensure likedBy is an array of strings for consistent checking
        const likedBy = (project.likedBy || []).map(id => id.toString()); 
        const wasLiked = likedBy.includes(currentUserId);
        const hasLiked = !wasLiked; // The new state

        if (wasLiked) {
            // UNLIKE logic
            project.likedBy = likedBy.filter(id => id !== currentUserId);
            console.log(`[LIKE DEBUG] User ${currentUserId} is UNLIKING project ${req.params.id}.`);
        } else {
            // LIKE logic
            project.likedBy.push(currentUserId);
            console.log(`[LIKE DEBUG] User ${currentUserId} is LIKING project ${req.params.id}.`);
        }

        project.likes = project.likedBy.length;

        // CRITICAL LOGGING STEP: Check state before DB save
        console.log(`[LIKE DEBUG] Pre-save likes: ${project.likes}, new hasLiked state: ${hasLiked}`);

        await project.save();

        // -----------------------------------------------------
        // 🚀 NOTIFICATION LOGIC (LIKE) 🚀
        // -----------------------------------------------------
        if (hasLiked) {
            let message;
            let targetUserId;
            
            if (currentUserId === projectOwnerId) {
                // User liked their own post
                message = `You liked your own project: ${project.title}`;
                targetUserId = currentUserId; 
            } else {
                // Another user liked the post
                const liker = req.session.userName || 'Someone';
                message = `${liker} liked your project: ${project.title}`;
                targetUserId = projectOwnerId;
            }
            
            // Only create the notification if the user is liking the post (not unliking)
            const notification = new Notification({
                userId: targetUserId,
                message: message,
                type: 'like',
                relatedId: project._id,
                relatedModel: 'Project'
            });
            await notification.save();
            console.log(`[LIKE DEBUG] Notification created for user ${targetUserId}.`);
        } 
        // Note: We typically don't delete notifications on an 'unlike' for history simplicity.
        
        console.log(`[LIKE DEBUG] POST successful. New likes: ${project.likes}. Response sent.`);

        res.json({ success: true, likes: project.likes, hasLiked: hasLiked });
    } catch (err) {
        // Log the error detail when the save or notification creation fails
        console.error(`[LIKE ERROR] Failed to process like/unlike for project ${req.params.id}:`, err);
        res.status(500).json({ error: 'Server error: Database update failed.', details: err.message });
    }
});

// ---------------------------------------------------------------------
// 7. Post Comment (router.post /project/:id/comment)
// ---------------------------------------------------------------------
router.post('/project/:id/comment', isAuthenticated, async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ error: 'Project not found' });

        const user = await User.findById(req.session.userId).select('name profilePic');
        if (!user) return res.status(404).json({ error: 'User not found' });

        const newComment = {
            userId: req.session.userId,
            userName: user.name || 'Anonymous',
            userProfilePic: user.profilePic || 'https://res.cloudinary.com/dphfedhek/image/upload/default-profile.jpg',
            text: req.body.text,
            timestamp: new Date()
        };

        project.comments = project.comments || [];
        project.comments.push(newComment);
        await project.save();

        // -----------------------------------------------------
        // 🚀 NOTIFICATION LOGIC (COMMENT) 🚀
        // -----------------------------------------------------
        const currentUserId = req.session.userId.toString();
        const projectOwnerId = project.userId.toString(); 
        const commenterName = req.session.userName || 'Someone';

        let message;
        let targetUserId;
        let notificationSent = false;

        if (currentUserId === projectOwnerId) {
            // Case 1: User commented on their own post
            message = `You commented on your own project: ${project.title}`;
            targetUserId = currentUserId; 
        } else {
            // Case 2: Another user commented (Notify the project owner)
            message = `${commenterName} commented on your project: ${project.title}`;
            targetUserId = projectOwnerId;
        }

        // Create the notification
        const notification = new Notification({
            userId: targetUserId,
            message: message,
            type: 'comment',
            relatedId: project._id,
            relatedModel: 'Project'
        });
        
        await notification.save();
        console.log(`[COMMENT DEBUG] Notification created for user ${targetUserId}.`);
        // -----------------------------------------------------

        res.json({ success: true, comments: project.comments });
    } catch (err) {
        console.error('[COMMENT ERROR] Post comment error:', err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// ---------------------------------------------------------------------
// 8. Delete Comment (router.delete /project/:projectId/comment/:commentId)
// ---------------------------------------------------------------------
router.delete('/project/:projectId/comment/:commentId', isAuthenticated, async (req, res) => {
    try {
        const { projectId, commentId } = req.params;
        const project = await Project.findById(projectId);
        if (!project) return res.status(404).json({ message: 'Project not found' });

        const comment = project.comments.id(commentId);
        if (!comment) return res.status(404).json({ message: 'Comment not found' });

        // Authorisation: comment owner OR project owner
        const isOwner = comment.userId.toString() === req.session.userId;
        const isProjectOwner = project.userId.toString() === req.session.userId;
        if (!isOwner && !isProjectOwner) return res.status(403).json({ message: 'Unauthorized' });

        comment.remove();
        await project.save();

        res.json({ success: true, comments: project.comments });
    } catch (err) {
        console.error('Delete comment error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// ---------------------------------------------------------------------
// 9. Delete Project (router.delete /project/:id) - Client is calling wrong path
// ---------------------------------------------------------------------
router.delete('/project/:id', isAuthenticated, isProfileComplete, async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }
        // ... (authorization and deletion logic)
        await project.deleteOne();
        res.status(200).json({ success: true, message: 'Project deleted successfully' });
    } catch (error) {
        console.error('Delete project error:', error);
        res.status(500).json({ error: 'Server error', details: error.message });
    }
});
// ---------------------------------------------------------------------
// 10. Edit Project (router.put /:id)
// ---------------------------------------------------------------------
router.put('/:id', isAuthenticated, isProfileComplete, upload.fields([
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
        const isCollaborator = (project.collaborators || []).some(collabId => collabId.toString() === req.session.userId);
        
        if (!isUploader && !isCollaborator) {
            return res.status(403).json({ error: 'Unauthorized to edit this project.' });
        }

        const {
            title, projectType, description, problemStatement, tags, year, department, category,
            collaboratorIds, otherContributors, resources, isPublished,
            technicalDescription, functionalGoals,
            mediumTechnique, artistStatement, exhibitionHistory,
            toolsSoftware // Keep this declaration for req.body access
        } = req.body;

        if (!title || title.trim() === '') {
            return res.status(400).json({ error: 'Project Title is required.' });
        }
        
        const newIsPublished = isPublished === 'true';

        // --- 🛑 CORE FILE HANDLING AND PERSISTENCE ---
        const newMainImageUrl = await handleFileUpdate(
            req, 'image', project.image, 'removeCurrentImage', 'https://res.cloudinary.com/dphfedhek/image/upload/default-project.jpg'
        );
        const newCADFileLink = await handleFileUpdate(
            req, 'CADFile', project.projectDetails?.CADFileLink, 'removeCADFileCurrent', null
        );
        const newArtworkImage = await handleFileUpdate(
            req, 'artworkImage', project.projectDetails?.artworkImage, 'removeArtworkImageCurrent', null
        );

        // --- Data Parsing ---
        const parsedTags = tags ? tags.split(',').map(t => t.trim()).filter(t => t) : [];
        const parsedOtherContributors = otherContributors || ''; 
        const parsedResources = resources ? resources.split(',').map(r => r.trim()).filter(r => r) : [];
        
        // FIX: Ensure toolsSoftware is a string before parsing
        const toolsSoftwareString = typeof toolsSoftware === 'string' ? toolsSoftware : ''; 
        const parsedToolsSoftware = toolsSoftwareString
            .split(',')
            .map(t => t.trim())
            .filter(t => t);
        
        // 🛑 FIX: Safely extract single string values from potentially array-filled req.body
        const cleanTechnicalDescription = Array.isArray(technicalDescription) ? technicalDescription[0] : (technicalDescription || '');
        const cleanFunctionalGoals = Array.isArray(functionalGoals) ? functionalGoals[0] : (functionalGoals || '');
        const cleanMediumTechnique = Array.isArray(mediumTechnique) ? mediumTechnique[0] : (mediumTechnique || '');
        const cleanArtistStatement = Array.isArray(artistStatement) ? artistStatement[0] : (artistStatement || '');
        const cleanExhibitionHistory = Array.isArray(exhibitionHistory) ? exhibitionHistory[0] : (exhibitionHistory || '');


        // Collaborators parsing
        const newCollaboratorIds = collaboratorIds
            ? collaboratorIds.split(',').map(id => id.trim()).filter(id => id && ObjectId.isValid(id)).map(id => new ObjectId(id))
            : [];
            
        // --- Update Document Fields ---
        project.title = title.trim();
        project.projectType = projectType || project.projectType || 'Other';
        project.description = description || '';
        project.problemStatement = problemStatement || '';
        project.image = newMainImageUrl;
        project.year = year || '';
        project.department = department || '';
        project.category = category || '';
        
        project.tags = [...new Set([...parsedTags, year, department, category].filter(t => t))];
        project.otherContributors = parsedOtherContributors;
        project.resources = parsedResources;
        project.isPublished = newIsPublished;
        project.updatedAt = new Date(); // Explicitly update timestamp

        // Update projectDetails sub-document with CLEANED values
        project.projectDetails = {
            CADFileLink: newCADFileLink,
            technicalDescription: cleanTechnicalDescription,
            toolsSoftware: parsedToolsSoftware, 
            functionalGoals: cleanFunctionalGoals,
            artworkImage: newArtworkImage,
            mediumTechnique: cleanMediumTechnique,
            artistStatement: cleanArtistStatement,
            exhibitionHistory: cleanExhibitionHistory
        };

        project.collaborators = newCollaboratorIds;
        
        await project.save();
        
        const redirectPath = newIsPublished ? `/project.html?id=${project._id}` : '/profile.html?tab=drafts';
        res.json({ success: true, message: 'Project updated successfully', redirect: redirectPath });
        
    } catch (error) {
        console.error('Edit project error:', error);
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            // Return 400 Bad Request if validation fails
            return res.status(400).json({ error: 'Validation Error', details: messages.join(', ') });
        }
        res.status(500).json({ error: 'Server error', details: error.message });
    }
});

// ---------------------------------------------------------------------
// 11. Fetch Projects by User ID (router.get /projects-by-user/:userId)
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

        const formattedProjects = projects.map(project => {
            if (!project._id) {
                console.warn('Project with missing _id in projects-by-user:', project);
                return null;
            }
            return {
                id: project._id.toString(),
                title: project.title,
                description: project.description,
                image: project.image || 'https://res.cloudinary.com/dphfedhek/image/upload/default-project.jpg',
                userId: project.userId._id.toString(),
                userName: project.userId.name,
                userProfilePic: project.userId.profilePic || 'https://res.cloudinary.com/dphfedhek/image/upload/default-profile.jpg',
                tags: project.tags || [],
                likes: project.likes || 0,
                views: project.views || 0,
                points: project.points || 0,
                projectType: project.projectType || 'Other'
            };
        }).filter(p => p !== null);

        console.log('Projects by user:', formattedProjects.map(p => ({ id: p.id, title: p.title })));
        res.json(formattedProjects);
    } catch (error) {
        console.error('Error fetching projects by user:', error);
        res.status(500).json({ error: 'Server error', details: error.message });
    }
});

module.exports = router;