const express = require("express");
const http = require("http");
require("dotenv").config();
const connectDb = require("./database");

const cors = require("cors");

const app = express();
app.use(cors());

app.use(express.json());

const server = http.createServer(app);

const routes = require("./routes/route");

app.get("/", (req, res) => {
  res.send("Bikaner Biscuit API is running ...");
});

app.use("/api", routes);

const startServer = async () => {
  const mongoConnection = await connectDb();

  const PORT = process.env.PORT || 9020;
  const host = process.env.HOST || "localhost";
  server.listen(PORT, () => {
    console.log(`Server running at http://${host}:${PORT}`);
  });
};

startServer();
