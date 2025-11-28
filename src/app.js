const express = require("express");
const routes = require("./routes");
const dotenv = require("dotenv");
const path = require("path");
require("./corn/attendance.cron"); // Add this after mongoose connection
require("./corn/autoMarkAbsent.cron");

dotenv.config();
const app = express();
const cors = require("cors");
const UserService = require("./services/user-service");
app.use(express.static(path.join(__dirname, "public")));

const mongoose = require("mongoose");

const DB_URI = "mongodb://127.0.0.1:27017/hrms";

mongoose.connect(DB_URI, {
  serverSelectionTimeoutMS: 30000, // 30 seconds
  socketTimeoutMS: 45000, // 45 seconds
});

mongoose.connection.on("connected", () => {
  console.log("Mongoose connected to DB");
});

mongoose.connection.on("error", (err) => {
  console.error("Mongoose connection error:", err);
});

mongoose.connection.on("disconnected", () => {
  console.log("Mongoose disconnected");
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let userService = new UserService();
userService.init();


app.use(routes);

app.get("/", (req, res, next) => {
  res.send("Test app");
});
app.listen(8080, () => console.log("Server running on port:8080"));
