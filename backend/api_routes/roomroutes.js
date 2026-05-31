/* ==========================================================================
   IPL Auction - Room Routes (roomroutes.js)
   All room data is persisted in MongoDB Atlas.
   ========================================================================== */

const express = require('express');
const router  = express.Router();
const Room    = require('../models/Room');


// Helper: random 6-char alphanumeric code (no O, 0, I, 1 to avoid confusion)
function generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
}

/* ------------------------------------------------------------------
   POST /api/rooms  — Create a new room
   Body: { auctioneerName, roomName, maxPlayers, budget }
------------------------------------------------------------------ */
router.post('/rooms', async (req, res) => {
    try {
        const { auctioneerName, roomName, maxPlayers, budget, maxSquadSize, maxOverseas, expiryDays } = req.body;

        if (!auctioneerName || !roomName || !maxPlayers || !budget) {
            return res.status(400).json({ success: false, message: 'All fields are required.' });
        }

        // Generate a unique code
        let code;
        let attempts = 0;
        do {
            code = generateCode();
            attempts++;
            if (attempts > 20) throw new Error('Could not generate unique code.');
        } while (await Room.findOne({ code }));

        const roomData = {
            code,
            roomName,
            auctioneerName,
            maxPlayers: parseInt(maxPlayers),
            budget: parseInt(budget),
            maxSquadSize: parseInt(maxSquadSize) || 25,
            maxOverseas: parseInt(maxOverseas) || 8,
            players: [],
            status: 'WAITING'
        };

        const parsedExpiryDays = parseInt(expiryDays) || 3;
        if (parsedExpiryDays !== -1) {
            roomData.expiresAt = new Date(Date.now() + parsedExpiryDays * 24 * 60 * 60 * 1000);
        }

        const room = await Room.create(roomData);

        res.status(201).json({ success: true, data: room });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/* ------------------------------------------------------------------
   GET /api/rooms/:code  — Fetch a room by code (verify / resume)
------------------------------------------------------------------ */
router.get('/rooms/:code', async (req, res) => {
    try {
        const code = req.params.code.toUpperCase();
        const room = await Room.findOne({ code });

        if (!room)                          return res.status(404).json({ success: false, message: 'Room not found.' });
        if (room.expiresAt && new Date() > room.expiresAt)    return res.status(410).json({ success: false, message: 'Room has expired.' });

        res.status(200).json({ success: true, data: room });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/* ------------------------------------------------------------------
   POST /api/rooms/:code/join  — Player joins a room
   Body: { name, teamId, teamName, password }
------------------------------------------------------------------ */
router.post('/rooms/:code/join', async (req, res) => {
    try {
        const code = req.params.code.toUpperCase();
        const { name, teamId, teamName, password } = req.body;

        if (!name || !teamId || !teamName || !password) {
            return res.status(400).json({ success: false, message: 'name, teamId, teamName, and password are required.' });
        }
        if (password.length < 2) {
            return res.status(400).json({ success: false, message: 'Password must be at least 2 characters long.' });
        }

        const room = await Room.findOne({ code });
        if (!room)                       return res.status(404).json({ success: false, message: 'Room not found.' });
        if (room.expiresAt && new Date() > room.expiresAt) return res.status(410).json({ success: false, message: 'Room has expired.' });
        
        const existingPlayer = room.players.find(p => p.teamId === teamId.toUpperCase());
        if (existingPlayer) {
            if (existingPlayer.password === password) {
                // Resume logic: allow joining if password matches
                return res.status(200).json({ success: true, data: room, message: 'Session resumed successfully.' });
            } else {
                return res.status(401).json({ success: false, message: 'That team is already taken (incorrect password).' });
            }
        }

        if (room.players.length >= room.maxPlayers) {
            return res.status(409).json({ success: false, message: 'Room is full.' });
        }

        room.players.push({ name, teamId: teamId.toUpperCase(), teamName, password, joinedAt: new Date() });
        await room.save();

        res.status(200).json({ success: true, data: room });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/* ------------------------------------------------------------------
   PATCH /api/rooms/:code/status  — Update room status
   Body: { status: 'IN_PROGRESS' | 'FINISHED' }
         optionally { auctioneerName } to update name on resume
------------------------------------------------------------------ */
router.patch('/rooms/:code/status', async (req, res) => {
    try {
        const code   = req.params.code.toUpperCase();
        const { status, auctioneerName } = req.body;

        const allowed = ['WAITING', 'IN_PROGRESS', 'FINISHED'];
        if (!allowed.includes(status)) {
            return res.status(400).json({ success: false, message: `status must be one of: ${allowed.join(', ')}` });
        }

        const update = { status };
        if (auctioneerName) update.auctioneerName = auctioneerName;

        const room = await Room.findOneAndUpdate({ code }, update, { new: true });
        if (!room) return res.status(404).json({ success: false, message: 'Room not found.' });

        res.status(200).json({ success: true, data: room });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/* ------------------------------------------------------------------
   GET /api/rooms/:code/players  — Poll joined players list
------------------------------------------------------------------ */
router.get('/rooms/:code/players', async (req, res) => {
    try {
        const code = req.params.code.toUpperCase();
        const room = await Room.findOne({ code }, 'players status expiresAt');

        if (!room) return res.status(404).json({ success: false, message: 'Room not found.' });

        res.status(200).json({
            success: true,
            data: {
                players: room.players,
                status:  room.status,
                expiresAt: room.expiresAt
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
