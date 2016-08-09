import gcloud = require('gcloud');

import sd = require('../model/simple_date');
import umr = require('../model/use_events_repository');

function toDatastoreDate(date: sd.SimpleDate): Date {
  if (date === null) {
    return null;
  }
  // Remove 1 from month because it is 0-based in JS Date. 
  return new Date(Date.UTC(date.getYear(), date.getMonth() - 1, date.getDay()));
}

// UseEventsRepository implemented using the Google Cloud Datastore.
export default class DatastoreUseEventsRepository implements umr.UseEventsRepository {
  // Pass the gcloud.Datastore object to use.
  public constructor(datastore: gcloud.datastore.Datastore) {
    this.datastore = datastore;
  }

  public recordUseEvent(event: umr.UseEvent): Promise<void> {
    let entry = {
      key: this.datastore.key('LatestUse'),
      data: {
        date: toDatastoreDate(event.date()),
        country: event.country(),
        previous_date: toDatastoreDate(event.previousDate()),
        previous_country: event.previousCountry()
      }
    };
    return new Promise<void>((resolve, reject) => {
      this.datastore.insert(entry, (error: any) => {
        if (error) { reject(error); }
        else { resolve(); }
      });
    });
  }

  getUseEventsInRange(start_date: sd.SimpleDate, end_date: sd.SimpleDate): Promise<umr.UseEvent[]> {
    const query = this.datastore.createQuery('LatestUse')
      .filter('date', '>=', toDatastoreDate(start_date))
      .filter('date', '<=', toDatastoreDate(end_date));
    return new Promise<umr.UseEvent[]>((resolve, reject) => {
      this.datastore.runQuery(query, (error: any, db_entries: any[]) => {
        if (error) {
          return reject(error);
        }
        let events = [] as umr.UseEvent[];
        for (let entry of db_entries) {
          events.push(new umr.UseEvent(sd.datefromJsDate(entry.data.date),
                                       entry.data.country,
                                       sd.datefromJsDate(entry.data.previous_date),
                                       entry.data.previous_country));
        }
        resolve(events);
      });
    });
  }

  getUniqueClients(start_date: sd.SimpleDate, end_date: sd.SimpleDate): Promise<number> {
    debugger;
    return new Promise<number>((resolve, reject) => {
      this.getUseEventsInRange(start_date, end_date).then((entries) => {
        let count = 0;
        for (let entry of entries) {
          if (entry.previousDate() === null || entry.previousDate() < start_date) {
            count += 1;
          }
        }
        resolve(count);
      });
    });
  }

  // TODO: Generate reports:
  // (date, {(one|seven|28)_day: {unique_clients, activations, reactivations}})
  // Dump to bigquery
  // Add abandonment ()
  // Add country, move in, move out.

  countEntries(): Promise<number> {
    const query = this.datastore.createQuery('LatestUse');
    return new Promise<number>((resolve, reject) => {
      this.datastore.runQuery(query, (error: any, entries: any[]) => {
        if (error) {
          return reject(error);
        }
        resolve(entries.length);
      });
    });
  }

  private datastore: gcloud.datastore.Datastore;
}