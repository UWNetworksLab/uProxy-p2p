"use strict";
// Users that are idle for more than this many days or not considered retained.
const RETENTION_DAYS = 28;
function generateReport(events_repo, start_date, end_date, report) {
    // Complexity: date_range * events
    return events_repo.getUseEventsInRange(start_date.minusDays(RETENTION_DAYS), end_date).then((events) => {
        console.log('Datastore has %d events in range', events.length);
        let matchers = CreateCountryMatchers(events);
        try {
            for (let date = start_date; !date.isLaterThan(end_date); date.incrementByDays(1)) {
                for (let country_matcher of matchers) {
                    for (let range of [1, 7, 28]) {
                        let range_metrics = metricsForDateRange(events, date.minusDays(range - 1), date, country_matcher);
                        report.addRangeMetric(date, country_matcher, range, range_metrics);
                    }
                    report.addLastUse(date, country_matcher, LastUse(events, date, country_matcher));
                }
            }
        }
        finally {
            report.end();
        }
    });
}
exports.generateReport = generateReport;
function metricsForDateRange(events, start_date, end_date, country_matcher) {
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
            }
            else if (event.previousDate().daysTo(event.date()) > RETENTION_DAYS) {
                metrics.re_activations += 1;
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
class DateRangeMetrics {
    constructor() {
        this.unique_clients = 0;
        this.new_activations = 0;
        this.re_activations = 0;
    }
}
exports.DateRangeMetrics = DateRangeMetrics;
;
function LastUse(events, query_date, query_country) {
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
class CountryMatcher {
    // _pattern must be "*" or a CountryCode.
    constructor(_pattern) {
        this._pattern = _pattern;
    }
    matches(country_code) {
        return this._pattern == '*' || this._pattern == country_code;
    }
    toString() {
        return this._pattern;
    }
}
exports.CountryMatcher = CountryMatcher;
function CreateCountryMatchers(events) {
    let matchers = [];
    // let matchers = [new CountryMatcher("*")];
    let added = new Set();
    for (let event of events) {
        let country_code = event.country();
        if (added.has(country_code)) {
            continue;
        }
        matchers.push(new CountryMatcher(country_code));
        added.add(country_code);
    }
    return matchers;
}
