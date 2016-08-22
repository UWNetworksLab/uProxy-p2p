"use strict";
const gcloud = require('gcloud');
const datastore_use_events_repository_1 = require('../adaptors/datastore_use_events_repository');
const us = require('./use_service');
let datastore = gcloud().datastore({
    projectId: 'uproxy-metrics',
    namespace: 'test'
});
let use_service = new us.RecordUseService(new datastore_use_events_repository_1.default(datastore));
function recordUse(request, response) {
    use_service.recordUse(request, response);
}
exports.recordUse = recordUse;
;
