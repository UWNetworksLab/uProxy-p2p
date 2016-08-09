// You can find the request and response api at http://expressjs.com/en/api.html.

import gcloud = require('gcloud');
import DatastoreUseEventsRepository from '../adaptors/datastore_use_events_repository';
import us = require('./use_service');

let datastore = gcloud().datastore({
  projectId: 'uproxy-metrics',
  namespace: 'test'
});

let use_service = new  us.RecordUseService(new DatastoreUseEventsRepository(datastore));

export function recordUse(request: any, response: any): void {
  use_service.recordUse(request, response);
};