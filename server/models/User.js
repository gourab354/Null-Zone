const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  googleId: { type: String, required: true, unique: true },
  email: { type: String, required: true },
  name: { type: String, required: true },
  picture: { type: String },
  currentLevelIndex: { type: Number, default: 0 }
});

module.exports = mongoose.model('User', userSchema);
