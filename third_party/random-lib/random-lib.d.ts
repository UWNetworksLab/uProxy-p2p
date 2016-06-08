/// <reference path='../typings/browser.d.ts' />

// TypeScript definitions for random-lib:
//   https://github.com/fardog/node-random-lib

declare module 'random-lib' {
  interface MinMaxOptions {
    min?: number; // Minimum bound, inclusive.
    max?: number; // Maximum bound, exclusive.
  }

  interface MultiOptions {
    num?: number;
    unique?: boolean;
  }

  interface RandomIntsOptions extends MinMaxOptions, MultiOptions {
    num?: number;
    unique?: boolean;
  }

  interface RandomFloatsOptions extends MultiOptions { }

  function randomInt(options: MinMaxOptions,
  	  callback?: (e:Error, result: number) => any): number;
  function randomInts(options: RandomIntsOptions,
  	  callback?: (e: Error, results: number[]) => any): number[];

  function randomFloat(options: {},
  	  callback?: (e: Error, result: number) => any): number;
  function randomFloats(options: RandomFloatsOptions,
  	  callback?: (e: Error, results: number[]) => any): number[];
}
