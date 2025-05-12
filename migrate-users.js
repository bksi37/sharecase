const mongoose = require('mongoose');
const User = require('./models/User');

mongoose.connect('mongodb+srv://brakwasi619:M6UcDlG5FiJylCEQ@cluster0.vbjwzl2.mongodb.net/sharecase?retryWrites=true&w=majority', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(async () => {
    await User.updateMany(
        { isProfileComplete: { $exists: false } },
        { $set: { isProfileComplete: true } }
    );
    console.log('User migration complete');
    mongoose.disconnect();
}).catch(err => console.error('Migration error:', err));