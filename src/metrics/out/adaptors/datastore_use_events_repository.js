"use strict";
const sd = require('../model/simple_date');
const uer = require('../model/use_events_repository');
function toDatastoreDate(date) {
    if (date === null) {
        return null;
    }
    // Remove 1 from month because it is 0-based in JS Date. 
    return new Date(Date.UTC(date.getYear(), date.getMonth() - 1, date.getDay()));
}
// UseEventsRepository implemented using the Google Cloud Datastore.
class DatastoreUseEventsRepository {
    // Pass the gcloud.Datastore object to use.
    constructor(datastore) {
        this.datastore = datastore;
    }
    recordUseEvent(event) {
        let entry = {
            key: this.datastore.key('LatestUse'),
            data: {
                date: toDatastoreDate(event.date()),
                country: event.country(),
                previous_date: toDatastoreDate(event.previousDate()),
                previous_country: event.previousCountry()
            }
        };
        return new Promise((resolve, reject) => {
            this.datastore.insert(entry, (error) => {
                if (error) {
                    reject(error);
                }
                else {
                    resolve();
                }
            });
        });
    }
    getUseEventsInRange(start_date, end_date) {
        const query = this.datastore.createQuery('LatestUse')
            .filter('date', '>=', toDatastoreDate(start_date))
            .filter('date', '<=', toDatastoreDate(end_date));
        return new Promise((resolve, reject) => {
            this.datastore.runQuery(query, (error, db_entries) => {
                if (error) {
                    return reject(error);
                }
                let events = [];
                for (let entry of db_entries) {
                    events.push(new uer.UseEvent(sd.datefromJsDate(entry.data.date), entry.data.country, sd.datefromJsDate(entry.data.previous_date), entry.data.previous_country));
                }
                resolve(events);
            });
        });
    }
    getUniqueClients(start_date, end_date) {
        debugger;
        return new Promise((resolve, reject) => {
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
    countEntries() {
        const query = this.datastore.createQuery('LatestUse');
        return new Promise((resolve, reject) => {
            this.datastore.runQuery(query, (error, entries) => {
                if (error) {
                    return reject(error);
                }
                resolve(entries.length);
            });
        });
    }
}
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = DatastoreUseEventsRepository;
