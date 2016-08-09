/// <reference path="../typings/globals/express/index.d.ts" />
import express = require('express');
import gcloud = require('gcloud');

import DatastoreUseEventsRepository from '../adaptors/datastore_use_events_repository';
import us = require('./use_service');

let datastore = gcloud().datastore({
  projectId: 'uproxy-metrics',
  namespace: 'test'
});

let use_service = new  us.RecordUseService(new DatastoreUseEventsRepository(datastore));

export function recordUse(request: express.Request, response: express.Response): void {
  use_service.recordUse(request, response);
};