const express = require("express");
const routes = require("./routes");
const dotenv = require("dotenv");
const cors = require("cors");
const mongoose = require("mongoose");
const UserService = require("./services/user-service");

dotenv.config();

const DB_URI = process.env.MONGO_URI || "mongodb+srv://HRMS:dbHRMS02@cluster0.b3zzpjd.mongodb.net/hrmsdb?retryWrites=true&w=majority&appName=Cluster0";

// Connect to MongoDB Atlas
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  tls: true,
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 45000,
});


mongoose.connection.on("connected", () => {
  console.log("✅ Mongoose connected to DB");

  // Load cron jobs only after DB connection
  require("./corn/attendance.cron");
  require("./corn/autoMarkAbsent.cron");

  // Start server only after DB is ready
  startServer();
});

mongoose.connection.on("error", (err) => {
  console.error("❌ Mongoose connection error:", err);
});

mongoose.connection.on("disconnected", () => {
  console.log("⚠️ Mongoose disconnected");
});

// -------------------
// Start Express Server
// -------------------
function startServer() {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Init services AFTER DB connection
  let userService = new UserService();
  userService.init();

  app.use(routes);

  app.get("/", (req, res) => {
    res.send("Test app");
  });

  const PORT = process.env.PORT || 8081;
  app.listen(PORT, () => console.log(`🚀 Server running on port: ${PORT}`));
}
