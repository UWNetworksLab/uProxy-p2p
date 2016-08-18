import sd = require('./simple_date');
import uer = require('./use_events_repository');

// Users that are idle for more than this many days or not considered retained.
const RETENTION_DAYS = 28;

// A usage metrics report.
//
// This class is used to output reports. encapsulating how it's used or saved.
export interface MetricsReport {
  addRangeMetric(date: sd.SimpleDate, country_matcher: CountryMatcher, range: number, metrics: DateRangeMetrics): void
  addLastUse(date: sd.SimpleDate, country_matcher: CountryMatcher, value: number): void
  end(): void;
}

// Fills a MetricsReport for the given [start_date, end_date] range. Uses the input event repository as
// the raw data.
export function generateReport(events_repo: uer.UseEventsRepository, start_date: sd.SimpleDate,
                               end_date: sd.SimpleDate, report: MetricsReport) : Promise<void> {
  // Complexity: date_range * events
  return events_repo.getUseEventsInRange(start_date.minusDays(RETENTION_DAYS), end_date).then((events) => {
    console.log('Datastore has %d events in range', events.length);

    let matchers = CreateCountryMatchers(events);
    try {
      for (let date = start_date; !date.isLaterThan(end_date); date.incrementByDays(1)) {
        for (let country_matcher of matchers) {
          for (let range of [1, 7, 28]) {
            let range_metrics = metricsForDateRange(
              events, date.minusDays(range - 1), date, country_matcher);
            report.addRangeMetric(date, country_matcher, range, range_metrics);
          }
          report.addLastUse(date, country_matcher, LastUse(events, date, country_matcher));
        }
      }
    } finally {
      report.end();
    }
  })
}

// Calculates the DateRangeMetrics for the [start_date, end_date] range in the given country.
function metricsForDateRange(events: uer.UseEvent[], start_date: sd.SimpleDate,
  end_date: sd.SimpleDate, country_matcher: CountryMatcher) {
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

// The metrics we calculate for date ranges.
export class DateRangeMetrics {
  // Unique clients in the date range. Duplicate uses are deduped.
  public unique_clients = 0;
  // Number of new clients in the date range.
  public new_activations = 0;
  // Number of clients active in the date range that were idle for RETENTION_DAYS or more.
  public re_activations = 0;
};

// Number of unique clients in the given (query_date, query_country) bucket after all the input events.
function LastUse(events: uer.UseEvent[], query_date: sd.SimpleDate, query_country: CountryMatcher): number {
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

// Helper class to match country code against country patterns.
export class CountryMatcher {
  // _pattern must be "*" or a CountryCode.
  public constructor(private _pattern: uer.CountryCode | "*") { }

  public matches(country_code: uer.CountryCode): boolean {
    return this._pattern == '*' || this._pattern == country_code;
  }

  public toString() {
    return this._pattern;
  }
}

// Extracts all country codes from the events list, saving them as CountryMatchers.
function CreateCountryMatchers(events: uer.UseEvent[]): CountryMatcher[] {
  let matchers = [] as CountryMatcher[];
  // let matchers = [new CountryMatcher("*")];
  let added = new Set<uer.CountryCode>();
  for (let event of events) {
    let country_code = event.country();
    if (added.has(country_code)) { continue; }
    matchers.push(new CountryMatcher(country_code));
    added.add(country_code);
  }
  return matchers;
}