"use strict";
class UseEvent {
    constructor(_date, _country, _previous_date, _previous_country) {
        this._date = _date;
        this._country = _country;
        this._previous_date = _previous_date;
        this._previous_country = _previous_country;
    }
    ;
    date() {
        return this._date;
    }
    country() {
        return this._country;
    }
    previousDate() {
        return this._previous_date;
    }
    previousCountry() {
        return this._previous_country;
    }
    isFirstUse() {
        return this._previous_date === null;
    }
    toString() {
        let date_str = this.date().toString();
        let country_str = this.country();
        let previous_str = '(first use)';
        if (!this.isFirstUse()) {
            previous_str = `previous_date: ${this.previousDate().toString()} (${this.previousCountry()})`;
        }
        return `date: ${date_str} (${country_str}) ${previous_str}`;
    }
}
exports.UseEvent = UseEvent;
