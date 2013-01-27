# worker-docverter

This worker converts plain text field values written in HTML, Markdown, or LaTeX to PDF, Docx, RTF or ePub using [Docverter][docverter]'s HTTP API.

Install node dependencies:

    npm install

Set environment variables (e.g. in `.env` for `foreman`):

    COUCHDB_DB_URL=http://admin:party@127.0.0.1:5984/example_com
    DOCVERTER_API_URL=http://127.0.0.1:9595/convert

Start worker:

    foreman start

[docverter]: http://www.docverter.com "Docverter"
[docverter-api]: http://www.docverter.com/api.html "Docverter API Documentation"