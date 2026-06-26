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

app.get("/", (req, res) => {
  res.send("Bikaner Biscuit API is running ...");
});

app.use("/", routes);

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
      console.log(`\n📚 API Endpoints:`);
      console.log(`   - POST http://${host}:${PORT}/api/auth/login`);
      console.log(`   - GET  http://${host}:${PORT}/api/roles`);
      console.log(`   - GET  http://${host}:${PORT}/api/users`);
      console.log(`   - GET  http://${host}:${PORT}/api/products`);
      console.log(`   - GET  http://${host}:${PORT}/api/categories`);
      console.log(`\n👤 Default Admin Credentials:`);
      console.log(`   Mobile: 9999999999`);
      console.log(`   Password: admin123`);
      console.log(`   ⚠️  Change this password after first login!`);
      console.log(`\n✅ Server is ready to accept requests!`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
