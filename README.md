# worker-docverter

This worker converts plain text field values written in HTML, Markdown, or LaTeX to PDF, Docx, RTF or ePub using [Docverter][docverter]'s HTTP API.

## Local Development Environment

Install node dependencies: `npm install`

Create a `.env` file with your project configuration (for `foreman` to pick up):

    COUCHDB=http://admin:party@127.0.0.1:5984/example_com
    DOCVERTER=http://127.0.0.1:9595/convert

Start worker: `foreman start`

## Heroku Deployment Steps

Install the [Heroku Toolbelt][heroku-toolbelt] - everything you need to get started using heroku.

Authenticate/ login: `heroku login`

Install [heroku-config][heroku-config], a plugin for the `heroku` CLI that makes it easy to *push* or *pull* your application’s config environment vars, from or into your local `.env` file.

Create a `.env` file with your project configuration:

    COUCHDB=https://ADMIN:PARTY@EXAMPLE.iriscouch.com/YOUR_EXAMPLE_COM
    DOCVERTER=http://YOUR-EXAMPLE-1234.herokuapp.com/convert

Next, deploy the application to Heroku.

Create the app: `heroku create`

Push your local environment file to Heroku: `heroku config:push`

Deploy the code: `git push heroku master`

[docverter]: http://www.docverter.com "Docverter"
[docverter-api]: http://www.docverter.com/api.html "Docverter API Documentation"
[heroku-toolbelt]: https://toolbelt.heroku.com "heroku toolbelt"
[heroku-config]: https://github.com/ddollar/heroku-config "heroku-config"