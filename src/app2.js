// const express = require("express");
// const routes = require("./routes");
// const dotenv = require("dotenv");
// const cors = require("cors");
// const mongoose = require("mongoose");
// const UserService = require("./services/user-service");
// const uploadUserRoutes = require("./routes/uploadUser.routes");
// app.use("/api/upload-users", uploadUserRoutes);
// app.use(express.static(path.join(__dirname, "public")));

// dotenv.config();

// const DB_URI = process.env.MONGO_URI || "mongodb+srv://HRMS:dbHRMS02@cluster0.b3zzpjd.mongodb.net/hrmsdb?retryWrites=true&w=majority&appName=Cluster0";

// // Connect to MongoDB Atlas
// mongoose.connect(process.env.MONGO_URI, {
//   useNewUrlParser: true,
//   useUnifiedTopology: true,
//   tls: true,
//   serverSelectionTimeoutMS: 30000,
//   socketTimeoutMS: 45000,
// });


// mongoose.connection.on("connected", () => {
//   console.log("✅ Mongoose connected to DB");

//   // Load cron jobs only after DB connection
//   require("./corn/attendance.cron");
//   require("./corn/autoMarkAbsent.cron");

//   // Start server only after DB is ready
//   startServer();
// });

// mongoose.connection.on("error", (err) => {
//   console.error("❌ Mongoose connection error:", err);
// });

// mongoose.connection.on("disconnected", () => {
//   console.log("⚠️ Mongoose disconnected");
// });

// // -------------------
// // Start Express Server
// // -------------------
// function startServer() {
//   const app = express();

//   app.use(cors());
//   app.use(express.json());
//   app.use(express.urlencoded({ extended: true }));

//   // Init services AFTER DB connection
//   let userService = new UserService();
//   userService.init();

//   app.use(routes);

//   app.get("/", (req, res) => {
//     res.send("Test app");
//   });

//   const PORT = process.env.PORT || 8080;
//   app.listen(PORT, () => console.log(`🚀 Server running on port: ${PORT}`));
// }


const express = require("express");
const dotenv = require("dotenv");
const path = require("path");
const cors = require("cors");
const mongoose = require("mongoose");

dotenv.config();

const app = express();

// --------------------
// Middlewares
// --------------------
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// --------------------
// MongoDB Connection
// --------------------
mongoose.connect(process.env.MONGO_URI, {
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 45000,
});

mongoose.connection.on("connected", () => {
  console.log("✅ Mongoose connected to HRMS database");
});

mongoose.connection.on("error", (err) => {
  console.error("❌ Mongoose connection error:", err);
});

mongoose.connection.on("disconnected", () => {
  console.log("⚠️ Mongoose disconnected");
});

// --------------------
// CRON Jobs (AFTER DB)
// --------------------
require("./corn/attendance.cron");
require("./corn/autoMarkAbsent.cron");

// --------------------
// Routes & Services
// --------------------
const routes = require("./routes");
const UserService = require("./services/user-service");

let userService = new UserService();
userService.init();

app.use(routes);

// --------------------
// Default Route
// --------------------
app.get("/", (req, res) => {
  res.send("HRMS API is running");
});

// --------------------
// Server Start
// --------------------
const PORT = process.env.PORT || 8080;
app.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT}`)
);
