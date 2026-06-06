const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, username, email, password } = req.body;
    const existsEmail = await User.findOne({ email });
    if (existsEmail) return res.status(400).json({ message: 'Email already exists' });
    const existsUsername = await User.findOne({ username });
    if (existsUsername) return res.status(400).json({ message: 'Username already taken' });
    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ name, username, email, password: hashed });
    res.status(201).json({ message: 'Registration successful!' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'User not found' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ message: 'Wrong password' });
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, username: user.username, email: user.email, profilePicture: user.profilePicture, bio: user.bio } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;