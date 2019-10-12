const path = require('path')
const fs = require('fs-extra')

let mainWindow, rootImageFolder

function startDisplay(window, folder) {
    mainWindow = window
    rootImageFolder = folder

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
        console.log("Reloading displayable files.  Count: " + filesForDisplay.length);
    }

    if (filesForDisplay.length == 0) {
        return "";
    }

    const random = (max) => { return Math.floor(Math.random() * max) };
    let nextIndex = random(filesForDisplay.length);
    let nextImage = filesForDisplay[nextIndex];

    console.log("Image selected for display", nextImage);

    filesForDisplay.splice(nextIndex, 1);
    return nextImage;
}


const disallowedExtensions = ["txt"];

function loadDisplayableFiles(folder) {

    let files = fs.readdirSync(folder);
    let usableFiles = [];

    const extension = (filename) => { return (path.extname(filename) || "").toLowerCase().replace(".","") }

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

module.exports = {startDisplay};