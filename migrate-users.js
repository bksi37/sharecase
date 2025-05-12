const mongoose = require('mongoose');
const Project = require('./models/Project');

mongoose.connect('mongodb+srv://brakwasi619:M6UcDlG5FiJylCEQ@cluster0.vbjwzl2.mongodb.net/sharecase?retryWrites=true&w=majority', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(async () => {
    await Project.updateMany({}, { $set: { likedBy: [] } });
    console.log('Project migration complete');
    mongoose.disconnect();
}).catch(err => console.error('Migration error:', err));