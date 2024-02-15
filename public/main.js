const { app, BrowserWindow, ipcMain } = require("electron");
const isDev = require("electron-is-dev");
const path = require("path");
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const ip = require("ip");
const config = require("../src/utilities/config");
require("@electron/remote/main").initialize();

function createWindow() {

    const server = express();
    server.use(cors());
    server.use(bodyParser.json());
    server.use("/", require("./src/controllers/base"));
    server.use("/config", require("./src/controllers/config"));
    const host = server.listen(0, () => {
        ipcMain.handle("serverAddress", () => `http://${ip.address()}:${host.address().port}/`);
    });

    const win = new BrowserWindow({
        width: 1300,
        height: 800,
        minWidth: 1300,
        minHeight: 700,
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
            webSecurity: false,
        },
    });
    require("@electron/remote/main").enable(win.webContents);
    win.loadURL(isDev ? "http://localhost:3000" : `file://${path.join(__dirname, "../build/index.html")}`);
    if (isDev) win.webContents.openDevTools({ mode: "detach" });
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});