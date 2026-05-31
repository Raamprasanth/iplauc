const xlsx = require('xlsx');

// Define the exact headers that match the PlayerSchema requirements
const headers = [
    "ID", 
    "Name", 
    "Role (BAT/BOWL/AR/WK)", 
    "Rating (0-100)", 
    "Nationality (Indian/Overseas)", 
    "Base Price (Lakhs)", 
    "Description", 
    "Matches", 
    "Runs", 
    "Average", 
    "Strike Rate", 
    "Wickets", 
    "Economy"
];

// Provide a few examples so the user knows how to fill it out
const examples = [
    [1, "Rishabh Pant", "WK", 95, "Indian", 200, "Explosive Left-hand Keeper-Batter", 111, 3284, 35.3, 148.9, 0, 0],
    [2, "Pat Cummins", "AR", 96, "Overseas", 200, "World Cup Winning Skipper", 58, 512, 18.5, 140.2, 63, 8.45],
    [3, "Jasprit Bumrah", "BOWL", 98, "Indian", 200, "Lethal Death-Over Bowler", 133, 60, 5.2, 85.0, 165, 7.30],
    [4, "Shubman Gill", "BAT", 94, "Indian", 200, "Elegant Top Order Batsman", 103, 3216, 37.8, 135.2, 0, 0],
];

// Create empty rows for them to fill
const emptyRows = Array.from({ length: 150 }, (_, i) => [i + 5, "", "", "", "", "", "", "", "", "", "", "", ""]);

const data = [headers, ...examples, ...emptyRows];

const wb = xlsx.utils.book_new();
const ws = xlsx.utils.aoa_to_sheet(data);

// Adjust column widths for neatness
ws['!cols'] = [
    { wch: 5 },  // ID
    { wch: 25 }, // Name
    { wch: 22 }, // Role
    { wch: 15 }, // Rating
    { wch: 25 }, // Nationality
    { wch: 18 }, // Base Price
    { wch: 45 }, // Description
    { wch: 10 }, // Matches
    { wch: 10 }, // Runs
    { wch: 10 }, // Average
    { wch: 12 }, // Strike Rate
    { wch: 10 }, // Wickets
    { wch: 10 }  // Economy
];

xlsx.utils.book_append_sheet(wb, ws, "IPL Players");
xlsx.writeFile(wb, "IPL_Auction_Template.xlsx");

console.log("Template generated at IPL_Auction_Template.xlsx");
