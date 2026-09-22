const express = require("express");
const http = require("http");
const path = require("path");
require("dotenv").config();
const connectDb = require("./database");
const { seedRoles } = require("./utils/seedRoles");
const { seedUsers } = require("./utils/seedUsers");

const cors = require("cors");

const app = express();
app.use(cors());

app.use(express.json());

// Serve static files from assets directory
app.use('/assets', express.static(path.join(__dirname, 'assets')));

const server = http.createServer(app);

const routes = require("./routes/route");
const appRoutes = require("./routes/appRoute");
const franchiseAppRoute = require("./routes/franchiseAppRoute");

app.get("/", (req, res) => {
  res.send("Bikaner Biscuit API is running ...");
});

app.use("/", routes);
app.use("/api", appRoutes);
app.use("/franchise", franchiseAppRoute);

const startServer = async () => {
  try {
    // Connect to database
    const mongoConnection = await connectDb();
    console.log("✅ Database connected successfully");

    // Seed roles and admin user if not exists
    console.log("\n📦 Checking database setup...");
    await seedRoles();
    // Ensure an admin exists on a fresh database; never modifies existing users
    await seedUsers({ onlyMissing: true, only: ["admin"] });

    // Start server
    const PORT = process.env.PORT || 9020;
    const host = process.env.HOST || "localhost";
    
    server.listen(PORT, () => {
      console.log(`\n🚀 Server running at http://${host}:${PORT}`);
      console.log(`\n✅ Server is ready to accept requests!`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
