var tote = require('../');
var PouchDB = require('pouchdb');
var test = require('tape');

PouchDB.plugin(tote);

function makeDb() {
    return new PouchDB('tote-test-' + new Date().getTime().toString());
}

test('plugin creates define method', function (t) {
    var db = makeDb();
    t.ok(db.define, 'define exists');
    db.destroy();
    t.end();
});

test('define a model', function (t) {
    var db = makeDb();
    db.define('band');
    t.ok(db.band, 'band exists');
    db.destroy();
    t.end();
});

test('save an item', function (t) {
    var db = makeDb();
    db.define('band');
    db.band.save({name: 'Melvins'}).then(function (result) {
        t.ok(result, 'save returned an object');
        return db.get(result.id);
    }).then(function(band) {
        t.ok(band, 'get returned an object');
        t.equal(band.name, 'Melvins', 'band name was set');
        db.destroy();
        t.end();
    });
});

test('create a validation', function (t) {
    var db = makeDb();
    db.define('band', {
        validate: function (band) {
            if (!band.name) {
                return {name: 'Missing name'};
            }
            return undefined;
        }
    });
    db.band.save({foo: 'bar'}, function (err, result) {
        t.ok(err, 'expected validation error');
        t.equal(err.name, 'Missing name', 'error message returned');
        t.notOk(result, 'expected no result');
        db.destroy();
        t.end();
    });
});

test('create a validation - promise version', function (t) {
    var db = makeDb();
    db.define('band', {
        validate: function (band) {
            if (!band.name) {
                return {name: 'Missing name'};
            }
            return undefined;
        }
    });
    t.plan(2);
    db.band.save({foo: 'bar'}).catch(function(err){
        t.ok(err, 'err is truthy');
        t.ok(err.name, 'err is an object with a name key');
        db.destroy();
    });
});

test('default id generator uses model name', function (t) {
    var db = makeDb();
    db.define('band');
    db.band.save({name: 'Melvins'}).then(function (result) {
        t.equal(result.id.substr(0,5), 'band_', 'id prefixed with band_');
        db.destroy();
        t.end();
    });
});

test('retrieve items', function(t) {
    var db = makeDb();
    db.define('band');
    db.band.save({name: 'Melvins'}).then(function (band) {
        db.band.all(function (err, bands) {
            t.notOk(err, 'err is undefined');
            t.ok(bands, 'bands is defined');
            t.equal(bands.length, 1 , 'there is one band');
            db.destroy();
            t.end();
        });
    });
});

test('specify id segment generator', function (t) {
    var db = makeDb();
    db.define('band', {
        generateIdSegments: function (band) {
            return ['group', band.name];
        }
    });
    db.band.save({name: 'Chavez'}).then(function (result) {
        t.equal(result.id, 'group_chavez', 'id created from generateIdSegments');
        db.destroy();
        t.end();
    });
});

test('specify id generator', function (t) {
    var db = makeDb();
    db.define('band', {
        generateId: function (band) {
            return 'prince';
        }
    });
    db.band.save({name: 'Chavez'}).then(function (result) {
        t.equal(result.id, 'prince', 'id created from generateId');
        db.destroy();
        t.end();
    });
});

test('specify allDocs query', function(t) {
    var db = makeDb();
    db.define('band', {
        generateIdSegments: function(band) {
            return ['band', band.genre, band.name];
        },
        queries: {
            inGenre: {
                optGenerator: function(genre) {
                    return {
                        startkey: 'band_' + genre + '_',
                        endkey: 'band_' + genre + '_\uffff'
                    };
                }
            }
        }
    });
    t.ok(db.band.inGenre, 'query function created');
    db.band.save({name: 'Bad Brains', genre: 'punk'}).then(function() {
        return db.band.save({name: 'Q And Not U', genre: 'rock'});
    }).then(function() {
        return db.band.save({name: 'Trouble Funk', genre: 'gogo'});
    }).then(function() {
        db.band.inGenre('rock', function(err, bands) {
            t.notOk(err, 'no error returned');
            t.ok(bands, 'bands is truthy');
            t.equal(bands.length, 1, '1 rock band returned');
            t.equal(bands[0].name, 'Q And Not U', 'correct band returned');
            db.destroy();
            t.end();
        });
    });
});

test('specify action', function(t) {
    var db = makeDb();
    db.define('bands', {
        actions: {
            rate: function(db, rating) {
                return db._db_name + rating;
            }
        }
    });
    t.equal(db._db_name + 'awesome', db.bands.rate('awesome'));
    db.destroy();
    t.end();
});

// TODO: Revisit this test once define is async
test.skip('specify view', function(t) {
    var db = makeDb();
    db.define('bands', {
        views: {
            rating: function(doc) {
                if (doc.rating) {
                    emit(doc.rating);
                }
            }
        },
        queries: {
            withRating: {
                view: 'rating',
                optGenerator: function(rating) {
                    return {
                        startkey: rating,
                        endkey: rating + '_\uffff'
                    };
                }
            }
        }
    });
    db.get('_design/rating').then(function(ddoc){
        t.ok(ddoc);
    }).catch(function(err){
        t.fail(err);
    });
    db.destroy();
    t.end();
});
