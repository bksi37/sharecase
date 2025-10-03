// File: migrate-projects.js
const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

const ProjectSchema = new mongoose.Schema({
    title: String,
    image: String,
    images: [String],
    // ... other fields
});
const Project = mongoose.model('Project', ProjectSchema);

async function migrateProjects() {
    try {
        const projects = await Project.find();
        for (const project of projects) {
            if (project.image && !project.images) {
                await Project.updateOne(
                    { _id: project._id },
                    { $set: { images: [project.image] }, $unset: { image: "" } }
                );
                console.log(`Migrated project: ${project.title} (_id: ${project._id})`);
            } else if (!project.images) {
                await Project.updateOne(
                    { _id: project._id },
                    { $set: { images: [] } }
                );
                console.log(`Set empty images array for project: ${project.title} (_id: ${project._id})`);
            }
        }
        console.log('Migration complete.');
        mongoose.connection.close();
    } catch (error) {
        console.error('Migration error:', error);
        mongoose.connection.close();
    }
}

migrateProjects();