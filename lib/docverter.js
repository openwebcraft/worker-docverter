var _ = require("underscore");
var nano = require("nano");
var url = require("url");
var Tempfile = require("temporary/lib/file");
var fs = require("fs");
var path = require("path");
var FormData = require("form-data");

module.exports = WorkerDocverter;

function WorkerDocverter(config) {

	var formats = {
		markdown: "markdown", 
		md: "markdown",
		textile: "textile"
	};

	var couchdb = url.parse(config.couchdb.db) || "http://127.0.0.1:5984/example_com";

	var docverter = url.parse(config.docverter.api) || "http://127.0.0.1:9595/convert";

	// nano couchdb connection
	var db = nano(couchdb.href);	

	// nano uses https://github.com/iriscouch/follow to create a solid changes feed
	var feed = new db.follow({since: "now", include_docs:true});
	
	// apply filter to changes feed
	feed.filter = function(doc, req) {
		// filter for docs with 'content' and content_format' fields
		if(doc.content && doc.content_format 
			// ... and valid (aka supported) source format value 
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

	feed.on('change', function (change) {
	    console.log("Change seq: " + change.seq 
	    			+ " (doc id: '" + change.doc._id
	    			+ "', rev: '" + change.doc._rev + "')"
	    );
	    // A Follow feed is a Node.js stream. 
	    // If we get lots of changes (e.g. for initial conversion) 
	    // and Docverter processing them takes a while, 
	    // we'd better use .pause() and .resume(). 
	    // - Pausing guarantees that no new events will fire. 
	    // - Resuming guarantees you'll pick up where you left off.
	    feed.pause();

		var tmpfile = new Tempfile(change.seq);
		fs.writeFile(tmpfile.path, change.doc.content, 'utf8', function (err) {
			if (err) { 
				tmpfile.unlink(); // rm tmp file
				feed.resume(); // resume changes feed 
				throw err; 
			}

			// file created
			var form = new FormData();
			form.append("from", formats[change.doc.content_format]);
			form.append("to", "html");
			form.append("template", "content.html");
			form.append("input_files[]", fs.createReadStream(tmpfile.path));
			form.append("other_files[]", fs.createReadStream(path.join(__dirname, "content.html")));
			
			form.submit({
				method: 'post',
				host: docverter.hostname,
				port: docverter.port,
				path: docverter.pathname
				}, function(err, res) {

					tmpfile.unlink(); // rm tmp file
					feed.resume(); // resume changes feed

					if (err) { 
						console.log(err); 
					} else {

						// form submitted
						console.log(
							res.statusCode
							+ " - Docverter for '" + formats[change.doc.content_format] + "' to 'html': "
							+ "Change seq " + change.seq 
							+ " (doc id: '"+change.doc._id+"', rev: '"+change.doc._rev+"')"
						);
		
						res.on("data", function (chunk) {
							if (res.statusCode === 200) {
								db.insert(
									_.extend(
										change.doc,
										{
											content_html: chunk.toString(),
											worker_status: {
												"worker-docverter": {
													status: "converted",
													revpos: parseInt(change.doc._rev)
												}
											}
										}
									),
									change.doc._id, 
									function (err, body) {
								    	if(err) { console.log("ERROR: "+ err + "\n" + body); }
									}
								);
							} else {
								console.log("ERROR: " + chunk);
							}
						});
					}
				}
			);

		});
	});

	feed.follow();

}