const mongoose = require("mongoose");
const dns = require("dns");

// Fix for Windows: Node.js SRV DNS lookup fails with default resolver.
// Force Google DNS (8.8.8.8) so mongodb+srv:// SRV records resolve correctly.
dns.setDefaultResultOrder("ipv4first");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 10000,
        });
        console.log("✅ MongoDB Connected Successfully");
    } catch (error) {
        console.error("❌ MongoDB Connection Error:", error.message);
        process.exit(1);
    }
};

module.exports = connectDB;