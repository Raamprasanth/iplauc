require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

// Import routes
const indexRoutes = require('./api_routes/indexroutes');
const loginRoutes = require('./api_routes/loginroutes');
const roomRoutes  = require('./api_routes/roomroutes');
const lobbyRoutes = require('./api_routes/lobbyroutes');
const aiRoutes    = require('./api_routes/airoutes');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
app.set('io', io); // Make io available in routes
const PORT = process.env.PORT || 3000;

process.on('unhandledRejection', (err) => {
    console.error('Unhandled async error:', err?.message || err);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err?.message || err);
});

// Initialize WebSockets logic
require('./sockets/auctionSocket')(io);

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Disable caching for all API routes
app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
});

// Serve frontend static files in production or when merged
const frontendBuildPath = path.join(__dirname, '../frontend/build');
app.use(express.static(frontendBuildPath));

// API Routes
app.use('/api', indexRoutes);
app.use('/api', loginRoutes); // Can keep or remove, we will add authRoutes
const authRoutes = require('./api_routes/authroutes');
app.use('/api/auth', authRoutes);
app.use('/api', roomRoutes);
app.use('/api', lobbyRoutes);
app.use('/api/ai', aiRoutes);

// MongoDB Connection
const mongoURI = process.env.MONGO_URI;
if (!mongoURI) {
    console.error("FATAL ERROR: MONGO_URI is not defined in .env file");
    process.exit(1);
}

mongoose.connection.on('connected', () => {
    console.log('MongoDB connection ready');
});

mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected. Mongoose will keep trying to reconnect.');
});

mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err?.message || err);
});

mongoose.connect(mongoURI, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10,
    dbName: 'ipl_auction'
})
    .then(() => console.log('✅ MongoDB Atlas Connected Successfully'))
    .catch(err => {
        console.error('❌ MongoDB Connection Error:', err.message);
        if (err.message.includes('timed out') || err.message.includes('Server selection')) {
            console.error('💡 FIX: Whitelist your IP in MongoDB Atlas → Network Access → Add 0.0.0.0/0');
        }
    });

// Fallback to index.html for SPA routing (Express 5 compatible)
app.get('/{*splat}', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Start the server
server.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
