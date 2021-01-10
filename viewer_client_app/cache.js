const path = require('path')
const fs = require('fs-extra')
const axios = require('axios')
const electronStore = require('electron-store');
const debug = require('debug')('cache');

const MEDIA_INDEX_FILENAME = "media.txt";
var config
var rootImageFolder
var cacheTimeout
var syncing
var syncDelay
var allowedExtensions

function startCache(_rootMediaFolder) {
    config = new electronStore({ cwd: path.join(_rootMediaFolder, 'config'), name: 'config', watch: true })
    config.onDidChange("syncDelay", (newValue) => { setSyncDelay(newValue); })
    config.onDidChange("integrations", (newValue) => { debug("Integration settings changed."); }) // does nothing, but could be good to know if we are trying to sync at the same time
    setSyncDelay(config.get('syncDelay'));
    setAllowedExtensions(config.get('allowedExtensions'));
    rootImageFolder = path.join(_rootMediaFolder, 'images');
    sync();
}

function setAllowedExtensions(_allowedExtensions){
    // TODO: validate?
    debug(`Setting allowed extensions to ${JSON.stringify(_allowedExtensions)}`);
    allowedExtensions = _allowedExtensions;
}

function setSyncDelay(delay){
    let parsedDelay = Number.parseFloat(delay);
    let safeDelay = parsedDelay == Number.NaN ? 15 : parsedDelay; // default to syncing every 15 minutes
    debug(`Setting sync delay to ${safeDelay} minutes`);
    syncDelay = safeDelay;
}

/*
function init() {
    // clear the timeout that checks our cache, if there is one, and restart it immediately
    if (cacheTimeout) {
        clearTimeout(cacheTimeout);
    }

    sync();
}
*/

function sync() {

    if (syncing)
        return;

    debug("Syncing images with server"); // TODO: say what the source is

    syncing = true;

    try {
        let fileList = [];

        // make sure we don't have a timeout instance if we are currently executing it
        clearTimeout(cacheTimeout);

        let dropBoxKey;

        if( config.get("integrations.dropbox") ){
            dropBoxKey = config.get("integrations.dropbox.accessToken");
            debug('dropboxkey', dropBoxKey);
        }

        if( config.get("integrations.amazonPhotos")) {
            // TODO: if Amazon Photos ever opens its API again, make it an integration option 
        }

        if( config.get("integrations.googlePhotos")) {
            // TODO: if Google Photos ever allows photo access, make it an integration option 
        }

        ensureDirectoryExists = (filePath) => {
            let dirName = path.dirname(filePath);
            if (!fs.existsSync(dirName))
                fs.mkdirSync(dirName, { recursive: true })

            return filePath;
        }

        writeFile = () => {
            fs.writeFileSync(ensureDirectoryExists(path.join(rootImageFolder, MEDIA_INDEX_FILENAME)), fileList.join(","), { encoding: 'utf8' });
        };
            
        cacheFiles = () => {

            // crawl the list of images from the Dropbox account, and save as a text file

            let newImagesDownloaded

            fileList.map((value, index, array) => {

                let newFileLocation = path.join(rootImageFolder, ...value.split('/'))

                // TODO:  also check the content hash to see if the file has changed
                if (fs.existsSync(newFileLocation)) {
                    return;
                }

                axios.post('https://content.dropboxapi.com/2/files/download', null,
                    { responseType: 'stream', headers: { "Content-Type": "text/plain", "Authorization": "Bearer " + dropBoxKey, "Dropbox-API-Arg": JSON.stringify({ "path": value }) }, })
                    .then(function (response) {
                        debug("New file synced from server", value);
                        ensureDirectoryExists(newFileLocation);
                        response.data.pipe(fs.createWriteStream(newFileLocation));
                    })
                    .catch(function (error) {
                        debug("Error downloading a file", error);
                    })
            })
        };

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
                            debug("Removing empty folder", file)
                            fs.rmdirSync(file, { emfileWait: 2000, maxBusyTries: 5, recursive: true });
                        }
                    }
                    else if (stat.isFile() &&
                        file != MEDIA_INDEX_FILENAME && 
                        !fileList.includes(file)) {
                        debug("Removing stale file", file)
                        fs.unlinkSync(file);
                    }
                });
            }

            let text = fs.readFileSync(path.join(rootImageFolder, MEDIA_INDEX_FILENAME), { encoding: 'utf8' });
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
            })
            .catch(function(error){
                console.log("error", error.data);
            });
    }
    catch (exception) {
        // if something fails, we need to keep running this every second or so until it works
        debug("Error trying to sync", exception);
        syncing = false;
        cacheTimeout = setTimeout(sync, 5000); // try again in 5 seconds
        return;
    }

    syncing = false;
    debug(`Sync process complete. Files may still be downloading.  Will repeat in ${syncDelay} minutes.`)
    cacheTimeout = setTimeout(sync, syncDelay * 1000 * 60); // good!  do it all over again later
}

module.exports = { startCache, /*init*/ };