// You can find the request and response api at http://expressjs.com/en/api.html.

import gcloud = require('gcloud');

import sd = require('../model/simple_date');
import uer = require('../model/use_events_repository');
import DatastoreUseEventsRepository from '../adaptors/datastore_use_events_repository';

let datastore = gcloud().datastore({
  projectId: 'uproxy-metrics',
  namespace: 'test'
});
let repository = new DatastoreUseEventsRepository(datastore);

export function recordUse(req: any, res: any): void {
  try {
    if (req.method !== 'POST') {
      return res.status(405).send(`Unsupported HTTP method ${req.method}\n`);
    }
    const query = req.query;
    if (!query) {
      console.error(`Query not found. req = ${req}`);
      return res.status(500);
    }

    let date = sd.datefromString(query.date);
    if (!date) {
      return res.status(400).send('date is missing\n');
    }
    let country_code: uer.CountryCode = query.country;
    if (!country_code) { country_code = 'ZZ'; }

    let previous_date = null as sd.SimpleDate;
    let previous_country_code = null as uer.CountryCode;
    if (query.previous_date) {
      previous_date = sd.datefromString(query.previous_date);
      if (!previous_date) {
        return res.status(400).send(`Could not parse previous_date: ${query.previous_date}\n`);
      }
      previous_country_code = query.previous_country;
      if (!previous_country_code) { previous_country_code = 'ZZ' }
    }
    let event = new uer.UseEvent(date, country_code, previous_date, previous_country_code);
    repository.recordUseEvent(event).then(() => {
      res.status(200).send('Use recorded\n');
    }, (error) => {
      console.error('repository.recordUseEvent failed: %s', error);
      res.status(500).end();
    });
  } catch (error) {
    console.error('recordUse failed: %s', error);
    res.status(500).end();
  }
};

export function reportUsage(req: any, res: any): void {
  console.log('Called reportUsage');
  return res.status(501);
};
