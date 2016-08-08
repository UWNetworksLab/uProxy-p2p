import fs = require('fs');
import gcloud = require('gcloud');
import csv_parse = require('csv-parse/lib/sync');

import * as umr from '../model/use_events_repository';
import DatastoreUseEventsRepository from '../adaptors/datastore_use_events_repository';

interface CsvEntry {
  latest_date: string;
  latest_country: string;
  previous_date?: string;
  previous_country: string;
}

function LoadSample(inputFilename: string, repo: umr.UseEventsRepository): Promise<void[]> {
  let content = fs.readFileSync(inputFilename);
  let entries = csv_parse(content.toString(), { columns: true }) as CsvEntry[];
  console.log('Read %d items from %s', entries.length, inputFilename);
  let insertions = entries.map((entry) => {
    let date = umr.eventDatefromString(entry.latest_date);
    let country = entry.latest_country;
    let previous_date = umr.eventDatefromString(entry.previous_date);
    if (!previous_date) { previous_date = null; }
    let previous_country = entry.previous_country;
    if (!previous_country) { previous_country = null }
    console.log('Inserting %s (%s) %s (%s)', date, country, previous_date, previous_country);
    return repo.recordUseEvent(new umr.UseEvent(date, country, previous_date, previous_country));
  });
  return Promise.all<void>(insertions);
}

let datastore = gcloud().datastore({
  projectId: 'uproxy-metrics',
  namespace: 'test'
})
let repo = new DatastoreUseEventsRepository(datastore);

let load_future = repo.countEntries().then((count) => {
  console.log('Datastore has %d entries before load', count);
  return LoadSample('./tools/sample_usage.csv', repo);
});

load_future.then((values) => {
  console.log('Inserted %d items', values.length);
}, (error) => {
  console.error('Failed to load: %s', error);
  throw new Error(error);
});
