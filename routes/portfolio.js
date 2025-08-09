const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Project = require('../models/Project');
const { isAuthenticated } = require('../middleware/auth');
const PDFDocument = require('pdfkit');
const https = require('https');

// Helper function to fetch image from URL and return a buffer
const fetchImageAsBuffer = (url) => {
    console.log('Fetching image:', url);
    return new Promise((resolve, reject) => {
        https.get(url, (response) => {
            if (response.statusCode < 200 || response.statusCode >= 300) {
                console.error(`Failed to fetch image ${url}: Status ${response.statusCode}`);
                return reject(new Error(`HTTP Error: ${response.statusCode} for ${url}`));
            }
            const chunks = [];
            response.on('data', (chunk) => chunks.push(chunk));
            response.on('end', () => resolve(Buffer.concat(chunks)));
        }).on('error', (err) => {
            console.error(`Error fetching image ${url}:`, err);
            reject(err);
        });
    });
};

// Helper function to generate PDF and stream to client
async function generatePortfolio(user, projects, format, res) {
    console.log('Starting PDF generation for user:', user.name, 'format:', format);
    const doc = new PDFDocument({ size: 'A4', margin: 40 });

    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=sharecase_portfolio_${format}.pdf`);

    // Pipe PDF directly to response
    doc.pipe(res);

    const styles = {
        classic: { primaryColor: '#212529', accentColor: '#000000', font: 'Roboto' },
        modern: { primaryColor: '#1a1a1a', accentColor: '#007bff', font: 'Roboto' }
    };
    const style = styles[format] || styles.classic;

    try {
        console.log('Registering fonts');
        doc.registerFont('Roboto', 'public/fonts/Roboto-Regular.ttf');
        doc.registerFont('Roboto-Bold', 'public/fonts/Roboto-Bold.ttf');
    } catch (error) {
        console.error('Font registration error:', error);
        doc.font('Helvetica');
    }

    // Header
    console.log('Adding header');
    doc.fillColor(style.primaryColor).font('Roboto-Bold').fontSize(28).text(user.name || 'Anonymous', { align: 'center' });
    doc.moveDown(0.2);
    doc.fillColor(style.accentColor).font('Roboto').fontSize(12).text(user.email || '', { align: 'center' });
    if (user.linkedin) {
        let linkedinUrl = user.linkedin;
        if (!linkedinUrl.startsWith('http://') && !linkedinUrl.startsWith('https://')) {
            linkedinUrl = `https://${linkedinUrl}`;
        }
        doc.moveDown(0.2);
        doc.fillColor(style.accentColor).font('Roboto').fontSize(12).text(`LinkedIn: ${linkedinUrl}`, { align: 'center', link: linkedinUrl });
    }
    doc.moveDown(1);
    doc.lineWidth(2).strokeColor(style.primaryColor).moveTo(40, doc.y).lineTo(552, doc.y).stroke();
    doc.moveDown(1);

    // Projects Section
    console.log('Adding projects section');
    doc.fillColor(style.primaryColor).font('Roboto-Bold').fontSize(22).text('My Projects', { align: 'left' });
    doc.moveDown(0.5);

    if (projects.length === 0) {
        console.log('No projects to display');
        doc.font('Roboto').fontSize(12).text('No projects available to display.', { align: 'center' });
    } else {
        for (const [index, p] of projects.entries()) {
            console.log(`Adding project ${index + 1}: ${p.title}`);
            if (index > 0) doc.addPage();
            doc.fillColor(style.primaryColor).font('Roboto-Bold').fontSize(18).text(p.title || 'Untitled Project', { align: 'left' });
            doc.moveDown(0.5);
            if (p.image && !p.image.includes('default-project.jpg')) {
                try {
                    const imageBuffer = await fetchImageAsBuffer(p.image); // Fixed with await
                    doc.image(imageBuffer, { width: 350, align: 'center', valign: 'center' });
                    doc.moveDown(0.5);
                } catch (error) {
                    console.error('Image download error during PDF generation:', error);
                    doc.fontSize(10).fillColor('#e74c3c').text('Image not available or failed to download', { align: 'left' });
                    doc.moveDown(0.5);
                }
            }
            doc.fillColor(style.accentColor).font('Roboto-Bold').fontSize(12).text('Problem Statement:', { align: 'left' });
            doc.font('Roboto').fontSize(10).text(p.problemStatement || 'Not provided', { align: 'left', indent: 10 });
            doc.moveDown(0.5);
            doc.font('Roboto-Bold').fontSize(12).text('Description:', { align: 'left' });
            doc.font('Roboto').fontSize(10).text(p.description || 'Not provided', { align: 'left', indent: 10 });
            doc.moveDown(0.5);
            doc.font('Roboto-Bold').fontSize(12).text('Tags:', { align: 'left' });
            doc.font('Roboto').fontSize(10).text(p.tags && p.tags.length ? p.tags.join(', ') : 'None', { align: 'left', indent: 10 });
            doc.moveDown(0.5);
            const collaboratorNames = p.collaborators && p.collaborators.length > 0
                ? p.collaborators.map(collab => collab.name).filter(Boolean).join(', ')
                : 'None';
            doc.font('Roboto-Bold').fontSize(12).text('Collaborators:', { align: 'left' });
            doc.font('Roboto').fontSize(10).text(collaboratorNames, { align: 'left', indent: 10 });
            doc.moveDown(1);
        }
    }

    console.log('Adding footer');
    doc.fontSize(10).fillColor('#666666').text('Generated by ShareCase © 2025', 40, doc.page.height - 60, { align: 'center' });
    console.log('Finalizing PDF');
    doc.end();
}

router.post('/generate', isAuthenticated, async (req, res) => {
    try {
        console.log('POST /portfolio/generate called with:', req.body);
        const { format } = req.body;
        const userId = req.session.userId;
        console.log('User ID from session:', userId);
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized. Please log in.' });
        }
        if (!format || !['classic'].includes(format)) {
            return res.status(400).json({ success: false, error: 'Invalid or unsupported portfolio format.' });
        }
        console.log('Fetching user with ID:', userId);
        const user = await User.findById(userId).select('name email linkedin profilePic');
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found.' });
        }
        console.log('User found:', user.name);
        console.log('Fetching projects for user:', userId);
        const projects = await Project.find({ userId: userId, isPublished: true })
            .populate('collaborators', 'name')
            .lean();
        console.log('Projects found:', projects.length);
        console.log('Generating PDF for format:', format);
        await generatePortfolio(user, projects, format, res);
    } catch (error) {
        console.error('Portfolio generation API error:', error);
        res.status(500).json({ success: false, error: error.message || 'Internal server error.' });
    }
});

module.exports = router;