const path = require('path')
const fs = require('fs-extra')
const debug = require('debug')('display')

let mainWindow, rootImageFolder, isWideScreen

function startDisplay(window, folder) {
    // TODO: allow the user to set how quickly they rotate
    // TODO: handle 4:3 aspect ratio screens
    mainWindow = window
    rootImageFolder = folder

    let aspectRatio = mainWindow.getBounds().width / mainWindow.getBounds().height;
    isWideScreen = aspectRatio > 1.4;

    setTimeout(() => { swapMedia(nextImage()) }, 1000);
    setTimeout(() => { swapMedia(nextImage()) }, 1000);
    setTimeout(() => { swapMedia(nextImage()) }, 1000);
    setTimeout(() => { swapMedia(nextImage()) }, 1000);
    setTimeout(() => { setInterval(() => { swapMedia(nextImage()) }, 10000) }, 9000);
}

let filesForDisplay = [];

function nextImage() {
    if (filesForDisplay.length == 0) {
        filesForDisplay = loadDisplayableFiles(rootImageFolder);
        debug("Reloading displayable files.  Count: " + filesForDisplay.length);
    }

    if (filesForDisplay.length == 0) {
        return "";
    }

    const random = (max) => { return Math.floor(Math.random() * max) };
    let nextIndex = random(filesForDisplay.length);
    let nextSelectedImage = filesForDisplay[nextIndex];

    debug("Image selected for display", nextSelectedImage);

    filesForDisplay.splice(nextIndex, 1);

    // this is for when the available files is changed
    // during syncing but the display doesn't know about it yet
    if (!fs.existsSync(nextSelectedImage)) {
        return nextImage();
    }

    return nextSelectedImage;
}


const disallowedExtensions = ["txt"];

function loadDisplayableFiles(folder) {

    let files = fs.readdirSync(folder);
    let usableFiles = [];

    const extension = (filename) => { return (path.extname(filename) || "").toLowerCase().replace(".", "") }

    for (let i = 0; i < files.length; i++) {
        let fullPath = path.join(folder, files[i]);
        let stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            usableFiles = usableFiles.concat(loadDisplayableFiles(fullPath));
        }
        else if (!disallowedExtensions.includes(extension(files[i]))) {
            usableFiles.push(fullPath);
        }
    }

    return usableFiles;
}

function swapMedia(path) {
    mainWindow.webContents.send('next', { image: path })
}

module.exports = { startDisplay };