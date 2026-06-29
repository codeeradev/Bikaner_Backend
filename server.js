const express = require("express");
const http = require("http");
const path = require("path");
require("dotenv").config();
const connectDb = require("./database");
const { seedRoles } = require("./utils/seedRoles");

const cors = require("cors");

const app = express();
app.use(cors());

app.use(express.json());

// Serve static files from assets directory
app.use('/assets', express.static(path.join(__dirname, 'assets')));

const server = http.createServer(app);

const routes = require("./routes/route");
const appRoutes = require("./routes/appRoute");
app.get("/", (req, res) => {
  res.send("Bikaner Biscuit API is running ...");
});

app.use("/", routes);
app.use("/api", appRoutes);

const startServer = async () => {
  try {
    // Connect to database
    const mongoConnection = await connectDb();
    console.log("✅ Database connected successfully");

    // Seed roles and admin user if not exists
    console.log("\n📦 Checking database setup...");
    await seedRoles();

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
