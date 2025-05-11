const express = require('express');
const cloudinary = require('cloudinary').v2;
const Project = require('../models/Project');
const { isAuthenticated, isProfileComplete } = require('../middleware/auth');
const router = express.Router();

// Add Project
router.post('/add-project', isAuthenticated, isProfileComplete, async (req, res) => {
    try {
        const { title, description } = req.body;
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
            image: imageUrl,
            userId: req.session.userId
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
        const { q } = req.query;
        const query = q ? { title: { $regex: q, $options: 'i' } } : {};
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

// Fetch Single Project
router.get('/projects/:id', isAuthenticated, isProfileComplete, async (req, res) => {
    try {
        const project = await Project.findById(req.params.id).populate('userId', 'name');
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }
        res.json({
            id: project._id,
            title: project.title,
            description: project.description,
            image: project.image || 'https://res.cloudinary.com/dphfedhek/image/upload/default-project.jpg',
            userId: project.userId._id
        });
    } catch (error) {
        console.error('Fetch project error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;