export class SimpleDate {
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
  public daysTo(date: SimpleDate): number {
    // Use unary + to workaround https://github.com/Microsoft/TypeScript/issues/5710.
    return (+date._date - +this._date) / (24 * 60 * 60 * 1000);
  }

  // Returns whether the input is before this date. 
  public equals(date: SimpleDate) {
    return this._date.getTime() == date._date.getTime();
  }

  // Returns whether the input is before this date. 
  public isEarlierThan(date: SimpleDate) {
    return this._date < date._date;
  }

  public isLaterThan(date: SimpleDate) {
    return this._date > date._date;
  }

  public incrementByDays(days: number): void {
    this._date.setUTCDate(this._date.getUTCDate() + days);
  }

  public plusDays(days: number): SimpleDate {
    return new SimpleDate(this.getYear(), this.getMonth(), this.getDay() + days);
  }

  public minusDays(days: number): SimpleDate {
    return new SimpleDate(this.getYear(), this.getMonth(), this.getDay() - days);
  }

  // Returns a string representation for logging or debugging.
  public toString(): string {
    return `${this.getYear()}-${padLeft(this.getMonth(), 2)}-${padLeft(this.getDay(), 2)}`;
  }
}

export function datefromString(date_str: string): SimpleDate {
  if (!date_str) {
    return null;
  }
  let js_date = new Date(date_str);
  if (isNaN(js_date.valueOf())) {
    // Parsing error.
    return null;
  }
  return datefromJsDate(js_date);
}

export function datefromJsDate(js_date: Date): SimpleDate {
  if (js_date === null) {
    return null;
  }
  // Add 1 to month because it is 0-based in JS Date.
  return new SimpleDate(js_date.getUTCFullYear(), js_date.getUTCMonth() + 1, js_date.getUTCDate());
}

function padLeft(number:number, length: number) {
  let number_str = number.toString();
  if (number_str.length >= length) {
    return number_str;
  }
  return Array(length - number_str.length + 1).join('0') + number_str;
}