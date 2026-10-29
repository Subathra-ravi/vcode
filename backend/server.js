
const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const frontendPath = path.join(__dirname, "../frontend");

app.use(express.static(frontendPath));

app.get("/login.js", (req, res) => {
    res.sendFile(path.join(__dirname, "login.js"));
});

app.get("/dashboard.js", (req, res) => {
    res.sendFile(path.join(__dirname, "dash.js"));
});

app.get("/", (req, res) => {
    res.sendFile(path.join(frontendPath, "login.html"));
});

app.listen(PORT, () => {
    console.log("Probe is running at http://localhost:" + PORT);
});
