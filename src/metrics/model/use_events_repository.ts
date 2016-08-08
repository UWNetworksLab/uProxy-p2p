// Represents the operations we can perform on the use metrics repository.
export interface UseEventsRepository {
  recordUseEvent(event: UseEvent): Promise<void>
}

export class UseEvent {
  public constructor(private _date: EventDate, private _country: CountryCode,
                     private _previous_date?: EventDate, private _previous_country?: CountryCode) { };

  public date(): EventDate {
    return this._date;
  }

  public country(): CountryCode {
    return this._country;
  }

  public previousDate(): EventDate {
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

export class EventDate {
  private _date: Date;

  public constructor(year: number, month: number, day: number) {
    // Remove 1 from month because JS Date is 0-based.
    this._date = new Date(Date.UTC(year, month - 1, day));
   }

  // Returns the year.
  public getYear(): number {
    return this._date.getUTCFullYear();
  }

  // Returns the month in the 1..12 range.
  public getMonth(): number {
    return this._date.getUTCMonth() + 1;
  }

  // Returns the day in the 1..31 range.
  public getDay(): number {
    return this._date.getUTCDate();
  }

  // Returns the number of days to the given date. Returns a negative number if the
  // parameter is in the past.
  public daysTo(date: EventDate): number {
    // Use unary + to workaround https://github.com/Microsoft/TypeScript/issues/5710.
    return (+date._date - +this._date) / (24 * 60 * 60 * 1000);
  }

  // Returns whether the input is before this date. 
  public equals(date: EventDate) {
    return this._date.getTime() == date._date.getTime();
  }

  // Returns whether the input is before this date. 
  public isEarlierThan(date: EventDate) {
    return this._date < date._date;
  }

  public isLaterThan(date: EventDate) {
    return this._date > date._date;
  }

  public incrementByDays(days: number): void {
    this._date.setUTCDate(this._date.getUTCDate() + days);
  }

  public plusDays(days: number): EventDate {
    return new EventDate(this.getYear(), this.getMonth(), this.getDay() + days);
  }

  public minusDays(days: number): EventDate {
    return new EventDate(this.getYear(), this.getMonth(), this.getDay() - days);
  }

  // Returns a string representation for logging or debugging.
  public toString(): string {
    return `${this.getYear()}-${padLeft(this.getMonth(), 2)}-${padLeft(this.getDay(), 2)}`;
  }
}

export function eventDatefromString(date_str: string): EventDate {
  if (!date_str) {
    return null;
  }
  let js_date = new Date(date_str);
  if (isNaN(js_date.valueOf())) {
    // Parsing error.
    return null;
  }
  return eventDatefromJsDate(js_date);
}

export function eventDatefromJsDate(js_date: Date): EventDate {
  if (js_date === null) {
    return null;
  }
  // Add 1 to month because it is 0-based in JS Date.
  return new EventDate(js_date.getUTCFullYear(), js_date.getUTCMonth() + 1, js_date.getUTCDate());
}

function padLeft(number:number, length: number) {
  let number_str = number.toString();
  if (number_str.length >= length) {
    return number_str;
  }
  return Array(length - number_str.length + 1).join('0') + number_str;
}

export default UseEventsRepository;