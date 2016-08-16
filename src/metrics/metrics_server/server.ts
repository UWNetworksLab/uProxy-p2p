import bodyParser = require('body-parser')
import express = require('express');
import gcloud = require('gcloud');

import us = require('./use_service');
import DatastoreUseEventsRepository from '../adaptors/datastore_use_events_repository';

let datastore = gcloud().datastore({
  projectId: 'uproxy-metrics',
  namespace: 'test'
});
let use_service = new  us.RecordUseService(new DatastoreUseEventsRepository(datastore));

let app = express();
app.use(bodyParser.json({type: 'application/json'}));

app.get('/', (request: express.Request, response: express.Response) => {
  response.status(200).send('Hello, world!');
});

app.post('/recordUse', (request: express.Request, response: express.Response) => {
  use_service.recordUse(request, response);
});

// Start the server
let server = app.listen(process.env.PORT || '8080', function () {
  console.log('App listening on port %s', server.address().port);
  console.log('Press Ctrl+C to quit.');
});
