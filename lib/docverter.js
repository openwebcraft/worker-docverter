var _ = require("underscore");
var cradle = require("cradle");
var url = require("url");

module.exports = WorkerDocverter;

function WorkerDocverter(config) {

	var _config_couch = {};
	var _config_couch_db = "";
	var _config_docverter = {};

	var _db = null;

	_couch_config = url.parse(config.couchdb.server) || "http://127.0.0.1:5984";
	_config_couch_db = config.couchdb.db || "example_com";
	_couch_config.auth = {
		username: config.couchdb.admin_user,
		password: config.couchdb.admin_pass
	};

	_config_docverter = url.parse(config.docverter.api) || "http://localhost:9595/convert";

	// couchdb connection
	_db = new(cradle.Connection)(_couch_config).database(_config_couch_db);

	var _feed = _db.changes({});

	_feed.on('change', function (change) {
	    console.log(change);
	});

}