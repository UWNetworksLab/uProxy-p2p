import sd = require('./simple_date');

// Represents the operations we can perform on the use metrics repository.
export interface UseEventsRepository {
  recordUseEvent(event: UseEvent): Promise<void>
}

export class UseEvent {
  public constructor(private _date: sd.SimpleDate, private _country: CountryCode,
                     private _previous_date?: sd.SimpleDate, private _previous_country?: CountryCode) { };

  public date(): sd.SimpleDate {
    return this._date;
  }

  public country(): CountryCode {
    return this._country;
  }

  public previousDate(): sd.SimpleDate {
    return this._previous_date;
  }

  public previousCountry(): CountryCode {
    return this._previous_country;
  }

  public isFirstUse(): boolean {
    return this._previous_date === null;
  }

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