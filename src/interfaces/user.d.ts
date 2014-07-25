/**
 * The 'User' type is used both in uProxy's core and UI, so there will be a base
 * interface to be extended as classes specific to particular components.
 */

/// <reference path='../uproxy.ts' />

interface BaseUser {
  userId :string;
  name :string;
}
