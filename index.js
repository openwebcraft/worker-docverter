var WorkerDocverter = require("./lib/docverter");

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
var worker = new WorkerDocverter(config);