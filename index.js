var WorkerDocverterToHtml = require("./lib/docverterToHtml");
var WorkerDocverterToPdf = require("./lib/docverterToPdf");

// config
var config = {
	couchdb: {
    	db: process.env.COUCHDB // Fully-qualified URL of a couch database. (Basic auth URLs are ok.)
	},
	docverter: {
    	api: process.env.DOCVERTER // Fully-qualified URL of Docverter /convert API
	}
}

// let's work
var workerToHtml = new WorkerDocverterToHtml(config);
var workerToPdf = new WorkerDocverterToPdf(config);