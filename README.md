# PrismicScout
[![npm version](https://badge.fury.io/js/prismic-scout.svg)](http://badge.fury.io/js/prismic-scout)

This package extract data from Prismic Query Results using a JSON like GraphQL style

## Install

```bash
npm install prismic-scout --save
```

or

```bash
yarn add prismic-scout
```

## Documentation

### Instance

```js
restriveFromData(
    Object <api>,
    Object <options> 
)
```

#### example

```js
const PrismicScout = require('prismic-scout');
...
/*
 * Get Prismic api now we can use `api` variable
 */
...
const Scout = new PrismicScout(api);
```

## Methods

### retriveFromData

For array of documents

```js
restriveFromData(
    Array <results>,
    Object <fileds>,
    Object <options>
)
```

#### example

```js
/*
 * Inside a Prismic `query` then function
 */
Scout.retriveFromData(results, {
    "title": {
        "_type": "text"
    },
    "description": {
        "_type": "html"
    },
    "image": {
        "url": {}
    }
})
```

### retriveSingle

For single of document

```js
restriveFromData(
    Object <doc>,
    Object <fileds>,
    Object <options>
)
```

#### example

```js
/*
 * Inside a Prismic `getByID` then function
 */
Scout.retriveSingle(doc, {
    "title": {
        "_type": "text"
    },
    "description": {
        "_type": "html"
    },
    "image": {
        "url": {}
    }
})
```

## Options

### `clean` (default: true)
Extract from document data field and append 'id','uid' and 'lang';

### `id` (default: true)
Append id value to object (*without id Scout cannot retrive nested document*)

### `uid` (default: true)
Append uid value to object

### `lang` (default: true)
Append lang value to object

#### example

```js
    /* Set global options */
    const Scout = new PrismicScout(api, {uid: false, lang: false});

    /* Set single options (merged with global options) */
    Scout.retriveFromData(results, {
        "title": {
            "_type": 'html'
        }
    },{
        lang: true // { uid: false, lang: true }
    });
```

## License

This project is under MIT license, 2017, ⓒ Antonio Dal Sie. Read more in LICENSE.
