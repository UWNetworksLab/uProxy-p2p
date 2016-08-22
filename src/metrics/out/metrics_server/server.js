"use strict";
const bodyParser = require('body-parser');
const express = require('express');
const gcloud = require('gcloud');
const us = require('./use_service');
const datastore_use_events_repository_1 = require('../adaptors/datastore_use_events_repository');
let datastore = gcloud().datastore({
    projectId: 'uproxy-metrics',
    namespace: 'test'
});
let use_service = new us.RecordUseService(new datastore_use_events_repository_1.default(datastore));
let app = express();
app.use(bodyParser.json({ type: 'application/json' }));
app.get('/', (request, response) => {
    response.status(200).send('Hello, world!');
});
app.post('/recordUse', (request, response) => {
    use_service.recordUse(request, response);
});
// Start the server
let server = app.listen(process.env.PORT || '8080', function () {
    console.log('App listening on port %s', server.address().port);
    console.log('Press Ctrl+C to quit.');
});
