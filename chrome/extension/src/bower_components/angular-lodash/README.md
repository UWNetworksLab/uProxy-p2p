# An AngularJS module adapting lodash

A fork of [angular-underscore](https://github.com/floydsoft/angular-underscore)

This module exposes lodash's API into angular app's root scope,
and provides some filters from lodash.


## How to use

### Install

After loading angular.js and lodash.js:

```html
<script type="text/javascript" src="angular-lodash.js"></script>
```

### Load angular-lodash

#### Load the whole library

```javascript
angular.module('app', ['angular-lodash']);
```

### Usecase

```html
<script type="text/javascript">
  angular.module('example', ['angular-lodash']);
</script>

<body ng-app="example">
  <!-- generate 10 unduplicated random number from 0 to 9 -->
  <div ng-repeat="num in range(10)|shuffle">{{num}}</div>
</body>
```
