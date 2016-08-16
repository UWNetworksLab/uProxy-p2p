import express = require('express');

import sd = require('../model/simple_date');
import uer = require('../model/use_events_repository');

export class RecordUseService {
  public constructor(private _repository:uer.UseEventsRepository) {}

  public recordUse(req: express.Request, res: express.Response): void {

    try {
      if (req.method !== 'POST') {
        res.status(405).send(`Unsupported HTTP method ${req.method}\n`);
        return;
      }
      if (!req.body) {
        console.error(`Request body not found. req = ${req}`);
        res.status(500);
        return;
      }
      let date = sd.datefromString(req.body.date);
      if (!date) {
        res.status(400).send('date is missing\n');
        return;
      }
      let country_code: uer.CountryCode = req.body.country;
      if (!country_code) { country_code = 'ZZ'; }

      let previous_date = null as sd.SimpleDate;
      let previous_country_code = null as uer.CountryCode;
      if (req.body.previous_date) {
        previous_date = sd.datefromString(req.body.previous_date);
        if (!previous_date) {
          res.status(400).send(`Could not parse previous_date: ${req.body.previous_date}\n`);
          return;
        }
        previous_country_code = req.body.previous_country;
        if (!previous_country_code) { previous_country_code = 'ZZ' }
      }
      let event = new uer.UseEvent(date, country_code, previous_date, previous_country_code);
      this._repository.recordUseEvent(event).then(() => {
        res.status(200).send('Use recorded\n');
      }, (error) => {
        console.error('repository.recordUseEvent failed: %s', error);
        res.status(500).end();
      });
    } catch (error) {
      console.error('recordUse failed: %s', error);
      res.status(500).end();
    }
  }
}
