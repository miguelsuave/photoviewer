/* eslint-disable no-undef */
var express = require('express');
var chalk = require('chalk');
var debug = require('debug')('app');
var morgan = require('morgan');
var path = require('path');
var axios = require('axios');
var qs = require('querystring');
var conf = require('conf');

var app = express();

const port = process.env.PORT || 3000;

app.use(morgan('tiny'));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/css', express.static(path.join(__dirname, 'node_modules', 'bootstrap', 'dist', 'css')));
app.use('/js', express.static(path.join(__dirname, 'node_modules', 'bootstrap', 'dist', 'js')));
app.use('/js', express.static(path.join(__dirname, 'node_modules', 'jquery', 'dist')));
app.set('views', './src/views');
app.set('view engine', 'ejs');

// set up configuration files
var rootConfigFile = "config";
if (process.env["DEVELOPMENT"]) {
	rootConfigFile = "config-dev";
}
let rootConfig = new conf({ cwd: __dirname, configName: rootConfigFile });
let pathToMediaFolder = rootConfig.get('mediaLocation');
let pathToCredentialsFolder = rootConfig.get('credentialsLocation');

// normalize the paths for the environment
pathToMediaFolder = path.join(...pathToMediaFolder.split('/'))
pathToCredentialsFolder = path.join(...pathToCredentialsFolder.split('/'))

debug("root config file location", rootConfig.path);

if (!path.isAbsolute(pathToMediaFolder)) {
	pathToMediaFolder = path.join(__dirname, pathToMediaFolder);
}

if (!path.isAbsolute(pathToCredentialsFolder)) {
	pathToCredentialsFolder = path.join(__dirname, pathToCredentialsFolder);
}

debug("path to media folder", pathToMediaFolder);
debug("path to credentials folder", pathToCredentialsFolder);
let mediaConfig = new conf({ cwd: path.join(pathToMediaFolder, 'config'), configName: 'config' });
let credentialsConfig = new conf({ cwd: path.join(pathToCredentialsFolder), configName: 'credentials' });
debug("media config file location", mediaConfig.path);
debug("credentials config file location", credentialsConfig.path);

let clientId = credentialsConfig.get("integrations.dropbox.clientId");
let clientSecret = credentialsConfig.get("integrations.dropbox.clientSecret");
let redirectUri = credentialsConfig.get("integrations.dropbox.redirectUri");

app.get('/', function (req, res) {
	res.render('index', { isConnectedToDropbox: true });
})

app.get('/source', function (req, res) {
	res.render('source', { clientId, redirectUri });
})

app.get('/updates', function (req, res) {
	res.render('updates', {});
})

app.get('/settings', function (req, res) {
	res.render('settings', {});
})

app.get('/auth', function (req, res) {

	debug(`Got back this auth code${req.query.code}`);

	const requestBody = {
		code: req.query.code,
		grant_type: 'authorization_code',
		client_id: clientId,
		client_secret: clientSecret,
		redirect_uri: redirectUri
	};

	const reqConfig = {
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded'
		}
	}

	axios.post('https://api.dropboxapi.com/oauth2/token', qs.stringify(requestBody), reqConfig)
		.then((response) => {
			debug("Success retrieving access token", response.data.access_token);
			mediaConfig.set("integrations.dropbox.accessToken", response.data.access_token)

			res.render('auth', { title: "Success!", message: "You are now connected to Dropbox.  Your photo viewer will display images and videos in this Dropbox folder:", details: "Apps / Shared Photo Viewer" });
		})
		.catch((error) => {
			debug("Error trying to retrieve token", error.response);
			res.render('auth', { title: "Uh oh!", message: "There was a problem connecting to Dropbox.  The error they gave is:", details: error.response.data.error_description });
		});

})

app.listen(port, function () {
	debug(`Listening on port ${chalk.green(port)}`);
});