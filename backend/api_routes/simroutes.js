/* ==========================================================================
   IPL Auction - Simulation Routes (simroutes.js)
   Handles Schedule generation, Match updates, and Standings.
   ========================================================================== */

const express = require('express');
const router  = express.Router();
const Lobby   = require('../models/lobbymodel');

// Helper: Generate Round-Robin Schedule
function generateRoundRobin(teams) {
    if (teams.length < 2) return [];
    
    let schedule = [];
    let matchId = 1;
    // Simple single round-robin
    for (let i = 0; i < teams.length; i++) {
        for (let j = i + 1; j < teams.length; j++) {
            schedule.push({
                matchId: `M${matchId++}`,
                team1: teams[i].localId,
                team2: teams[j].localId,
                status: 'PENDING'
            });
        }
    }
    return schedule;
}

// Helper: generate code for single player
function generateSPCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'SP-';
    for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
}

const defaultFranchises = [
    { localId: "CSK", name: "Chennai Super Kings", budget: 1200000000, color: "#FFFF00" },
    { localId: "MI", name: "Mumbai Indians", budget: 1200000000, color: "#004BA0" },
    { localId: "RCB", name: "Royal Challengers Bangalore", budget: 1200000000, color: "#E3292E" },
    { localId: "KKR", name: "Kolkata Knight Riders", budget: 1200000000, color: "#3A225D" },
    { localId: "DC", name: "Delhi Capitals", budget: 1200000000, color: "#00008B" },
    { localId: "RR", name: "Rajasthan Royals", budget: 1200000000, color: "#FFC0CB" },
    { localId: "PBKS", name: "Punjab Kings", budget: 1200000000, color: "#ED1B24" },
    { localId: "SRH", name: "Sunrisers Hyderabad", budget: 1200000000, color: "#FF822A" },
    { localId: "LSG", name: "Lucknow Super Giants", budget: 1200000000, color: "#005DA0" },
    { localId: "GT", name: "Gujarat Titans", budget: 1200000000, color: "#1B2133" }
];

/* ------------------------------------------------------------------
   POST /api/sim/singleplayer
   Creates a single-player simulation lobby instantly
------------------------------------------------------------------ */
router.post('/sim/singleplayer', async (req, res) => {
    try {
        let code;
        let attempts = 0;
        do {
            code = generateSPCode();
            attempts++;
            if (attempts > 10) throw new Error('Could not generate unique SP code.');
        } while (await Lobby.findOne({ roomCode: code }));

        const newLobby = new Lobby({
            roomCode: code,
            createdBy: 'Player',
            status: 'SIMULATION',
            teams: defaultFranchises.map(f => ({
                localId: f.localId,
                name: f.name,
                budget: f.budget,
                color: f.color,
                isAI: true
            }))
        });

        await newLobby.save();
        res.status(201).json({ success: true, roomCode: code });
    } catch (err) {
        console.error('Error creating single-player session:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

/* ------------------------------------------------------------------
   POST /api/sim/:code/generate-schedule
   Transitions a FINISHED lobby to SIMULATION, generates Season 1 schedule
------------------------------------------------------------------ */
router.post('/sim/:code/generate-schedule', async (req, res) => {
    try {
        const code = req.params.code.toUpperCase();
        const lobby = await Lobby.findOne({ roomCode: code });
        if (!lobby) return res.status(404).json({ success: false, message: 'Lobby not found.' });

        // Ensure there are teams
        if (lobby.teams.length < 2) {
            return res.status(400).json({ success: false, message: 'Not enough teams to generate a schedule.' });
        }

        const seasonNumber = lobby.currentSeason || 1;
        
        // Check if schedule already exists for this season
        const existingSeason = lobby.seasons.find(s => s.seasonNumber === seasonNumber);
        if (existingSeason && existingSeason.schedule.length > 0) {
            return res.status(400).json({ success: false, message: 'Schedule already exists for this season.' });
        }

        // Generate schedule
        const schedule = generateRoundRobin(lobby.teams);
        
        // Initialize standings
        const standings = lobby.teams.map(t => ({
            teamLocalId: t.localId,
            played: 0, won: 0, lost: 0, tied: 0, points: 0, nrr: 0
        }));

        const newSeason = {
            seasonNumber,
            status: 'ACTIVE',
            schedule,
            standings
        };

        // Remove old season entry if exists (safety check)
        lobby.seasons = lobby.seasons.filter(s => s.seasonNumber !== seasonNumber);
        lobby.seasons.push(newSeason);
        
        // Update status to SIMULATION
        lobby.status = 'SIMULATION';
        
        await lobby.save();
        res.status(200).json({ success: true, data: newSeason });
    } catch (err) {
        console.error('Error generating schedule:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

/* ------------------------------------------------------------------
   POST /api/sim/:code/update-match
   Body: { seasonNumber, matchId, winnerTeamId, score1, score2, summary }
   Updates match status and standings
------------------------------------------------------------------ */
router.post('/sim/:code/update-match', async (req, res) => {
    try {
        const code = req.params.code.toUpperCase();
        const { seasonNumber, matchId, winnerTeamId, score1, score2, summary } = req.body;

        const lobby = await Lobby.findOne({ roomCode: code });
        if (!lobby) return res.status(404).json({ success: false, message: 'Lobby not found.' });

        const season = lobby.seasons.find(s => s.seasonNumber === seasonNumber);
        if (!season) return res.status(404).json({ success: false, message: 'Season not found.' });

        const match = season.schedule.find(m => m.matchId === matchId);
        if (!match) return res.status(404).json({ success: false, message: 'Match not found.' });

        if (match.status === 'PLAYED') {
            return res.status(400).json({ success: false, message: 'Match is already played.' });
        }

        // Update match
        match.status = 'PLAYED';
        match.winner = winnerTeamId;
        match.score1 = score1;
        match.score2 = score2;
        match.summary = summary;

        // Update standings
        const t1Standing = season.standings.find(s => s.teamLocalId === match.team1);
        const t2Standing = season.standings.find(s => s.teamLocalId === match.team2);

        if (t1Standing && t2Standing) {
            t1Standing.played++;
            t2Standing.played++;

            if (winnerTeamId === match.team1) {
                t1Standing.won++;
                t1Standing.points += 2;
                t2Standing.lost++;
            } else if (winnerTeamId === match.team2) {
                t2Standing.won++;
                t2Standing.points += 2;
                t1Standing.lost++;
            } else if (winnerTeamId === 'TIE') {
                t1Standing.tied++;
                t2Standing.tied++;
                t1Standing.points += 1;
                t2Standing.points += 1;
            }

            // Note: NRR calculation requires ball-by-ball or over-by-over runs/overs logic
            // For now, we leave NRR as 0 or implement a simplified logic if needed.
        }

        // Check if season is complete
        const allPlayed = season.schedule.every(m => m.status === 'PLAYED');
        if (allPlayed) {
            season.status = 'COMPLETED';
        }

        await lobby.save();
        res.status(200).json({ success: true, data: season });
    } catch (err) {
        console.error('Error updating match:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
