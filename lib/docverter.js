var _ = require("underscore");
var cradle = require("cradle");
var url = require("url");

module.exports = WorkerDocverter;

function WorkerDocverter(config) {

	var _config_couch = {};
	var _config_couch_db = "";
	var _config_docverter = {};

	var formats = {
		markdown: "markdown", 
		md: "markdown"
	};

	var _db = null;

	_couch_config = url.parse(config.couchdb.server) || "http://127.0.0.1:5984";
	_config_couch_db = config.couchdb.db || "example_com";
	_couch_config.auth = {
		username: config.couchdb.admin_user,
		password: config.couchdb.admin_pass
	};

	_config_docverter = url.parse(config.docverter.api) || "http://localhost:9595/convert";

	// couchdb connection
	_db = new(cradle.Connection)(_couch_config, {cache: false}).database(_config_couch_db);

	// changes feed, stream (cradle is making use of IrisCouch's 'follow' lib)
	var _feed = _db.changes({include_docs:true});

	
	// apply filter to changes feed
	_feed.filter = function(doc, req) {
		// filter for docs with 'content' and content_format' fields
		if(doc.content && doc.content_format 
			// ... and valid (supported) source format value 
			&& _.any(
				_.keys(formats), function(format) { 
					return format === doc.content_format; 
				}
			)
			// ... ignore if we already processed that doc._rev
			&& (
				!doc.worker_status 
				|| (
					doc.worker_status['worker-docverter'] 
					&& doc.worker_status['worker-docverter'].status
					&& doc.worker_status['worker-docverter'].status === "converted"
					&& doc.worker_status['worker-docverter'].revpos
					&& parseInt(doc.worker_status['worker-docverter'].revpos) !== parseInt(doc._rev)-1
				)
			) 
		) {
			return true;
		} else {
			return false;
		}
	}

	_feed.on('change', function (change) {
	    console.log(
	    	"Change seq: " + change.seq 
	    	+ " (doc id: '"+change.doc._id+"', rev: '"+change.doc._rev+"')"
	    );
		_db.merge(change.id, 
			{
				content_html: '<html/>'+change.seq,
				worker_status: {
					"worker-docverter": {
						status: "converted",
						revpos: parseInt(change.doc._rev)
					}
				}
			}, function (err, res) {
		      // Handle response
		      if(err) console.log(err);
			}
		);
	});

}