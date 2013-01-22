var WorkerDocverter = require("./lib/docverter");

// config
var config = {
	couchdb: {
    	server: process.env.COUCHDB_SERVER_URL,
    	db: process.env.COUCHDB_DATABASE,
    	admin_user: process.env.COUCHDB_ADMIN_USER,
    	admin_pass: process.env.COUCHDB_ADMIN_PASS
	},
	docverter: {
    	api: process.env.DOCVERTER_API_URL
	}
}

// let's work
var worker = new WorkerDocverter(config);