# PrisimicScout
This package extract data from Prisimic Query Results using a JSON like GraphQL style

## Install

```bash
npm install prisimic-scout --save
```

or

```bash
yarn add prisimic-scout
```

## Documentation

### Instance

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

```js
restriveFromData(
    Array <results>,
    Object <fileds> 
)
```

#### example

```js
/*
 * Inside a Prismic Query
 */
Scout.retriveFromData(results, {
    "title": {
        "_type": "text"
    },
    "description": {
        "_type": "richtext"
    },
    "image": {
        "url": {}
    }
})
```

##License

This project is under MIT license, 2017, ⓒ Antonio Dal Sie. Read more in LICENSE.
