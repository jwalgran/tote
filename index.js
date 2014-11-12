var _ = require('lodash');
var slug = require('slug');
var Promise = require('lie');

function id (o) {
    if (_.isObject(o)) {
        return o._id;
    } else {
        return o;
    }
}

function makeIdSegment(string) {
    return slug(string).toLowerCase();
}

function generateId(model, data) {
    if (data._id) {
        return data._id;
    } else if (_.isFunction(model.generateIdSegments)) {
        return idFromSegments(model.generateIdSegments(data));
    } else if (_.isFunction(model.generateId)) {
        return model.generateId(data);
    } else {
        throw new Error('The model must have either a generateIdSegments function or a generateId function');
    }
}

function save(db, model, data, cb) {
    if (!_.isObject(data)) {
        throw new Error("data must be an object");
    }
    var id = generateId(model, data),
        failures = model.validate(data);
    if (failures) {
        if (_.isFunction(cb)) {
            cb(failures);
        }
        return new Promise(function(resolve, reject){
            reject(failures);
        });
    }
    return db.put(data, id, cb);
}

function buildDesignDoc(name, mapFunction) {
    var ddoc = {
        _id: '_design/' + name,
        views: {}
    };
    ddoc.views[name] = { map: mapFunction.toString() };
    return ddoc;
}

function overwriteDesignDoc(db, newDoc, name) {
    // TODO: This is an ugly "just get something working" solution.
    // TODO: Don't bother recreating the doc if the content is the same
    // TODO: handle failure
    db.get(newDoc._id).then(function(existingDoc){
        newDoc._rev = existingDoc._rev;
        db.put(newDoc);
    }).catch(function(err){
        if (err.status && err.status === 404) {
            db.put(newDoc);
        }
    });
};

function idFromSegments (segments) {
    var mapOver = arguments.length === 1 ? segments : arguments;
    return _.map(mapOver, makeIdSegment).join('_');
}

function nowString () {
    return new Date().getTime().toString();
}

function makeDefaultIdGenerator (modelName) {
    return function () {
        return idFromSegments(modelName, nowString());
    };
}

function defaultValidtion (o) {
    return undefined; // No validation errors
}

module.exports = {
    define: function(/* arguments */) {
        var db = this,
            models = {};
        if (arguments.length > 1) {
            models[(arguments[0])] = arguments[1];
        } else {
            if (_.isString(arguments[0])) {
                models[arguments[0]] = {};
            } else {
                models = arguments[0];
            }
        }
        _.each(models, function(m, modelName) {
            var model = _.extend({
                generateId: makeDefaultIdGenerator(modelName),
                validate: defaultValidtion
            }, m);

            // Dynamically add a 'save' method for each model
            db[modelName] = db[modelName] || {};
            db[modelName].save = _.partial(save, db, model);

            // TODO: Adding documents is async, but "define" is not set up
            // TODO: to take a callback
            // // Add design documents for views
            // if (model.views) {
            //     _.each(model.views, function(viewFn, viewName) {
            //         var ddoc = buildDesignDoc(viewName, viewFn);
            //         overwriteDesignDoc(db, ddoc, viewName);
            //     });
            // }

            // Append allDocs query functions defined in the models
            if (model.queries) {
                _.each(model.queries, function(queryDef, queryName) {
                    db[modelName] = db[modelName] || {};
                    db[modelName][queryName] = function() {
                        var args = Array.prototype.slice.call(arguments),
                            cb = args.pop(),
                            generatedOpts = queryDef.optGenerator.apply(null, args),
                            opts = _.extend({include_docs: true}, generatedOpts),
                            resultHandler = function(result) {
                                var docs = _.map(result.rows, 'doc');
                                if (generatedOpts.limit && generatedOpts.limit === 1) {
                                    docs = docs.length ? docs[0] : null;
                                }
                                cb(null, docs);
                            };
                        if (queryDef.view) {
                            db.query(queryDef.view, opts).then(resultHandler);
                        } else {
                            db.allDocs(opts).then(resultHandler);
                        }
                    };
                });
            }

            db[modelName] = db[modelName] || {};
            db[modelName].all = function(cb) {
                var idPrefix = model.idPrefix || modelName;
                return new Promise(function (resolve, reject) {
                    db.allDocs({
                        include_docs: true,
                        startkey: idPrefix + '_',
                        endkey: idPrefix + '_\uffff'
                    }, function(err, results) {
                        if (err) {
                            if (_.isFunction(cb)) {
                                cb(err, null);
                            }
                            reject(err);
                        } else {
                            var docs = _.pluck(results.rows, 'doc');
                            if (_.isFunction(cb)) {
                                cb(null, docs);
                            }
                            resolve(docs);
                        }
                    });
                });
            };

            // Append actions defined in the models
            if (model.actions) {
                _.each(model.actions, function(action, actionName) {
                    db[modelName] = db[modelName] || {};
                    db[modelName][actionName] = _.partial(action, db);
                });
            }
        });
    }
};
