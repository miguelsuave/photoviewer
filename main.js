// Modules to control application life and create native browser window
const electron = require('electron')
const { app, BrowserWindow } = electron
const path = require('path')
const { startDisplay } = require('./display')
const { startCache } = require('./cache')
const { startServer } = require('./web-server')
let rootFolder = ""

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow

function createWindow() {

  console.log(startDisplay);

  // Create the browser window.
  mainWindow = new BrowserWindow({
    fullscreen: true,
    //width: 800,
    //height: 600,
    frame: false,
    webPreferences: {
      nodeIntegration: true,
      devTools: true
    }
  })

  process.env["NODE_CONFIG_DIR"] = app.getAppPath();
  var config = require('config')
  
  rootFolder = config.get("mediaLocation");
  delete require.cache[require.resolve('config')]; // clear and reload the config from both places
  process.env["NODE_CONFIG_DIR"] = app.getAppPath() + path.delimiter + path.join(rootFolder, "config");
  let rootImageFolder = path.join(rootFolder, "images")
  
  startCache(rootImageFolder);
  startDisplay(mainWindow, rootImageFolder);
  startServer();

  mainWindow.loadFile('index.html')
  // uncomment if you want the dev tools to show on load
  //mainWindow.webContents.openDevTools();
  mainWindow.on('closed', function () {
    mainWindow = null
  })
}

app.on("preload", () => {

  startServer(rootFolder)
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', function () {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) createWindow()
})