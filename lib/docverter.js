var _ = require("underscore");
var cradle = require("cradle");
var follow = require('follow');
var url = require("url");
var Tempfile = require("temporary/lib/file");
var fs = require("fs");
var path = require("path");
var FormData = require("form-data");

module.exports = WorkerDocverter;

function WorkerDocverter(config) {

	var _config_couch_db = {};
	var _config_docverter = {};

	var formats = {
		markdown: "markdown", 
		md: "markdown"
	};

	var _db = null;

	_config_couch_db = url.parse(config.couchdb.db) || "http://127.0.0.1:5984/example_com";

	// build cradle connection config
	_config_couch_db.db = _config_couch_db.pathname.split("/")[1];
	_config_couch_db.auth = {
		username: _config_couch_db.auth.split(":")[0],
		password: _config_couch_db.auth.split(":")[1]
	};

	_config_docverter = url.parse(config.docverter.api) || "http://localhost:9595/convert";

	// cradle couchdb connection
	_db = new(cradle.Connection)(_config_couch_db, {cache: false}).database(_config_couch_db.db);

	// changes feed, stream (cradle is making use of IrisCouch's 'follow' lib)
	var _feed = new follow.Feed(
		{
			db: _config_couch_db.href,
			include_docs:true
		}
	);

	
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
					doc.worker_status["worker-docverter"] 
					&& doc.worker_status["worker-docverter"].status
					&& doc.worker_status["worker-docverter"].status === "converted"
					&& doc.worker_status["worker-docverter"].revpos
					&& parseInt(doc.worker_status["worker-docverter"].revpos) !== parseInt(doc._rev)-1
				)
			) 
		) {
			return true;
		} else {
			return false;
		}
	};

	_feed.on('change', function (change) {
	    console.log(
	    	"Change seq: " + change.seq 
	    	+ " (doc id: '"+change.doc._id+"', rev: '"+change.doc._rev+"')"
	    );
	    // A Follow feed is a Node.js stream. 
	    // If we get lots of changes (e.g. for initial conversion) 
	    // and Docverter processing them takes a while, 
	    // we'd better use .pause() and .resume(). 
	    // - Pausing guarantees that no new events will fire. 
	    // - Resuming guarantees you'll pick up where you left off.
	    _feed.pause();
	    setTimeout(function() { _feed.resume() }, 1 * 1000); // 1 Sec

		var tmpfile = new Tempfile(change.seq);
		fs.writeFile(tmpfile.path, change.doc.content, 'utf8', function (err) {
			if (err) { throw err; }

			// file created
			var form = new FormData();
			form.append("from", formats[change.doc.content_format]);
			form.append("to", "html");
			form.append("template", "content.html");
			form.append("input_files[]", fs.createReadStream(tmpfile.path));
			form.append("other_files[]", fs.createReadStream(path.join(__dirname, "content.html")));
			
			form.submit({
				method: 'post',
				host: _config_docverter.hostname,
				port: _config_docverter.port,
				path: _config_docverter.pathname
			}, function(err, res) {
				if (err) { console.log(err); }

				// form submitted
				console.log(
					res.statusCode
					+ " - Docverter for '" + formats[change.doc.content_format] + "' to 'html': "
					+ "Change seq " + change.seq 
					+ " (doc id: '"+change.doc._id+"', rev: '"+change.doc._rev+"')"
				);

				res.on("data", function (chunk) {
					if (res.statusCode === 200) {
						_db.merge(change.id, 
							{
								content_html: chunk.toString(),
								worker_status: {
									"worker-docverter": {
										status: "converted",
										revpos: parseInt(change.doc._rev)
									}
								}
							}, function (err, res) {
						    	if(err) { console.log(err); }
							}
						);
					} else {
						console.log("ERROR: " + chunk);
					}
				});

			});
			tmpfile.unlink(); // rm tmp file, in any case...
		});
	});

	_feed.follow();

}