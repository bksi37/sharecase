const express = require('express');
const cloudinary = require('cloudinary').v2;
const Project = require('../models/Project');
const { isAuthenticated, isProfileComplete } = require('../middleware/auth');
const PDFDocument = require('pdfkit');
const fetch = require('node-fetch'); // Ensure this is also here
const User = require('../models/User'); // Add this line
const router = express.Router();

// Add Project
router.post('/add-project', isAuthenticated, isProfileComplete, async (req, res) => {
    try {
        const { title, description, tags, problemStatement, collaborators, resources, isPublished } = req.body;
        if (!title) {
            return res.status(400).json({ error: 'Title is required' });
        }
        let imageUrl = 'https://res.cloudinary.com/dphfedhek/image/upload/default-project.jpg';
        if (req.files && req.files.image) {
            const file = req.files.image;
            const result = await cloudinary.uploader.upload(`data:${file.mimetype};base64,${file.data.toString('base64')}`, {
                folder: 'sharecase/projects',
                format: 'jpg'
            });
            imageUrl = result.secure_url;
        }
        const project = new Project({
            title,
            description,
            tags: tags ? tags.split(',').map(t => t.trim()) : [],
            image: imageUrl,
            userId: req.session.userId,
            problemStatement: problemStatement || '',
            collaborators: collaborators ? collaborators.split(',').map(c => c.trim()) : [],
            resources: resources ? resources.split(',').map(r => r.trim()) : [],
            isPublished: isPublished === 'true'
        });
        await project.save();
        res.redirect('/index.html');
    } catch (error) {
        console.error('Add project error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Fetch All Projects
router.get('/projects', isAuthenticated, isProfileComplete, async (req, res) => {
    try {
        const projects = await Project.find().populate('userId', 'name');
        res.json(projects.map(p => ({
            id: p._id,
            title: p.title,
            description: p.description,
            image: p.image || 'https://res.cloudinary.com/dphfedhek/image/upload/default-project.jpg',
            userId: p.userId._id,
            likes: p.likes || 0,
            views: p.views || 0
        })));
    } catch (error) {
        console.error('Fetch projects error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Search Projects
router.get('/search', isAuthenticated, isProfileComplete, async (req, res) => {
    try {
        const { q, course, year, type, department, category } = req.query;
        const query = {};
        if (q) query.title = { $regex: q, $options: 'i' };
        if (course || year || type || department || category) {
            query.tags = { $all: [course, year, type, department, category].filter(t => t) };
        }
        const projects = await Project.find(query).populate('userId', 'name');
        res.json(projects.map(p => ({
            id: p._id,
            title: p.title,
            description: p.description,
            image: p.image || 'https://res.cloudinary.com/dphfedhek/image/upload/default-project.jpg',
            userId: p.userId._id,
            likes: p.likes || 0,
            views: p.views || 0
        })));
    } catch (error) {
        console.error('Search projects error:', error);
        res.status(500).json({ error: 'Server error' });
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
        const projects = await Project.find({ userId: req.session.userId });
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

// Fetch Single Project
router.get('/project/:id', isAuthenticated, isProfileComplete, async (req, res) => {
    try {
        const project = await Project.findById(req.params.id).populate('userId', 'name');
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }
        project.views = (project.views || 0) + 1;
        await project.save();
        res.json({
            id: project._id,
            title: project.title,
            description: project.description,
            image: project.image || 'https://res.cloudinary.com/dphfedhek/image/upload/default-project.jpg',
            userId: project.userId._id,
            userName: project.userId.name,
            problemStatement: project.problemStatement || '',
            collaborators: project.collaborators || [],
            tags: project.tags || [],
            resources: project.resources || [],
            likes: project.likes || 0,
            views: project.views || 0,
            comments: project.comments || [],
            likedBy: project.likedBy || []
        });
    } catch (error) {
        console.error('Fetch project error:', error);
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
        res.json({ success: true });
    } catch (error) {
        console.error('Post comment error:', error);
        res.status(500).json({ error: 'Server error' });
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
        await project.deleteOne();
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Delete project error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Edit Project
router.put('/project/:id', isAuthenticated, isProfileComplete, async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }
        if (project.userId.toString() !== req.session.userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        const { title, description, tags, problemStatement, collaborators, resources, isPublished } = req.body;
        if (!title) {
            return res.status(400).json({ error: 'Title is required' });
        }
        let imageUrl = project.image;
        if (req.files && req.files.image) {
            if (imageUrl && !imageUrl.includes('default-project.jpg')) {
                const publicId = imageUrl.split('/').pop().split('.')[0];
                await cloudinary.uploader.destroy(`sharecase/projects/${publicId}`);
            }
            const file = req.files.image;
            const result = await cloudinary.uploader.upload(`data:${file.mimetype};base64,${file.data.toString('base64')}`, {
                folder: 'sharecase/projects',
                format: 'jpg'
            });
            imageUrl = result.secure_url;
        }
        project.title = title;
        project.description = description || '';
        project.problemStatement = problemStatement || '';
        project.tags = tags ? tags.split(',').map(t => t.trim()) : [];
        project.collaborators = collaborators ? collaborators.split(',').map(c => c.trim()) : [];
        project.resources = resources ? resources.split(',').map(r => r.trim()) : [];
        project.isPublished = isPublished === 'true';
        project.image = imageUrl;
        await project.save();
        res.json({ success: true });
    } catch (error) {
        console.error('Edit project error:', error);
        res.status(500).json({ error: 'Server error' });
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

// Generate Portfolio
const fetch = require('node-fetch'); // Add this for image fetching

// Generate Portfolio
router.post('/generate-portfolio', isAuthenticated, isProfileComplete, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        const projects = await Project.find({ userId: req.session.userId });
        const doc = new PDFDocument({ size: 'A4', margin: 40 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=portfolio.pdf');
        doc.pipe(res);

        // Fonts
        doc.registerFont('Roboto', 'public/fonts/Roboto-Regular.ttf');
        doc.registerFont('Roboto-Bold', 'public/fonts/Roboto-Bold.ttf');

        // Header
        doc.fillColor('#007bff').font('Roboto-Bold').fontSize(24).text('ShareCase Portfolio', { align: 'center' });
        doc.fillColor('#000000').font('Roboto').fontSize(16).text(user.name, { align: 'center' });
        doc.moveDown(1);
        doc.lineWidth(2).strokeColor('#007bff').moveTo(40, doc.y).lineTo(552, doc.y).stroke();
        doc.moveDown(1);

        if (projects.length === 0) {
            doc.fontSize(12).text('No projects available.', { align: 'center' });
        } else {
            projects.forEach(async (p, index) => {
                if (index > 0) doc.addPage();

                // Project Title
                doc.fillColor('#007bff').font('Roboto-Bold').fontSize(18).text(p.title, { align: 'left' });
                doc.moveDown(0.5);

                // Image
                if (p.image && !p.image.includes('default-project.jpg')) {
                    try {
                        const response = await fetch(`${p.image}?w=200&h=150`);
                        const buffer = await response.buffer();
                        doc.image(buffer, { width: 200, height: 150 });
                        doc.moveDown(0.5);
                    } catch (error) {
                        console.error('Image fetch error:', error);
                        doc.fontSize(10).fillColor('#e74c3c').text('Image not available', { align: 'left' });
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
                doc.font('Roboto').fontSize(10).text(p.tags.length ? p.tags.join(', ') : 'None', { align: 'left', indent: 10 });
                doc.moveDown(0.5);

                // Collaborators
                doc.font('Roboto-Bold').fontSize(12).text('Collaborators:', { align: 'left' });
                doc.font('Roboto').fontSize(10).text(p.collaborators.length ? p.collaborators.join(', ') : 'None', { align: 'left', indent: 10 });
                doc.moveDown(1);
            });
        }

        // Footer
        doc.fontSize(10).fillColor('#666666').text('Generated by ShareCase © 2025', 40, doc.page.height - 60, { align: 'center' });
        doc.end();
    } catch (error) {
        console.error('Generate portfolio error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;