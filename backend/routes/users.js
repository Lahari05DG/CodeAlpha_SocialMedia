const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Middleware
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

// Get all users
router.get('/', async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get user profile
router.get('/:username', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username })
      .select('-password')
      .populate('followers', 'name username profilePicture')
      .populate('following', 'name username profilePicture')
      .populate('followRequests', 'name username profilePicture')
      .populate('notifications.from', 'name username profilePicture');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Send follow request
router.put('/:id/follow', auth, async (req, res) => {
  try {
    const userToFollow = await User.findById(req.params.id);
    const currentUser = await User.findById(req.user.id);
    if (!userToFollow) return res.status(404).json({ message: 'User not found' });
    if (req.params.id === req.user.id) return res.status(400).json({ message: 'Cannot follow yourself' });

    const isFollowing = currentUser.following.includes(req.params.id);
    const requestSent = userToFollow.followRequests.includes(req.user.id);

    if (isFollowing) {
      // Unfollow
      currentUser.following = currentUser.following.filter(id => id.toString() !== req.params.id);
      userToFollow.followers = userToFollow.followers.filter(id => id.toString() !== req.user.id);
      await currentUser.save();
      await userToFollow.save();
      res.json({ status: 'unfollowed' });
    } else if (requestSent) {
      // Cancel request
      userToFollow.followRequests = userToFollow.followRequests.filter(id => id.toString() !== req.user.id);
      await userToFollow.save();
      res.json({ status: 'cancelled' });
    } else {
      // Send request
      userToFollow.followRequests.push(req.user.id);
      // Add notification
      userToFollow.notifications.push({
        type: 'follow_request',
        message: `${currentUser.name} sent you a follow request`,
        from: req.user.id
      });
      await userToFollow.save();
      res.json({ status: 'requested' });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Accept/Reject follow request
router.put('/request/:id/accept', auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id);
    const requester = await User.findById(req.params.id);
    // Accept
    currentUser.followRequests = currentUser.followRequests.filter(id => id.toString() !== req.params.id);
    currentUser.followers.push(req.params.id);
    requester.following.push(req.user.id);
    // Notify requester
    requester.notifications.push({
      type: 'follow_accepted',
      message: `${currentUser.name} accepted your follow request`,
      from: req.user.id
    });
    await currentUser.save();
    await requester.save();
    res.json({ message: 'Request accepted!' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/request/:id/reject', auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id);
    currentUser.followRequests = currentUser.followRequests.filter(id => id.toString() !== req.params.id);
    await currentUser.save();
    res.json({ message: 'Request rejected!' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get notifications
router.get('/:id/notifications', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .populate('notifications.from', 'name username profilePicture');
    res.json(user.notifications.reverse());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Mark notifications read
router.put('/:id/notifications/read', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    user.notifications.forEach(n => n.read = true);
    await user.save();
    res.json({ message: 'Notifications marked as read' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Send message
router.post('/message/send', auth, async (req, res) => {
  try {
    const { toId, text } = req.body;
    const sender = await User.findById(req.user.id);
    const receiver = await User.findById(toId);
    if (!receiver) return res.status(404).json({ message: 'User not found' });
    const message = { from: req.user.id, to: toId, text, createdAt: new Date() };
    sender.messages.push(message);
    receiver.messages.push(message);
    // Notify receiver
    receiver.notifications.push({
      type: 'message',
      message: `${sender.name} sent you a message`,
      from: req.user.id
    });
    await sender.save();
    await receiver.save();
    res.json({ message: 'Message sent!' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get messages between two users
router.get('/messages/:userId', auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id)
      .populate('messages.from', 'name username profilePicture')
      .populate('messages.to', 'name username profilePicture');
    const messages = currentUser.messages.filter(m =>
      m.from._id.toString() === req.params.userId ||
      m.to._id.toString() === req.params.userId
    );
    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update profile
router.put('/profile/update', auth, async (req, res) => {
  try {
    const { name, bio, profilePicture } = req.body;
    const user = await User.findByIdAndUpdate(req.user.id, { name, bio, profilePicture }, { new: true }).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;