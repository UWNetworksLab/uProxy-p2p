import sd = require('./simple_date');

describe('SimpleDate', () => {
  describe('The getter methods', () => {
    it('Return the constructor values', () => {
      let date = new sd.SimpleDate(2010, 2, 4);
      expect(date.getYear()).toEqual(2010);
      expect(date.getMonth()).toEqual(2);
      expect(date.getDay()).toEqual(4);
    });
    it('Day is 1-based', () => {
      let date = new sd.SimpleDate(2010, 1, 1);
      expect(date.getYear()).toEqual(2010);
      expect(date.getMonth()).toEqual(1);
      expect(date.getDay()).toEqual(1);
      date = new sd.SimpleDate(2010, 1, 0);
      expect(date.getYear()).toEqual(2009);
      expect(date.getMonth()).toEqual(12);
      expect(date.getDay()).toEqual(31);
    });
    it('Month is 1-based', () => {
      let date = new sd.SimpleDate(2010, 1, 1);
      expect(date.getYear()).toEqual(2010);
      expect(date.getMonth()).toEqual(1);
      expect(date.getDay()).toEqual(1);
      date = new sd.SimpleDate(2010, 0, 1);
      expect(date.getYear()).toEqual(2009);
      expect(date.getMonth()).toEqual(12);
      expect(date.getDay()).toEqual(1);
    });
  });

  describe('The daysTo method', () => {
    it('Returns the difference in days', () => {
      expect(new sd.SimpleDate(2010, 1, 1).daysTo(new sd.SimpleDate(2010, 1, 10))).toEqual(9);
      expect(new sd.SimpleDate(2010, 1, 10).daysTo(new sd.SimpleDate(2010, 1, 1))).toEqual(-9);
    });
    it('Works across months', () => {
      expect(new sd.SimpleDate(2010, 1, 1).daysTo(new sd.SimpleDate(2010, 2, 10))).toEqual(40);
      expect(new sd.SimpleDate(2010, 2, 10).daysTo(new sd.SimpleDate(2010, 1, 1))).toEqual(-40);
    });
    it('Works across years', () => {
      expect(new sd.SimpleDate(2010, 1, 1).daysTo(new sd.SimpleDate(2011, 2, 10))).toEqual(405);
      expect(new sd.SimpleDate(2011, 2, 10).daysTo(new sd.SimpleDate(2010, 1, 1))).toEqual(-405);
    });
    it('Returns zero for equal dates', () => {
      expect(new sd.SimpleDate(2010, 1, 1).daysTo(new sd.SimpleDate(2010, 1, 1))).toEqual(0);
    });
  });

  describe('The equal method', () => {
    it('Equivalent dates are equal', function() {
      let date1 = new sd.SimpleDate(2010, 1, 1);
      let date2 = new sd.SimpleDate(2010, 1, 1);
      expect(date1 === date2).toBeFalsy();
      expect(date1.equals(date2)).toBeTruthy();
      expect(date2.equals(date1)).toBeTruthy();
    });
    it('Different dates are not equal', function() {
      let date1 = new sd.SimpleDate(2012, 9, 9);
      let date2 = new sd.SimpleDate(2010, 1, 1);
      expect(date1 !== date2).toBeTruthy();
      expect(date1.equals(date2)).toBeFalsy();
      expect(date2.equals(date1)).toBeFalsy();
    });
  });

  describe('The incrementByDays method', () => {
    it('Shifts the date correctly', () => {
      let date = new sd.SimpleDate(2010, 1, 1);
      date.incrementByDays(405);
      expect(date.equals(new sd.SimpleDate(2011, 2, 10))).toBeTruthy();
      date.incrementByDays(-405);
      expect(date.equals(new sd.SimpleDate(2010, 1, 1))).toBeTruthy();
    });
  });

  describe('Remaining features', () => {
    it('work', () => {
      pending('Needs to implement test');
    });
  });
});
