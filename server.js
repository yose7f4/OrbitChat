const http = require('node:http');
const path = require('node:path');
const express = require('express');
const { Server } = require('socket.io');
const { claimOrAuthenticateUser, saveMessage, getRecentMessages } = require('./db');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// REST endpoint for initial claim & authentication check
app.post('/api/auth', (req, res) => {
  const { username, token } = req.body || {};
  const result = claimOrAuthenticateUser(username, token);
  if (!result.success) {
    return res.status(400).json(result);
  }
  return res.json(result);
});

// Track active online users: Map<username, Set<socketId>>
const userSockets = new Map();

function getOnlineUsernames() {
  return Array.from(userSockets.keys());
}

io.on('connection', (socket) => {
  let currentUser = null;

  // Handle client authentication via socket
  socket.on('auth:login', ({ username, token }) => {
    const authResult = claimOrAuthenticateUser(username, token);
    if (!authResult.success) {
      return socket.emit('auth:error', { error: authResult.error });
    }

    currentUser = authResult.username;
    socket.data.username = currentUser;

    // Register socket connection for presence
    if (!userSockets.has(currentUser)) {
      userSockets.set(currentUser, new Set());
      // Announce new arrival to everyone else
      socket.broadcast.emit('chat:system', {
        text: `${currentUser} joined the chat.`,
        timestamp: Date.now()
      });
    }
    userSockets.get(currentUser).add(socket.id);

    // Send success state back to authenticated client
    socket.emit('auth:success', {
      username: currentUser,
      token: authResult.token,
      isNew: authResult.isNew,
      recentMessages: getRecentMessages(100),
      onlineUsers: getOnlineUsernames()
    });

    // Broadcast updated presence list
    io.emit('presence:update', {
      onlineUsers: getOnlineUsernames()
    });
  });

  // Handle incoming message
  socket.on('chat:send', ({ text }) => {
    if (!currentUser) {
      return socket.emit('chat:error', { error: 'You are not logged in.' });
    }

    const savedMsg = saveMessage(currentUser, text);
    if (savedMsg) {
      io.emit('chat:message', savedMsg);
    }
  });

  // Handle typing status
  socket.on('typing:start', () => {
    if (!currentUser) return;
    socket.broadcast.emit('typing:update', {
      username: currentUser,
      isTyping: true
    });
  });

  socket.on('typing:stop', () => {
    if (!currentUser) return;
    socket.broadcast.emit('typing:update', {
      username: currentUser,
      isTyping: false
    });
  });

  // Disconnection cleanup
  socket.on('disconnect', () => {
    if (!currentUser) return;

    const set = userSockets.get(currentUser);
    if (set) {
      set.delete(socket.id);
      if (set.size === 0) {
        userSockets.delete(currentUser);
        // Announce departure and update presence
        socket.broadcast.emit('chat:system', {
          text: `${currentUser} left the chat.`,
          timestamp: Date.now()
        });
        io.emit('presence:update', {
          onlineUsers: getOnlineUsernames()
        });
        // Clear typing indicator for user
        socket.broadcast.emit('typing:update', {
          username: currentUser,
          isTyping: false
        });
      }
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Chat application running at http://localhost:${PORT}`);
});
