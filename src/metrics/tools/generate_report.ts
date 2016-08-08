import gcloud = require('gcloud');
import fs = require('fs');

import umr = require('../model/use_events_repository');
import DatastoreUseEventsRepository from '../adaptors/datastore_use_events_repository';

// Users that are idle for this number of days or more are not
// considered retained. 
const RETENTION_DAYS = 28;

class DateRangeMetrics {
  public unique_clients = 0;
  public new_activations = 0;
  public re_activations = 0;
};

function MetricsForDateRange(events: umr.UseEvent[], start_date: umr.EventDate,
  end_date: umr.EventDate, country_matcher: CountryMatcher) {
  let metrics = new DateRangeMetrics;
  for (let event of events) {
    let date = event.date();
    if (date.isEarlierThan(start_date) || date.isLaterThan(end_date)) {
      continue;
    }

    let country = event.country();
    if (country_matcher.matches(country)) {
      metrics.unique_clients += 1;
      if (event.isFirstUse()) {
        metrics.new_activations += 1;
      } else if (event.previousDate().daysTo(event.date()) > RETENTION_DAYS) {
        metrics.re_activations += 1
      }
    }
    if (!event.isFirstUse() && !event.previousDate().isEarlierThan(start_date)) {
      if (country_matcher.matches(event.previousCountry())) {
        metrics.unique_clients -= 1;
      }
    }
  }
  return metrics;
}

function LastUse(events: umr.UseEvent[], query_date: umr.EventDate, query_country: CountryMatcher): number {
  let last_use = 0;
  for (let event of events) {
    if (query_country.matches(event.country()) && query_date.equals(event.date())) {
      last_use += 1;
    }
    if (!event.isFirstUse()) {
      if (query_country.matches(event.previousCountry()) && query_date.equals(event.previousDate())) {
        last_use -= 1;
      }
    }
  }
  return last_use;
}

class CsvRangeReport {
  private output: fs.WriteStream;

  public constructor(filename: string) {
    this.output = fs.createWriteStream(filename);
  }

  public addLine(date: umr.EventDate, country_matcher: CountryMatcher, range: number, metrics: DateRangeMetrics): void {
    let range_str = `${range}d`;
    if (range % 7 == 0) {
      range_str = `${range / 7}w`;
    }
    this.output.write(
      `${date},${country_matcher},${range_str},${metrics.unique_clients},${metrics.new_activations},${metrics.re_activations}\n`
    );
  }

  public end() {
    this.output.end();
  }
}

class CsvDateHistogram {
  private output: fs.WriteStream;

  public constructor(filename: string) {
    this.output = fs.createWriteStream(filename);
  }

  public addDateValue(date: umr.EventDate, country_matcher: CountryMatcher, value: number): void {
    this.output.write(`${date},${country_matcher},${value}\n`);
  }

  public end() {
    this.output.end();
  }
}

class CountryMatcher {
  // _pattern must be "*" or a CountryCode.
  public constructor(private _pattern: umr.CountryCode | "*") { }

  public matches(country_code: umr.CountryCode): boolean {
    return this._pattern == '*' || this._pattern == country_code;
  }

  public toString() {
    return this._pattern;
  }
}

function CreateCountryMatchers(events: umr.UseEvent[]): CountryMatcher[] {
  let matchers = [] as CountryMatcher[];
  // let matchers = [new CountryMatcher("*")];
  let added = new Set<umr.CountryCode>();
  for (let event of events) {
    let country_code = event.country();
    if (added.has(country_code)) { continue; }
    matchers.push(new CountryMatcher(country_code));
    added.add(country_code);
  }
  return matchers;
}

let datastore = gcloud().datastore({
  projectId: 'uproxy-metrics',
  namespace: 'test'
});

let repo = new DatastoreUseEventsRepository(datastore);

repo.countEntries().then((count) => {
  console.log('Datastore has %d entries', count);
})

let end_date = umr.eventDatefromString('2016-08-06');
let start_date = end_date.minusDays(180);

// Complexity: date_range * events
repo.getUseEventsInRange(start_date.minusDays(RETENTION_DAYS), end_date).then((events) => {
  console.log('Datastore has %d events in range', events.length);

  let matchers = CreateCountryMatchers(events);
  let range_report = new CsvRangeReport('./out/range_metrics.csv');
  let last_use_report = new CsvDateHistogram('./out/last_use_metrics.csv');
  try {
    for (let date = start_date; !date.isLaterThan(end_date); date.incrementByDays(1)) {
      for (let country_matcher of matchers) {
        for (let range of [1, 7, 28]) {
          let range_metrics = MetricsForDateRange(events, date.minusDays(range - 1), date, country_matcher);
          range_report.addLine(date, country_matcher, range, range_metrics);
        }
        last_use_report.addDateValue(date, country_matcher, LastUse(events, date, country_matcher));
      }
    }
  } finally {
    range_report.end();
    last_use_report.end();
  }
}).catch((error) => {
  console.error('getUseEventsInRange Error: %s', error);
});
