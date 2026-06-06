const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const jwt = require('jsonwebtoken');

// Middleware to verify token
const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
};

// Get all posts
router.get('/', async (req, res) => {
  try {
    const posts = await Post.find()
      .populate('user', 'name username profilePicture')
      .populate('comments.user', 'name username profilePicture')
      .sort({ createdAt: -1 });
    res.json(posts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create post
router.post('/', auth, async (req, res) => {
  try {
    const { content, image } = req.body;
    const post = await Post.create({ user: req.user.id, content, image });
    const populated = await post.populate('user', 'name username profilePicture');
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Like/Unlike post
router.put('/:id/like', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });
    const liked = post.likes.includes(req.user.id);
    if (liked) {
      post.likes = post.likes.filter(id => id.toString() !== req.user.id);
    } else {
      post.likes.push(req.user.id);
    }
    await post.save();
    res.json({ likes: post.likes.length, liked: !liked });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Add comment
router.post('/:id/comment', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });
    post.comments.push({ user: req.user.id, text: req.body.text });
    await post.save();
    const populated = await post.populate('comments.user', 'name username profilePicture');
    res.json(populated.comments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete post
router.delete('/:id', auth, async (req, res) => {
  try {
    await Post.findByIdAndDelete(req.params.id);
    res.json({ message: 'Post deleted!' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;