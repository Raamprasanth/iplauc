/* ==========================================================================
   IPL Auction - Room Model (Room.js)
   ========================================================================== */

const mongoose = require('mongoose');

const PlayerEntrySchema = new mongoose.Schema({
    name:     { type: String, required: true, trim: true },
    teamId:   { type: String, required: true, uppercase: true, trim: true },
    teamName: { type: String, required: true, trim: true },
    password: { type: String, required: true },
    joinedAt: { type: Date, default: Date.now }
}, { _id: false });

const RoomSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true,
        minlength: 6,
        maxlength: 6,
        index: true
    },
    roomName: {
        type: String,
        required: true,
        trim: true,
        maxlength: 50
    },
    auctioneerName: {
        type: String,
        required: true,
        trim: true,
        maxlength: 30
    },
    maxPlayers: {
        type: Number,
        required: true,
        min: 2,
        max: 10
    },
    budget: {
        type: Number,
        required: true,        // Crores — 60 / 90 / 120 / 150
        min: 60,
        max: 150
    },
    maxSquadSize: {
        type: Number,
        default: 25
    },
    maxOverseas: {
        type: Number,
        default: 8
    },
    status: {
        type: String,
        enum: ['WAITING', 'IN_PROGRESS', 'FINISHED'],
        default: 'WAITING'
    },
    players: [PlayerEntrySchema],
    expiresAt: {
        type: Date,
        required: false,
        index: { expireAfterSeconds: 0 }   // MongoDB TTL — auto-delete after expiry
    }
}, { timestamps: true });

module.exports = mongoose.model('Room', RoomSchema);
