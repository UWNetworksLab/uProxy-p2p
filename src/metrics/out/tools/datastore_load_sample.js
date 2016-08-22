/// <reference path="../typings/globals/csv-parse/index.d.ts" />
"use strict";
const fs = require('fs');
const gcloud = require('gcloud');
const csv_parse = require('csv-parse/lib/sync');
const sd = require('../model/simple_date');
const umr = require('../model/use_events_repository');
const datastore_use_events_repository_1 = require('../adaptors/datastore_use_events_repository');
function LoadSample(inputFilename, repo) {
    let content = fs.readFileSync(inputFilename);
    let entries = csv_parse(content.toString(), { columns: true });
    console.log('Read %d items from %s', entries.length, inputFilename);
    let insertions = entries.map((entry) => {
        let date = sd.datefromString(entry.latest_date);
        let country = entry.latest_country;
        let previous_date = sd.datefromString(entry.previous_date);
        if (!previous_date) {
            previous_date = null;
        }
        let previous_country = entry.previous_country;
        if (!previous_country) {
            previous_country = null;
        }
        console.log('Inserting %s (%s) %s (%s)', date, country, previous_date, previous_country);
        return repo.recordUseEvent(new umr.UseEvent(date, country, previous_date, previous_country));
    });
    return Promise.all(insertions);
}
let datastore = gcloud().datastore({
    projectId: 'uproxy-metrics',
    namespace: 'test'
});
let repo = new datastore_use_events_repository_1.default(datastore);
let load_future = repo.countEntries().then((count) => {
    console.log('Datastore has %d entries before load', count);
    return LoadSample('./tools/sample_events.csv', repo);
});
load_future.then((values) => {
    console.log('Inserted %d items', values.length);
}, (error) => {
    console.error('Failed to load: %s', error);
    throw new Error(error);
});
