var _ = require("underscore"),
    nano = require("nano"),
    url = require("url"),
    fs = require("fs"),
    path = require("path"),
    needle = require('needle'),
    Tempfile = require("temporary/lib/file"),
    crypto = require('crypto');

module.exports = WorkerDocverterToHtml;

function WorkerDocverterToHtml(config) {

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
        var md5content;

        // filter for docs with 'content' field
        if(doc.content) {
            var md5sum = crypto.createHash('md5');
            md5sum.update(doc.content, 'utf8');
            md5content = md5sum.digest('hex');
        } else {
            return false;
        }

        if (
                // ignore if we already processed this doc._rev toHtml
                (
                !doc["worker-docverter-to-html"]
                ||
                    (
                        doc["worker-docverter-to-html"]
                        && doc["worker-docverter-to-html"].contentmd5
                        && doc["worker-docverter-to-html"].contentmd5 !== md5content
                    )
                )
                // filter for docs with content_format' fields
                &&
                    (
                        doc.content_format
                        && _.any(
                            _.keys(formats), function (format) {
                                return format === doc.content_format;
                            }
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
	    setTimeout(function() { feed.resume(); }, 3 * 1000);

	    var tmpfile = new Tempfile(change.seq+'toHtml');
		fs.writeFile(tmpfile.path, change.doc.content, "utf8", 
			function (err) {
				if (err) { 
					tmpfile.unlink(); // rm tmp file
					// feed.resume(); // resume changes feed 
					throw err; 
				}
	
				// file created

				var dataToHtml = {
				  "from": formats[change.doc.content_format],
				  "to": "html",
				  "template": "content.html",
				  "input_files[]": { file: tmpfile.path, content_type: "text/plain" },
				  "other_files[]": { file: path.join(__dirname, "content.html"), content_type: "text/html"},
				};

				needle.post(docverter.href, dataToHtml, { multipart: true }, onDocverterToHtmlResponse);

                function onDocverterToHtmlResponse(err, res, body) {
					tmpfile.unlink(); // rm tmp file
					// feed.resume(); // resume changes feed
			
					// form submitted
					console.log(
						res.statusCode
						+ " - Docverter for '" + formats[change.doc.content_format] + "' to 'html': "
						+ "Change seq " + change.seq 
						+ " (doc id: '"+change.doc._id+"', rev: '"+change.doc._rev+"')"
					);
				
					if (res.statusCode === 200) {
                        var md5sum = crypto.createHash('md5');
                        md5sum.update(change.doc.content, 'utf8');
                        var contentmd5 = md5sum.digest('hex');

						db.insert(
							_.extend(
								change.doc,
								{
									content_html: body,
									"worker-docverter-to-html": {
										revpos: parseInt(change.doc._rev),
                                        contentmd5: contentmd5
									}
								}
							),
							change.doc._id, 
							function (err, body) {
						    	if(err) { console.log("ERROR: "+ err + "\n" + body); }
							}
						);
					} else {
						console.log("ERROR: "+body)
					}
				};

            }
		);
	});

	feed.follow();

}