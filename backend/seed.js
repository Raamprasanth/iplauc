require('dotenv').config();
const mongoose = require('mongoose');
const { Player, Franchise, BidHistory } = require('./models/indexmodel');

const xlsx = require('xlsx');

// Read Players from Excel
let defaultPlayers = [];
try {
    const workbook = xlsx.readFile('./IPL_Auction_Template.xlsx');
    const sheetName = workbook.SheetNames[0];
    const rawData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    defaultPlayers = rawData.map(row => ({
        id: row['ID'],
        name: row['Name'],
        role: row['Role (BAT/BOWL/AR/WK)'],
        rating: row['Rating (0-100)'],
        nationality: row['Nationality (Indian/Overseas)'],
        basePrice: row['Base Price (Lakhs)'],
        desc: row['Description'],
        stats: {
            match: row['Matches'] || 0,
            runs: row['Runs'] || 0,
            avg: row['Average']?.toString() || "0.0",
            sr: row['Strike Rate']?.toString() || "0.0",
            wkts: row['Wickets'] || 0,
            econ: row['Economy']?.toString() || "0.00"
        }
    })).filter(p => p.id && p.name); // Ignore empty rows
} catch (err) {
    console.error("❌ Could not read IPL_Auction_Template.xlsx. Please ensure the file exists.");
    process.exit(1);
}


const defaultFranchises = [
    { shortName: "CSK", name: "Chennai Super Kings", purse: 10000, squad: [], RTM: 1, isAI: true },
    { shortName: "MI", name: "Mumbai Indians", purse: 10000, squad: [], RTM: 1, isAI: true },
    { shortName: "RCB", name: "Royal Challengers Bangalore", purse: 10000, squad: [], RTM: 1, isAI: true },
    { shortName: "KKR", name: "Kolkata Knight Riders", purse: 10000, squad: [], RTM: 1, isAI: true },
    { shortName: "DC", name: "Delhi Capitals", purse: 10000, squad: [], RTM: 1, isAI: true },
    { shortName: "RR", name: "Rajasthan Royals", purse: 10000, squad: [], RTM: 1, isAI: true },
    { shortName: "PBKS", name: "Punjab Kings", purse: 10000, squad: [], RTM: 1, isAI: true },
    { shortName: "SRH", name: "Sunrisers Hyderabad", purse: 10000, squad: [], RTM: 1, isAI: true },
    { shortName: "LSG", name: "Lucknow Super Giants", purse: 10000, squad: [], RTM: 1, isAI: true },
    { shortName: "GT", name: "Gujarat Titans", purse: 10000, squad: [], RTM: 1, isAI: true }
];

async function seedDatabase() {
    try {
        const mongoURI = process.env.MONGO_URI;
        if (!mongoURI) {
            throw new Error("MONGO_URI is not defined in .env file");
        }

        console.log("Connecting to MongoDB Atlas...");
        await mongoose.connect(mongoURI, {
            serverSelectionTimeoutMS: 10000,  // fail fast after 10s
            dbName: 'ipl_auction'             // explicit DB name
        });
        console.log("✅ Connected Successfully.");

        console.log("Clearing existing data...");
        await Player.deleteMany({});
        await Franchise.deleteMany({});
        await BidHistory.deleteMany({});

        console.log("Seeding Players...");
        await Player.insertMany(defaultPlayers);
        
        console.log("Seeding Franchises...");
        await Franchise.insertMany(defaultFranchises);

        console.log("✅ Database Seeded Successfully!");
        process.exit(0);
    } catch (error) {
        console.error("❌ Error seeding database:", error.message);
        if (error.message.includes('ECONNREFUSED') || error.message.includes('timed out') || error.message.includes('Server selection')) {
            console.error("\n💡 FIX: Go to MongoDB Atlas → Network Access → Add IP Address → Allow Access from Anywhere (0.0.0.0/0)");
        }
        process.exit(1);
    }
}

seedDatabase();
