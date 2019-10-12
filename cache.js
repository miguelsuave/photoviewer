const path = require('path')
const fs = require('fs-extra')
const axios = require('axios')

var rootImageFolder
var cacheTimeout
var syncing

// rootFolder is where we read the drop box configuration and where we copy the images to
function startCache(_rootImageFolder) {
    rootImageFolder = _rootImageFolder;
    sync();
}

function init() {
    // clear the timeout that checks our cache, if there is one, and restart it immediately
    if (cacheTimeout) {
        clearTimeout(cacheTimeout);
    }

    sync();
}

function sync() {

    if (syncing)
        return;

    console.log("Syncing images with server");

    syncing = true;

    try {
        let fileList = [];

        // make sure we don't have a timeout instance if we are currently executing it
        clearTimeout(cacheTimeout);

        const config = require("config")

        let dropBoxKey = config.get("access_token");

        ensureDirectoryExists = (filePath) => {
            let dirName = path.dirname(filePath);
            if (!fs.existsSync(dirName))
                fs.mkdirSync(dirName, { recursive: true })
        }

        writeFile = () => {
            // scrape the list of images from the Dropbox account, and save as a text file
            fs.writeFileSync(path.join(rootImageFolder, "media.txt"), fileList.join(","), { encoding: 'utf8' });
        };
        cacheFiles = () => {
            fileList.map((value, index, array) => {

                let newFileLocation = path.join(rootImageFolder, ...value.split('/'))

                // TODO:  also check the content hash to see if the file has changed
                if (fs.existsSync(newFileLocation)) {
                    return;
                }

                axios.post('https://content.dropboxapi.com/2/files/download', null,
                    { responseType: 'stream', headers: { "Content-Type": "text/plain", "Authorization": "Bearer " + dropBoxKey, "Dropbox-API-Arg": JSON.stringify({ "path": value }) }, })
                    .then(function (response) {
                        console.log("New file synced from server", value);
                        ensureDirectoryExists(newFileLocation);
                        response.data.pipe(fs.createWriteStream(newFileLocation));
                    })
                    .catch(function (error) {
                        console.log("Error downloading a file", error);
                    })
            })
        };

        const ignoredExtensions = ["txt"];
        const extension = (filename) => { return (path.extname(filename) || "").toLowerCase().replace(".", "") }

        cleanCache = () => {
            _cleanCache = (fileList, folder) => {

                let files = fs.readdirSync(folder);
                files.map((file, index, array) => {
                    file = path.join(folder, file);

                    let stat = fs.statSync(file);

                    // if it's a directory, go deep, then delete ourselves if we are now empty
                    if (stat.isDirectory()) {
                        _cleanCache(fileList, file);
                        let childFiles = fs.readdirSync(file);
                        if (childFiles.length == 0) {
                            console.log("Removing empty folder", file)
                            fs.rmdirSync(file, { emfileWait: 2000, maxBusyTries: 5, recursive: true });
                        }
                    }
                    else if (stat.isFile() &&
                        !ignoredExtensions.includes(extension(file)) &&
                        !fileList.includes(file)) {
                        console.log("Removing stale file", file)
                        fs.unlinkSync(file);
                    }
                });
            }

            let text = fs.readFileSync(path.join(rootImageFolder, "media.txt"), { encoding: 'utf8' });
            let fileList = text.split(",");
            let localizedFileList = [];
            fileList.map((file, index, array) => {
                localizedFileList.push(path.join(rootImageFolder, ...file.split("/")));
            });

            _cleanCache(localizedFileList, rootImageFolder);
        }

        // make sure we can connect to the Dropbox API
        axios.post('https://api.dropboxapi.com/2/files/list_folder',
            { path: "", recursive: true },
            { contentType: 'application/json', headers: { "Authorization": "Bearer " + dropBoxKey }, })
            .then(function (response) {
                if (!response.data) {
                    return;
                }

                response.data.entries.map((value, index, array) => {
                    if (value[".tag"] == 'file' &&
                        value.is_downloadable == true)
                        if (!ignoredExtensions.includes(extension(value.path_lower)))
                            fileList.push(value.path_lower);
                })

                writeFile();
                cacheFiles();
                cleanCache();
            });
    }
    catch (exception) {
        // if something fails, we need to keep running this every second or so until it works
        console.log("Error trying to sync", exception);
        syncing = false;
        cacheTimeout = setTimeout(sync, 5000); // try again in 5 seconds
        return;
    }

    syncing = false;
    cacheTimeout = setTimeout(sync, 15000 * 1000); // good!  do it all over again in 15 minutes
}

module.exports = { startCache, init };