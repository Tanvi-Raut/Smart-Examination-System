const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const os = require("os");
const path = require("path");
const fs = require("fs");
const connectDB = require("./config/db");

dotenv.config();

const app = express();

// Connect MongoDB
connectDB();

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Enable CORS for localhost and local network devices (tablets, phones, laptops)
app.use(cors({
    origin: true,
    credentials: true
}));

app.use("/uploads", express.static("uploads"));

// System network & offline status inspection endpoint
app.get("/api/system/network-info", (req, res) => {
    const interfaces = os.networkInterfaces();
    const addresses = [];

    for (const name of Object.keys(interfaces)) {
        for (const net of interfaces[name]) {
            // Skip over non-IPv4 and internal/loopback addresses
            if (net.family === 'IPv4' && !net.internal) {
                addresses.push({
                    interface: name,
                    address: net.address,
                    netmask: net.netmask,
                    mac: net.mac
                });
            }
        }
    }

    res.json({
        status: "online",
        hostname: os.hostname(),
        platform: os.platform(),
        port: process.env.PORT || 5000,
        localAddresses: addresses,
        isOfflineLanReady: true,
        message: "Campus Local Intranet Server is operational"
    });
});

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/branches", require("./routes/branchRoutes"));
app.use("/api/exams", require("./routes/examRoutes"));
app.use("/api/halls", require("./routes/hallRoutes"));
app.use("/api/students", require("./routes/studentRoutes"));
app.use("/api/subjects", require("./routes/subjectRoutes"));
app.use("/api/allocations", require("./routes/allocationRoutes"));
app.use("/api/attendance", require("./routes/attendanceRoutes"));

// Serve static client PWA bundle in production or local offline campus mode
const clientDist = path.join(__dirname, "../client/dist");
if (fs.existsSync(clientDist)) {
    console.log(`[Server] Serving production PWA client from ${clientDist}`);
    app.use(express.static(clientDist));
    app.use((req, res, next) => {
        if (req.method === "GET" && !req.path.startsWith("/api") && !req.path.startsWith("/uploads")) {
            return res.sendFile(path.join(clientDist, "index.html"));
        }
        next();
    });
} else {
    app.get("/", (req, res) => {
        res.send("Smart Examination Management API Server is running");
    });
}

const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
    const interfaces = os.networkInterfaces();
    const lanIPs = [];

    for (const name of Object.keys(interfaces)) {
        for (const net of interfaces[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                lanIPs.push(`http://${net.address}:${PORT}`);
            }
        }
    }

    console.log("====================================================================");
    console.log("🎓 Smart Examination Management Server (Offline LAN & Jammer Ready)");
    console.log("====================================================================");
    console.log(`• Localhost:       http://localhost:${PORT}`);
    if (lanIPs.length > 0) {
        lanIPs.forEach(ip => console.log(`• Campus Intranet: ${ip}`));
    }
    console.log("📡 Listening on all IPv4 interfaces (0.0.0.0)");
    console.log("🛡️ College intranet devices can access this server without active WAN!");
    console.log("====================================================================");
});