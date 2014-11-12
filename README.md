# tote

A data model plugin for [PouchDB](http://pouchdb.com/).

[![Build Status](https://travis-ci.org/jwalgran/tote.png)](https://travis-ci.org/jwalgran/tote)

## Getting Started

```
var PouchDB = require('pouchdb');
var tote = require('tote');
PouchDB.plugin(tote);

var db = new PouchDB('music');
db.define('band': {
    generateId: function (band) {
        return band.name;
    },
    validate: function (band) {
        if (!band.name) {
            return {name: 'Missing name'}
        }
        return undefined; // Valid, do not return an error object
    }
});

db.band.save({ name: 'Melvins' }, function (err) {
    if (!err) {
        db.band.all(function(bands) {
            console.log(bands);
        });
    } else {
        console.log(err);
    }
});
```

## API

``tote`` is a PouchDB [plug in](http://pouchdb.com/api.html#plugins). Install it like so:

```
var PouchDB = require('pouchdb');
var tote = require('tote');
PouchDB.plugin(tote);
```

will add a ``define`` function to all PouchDB instances.

### db.define(modelName \[,options])

Define a named set of documents within the database. After calling
``define``, the ``db`` instance will have a ``modelName`` key under
which a ``save`` function and other query and actions functions are
added.

#### Options

##### generateId (function)

When saving a new document, this function will be invoked and passed
the object to be saved as an argument. ``generateId`` should return a
string that uniquely identifies the document.

##### generateIdSegments (function)

This is a different document ID generation function that takes
precedence over ``generateId``. Instead of returning a single string,
``generateIdSegments`` should return an array of strings, which will
be "[slugified](https://www.npmjs.org/package/slug)" and joined with "_" to create the id for a document
being saved.

##### validate (function)

This function will be invoked and passed a prospective object before
it is saved to the database. If the object is valid, this function
should return ``undefined``. Returning any truthy value will prevent
the object from being saved.

##### queries (object)

A set of named functions that are used to transform arguments into
PouchDB queries

##### actions (object)

### db.modelName.all()

Returns all documents of the ``modelName`` type.

### db.modelName.queryName([arg1, arg2, ... argN)

Run a query on either the ``allDocs`` index or a custom view.

### db.modelName.actionName(arg1, arg2, ... argN)

Run a function in the context of a database instance.

## Releases

### 1.1.0

The ``model.save`` method now returns a promise in all cases.

### 1.0.0

Initial
