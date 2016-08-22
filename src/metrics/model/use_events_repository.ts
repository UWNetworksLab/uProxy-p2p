import sd = require('./simple_date');

// Represents the operations we can perform on the use metrics repository.
export interface UseEventsRepository {
  recordUseEvent(event: UseEvent): Promise<void>
  getUseEventsInRange(start_date: sd.SimpleDate, end_date: sd.SimpleDate): Promise<UseEvent[]>
}

// Represents a single use event.
//
// Assuming a model where clients are placed in (date, country) buckets for when and where they last used the
// application, a use event can be seen as an operation of adding a client to the (date, country) bucket and
// removing it from the (previous_date, previous_country) bucket.
export class UseEvent {
  public constructor(private _date: sd.SimpleDate, private _country: CountryCode,
                     private _previous_date?: sd.SimpleDate, private _previous_country?: CountryCode) { };

  // The date when the the client used the application, in the client's timezone.
  public date(): sd.SimpleDate {
    return this._date;
  }

  // The country where the client used the application.
  // Returns 'ZZ' if the country was not known.
  public country(): CountryCode {
    return this._country;
  }

  // Is this the first use by the client? If true, the previous date and country will be null.
  public isFirstUse(): boolean {
    return this._previous_date === null;
  }

  // The date when the client previously used the application, in the client's timezone.
  // Returns null if this event represents the client's first use.
  public previousDate(): sd.SimpleDate {
    return this._previous_date;
  }

  // The country where the client previously used the application.
  // Returns null if this event represents the client's first use.
  public previousCountry(): CountryCode {
    return this._previous_country;
  }

  // Returns a string representation for the event for debugging or logging purposes.
  public toString(): string {
    let date_str = this.date().toString();
    let country_str = this.country();
    let previous_str = '(first use)';
    if (!this.isFirstUse()) {
      previous_str = `previous_date: ${this.previousDate().toString()} (${this.previousCountry()})`;
    }
    return `date: ${date_str} (${country_str}) ${previous_str}`;
  }
}

export type CountryCode = string;

export default UseEventsRepository;