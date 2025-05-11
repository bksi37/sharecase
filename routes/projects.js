const express = require('express');
const cloudinary = require('cloudinary').v2;
const Project = require('../models/Project');
const { isAuthenticated, isProfileComplete } = require('../middleware/auth');
const PDFDocument = require('pdfkit');
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
            isPublished: isPublished === 'true' // Convert string to boolean
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
            userId: p.userId._id
        })));
    } catch (error) {
        console.error('Fetch projects error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Search Projects
router.get('/search', isAuthenticated, isProfileComplete, async (req, res) => {
    try {
        const { q, course, year, type } = req.query;
        const query = {};
        if (q) query.title = { $regex: q, $options: 'i' };
        if (course || year || type) {
            query.tags = { $all: [course, year, type].filter(t => t) };
        }
        const projects = await Project.find(query).populate('userId', 'name');
        res.json(projects.map(p => ({
            id: p._id,
            title: p.title,
            description: p.description,
            image: p.image || 'https://res.cloudinary.com/dphfedhek/image/upload/default-project.jpg',
            userId: p.userId._id
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
        res.json({ courses, years, types });
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
            isPublished: p.isPublished
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
        // Increment views
        project.views = (project.views || 0) + 1;
        await project.save();
        res.json({
            id: project._id,
            title: project.title,
            description: project.description,
            image: project.image || 'https://res.cloudinary.com/dphfedhek/image/upload/default-project.jpg',
            userId: project.userId._id,
            problemStatement: project.problemStatement || '',
            collaborators: project.collaborators || [],
            tags: project.tags || [],
            resources: project.resources || [],
            likes: project.likes || 0,
            views: project.views || 0,
            comments: project.comments || []
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
        // Delete image from Cloudinary if not default
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

// Generate Portfolio
router.post('/generate-portfolio', isAuthenticated, isProfileComplete, async (req, res) => {
    try {
        const projects = await Project.find({ userId: req.session.userId });
        const doc = new PDFDocument();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=portfolio.pdf');
        doc.pipe(res);
        doc.fontSize(20).text('My Portfolio', { align: 'center' });
        doc.moveDown();
        if (projects.length === 0) {
            doc.fontSize(12).text('No projects available.', { align: 'center' });
        } else {
            projects.forEach(p => {
                doc.fontSize(16).text(p.title, { underline: true });
                doc.fontSize(12).text(p.description || 'No description');
                doc.moveDown();
            });
        }
        doc.end();
    } catch (error) {
        console.error('Generate portfolio error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;