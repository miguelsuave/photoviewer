const path = require('path')
const fs = require('fs-extra')
const axios = require('axios')
const electronStore = require('electron-store');
const { pipeline } = require('stream');
const { rename } = require('fs');
//const debug = require('debug')('cache');
const debug = console.log;
const ExifImage = require('exif').ExifImage;
const Jimp = require('jimp')

const MEDIA_INDEX_FILENAME = "media.txt";
var config
var rootImageFolder
var cacheTimeout
var syncDelay
var allowedExtensions


// TODO: the asynchronous nature of JS means this is written all wrong, but it works.
// Come back and fix it later.

function startCache(_rootMediaFolder) {
    config = new electronStore({ cwd: path.join(_rootMediaFolder, 'config'), name: 'config', watch: true })
    config.onDidChange("syncDelay", (newValue) => { setSyncDelay(newValue); })
    config.onDidChange("integrations", (newValue) => { debug("Integration settings changed."); }) // does nothing, but could be good to know if we are trying to sync at the same time
    setSyncDelay(config.get('syncDelay'));
    setAllowedExtensions(config.get('allowedExtensions'));
    rootImageFolder = path.join(_rootMediaFolder, 'images');
    sync();
}

function setAllowedExtensions(_allowedExtensions) {
    // TODO: validate?
    debug(`Setting allowed extensions to ${JSON.stringify(_allowedExtensions)}`);
    allowedExtensions = _allowedExtensions;
}

function setSyncDelay(delay) {
    let parsedDelay = Number.parseFloat(delay);
    let safeDelay = parsedDelay == Number.NaN ? 15 : parsedDelay; // default to syncing every 15 minutes
    debug(`Setting sync delay to ${safeDelay} minutes`);
    syncDelay = safeDelay;
}

function sync() {

    debug("Syncing images with server"); // TODO: say what the source is

    try {
        let fileList = [];

        // make sure we don't have a timeout instance if we are currently executing it
        clearTimeout(cacheTimeout);

        let dropBoxKey;

        if (config.get("integrations.dropbox")) {
            dropBoxKey = config.get("integrations.dropbox.accessToken");
            debug('Configured to sync with Dropbox');
        }

        if (config.get("integrations.amazonPhotos")) {
            // TODO: if Amazon Photos ever opens its API again, make it an integration option 
        }

        if (config.get("integrations.googlePhotos")) {
            // TODO: if Google Photos ever allows photo access, make it an integration option 
        }

        ensureDirectoryExists = (filePath) => {
            let dirName = path.dirname(filePath);
            if (!fs.existsSync(dirName))
                fs.mkdirSync(dirName, { recursive: true })

            return filePath;
        }

        writeFile = () => {
            fs.writeFileSync(ensureDirectoryExists(path.join(rootImageFolder, MEDIA_INDEX_FILENAME)), fileList.join("*"), { encoding: 'utf8' });
        };

        fixImage = (fileName) => {

            return;
            /*
            try {
                new ExifImage({ image: newFileLocation + ".tmp" }, function (error, exifData) {
                    if (error)
                        console.log('Error: ' + error.message);
                    else {
                        console.log("Orientation", exifData.image.Orientation); // Do something with your data!

                        try {
                            Jimp.read(newFileLocation + ".tmp", (err, image) => {

                                switch (exifData.image.Orientation) {
                                    case 1: // we're good!
                                        break;
                                    case 2: // 0 degrees, mirrored
                                        image.flip(true, false);
                                        break;
                                    case 3: // 180 degrees
                                        image.flip(false, true);
                                        break;
                                    case 4: // 180 degrees, mirrored
                                        image.flip(true, true);
                                        break;
                                    case 5: // 90 degrees
                                        image.rotate(90);
                                        break;
                                    case 6: // 90 degrees, mirrored
                                        image.rotate(90).flip(true, false);
                                        break;
                                    case 7: // 270 degrees
                                        image.rotate(270);
                                        break;
                                    case 8: // 270 degrees, mirrored
                                        image.rotate(270).flip(true, false);
                                        break;

                                }

                                image.write(newFileLocation, () => {
                                    fs.removeSync(newFileLocation + ".tmp");
                                });
                            });
                        }
                        catch (erroror) {
                            console.log("More errors", erroror);
                        }

                        Jimp.read(image, (err, lenna) => {
                            if (err) throw err;
        
                            lenna.rotate(90).getBase64(Jimp.MIME_JPEG, (result) => {
                                element.src = result;
                            })
                        });

                    }
                });
            }
            catch (error) {
                //console.log('Error: ' + error.message);
                fs.rename(newFileLocation + ".tmp", newFileLocation);
            }
            */
        }

        downloadFile = (value) => {

            let newFileLocation = path.join(rootImageFolder, ...value.split('/'))

            // TODO:  also check the content hash to see if the file has changed

            // don't download it if it already exists
            if (fs.existsSync(newFileLocation)) {
                return;
            }

            axios.post('https://content.dropboxapi.com/2/files/download', null,
                { responseType: 'stream', headers: { "Content-Type": "text/plain", "Authorization": "Bearer " + dropBoxKey, "Dropbox-API-Arg": JSON.stringify({ "path": value }) }, })
                .then(function (response) {
                    debug("New file synced from server", value);
                    ensureDirectoryExists(newFileLocation);
                    pipeline(response.data, fs.createWriteStream(newFileLocation), () => {
                        fixImage(newFileLocation);
                    });
                })
                .catch(function (error) {
                    debug("Error downloading a file", error);
                })
        }

        cacheFiles = () => {

            // crawl the list of images from the Dropbox account, and save as a text file

            // staggering the download prevents the pipeline buffer from backing up and cutting the image off
            // it's a hack, but it's easier than dealing with the buffer
            staggerDownload = (index) => {
                if (index >= fileList.length)
                    return;

                downloadFile(fileList[index]);

                setTimeout(() => { staggerDownload(++index) }, 1000);
            }

            staggerDownload(0);
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
                        file.indexOf(MEDIA_INDEX_FILENAME) < 0 &&
                        !fileList.includes(file)) {
                        debug("Removing stale file", file)
                        fs.unlinkSync(file);
                    }
                });
            }

            let text = fs.readFileSync(path.join(rootImageFolder, MEDIA_INDEX_FILENAME), { encoding: 'utf8' });
            let fileList = text.split("*");
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
                    debug("No response returned when listing source folder contents");
                }

                response.data.entries.map((value, index, array) => {
                    if (value[".tag"] == 'file' &&
                        value.is_downloadable == true)
                        if (allowedExtensions.includes(extension(value.path_lower)))
                            fileList.push(value.path_lower);
                        else
                            debug(`Skipping ${value.path_lower} because it has an ignored file extension`);
                })

                writeFile();
                cacheFiles();
                cleanCache();
            })
            .catch(function (error) {
                debug("Error syncing the file list from source", error);
            });
    }
    catch (exception) {
        // if something fails, we need to keep running this every second or so until it works
        debug("Error trying to sync", exception);
        cacheTimeout = setTimeout(sync, 5000); // try again in 5 seconds
        return;
    }

    // TODO: so, again, because this is not synchronous, it isn't actually complete when we hit this line
    debug(`Sync process complete. Files may still be downloading.  Will repeat in ${syncDelay} minutes.`)
    cacheTimeout = setTimeout(sync, syncDelay * 1000 * 60); // good!  do it all over again later
}

module.exports = { startCache };