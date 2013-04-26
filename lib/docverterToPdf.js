var _ = require("underscore")
var nano = require("nano");
var url = require("url");
var fs = require("fs");
var path = require("path");
var needle = require('needle');
var Tempfile = require("temporary/lib/file");

module.exports = WorkerDocverterToPdf;

function WorkerDocverterToPdf(config) {

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
            // ... ignore if we do not yet have processed this doc._rev toHtml
            && (
                doc.worker_status
                && doc.worker_status["worker-docverter-to-html"]
                && doc.worker_status["worker-docverter-to-html"].status
                && doc.worker_status["worker-docverter-to-html"].status === "converted"
                && doc.worker_status["worker-docverter-to-html"].revpos
                && parseInt(doc.worker_status["worker-docverter-to-html"].revpos) === parseInt(doc._rev)-1
            )
            // ... ignore if we already processed this doc._rev toPdf
            && !(
                doc.worker_status
                && doc.worker_status["worker-docverter-to-pdf"]
                && doc.worker_status["worker-docverter-to-pdf"].status
                && doc.worker_status["worker-docverter-to-pdf"].status === "convertedToPdf"
                && doc.worker_status["worker-docverter-to-pdf"].revpos
                && parseInt(doc.worker_status["worker-docverter-to-pdf"].revpos) !== parseInt(doc._rev)-1
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

        var tmpfile = new Tempfile(change.seq+'toPdf');
        fs.writeFile(tmpfile.path, change.doc.content, "utf8",
            function (err) {
                if (err) {
                    tmpfile.unlink(); // rm tmp file
                    // feed.resume(); // resume changes feed
                    throw err;
                }

                // file created


                var dataToPdf = {
                    "from": formats[change.doc.content_format],
                    "to": "pdf",
                    "template": "content.html",
                    "input_files[]": { file: tmpfile.path, content_type: "text/plain" },
                    "other_files[]": { file: path.join(__dirname, "content.html"), content_type: "text/html"},
                };

                needle.post(docverter.href, dataToPdf, { multipart: true }, onDocverterToPdfResponse);

                function onDocverterToPdfResponse(err, res, body) {
                    tmpfile.unlink(); // rm tmp file
                    // feed.resume(); // resume changes feed

                    // form submitted
                    console.log(
                        res.statusCode
                            + " - Docverter for '" + formats[change.doc.content_format] + "' to 'pdf': "
                            + "Change seq " + change.seq
                            + " (doc id: '"+change.doc._id+"', rev: '"+change.doc._rev+"')"
                    );

                    if (res.statusCode === 200) {
                        db.attachment.insert(change.doc._id, change.doc._id+'.pdf', body, 'application/pdf',
                            { rev: change.doc._rev }, function(err, body) {

                                if (!err) {
                                    db.get(change.doc._id, function(err, body) {
                                        if (!err) {
                                            db.insert(
                                                _.extend(
                                                    body,
                                                    {
                                                        "_rev": body._rev,
                                                        worker_status: {
                                                            "worker-docverter-to-pdf": {
                                                                status: "converted",
                                                                revpos: parseInt(body._rev)
                                                            }
                                                        }
                                                    }
                                                ),
                                                body._id,
                                                function (err, body) {
                                                    if(err) { console.log("ERROR: "+ err + "\n" + body); }
                                                }
                                            );
                                        }
                                    });
                                }

                            });
                    } else {
                        console.log("ERROR: "+body)
                    }
                };

            }
        );
    });

    feed.follow();

}