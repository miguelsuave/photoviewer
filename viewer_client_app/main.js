// Modules to control application life and create native browser window
const electron = require('electron')
const { app, BrowserWindow } = electron
const path = require('path')
const { startDisplay } = require('./display')
const { startCache } = require('./cache')
const electronStore = require('electron-store');

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow

function createWindow() {

  // Create the browser window.
  mainWindow = new BrowserWindow({
    //fullscreen: true,
    frame: false,
    show: false,
    height: 1200,
    width: 2133,
    webPreferences: {
      nodeIntegration: true,
      devTools: true
    }
  })

  let rootConfigFile = "config";

  if( process.env["DEVELOPMENT"] ){
    rootConfigFile = "config-dev";
  }
  
  let rootConfig = new electronStore({cwd: app.getAppPath(), name: rootConfigFile})
  let pathToMediaFolderConfig = rootConfig.get('mediaLocation');
  pathToMediaFolder = path.join(...pathToMediaFolderConfig.split("/"));
  
  if( pathToMediaFolderConfig.startsWith("/") ) {
    pathToMediaFolder = "/" + pathToMediaFolder;
  }

  if( !path.isAbsolute(pathToMediaFolder) ){
    pathToMediaFolder = path.join(app.getAppPath(), pathToMediaFolder);
  }

  startCache(pathToMediaFolder);
  startDisplay(mainWindow, path.join(pathToMediaFolder, 'images'));

  mainWindow.webContents.on('did-finish-load', function(){
    setTimeout(function(){
      mainWindow.show();
    }, 50);
  });

  mainWindow.loadFile('index.html')

  // uncomment if you want the dev tools to show on load
  // mainWindow.webContents.openDevTools();
  mainWindow.on('closed', function () {
    mainWindow = null
  })
}

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