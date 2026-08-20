require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { OAuth2Client } = require('google-auth-library');
const User = require('./models/User');

const app = express();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Auth Route
app.post('/api/auth/google', async (req, res) => {
  console.log("Received login request", req.body);
  try {
    const { sub, email, name, picture } = req.body;
    if (!sub) {
      console.log("Missing sub in request body");
      return res.status(400).json({ error: "Missing user info" });
    }

    console.log("Finding user in DB:", sub);
    // Find or create user
    let user = await User.findOne({ googleId: sub });
    if (!user) {
      user = new User({ googleId: sub, email, name, picture, currentLevelIndex: 0 });
      await user.save();
    }

    res.json({ user });
  } catch (error) {
    console.error("Auth error:", error);
    res.status(401).json({ error: "Authentication failed" });
  }
});

// Update Level Route
app.post('/api/level', async (req, res) => {
  try {
    const { googleId, levelIndex } = req.body;
    if (!googleId) return res.status(401).json({ error: "Unauthorized" });

    const user = await User.findOneAndUpdate(
      { googleId },
      { currentLevelIndex: levelIndex },
      { new: true }
    );
    
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ success: true, levelIndex: user.currentLevelIndex });
  } catch (error) {
    console.error("Save level error:", error);
    res.status(500).json({ error: "Failed to save level" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
