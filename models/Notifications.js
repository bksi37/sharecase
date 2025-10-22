const mongoose = require('mongoose');
const notificationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    message: { type: String, required: true },
    type: { type: String, enum: ['like', 'follow', 'comment', 'mention'], required: true },
    read: { type: Boolean, default: false },
    timestamp: { type: Date, default: Date.now },
    relatedId: { type: mongoose.Schema.Types.ObjectId, refPath: 'relatedModel' },
    relatedModel: { type: String, enum: ['Project', 'User', null] }
});
module.exports = mongoose.model('Notification', notificationSchema);