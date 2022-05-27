# Logical Config

[![Sponsor Me!](https://img.shields.io/badge/%F0%9F%92%B8-Sponsor%20Me!-blue)](https://github.com/sponsors/nathan-fiscaletti)
[![Downloads](https://img.shields.io/npm/dw/logical-config)](https://www.npmjs.com/package/logical-config)
[![GitHub stars](https://img.shields.io/github/stars/nathan-fiscaletti/logical-config)](https://github.com/nathan-fiscaletti/logical-config/stargazers)
[![GitHub issues](https://img.shields.io/github/issues/nathan-fiscaletti/logical-config)](https://github.com/nathan-fiscaletti/logical-config/issues)
[![GitHub license](https://img.shields.io/github/license/nathan-fiscaletti/logical-config)](https://github.com/nathan-fiscaletti/logical-config/blob/main/LICENSE)

The logical-config Java Script package allows you, through a short-hand notation, to invoke functions directly from your configuration files at load-time and map configuration entries to variables, classes, or functions.

## Install

```sh
$ yarn add logical-config
```

## Index

- [Simple Example](#simple-example)
- [Documentation](#documentation)
  - [Path Objects](#path-objects)
    - [Short-hand](#path-object-short-hand)
  - [The `.fill()` function](#the-fill-function)
- [Advanced Examples](#advanced-examples)
  - [Retrieving Properties](#retrieving-properties)
  - [Using Functions](#using-functions)
  - [Using Classes](#using-classes)
  - [Winston Logical Config](#winston-logical-config)

## Simple Example

`config.yaml`
```yaml
Data:
    Connection: "{data.getConnection}"
```

`test.js`
```js
const LogicalConfig = require('logical-config');

const yaml = require('js-yaml');
const fs   = require('fs');

const config = await LogicalConfig.fill(
    yaml.load(fs.readFileSync('./config.yaml', 'utf8')),
    {
        data: {
            getConnection: async () => Promise.resolve({ connected: true })
        }
    }
);

console.log(config);
```

`output`
```js
{ Data: { Connection: { connected: true } } }
```

## Documentation

### Path Objects

Path objects tell the LogicalConfig how to look up the desired value.

Each path object consists of three properties.

|Property|Required|Default|Description|
|---|---|---|---|
|path|Yes|`undefined`|The dot path at which the desired value can be found in the map.|
|parameters|No|`[]`|When the value found at the specified path is callable, and the `call` property is enabled, this is a list of parameters that will be passed to it.|
|call|No|`true`|If the value found at the specified path is callable, this boolean indicates if the response of calling that value should be used, or the value itself.|

**Example Path Object**
```js
{
    path: 'user.isOlderThan',
    parameters: [ 18 ],
    call: true
}
```

#### Path Object Short-hand

- Short-hand path objects should be written as strings and wrapped with `{}`.
- Each property should be dilmited with a semi-colon `;`.
- The properties should be listed in the order of (`path`, `parameters`, `call`).
- The `parameters` property should be a JSON encoded array.
- At least the `path` property must be specified.

The above example path object can be written in short hand like this:

```js
"{user.isOlderThan;[18]}"
```

You can attempt to parse a short-hand path object yourself using the `.parsePathObject()` function.

```js
const parsed = LogicalConfig.parsePathObject(`{user.setName;["Nathan"]}`);
console.log(parsed);
```
```
{ path: 'user.setName', parameters: [ 'Nathan' ], call: true }
```

### The `.fill()` function

```js
const config = await LogicalConfig.fill(...
```

The `.fill()` function takes an input object and a map of available pathings and will replace each instance of a [Path Object](#path-objects) with the value it describes. This will be performed on the input object recursively until all path objects have been parsed, at which point the finalized object will be returned.

**Parameters**

|Parameter|Required|Description|
|---|---|---|
|input|Yes|The input object that will be parsed. Can be an array of [Path Objects](#path-objects), a single Path Object, or an object in which any value (at any depth) is either an array of Path Objects or a Path Object.|
|map|Yes|An object representing the map to which path objects correspond.|

**Return**

The new object.

## Advanced Examples

### Retrieving Properties

1. **Retrieve a property from the map using short-hand**

   ```js
   const res = await LogicalConfig.fill('{user.age}', {
       user: {
           age: 27
       }
   });
   console.log(res); // Outputs: 27
   ```

### Using Functions

1. **Call a function from the map using short-hand**

   ```js
   const res = await LogicalConfig.fill('{user.getName}', {
       user: {
           getName: () => "Nathan"
       }
   });
   console.log(res); // Outputs: "Nathan"
   ```

2. **Call a function with parameters from the map using short-hand**

   ```js
   const res = await LogicalConfig.fill(`{user.info;[{"name":"Nathan"}, 27]}`, {
       user: {
           info: ({name}, age) => ({name, age})
       }
   });
   console.log(res); // Outputs: { name: 'Nathan', age: 27 }
   ```

3. **Retrieve a function as a value from the map using short-hand**

   By default, if a property is callable (is a class or a function), it will be invoked and it's return value will be used. You can override this by setting the `call` parameter of the [Path Object](#path-objects) to `false`.

   ```js
   const res = await LogicalConfig.fill(`{user.info;;false}`, {
       user: {
           info: () => {}
       }
   });
   console.log(res); // Outputs: [Function: info]
   ```

### Using Classes

1. **Retrieve a new instance of a class from the map using short-hand**

   ```js
   const res = await LogicalConfig.fill('{person.c}', {
       person: {
           c: class {
               constructor() {
                   this.name = "Nathan";
               }
           }
       }
   });
   console.log(res); // Outputs: c { name: 'Nathan' }
   ```

2. **Retrieve a new instance of a class with parameters from the map using short-hand**

   ```js
   const res = await LogicalConfig.fill('{person.c;["Nathan"]}', {
       person: {
           c: class {
               constructor(name) {
                   this.name = name;
               }
           }
       }
   });
   console.log(res); // Outputs: c { name: 'Nathan' }
   ```

3. **Retrieve a class as a value from the map using short-hand.**

   By default, if a property is callable (is a class or a function), it will be invoked and it's return value will be used. You can override this by setting the `call` parameter of the [Path Object](#path-objects) to `false`.

   ```js
   const res = await LogicalConfig.fill('{person.c;;false}', {
       person: {
           c: class {}
       }
   });
   console.log(res); // Outputs: [class c]
   ```

### Winston Logical Config

See [Winston Logical Config](https://github.com/nathan-fiscaletti/winston-logical-config) for a practical example.