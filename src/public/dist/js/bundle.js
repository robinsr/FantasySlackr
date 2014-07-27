/*global setImmediate: false, setTimeout: false, console: false */
(function () {

    var async = {};

    // global on the server, window in the browser
    var root, previous_async;

    root = this;
    if (root != null) {
      previous_async = root.async;
    }

    async.noConflict = function () {
        root.async = previous_async;
        return async;
    };

    function only_once(fn) {
        var called = false;
        return function() {
            if (called) throw new Error("Callback was already called.");
            called = true;
            fn.apply(root, arguments);
        }
    }

    //// cross-browser compatiblity functions ////

    var _each = function (arr, iterator) {
        if (arr.forEach) {
            return arr.forEach(iterator);
        }
        for (var i = 0; i < arr.length; i += 1) {
            iterator(arr[i], i, arr);
        }
    };

    var _map = function (arr, iterator) {
        if (arr.map) {
            return arr.map(iterator);
        }
        var results = [];
        _each(arr, function (x, i, a) {
            results.push(iterator(x, i, a));
        });
        return results;
    };

    var _reduce = function (arr, iterator, memo) {
        if (arr.reduce) {
            return arr.reduce(iterator, memo);
        }
        _each(arr, function (x, i, a) {
            memo = iterator(memo, x, i, a);
        });
        return memo;
    };

    var _keys = function (obj) {
        if (Object.keys) {
            return Object.keys(obj);
        }
        var keys = [];
        for (var k in obj) {
            if (obj.hasOwnProperty(k)) {
                keys.push(k);
            }
        }
        return keys;
    };

    //// exported async module functions ////

    //// nextTick implementation with browser-compatible fallback ////
    if (typeof process === 'undefined' || !(process.nextTick)) {
        if (typeof setImmediate === 'function') {
            async.nextTick = function (fn) {
                // not a direct alias for IE10 compatibility
                setImmediate(fn);
            };
            async.setImmediate = async.nextTick;
        }
        else {
            async.nextTick = function (fn) {
                setTimeout(fn, 0);
            };
            async.setImmediate = async.nextTick;
        }
    }
    else {
        async.nextTick = process.nextTick;
        if (typeof setImmediate !== 'undefined') {
            async.setImmediate = setImmediate;
        }
        else {
            async.setImmediate = async.nextTick;
        }
    }

    async.each = function (arr, iterator, callback) {
        callback = callback || function () {};
        if (!arr.length) {
            return callback();
        }
        var completed = 0;
        _each(arr, function (x) {
            iterator(x, only_once(function (err) {
                if (err) {
                    callback(err);
                    callback = function () {};
                }
                else {
                    completed += 1;
                    if (completed >= arr.length) {
                        callback(null);
                    }
                }
            }));
        });
    };
    async.forEach = async.each;

    async.eachSeries = function (arr, iterator, callback) {
        callback = callback || function () {};
        if (!arr.length) {
            return callback();
        }
        var completed = 0;
        var iterate = function () {
            iterator(arr[completed], function (err) {
                if (err) {
                    callback(err);
                    callback = function () {};
                }
                else {
                    completed += 1;
                    if (completed >= arr.length) {
                        callback(null);
                    }
                    else {
                        iterate();
                    }
                }
            });
        };
        iterate();
    };
    async.forEachSeries = async.eachSeries;

    async.eachLimit = function (arr, limit, iterator, callback) {
        var fn = _eachLimit(limit);
        fn.apply(null, [arr, iterator, callback]);
    };
    async.forEachLimit = async.eachLimit;

    var _eachLimit = function (limit) {

        return function (arr, iterator, callback) {
            callback = callback || function () {};
            if (!arr.length || limit <= 0) {
                return callback();
            }
            var completed = 0;
            var started = 0;
            var running = 0;

            (function replenish () {
                if (completed >= arr.length) {
                    return callback();
                }

                while (running < limit && started < arr.length) {
                    started += 1;
                    running += 1;
                    iterator(arr[started - 1], function (err) {
                        if (err) {
                            callback(err);
                            callback = function () {};
                        }
                        else {
                            completed += 1;
                            running -= 1;
                            if (completed >= arr.length) {
                                callback();
                            }
                            else {
                                replenish();
                            }
                        }
                    });
                }
            })();
        };
    };


    var doParallel = function (fn) {
        return function () {
            var args = Array.prototype.slice.call(arguments);
            return fn.apply(null, [async.each].concat(args));
        };
    };
    var doParallelLimit = function(limit, fn) {
        return function () {
            var args = Array.prototype.slice.call(arguments);
            return fn.apply(null, [_eachLimit(limit)].concat(args));
        };
    };
    var doSeries = function (fn) {
        return function () {
            var args = Array.prototype.slice.call(arguments);
            return fn.apply(null, [async.eachSeries].concat(args));
        };
    };


    var _asyncMap = function (eachfn, arr, iterator, callback) {
        var results = [];
        arr = _map(arr, function (x, i) {
            return {index: i, value: x};
        });
        eachfn(arr, function (x, callback) {
            iterator(x.value, function (err, v) {
                results[x.index] = v;
                callback(err);
            });
        }, function (err) {
            callback(err, results);
        });
    };
    async.map = doParallel(_asyncMap);
    async.mapSeries = doSeries(_asyncMap);
    async.mapLimit = function (arr, limit, iterator, callback) {
        return _mapLimit(limit)(arr, iterator, callback);
    };

    var _mapLimit = function(limit) {
        return doParallelLimit(limit, _asyncMap);
    };

    // reduce only has a series version, as doing reduce in parallel won't
    // work in many situations.
    async.reduce = function (arr, memo, iterator, callback) {
        async.eachSeries(arr, function (x, callback) {
            iterator(memo, x, function (err, v) {
                memo = v;
                callback(err);
            });
        }, function (err) {
            callback(err, memo);
        });
    };
    // inject alias
    async.inject = async.reduce;
    // foldl alias
    async.foldl = async.reduce;

    async.reduceRight = function (arr, memo, iterator, callback) {
        var reversed = _map(arr, function (x) {
            return x;
        }).reverse();
        async.reduce(reversed, memo, iterator, callback);
    };
    // foldr alias
    async.foldr = async.reduceRight;

    var _filter = function (eachfn, arr, iterator, callback) {
        var results = [];
        arr = _map(arr, function (x, i) {
            return {index: i, value: x};
        });
        eachfn(arr, function (x, callback) {
            iterator(x.value, function (v) {
                if (v) {
                    results.push(x);
                }
                callback();
            });
        }, function (err) {
            callback(_map(results.sort(function (a, b) {
                return a.index - b.index;
            }), function (x) {
                return x.value;
            }));
        });
    };
    async.filter = doParallel(_filter);
    async.filterSeries = doSeries(_filter);
    // select alias
    async.select = async.filter;
    async.selectSeries = async.filterSeries;

    var _reject = function (eachfn, arr, iterator, callback) {
        var results = [];
        arr = _map(arr, function (x, i) {
            return {index: i, value: x};
        });
        eachfn(arr, function (x, callback) {
            iterator(x.value, function (v) {
                if (!v) {
                    results.push(x);
                }
                callback();
            });
        }, function (err) {
            callback(_map(results.sort(function (a, b) {
                return a.index - b.index;
            }), function (x) {
                return x.value;
            }));
        });
    };
    async.reject = doParallel(_reject);
    async.rejectSeries = doSeries(_reject);

    var _detect = function (eachfn, arr, iterator, main_callback) {
        eachfn(arr, function (x, callback) {
            iterator(x, function (result) {
                if (result) {
                    main_callback(x);
                    main_callback = function () {};
                }
                else {
                    callback();
                }
            });
        }, function (err) {
            main_callback();
        });
    };
    async.detect = doParallel(_detect);
    async.detectSeries = doSeries(_detect);

    async.some = function (arr, iterator, main_callback) {
        async.each(arr, function (x, callback) {
            iterator(x, function (v) {
                if (v) {
                    main_callback(true);
                    main_callback = function () {};
                }
                callback();
            });
        }, function (err) {
            main_callback(false);
        });
    };
    // any alias
    async.any = async.some;

    async.every = function (arr, iterator, main_callback) {
        async.each(arr, function (x, callback) {
            iterator(x, function (v) {
                if (!v) {
                    main_callback(false);
                    main_callback = function () {};
                }
                callback();
            });
        }, function (err) {
            main_callback(true);
        });
    };
    // all alias
    async.all = async.every;

    async.sortBy = function (arr, iterator, callback) {
        async.map(arr, function (x, callback) {
            iterator(x, function (err, criteria) {
                if (err) {
                    callback(err);
                }
                else {
                    callback(null, {value: x, criteria: criteria});
                }
            });
        }, function (err, results) {
            if (err) {
                return callback(err);
            }
            else {
                var fn = function (left, right) {
                    var a = left.criteria, b = right.criteria;
                    return a < b ? -1 : a > b ? 1 : 0;
                };
                callback(null, _map(results.sort(fn), function (x) {
                    return x.value;
                }));
            }
        });
    };

    async.auto = function (tasks, callback) {
        callback = callback || function () {};
        var keys = _keys(tasks);
        if (!keys.length) {
            return callback(null);
        }

        var results = {};

        var listeners = [];
        var addListener = function (fn) {
            listeners.unshift(fn);
        };
        var removeListener = function (fn) {
            for (var i = 0; i < listeners.length; i += 1) {
                if (listeners[i] === fn) {
                    listeners.splice(i, 1);
                    return;
                }
            }
        };
        var taskComplete = function () {
            _each(listeners.slice(0), function (fn) {
                fn();
            });
        };

        addListener(function () {
            if (_keys(results).length === keys.length) {
                callback(null, results);
                callback = function () {};
            }
        });

        _each(keys, function (k) {
            var task = (tasks[k] instanceof Function) ? [tasks[k]]: tasks[k];
            var taskCallback = function (err) {
                var args = Array.prototype.slice.call(arguments, 1);
                if (args.length <= 1) {
                    args = args[0];
                }
                if (err) {
                    var safeResults = {};
                    _each(_keys(results), function(rkey) {
                        safeResults[rkey] = results[rkey];
                    });
                    safeResults[k] = args;
                    callback(err, safeResults);
                    // stop subsequent errors hitting callback multiple times
                    callback = function () {};
                }
                else {
                    results[k] = args;
                    async.setImmediate(taskComplete);
                }
            };
            var requires = task.slice(0, Math.abs(task.length - 1)) || [];
            var ready = function () {
                return _reduce(requires, function (a, x) {
                    return (a && results.hasOwnProperty(x));
                }, true) && !results.hasOwnProperty(k);
            };
            if (ready()) {
                task[task.length - 1](taskCallback, results);
            }
            else {
                var listener = function () {
                    if (ready()) {
                        removeListener(listener);
                        task[task.length - 1](taskCallback, results);
                    }
                };
                addListener(listener);
            }
        });
    };

    async.waterfall = function (tasks, callback) {
        callback = callback || function () {};
        if (tasks.constructor !== Array) {
          var err = new Error('First argument to waterfall must be an array of functions');
          return callback(err);
        }
        if (!tasks.length) {
            return callback();
        }
        var wrapIterator = function (iterator) {
            return function (err) {
                if (err) {
                    callback.apply(null, arguments);
                    callback = function () {};
                }
                else {
                    var args = Array.prototype.slice.call(arguments, 1);
                    var next = iterator.next();
                    if (next) {
                        args.push(wrapIterator(next));
                    }
                    else {
                        args.push(callback);
                    }
                    async.setImmediate(function () {
                        iterator.apply(null, args);
                    });
                }
            };
        };
        wrapIterator(async.iterator(tasks))();
    };

    var _parallel = function(eachfn, tasks, callback) {
        callback = callback || function () {};
        if (tasks.constructor === Array) {
            eachfn.map(tasks, function (fn, callback) {
                if (fn) {
                    fn(function (err) {
                        var args = Array.prototype.slice.call(arguments, 1);
                        if (args.length <= 1) {
                            args = args[0];
                        }
                        callback.call(null, err, args);
                    });
                }
            }, callback);
        }
        else {
            var results = {};
            eachfn.each(_keys(tasks), function (k, callback) {
                tasks[k](function (err) {
                    var args = Array.prototype.slice.call(arguments, 1);
                    if (args.length <= 1) {
                        args = args[0];
                    }
                    results[k] = args;
                    callback(err);
                });
            }, function (err) {
                callback(err, results);
            });
        }
    };

    async.parallel = function (tasks, callback) {
        _parallel({ map: async.map, each: async.each }, tasks, callback);
    };

    async.parallelLimit = function(tasks, limit, callback) {
        _parallel({ map: _mapLimit(limit), each: _eachLimit(limit) }, tasks, callback);
    };

    async.series = function (tasks, callback) {
        callback = callback || function () {};
        if (tasks.constructor === Array) {
            async.mapSeries(tasks, function (fn, callback) {
                if (fn) {
                    fn(function (err) {
                        var args = Array.prototype.slice.call(arguments, 1);
                        if (args.length <= 1) {
                            args = args[0];
                        }
                        callback.call(null, err, args);
                    });
                }
            }, callback);
        }
        else {
            var results = {};
            async.eachSeries(_keys(tasks), function (k, callback) {
                tasks[k](function (err) {
                    var args = Array.prototype.slice.call(arguments, 1);
                    if (args.length <= 1) {
                        args = args[0];
                    }
                    results[k] = args;
                    callback(err);
                });
            }, function (err) {
                callback(err, results);
            });
        }
    };

    async.iterator = function (tasks) {
        var makeCallback = function (index) {
            var fn = function () {
                if (tasks.length) {
                    tasks[index].apply(null, arguments);
                }
                return fn.next();
            };
            fn.next = function () {
                return (index < tasks.length - 1) ? makeCallback(index + 1): null;
            };
            return fn;
        };
        return makeCallback(0);
    };

    async.apply = function (fn) {
        var args = Array.prototype.slice.call(arguments, 1);
        return function () {
            return fn.apply(
                null, args.concat(Array.prototype.slice.call(arguments))
            );
        };
    };

    var _concat = function (eachfn, arr, fn, callback) {
        var r = [];
        eachfn(arr, function (x, cb) {
            fn(x, function (err, y) {
                r = r.concat(y || []);
                cb(err);
            });
        }, function (err) {
            callback(err, r);
        });
    };
    async.concat = doParallel(_concat);
    async.concatSeries = doSeries(_concat);

    async.whilst = function (test, iterator, callback) {
        if (test()) {
            iterator(function (err) {
                if (err) {
                    return callback(err);
                }
                async.whilst(test, iterator, callback);
            });
        }
        else {
            callback();
        }
    };

    async.doWhilst = function (iterator, test, callback) {
        iterator(function (err) {
            if (err) {
                return callback(err);
            }
            if (test()) {
                async.doWhilst(iterator, test, callback);
            }
            else {
                callback();
            }
        });
    };

    async.until = function (test, iterator, callback) {
        if (!test()) {
            iterator(function (err) {
                if (err) {
                    return callback(err);
                }
                async.until(test, iterator, callback);
            });
        }
        else {
            callback();
        }
    };

    async.doUntil = function (iterator, test, callback) {
        iterator(function (err) {
            if (err) {
                return callback(err);
            }
            if (!test()) {
                async.doUntil(iterator, test, callback);
            }
            else {
                callback();
            }
        });
    };

    async.queue = function (worker, concurrency) {
        if (concurrency === undefined) {
            concurrency = 1;
        }
        function _insert(q, data, pos, callback) {
          if(data.constructor !== Array) {
              data = [data];
          }
          _each(data, function(task) {
              var item = {
                  data: task,
                  callback: typeof callback === 'function' ? callback : null
              };

              if (pos) {
                q.tasks.unshift(item);
              } else {
                q.tasks.push(item);
              }

              if (q.saturated && q.tasks.length === concurrency) {
                  q.saturated();
              }
              async.setImmediate(q.process);
          });
        }

        var workers = 0;
        var q = {
            tasks: [],
            concurrency: concurrency,
            saturated: null,
            empty: null,
            drain: null,
            push: function (data, callback) {
              _insert(q, data, false, callback);
            },
            unshift: function (data, callback) {
              _insert(q, data, true, callback);
            },
            process: function () {
                if (workers < q.concurrency && q.tasks.length) {
                    var task = q.tasks.shift();
                    if (q.empty && q.tasks.length === 0) {
                        q.empty();
                    }
                    workers += 1;
                    var next = function () {
                        workers -= 1;
                        if (task.callback) {
                            task.callback.apply(task, arguments);
                        }
                        if (q.drain && q.tasks.length + workers === 0) {
                            q.drain();
                        }
                        q.process();
                    };
                    var cb = only_once(next);
                    worker(task.data, cb);
                }
            },
            length: function () {
                return q.tasks.length;
            },
            running: function () {
                return workers;
            }
        };
        return q;
    };

    async.cargo = function (worker, payload) {
        var working     = false,
            tasks       = [];

        var cargo = {
            tasks: tasks,
            payload: payload,
            saturated: null,
            empty: null,
            drain: null,
            push: function (data, callback) {
                if(data.constructor !== Array) {
                    data = [data];
                }
                _each(data, function(task) {
                    tasks.push({
                        data: task,
                        callback: typeof callback === 'function' ? callback : null
                    });
                    if (cargo.saturated && tasks.length === payload) {
                        cargo.saturated();
                    }
                });
                async.setImmediate(cargo.process);
            },
            process: function process() {
                if (working) return;
                if (tasks.length === 0) {
                    if(cargo.drain) cargo.drain();
                    return;
                }

                var ts = typeof payload === 'number'
                            ? tasks.splice(0, payload)
                            : tasks.splice(0);

                var ds = _map(ts, function (task) {
                    return task.data;
                });

                if(cargo.empty) cargo.empty();
                working = true;
                worker(ds, function () {
                    working = false;

                    var args = arguments;
                    _each(ts, function (data) {
                        if (data.callback) {
                            data.callback.apply(null, args);
                        }
                    });

                    process();
                });
            },
            length: function () {
                return tasks.length;
            },
            running: function () {
                return working;
            }
        };
        return cargo;
    };

    var _console_fn = function (name) {
        return function (fn) {
            var args = Array.prototype.slice.call(arguments, 1);
            fn.apply(null, args.concat([function (err) {
                var args = Array.prototype.slice.call(arguments, 1);
                if (typeof console !== 'undefined') {
                    if (err) {
                        if (console.error) {
                            console.error(err);
                        }
                    }
                    else if (console[name]) {
                        _each(args, function (x) {
                            console[name](x);
                        });
                    }
                }
            }]));
        };
    };
    async.log = _console_fn('log');
    async.dir = _console_fn('dir');
    /*async.info = _console_fn('info');
    async.warn = _console_fn('warn');
    async.error = _console_fn('error');*/

    async.memoize = function (fn, hasher) {
        var memo = {};
        var queues = {};
        hasher = hasher || function (x) {
            return x;
        };
        var memoized = function () {
            var args = Array.prototype.slice.call(arguments);
            var callback = args.pop();
            var key = hasher.apply(null, args);
            if (key in memo) {
                callback.apply(null, memo[key]);
            }
            else if (key in queues) {
                queues[key].push(callback);
            }
            else {
                queues[key] = [callback];
                fn.apply(null, args.concat([function () {
                    memo[key] = arguments;
                    var q = queues[key];
                    delete queues[key];
                    for (var i = 0, l = q.length; i < l; i++) {
                      q[i].apply(null, arguments);
                    }
                }]));
            }
        };
        memoized.memo = memo;
        memoized.unmemoized = fn;
        return memoized;
    };

    async.unmemoize = function (fn) {
      return function () {
        return (fn.unmemoized || fn).apply(null, arguments);
      };
    };

    async.times = function (count, iterator, callback) {
        var counter = [];
        for (var i = 0; i < count; i++) {
            counter.push(i);
        }
        return async.map(counter, iterator, callback);
    };

    async.timesSeries = function (count, iterator, callback) {
        var counter = [];
        for (var i = 0; i < count; i++) {
            counter.push(i);
        }
        return async.mapSeries(counter, iterator, callback);
    };

    async.compose = function (/* functions... */) {
        var fns = Array.prototype.reverse.call(arguments);
        return function () {
            var that = this;
            var args = Array.prototype.slice.call(arguments);
            var callback = args.pop();
            async.reduce(fns, args, function (newargs, fn, cb) {
                fn.apply(that, newargs.concat([function () {
                    var err = arguments[0];
                    var nextargs = Array.prototype.slice.call(arguments, 1);
                    cb(err, nextargs);
                }]))
            },
            function (err, results) {
                callback.apply(that, [err].concat(results));
            });
        };
    };

    var _applyEach = function (eachfn, fns /*args...*/) {
        var go = function () {
            var that = this;
            var args = Array.prototype.slice.call(arguments);
            var callback = args.pop();
            return eachfn(fns, function (fn, cb) {
                fn.apply(that, args.concat([cb]));
            },
            callback);
        };
        if (arguments.length > 2) {
            var args = Array.prototype.slice.call(arguments, 2);
            return go.apply(this, args);
        }
        else {
            return go;
        }
    };
    async.applyEach = doParallel(_applyEach);
    async.applyEachSeries = doSeries(_applyEach);

    async.forever = function (fn, callback) {
        function next(err) {
            if (err) {
                if (callback) {
                    return callback(err);
                }
                throw err;
            }
            fn(next);
        }
        next();
    };

    // AMD / RequireJS
    if (typeof define !== 'undefined' && define.amd) {
        define([], function () {
            return async;
        });
    }
    // Node.js
    else if (typeof module !== 'undefined' && module.exports) {
        module.exports = async;
    }
    // included directly via <script> tag
    else {
        root.async = async;
    }

}());

/*! jQuery v1.8.3 jquery.com | jquery.org/license */
(function(e,t){function _(e){var t=M[e]={};return v.each(e.split(y),function(e,n){t[n]=!0}),t}function H(e,n,r){if(r===t&&e.nodeType===1){var i="data-"+n.replace(P,"-$1").toLowerCase();r=e.getAttribute(i);if(typeof r=="string"){try{r=r==="true"?!0:r==="false"?!1:r==="null"?null:+r+""===r?+r:D.test(r)?v.parseJSON(r):r}catch(s){}v.data(e,n,r)}else r=t}return r}function B(e){var t;for(t in e){if(t==="data"&&v.isEmptyObject(e[t]))continue;if(t!=="toJSON")return!1}return!0}function et(){return!1}function tt(){return!0}function ut(e){return!e||!e.parentNode||e.parentNode.nodeType===11}function at(e,t){do e=e[t];while(e&&e.nodeType!==1);return e}function ft(e,t,n){t=t||0;if(v.isFunction(t))return v.grep(e,function(e,r){var i=!!t.call(e,r,e);return i===n});if(t.nodeType)return v.grep(e,function(e,r){return e===t===n});if(typeof t=="string"){var r=v.grep(e,function(e){return e.nodeType===1});if(it.test(t))return v.filter(t,r,!n);t=v.filter(t,r)}return v.grep(e,function(e,r){return v.inArray(e,t)>=0===n})}function lt(e){var t=ct.split("|"),n=e.createDocumentFragment();if(n.createElement)while(t.length)n.createElement(t.pop());return n}function Lt(e,t){return e.getElementsByTagName(t)[0]||e.appendChild(e.ownerDocument.createElement(t))}function At(e,t){if(t.nodeType!==1||!v.hasData(e))return;var n,r,i,s=v._data(e),o=v._data(t,s),u=s.events;if(u){delete o.handle,o.events={};for(n in u)for(r=0,i=u[n].length;r<i;r++)v.event.add(t,n,u[n][r])}o.data&&(o.data=v.extend({},o.data))}function Ot(e,t){var n;if(t.nodeType!==1)return;t.clearAttributes&&t.clearAttributes(),t.mergeAttributes&&t.mergeAttributes(e),n=t.nodeName.toLowerCase(),n==="object"?(t.parentNode&&(t.outerHTML=e.outerHTML),v.support.html5Clone&&e.innerHTML&&!v.trim(t.innerHTML)&&(t.innerHTML=e.innerHTML)):n==="input"&&Et.test(e.type)?(t.defaultChecked=t.checked=e.checked,t.value!==e.value&&(t.value=e.value)):n==="option"?t.selected=e.defaultSelected:n==="input"||n==="textarea"?t.defaultValue=e.defaultValue:n==="script"&&t.text!==e.text&&(t.text=e.text),t.removeAttribute(v.expando)}function Mt(e){return typeof e.getElementsByTagName!="undefined"?e.getElementsByTagName("*"):typeof e.querySelectorAll!="undefined"?e.querySelectorAll("*"):[]}function _t(e){Et.test(e.type)&&(e.defaultChecked=e.checked)}function Qt(e,t){if(t in e)return t;var n=t.charAt(0).toUpperCase()+t.slice(1),r=t,i=Jt.length;while(i--){t=Jt[i]+n;if(t in e)return t}return r}function Gt(e,t){return e=t||e,v.css(e,"display")==="none"||!v.contains(e.ownerDocument,e)}function Yt(e,t){var n,r,i=[],s=0,o=e.length;for(;s<o;s++){n=e[s];if(!n.style)continue;i[s]=v._data(n,"olddisplay"),t?(!i[s]&&n.style.display==="none"&&(n.style.display=""),n.style.display===""&&Gt(n)&&(i[s]=v._data(n,"olddisplay",nn(n.nodeName)))):(r=Dt(n,"display"),!i[s]&&r!=="none"&&v._data(n,"olddisplay",r))}for(s=0;s<o;s++){n=e[s];if(!n.style)continue;if(!t||n.style.display==="none"||n.style.display==="")n.style.display=t?i[s]||"":"none"}return e}function Zt(e,t,n){var r=Rt.exec(t);return r?Math.max(0,r[1]-(n||0))+(r[2]||"px"):t}function en(e,t,n,r){var i=n===(r?"border":"content")?4:t==="width"?1:0,s=0;for(;i<4;i+=2)n==="margin"&&(s+=v.css(e,n+$t[i],!0)),r?(n==="content"&&(s-=parseFloat(Dt(e,"padding"+$t[i]))||0),n!=="margin"&&(s-=parseFloat(Dt(e,"border"+$t[i]+"Width"))||0)):(s+=parseFloat(Dt(e,"padding"+$t[i]))||0,n!=="padding"&&(s+=parseFloat(Dt(e,"border"+$t[i]+"Width"))||0));return s}function tn(e,t,n){var r=t==="width"?e.offsetWidth:e.offsetHeight,i=!0,s=v.support.boxSizing&&v.css(e,"boxSizing")==="border-box";if(r<=0||r==null){r=Dt(e,t);if(r<0||r==null)r=e.style[t];if(Ut.test(r))return r;i=s&&(v.support.boxSizingReliable||r===e.style[t]),r=parseFloat(r)||0}return r+en(e,t,n||(s?"border":"content"),i)+"px"}function nn(e){if(Wt[e])return Wt[e];var t=v("<"+e+">").appendTo(i.body),n=t.css("display");t.remove();if(n==="none"||n===""){Pt=i.body.appendChild(Pt||v.extend(i.createElement("iframe"),{frameBorder:0,width:0,height:0}));if(!Ht||!Pt.createElement)Ht=(Pt.contentWindow||Pt.contentDocument).document,Ht.write("<!doctype html><html><body>"),Ht.close();t=Ht.body.appendChild(Ht.createElement(e)),n=Dt(t,"display"),i.body.removeChild(Pt)}return Wt[e]=n,n}function fn(e,t,n,r){var i;if(v.isArray(t))v.each(t,function(t,i){n||sn.test(e)?r(e,i):fn(e+"["+(typeof i=="object"?t:"")+"]",i,n,r)});else if(!n&&v.type(t)==="object")for(i in t)fn(e+"["+i+"]",t[i],n,r);else r(e,t)}function Cn(e){return function(t,n){typeof t!="string"&&(n=t,t="*");var r,i,s,o=t.toLowerCase().split(y),u=0,a=o.length;if(v.isFunction(n))for(;u<a;u++)r=o[u],s=/^\+/.test(r),s&&(r=r.substr(1)||"*"),i=e[r]=e[r]||[],i[s?"unshift":"push"](n)}}function kn(e,n,r,i,s,o){s=s||n.dataTypes[0],o=o||{},o[s]=!0;var u,a=e[s],f=0,l=a?a.length:0,c=e===Sn;for(;f<l&&(c||!u);f++)u=a[f](n,r,i),typeof u=="string"&&(!c||o[u]?u=t:(n.dataTypes.unshift(u),u=kn(e,n,r,i,u,o)));return(c||!u)&&!o["*"]&&(u=kn(e,n,r,i,"*",o)),u}function Ln(e,n){var r,i,s=v.ajaxSettings.flatOptions||{};for(r in n)n[r]!==t&&((s[r]?e:i||(i={}))[r]=n[r]);i&&v.extend(!0,e,i)}function An(e,n,r){var i,s,o,u,a=e.contents,f=e.dataTypes,l=e.responseFields;for(s in l)s in r&&(n[l[s]]=r[s]);while(f[0]==="*")f.shift(),i===t&&(i=e.mimeType||n.getResponseHeader("content-type"));if(i)for(s in a)if(a[s]&&a[s].test(i)){f.unshift(s);break}if(f[0]in r)o=f[0];else{for(s in r){if(!f[0]||e.converters[s+" "+f[0]]){o=s;break}u||(u=s)}o=o||u}if(o)return o!==f[0]&&f.unshift(o),r[o]}function On(e,t){var n,r,i,s,o=e.dataTypes.slice(),u=o[0],a={},f=0;e.dataFilter&&(t=e.dataFilter(t,e.dataType));if(o[1])for(n in e.converters)a[n.toLowerCase()]=e.converters[n];for(;i=o[++f];)if(i!=="*"){if(u!=="*"&&u!==i){n=a[u+" "+i]||a["* "+i];if(!n)for(r in a){s=r.split(" ");if(s[1]===i){n=a[u+" "+s[0]]||a["* "+s[0]];if(n){n===!0?n=a[r]:a[r]!==!0&&(i=s[0],o.splice(f--,0,i));break}}}if(n!==!0)if(n&&e["throws"])t=n(t);else try{t=n(t)}catch(l){return{state:"parsererror",error:n?l:"No conversion from "+u+" to "+i}}}u=i}return{state:"success",data:t}}function Fn(){try{return new e.XMLHttpRequest}catch(t){}}function In(){try{return new e.ActiveXObject("Microsoft.XMLHTTP")}catch(t){}}function $n(){return setTimeout(function(){qn=t},0),qn=v.now()}function Jn(e,t){v.each(t,function(t,n){var r=(Vn[t]||[]).concat(Vn["*"]),i=0,s=r.length;for(;i<s;i++)if(r[i].call(e,t,n))return})}function Kn(e,t,n){var r,i=0,s=0,o=Xn.length,u=v.Deferred().always(function(){delete a.elem}),a=function(){var t=qn||$n(),n=Math.max(0,f.startTime+f.duration-t),r=n/f.duration||0,i=1-r,s=0,o=f.tweens.length;for(;s<o;s++)f.tweens[s].run(i);return u.notifyWith(e,[f,i,n]),i<1&&o?n:(u.resolveWith(e,[f]),!1)},f=u.promise({elem:e,props:v.extend({},t),opts:v.extend(!0,{specialEasing:{}},n),originalProperties:t,originalOptions:n,startTime:qn||$n(),duration:n.duration,tweens:[],createTween:function(t,n,r){var i=v.Tween(e,f.opts,t,n,f.opts.specialEasing[t]||f.opts.easing);return f.tweens.push(i),i},stop:function(t){var n=0,r=t?f.tweens.length:0;for(;n<r;n++)f.tweens[n].run(1);return t?u.resolveWith(e,[f,t]):u.rejectWith(e,[f,t]),this}}),l=f.props;Qn(l,f.opts.specialEasing);for(;i<o;i++){r=Xn[i].call(f,e,l,f.opts);if(r)return r}return Jn(f,l),v.isFunction(f.opts.start)&&f.opts.start.call(e,f),v.fx.timer(v.extend(a,{anim:f,queue:f.opts.queue,elem:e})),f.progress(f.opts.progress).done(f.opts.done,f.opts.complete).fail(f.opts.fail).always(f.opts.always)}function Qn(e,t){var n,r,i,s,o;for(n in e){r=v.camelCase(n),i=t[r],s=e[n],v.isArray(s)&&(i=s[1],s=e[n]=s[0]),n!==r&&(e[r]=s,delete e[n]),o=v.cssHooks[r];if(o&&"expand"in o){s=o.expand(s),delete e[r];for(n in s)n in e||(e[n]=s[n],t[n]=i)}else t[r]=i}}function Gn(e,t,n){var r,i,s,o,u,a,f,l,c,h=this,p=e.style,d={},m=[],g=e.nodeType&&Gt(e);n.queue||(l=v._queueHooks(e,"fx"),l.unqueued==null&&(l.unqueued=0,c=l.empty.fire,l.empty.fire=function(){l.unqueued||c()}),l.unqueued++,h.always(function(){h.always(function(){l.unqueued--,v.queue(e,"fx").length||l.empty.fire()})})),e.nodeType===1&&("height"in t||"width"in t)&&(n.overflow=[p.overflow,p.overflowX,p.overflowY],v.css(e,"display")==="inline"&&v.css(e,"float")==="none"&&(!v.support.inlineBlockNeedsLayout||nn(e.nodeName)==="inline"?p.display="inline-block":p.zoom=1)),n.overflow&&(p.overflow="hidden",v.support.shrinkWrapBlocks||h.done(function(){p.overflow=n.overflow[0],p.overflowX=n.overflow[1],p.overflowY=n.overflow[2]}));for(r in t){s=t[r];if(Un.exec(s)){delete t[r],a=a||s==="toggle";if(s===(g?"hide":"show"))continue;m.push(r)}}o=m.length;if(o){u=v._data(e,"fxshow")||v._data(e,"fxshow",{}),"hidden"in u&&(g=u.hidden),a&&(u.hidden=!g),g?v(e).show():h.done(function(){v(e).hide()}),h.done(function(){var t;v.removeData(e,"fxshow",!0);for(t in d)v.style(e,t,d[t])});for(r=0;r<o;r++)i=m[r],f=h.createTween(i,g?u[i]:0),d[i]=u[i]||v.style(e,i),i in u||(u[i]=f.start,g&&(f.end=f.start,f.start=i==="width"||i==="height"?1:0))}}function Yn(e,t,n,r,i){return new Yn.prototype.init(e,t,n,r,i)}function Zn(e,t){var n,r={height:e},i=0;t=t?1:0;for(;i<4;i+=2-t)n=$t[i],r["margin"+n]=r["padding"+n]=e;return t&&(r.opacity=r.width=e),r}function tr(e){return v.isWindow(e)?e:e.nodeType===9?e.defaultView||e.parentWindow:!1}var n,r,i=e.document,s=e.location,o=e.navigator,u=e.jQuery,a=e.$,f=Array.prototype.push,l=Array.prototype.slice,c=Array.prototype.indexOf,h=Object.prototype.toString,p=Object.prototype.hasOwnProperty,d=String.prototype.trim,v=function(e,t){return new v.fn.init(e,t,n)},m=/[\-+]?(?:\d*\.|)\d+(?:[eE][\-+]?\d+|)/.source,g=/\S/,y=/\s+/,b=/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g,w=/^(?:[^#<]*(<[\w\W]+>)[^>]*$|#([\w\-]*)$)/,E=/^<(\w+)\s*\/?>(?:<\/\1>|)$/,S=/^[\],:{}\s]*$/,x=/(?:^|:|,)(?:\s*\[)+/g,T=/\\(?:["\\\/bfnrt]|u[\da-fA-F]{4})/g,N=/"[^"\\\r\n]*"|true|false|null|-?(?:\d\d*\.|)\d+(?:[eE][\-+]?\d+|)/g,C=/^-ms-/,k=/-([\da-z])/gi,L=function(e,t){return(t+"").toUpperCase()},A=function(){i.addEventListener?(i.removeEventListener("DOMContentLoaded",A,!1),v.ready()):i.readyState==="complete"&&(i.detachEvent("onreadystatechange",A),v.ready())},O={};v.fn=v.prototype={constructor:v,init:function(e,n,r){var s,o,u,a;if(!e)return this;if(e.nodeType)return this.context=this[0]=e,this.length=1,this;if(typeof e=="string"){e.charAt(0)==="<"&&e.charAt(e.length-1)===">"&&e.length>=3?s=[null,e,null]:s=w.exec(e);if(s&&(s[1]||!n)){if(s[1])return n=n instanceof v?n[0]:n,a=n&&n.nodeType?n.ownerDocument||n:i,e=v.parseHTML(s[1],a,!0),E.test(s[1])&&v.isPlainObject(n)&&this.attr.call(e,n,!0),v.merge(this,e);o=i.getElementById(s[2]);if(o&&o.parentNode){if(o.id!==s[2])return r.find(e);this.length=1,this[0]=o}return this.context=i,this.selector=e,this}return!n||n.jquery?(n||r).find(e):this.constructor(n).find(e)}return v.isFunction(e)?r.ready(e):(e.selector!==t&&(this.selector=e.selector,this.context=e.context),v.makeArray(e,this))},selector:"",jquery:"1.8.3",length:0,size:function(){return this.length},toArray:function(){return l.call(this)},get:function(e){return e==null?this.toArray():e<0?this[this.length+e]:this[e]},pushStack:function(e,t,n){var r=v.merge(this.constructor(),e);return r.prevObject=this,r.context=this.context,t==="find"?r.selector=this.selector+(this.selector?" ":"")+n:t&&(r.selector=this.selector+"."+t+"("+n+")"),r},each:function(e,t){return v.each(this,e,t)},ready:function(e){return v.ready.promise().done(e),this},eq:function(e){return e=+e,e===-1?this.slice(e):this.slice(e,e+1)},first:function(){return this.eq(0)},last:function(){return this.eq(-1)},slice:function(){return this.pushStack(l.apply(this,arguments),"slice",l.call(arguments).join(","))},map:function(e){return this.pushStack(v.map(this,function(t,n){return e.call(t,n,t)}))},end:function(){return this.prevObject||this.constructor(null)},push:f,sort:[].sort,splice:[].splice},v.fn.init.prototype=v.fn,v.extend=v.fn.extend=function(){var e,n,r,i,s,o,u=arguments[0]||{},a=1,f=arguments.length,l=!1;typeof u=="boolean"&&(l=u,u=arguments[1]||{},a=2),typeof u!="object"&&!v.isFunction(u)&&(u={}),f===a&&(u=this,--a);for(;a<f;a++)if((e=arguments[a])!=null)for(n in e){r=u[n],i=e[n];if(u===i)continue;l&&i&&(v.isPlainObject(i)||(s=v.isArray(i)))?(s?(s=!1,o=r&&v.isArray(r)?r:[]):o=r&&v.isPlainObject(r)?r:{},u[n]=v.extend(l,o,i)):i!==t&&(u[n]=i)}return u},v.extend({noConflict:function(t){return e.$===v&&(e.$=a),t&&e.jQuery===v&&(e.jQuery=u),v},isReady:!1,readyWait:1,holdReady:function(e){e?v.readyWait++:v.ready(!0)},ready:function(e){if(e===!0?--v.readyWait:v.isReady)return;if(!i.body)return setTimeout(v.ready,1);v.isReady=!0;if(e!==!0&&--v.readyWait>0)return;r.resolveWith(i,[v]),v.fn.trigger&&v(i).trigger("ready").off("ready")},isFunction:function(e){return v.type(e)==="function"},isArray:Array.isArray||function(e){return v.type(e)==="array"},isWindow:function(e){return e!=null&&e==e.window},isNumeric:function(e){return!isNaN(parseFloat(e))&&isFinite(e)},type:function(e){return e==null?String(e):O[h.call(e)]||"object"},isPlainObject:function(e){if(!e||v.type(e)!=="object"||e.nodeType||v.isWindow(e))return!1;try{if(e.constructor&&!p.call(e,"constructor")&&!p.call(e.constructor.prototype,"isPrototypeOf"))return!1}catch(n){return!1}var r;for(r in e);return r===t||p.call(e,r)},isEmptyObject:function(e){var t;for(t in e)return!1;return!0},error:function(e){throw new Error(e)},parseHTML:function(e,t,n){var r;return!e||typeof e!="string"?null:(typeof t=="boolean"&&(n=t,t=0),t=t||i,(r=E.exec(e))?[t.createElement(r[1])]:(r=v.buildFragment([e],t,n?null:[]),v.merge([],(r.cacheable?v.clone(r.fragment):r.fragment).childNodes)))},parseJSON:function(t){if(!t||typeof t!="string")return null;t=v.trim(t);if(e.JSON&&e.JSON.parse)return e.JSON.parse(t);if(S.test(t.replace(T,"@").replace(N,"]").replace(x,"")))return(new Function("return "+t))();v.error("Invalid JSON: "+t)},parseXML:function(n){var r,i;if(!n||typeof n!="string")return null;try{e.DOMParser?(i=new DOMParser,r=i.parseFromString(n,"text/xml")):(r=new ActiveXObject("Microsoft.XMLDOM"),r.async="false",r.loadXML(n))}catch(s){r=t}return(!r||!r.documentElement||r.getElementsByTagName("parsererror").length)&&v.error("Invalid XML: "+n),r},noop:function(){},globalEval:function(t){t&&g.test(t)&&(e.execScript||function(t){e.eval.call(e,t)})(t)},camelCase:function(e){return e.replace(C,"ms-").replace(k,L)},nodeName:function(e,t){return e.nodeName&&e.nodeName.toLowerCase()===t.toLowerCase()},each:function(e,n,r){var i,s=0,o=e.length,u=o===t||v.isFunction(e);if(r){if(u){for(i in e)if(n.apply(e[i],r)===!1)break}else for(;s<o;)if(n.apply(e[s++],r)===!1)break}else if(u){for(i in e)if(n.call(e[i],i,e[i])===!1)break}else for(;s<o;)if(n.call(e[s],s,e[s++])===!1)break;return e},trim:d&&!d.call("\ufeff\u00a0")?function(e){return e==null?"":d.call(e)}:function(e){return e==null?"":(e+"").replace(b,"")},makeArray:function(e,t){var n,r=t||[];return e!=null&&(n=v.type(e),e.length==null||n==="string"||n==="function"||n==="regexp"||v.isWindow(e)?f.call(r,e):v.merge(r,e)),r},inArray:function(e,t,n){var r;if(t){if(c)return c.call(t,e,n);r=t.length,n=n?n<0?Math.max(0,r+n):n:0;for(;n<r;n++)if(n in t&&t[n]===e)return n}return-1},merge:function(e,n){var r=n.length,i=e.length,s=0;if(typeof r=="number")for(;s<r;s++)e[i++]=n[s];else while(n[s]!==t)e[i++]=n[s++];return e.length=i,e},grep:function(e,t,n){var r,i=[],s=0,o=e.length;n=!!n;for(;s<o;s++)r=!!t(e[s],s),n!==r&&i.push(e[s]);return i},map:function(e,n,r){var i,s,o=[],u=0,a=e.length,f=e instanceof v||a!==t&&typeof a=="number"&&(a>0&&e[0]&&e[a-1]||a===0||v.isArray(e));if(f)for(;u<a;u++)i=n(e[u],u,r),i!=null&&(o[o.length]=i);else for(s in e)i=n(e[s],s,r),i!=null&&(o[o.length]=i);return o.concat.apply([],o)},guid:1,proxy:function(e,n){var r,i,s;return typeof n=="string"&&(r=e[n],n=e,e=r),v.isFunction(e)?(i=l.call(arguments,2),s=function(){return e.apply(n,i.concat(l.call(arguments)))},s.guid=e.guid=e.guid||v.guid++,s):t},access:function(e,n,r,i,s,o,u){var a,f=r==null,l=0,c=e.length;if(r&&typeof r=="object"){for(l in r)v.access(e,n,l,r[l],1,o,i);s=1}else if(i!==t){a=u===t&&v.isFunction(i),f&&(a?(a=n,n=function(e,t,n){return a.call(v(e),n)}):(n.call(e,i),n=null));if(n)for(;l<c;l++)n(e[l],r,a?i.call(e[l],l,n(e[l],r)):i,u);s=1}return s?e:f?n.call(e):c?n(e[0],r):o},now:function(){return(new Date).getTime()}}),v.ready.promise=function(t){if(!r){r=v.Deferred();if(i.readyState==="complete")setTimeout(v.ready,1);else if(i.addEventListener)i.addEventListener("DOMContentLoaded",A,!1),e.addEventListener("load",v.ready,!1);else{i.attachEvent("onreadystatechange",A),e.attachEvent("onload",v.ready);var n=!1;try{n=e.frameElement==null&&i.documentElement}catch(s){}n&&n.doScroll&&function o(){if(!v.isReady){try{n.doScroll("left")}catch(e){return setTimeout(o,50)}v.ready()}}()}}return r.promise(t)},v.each("Boolean Number String Function Array Date RegExp Object".split(" "),function(e,t){O["[object "+t+"]"]=t.toLowerCase()}),n=v(i);var M={};v.Callbacks=function(e){e=typeof e=="string"?M[e]||_(e):v.extend({},e);var n,r,i,s,o,u,a=[],f=!e.once&&[],l=function(t){n=e.memory&&t,r=!0,u=s||0,s=0,o=a.length,i=!0;for(;a&&u<o;u++)if(a[u].apply(t[0],t[1])===!1&&e.stopOnFalse){n=!1;break}i=!1,a&&(f?f.length&&l(f.shift()):n?a=[]:c.disable())},c={add:function(){if(a){var t=a.length;(function r(t){v.each(t,function(t,n){var i=v.type(n);i==="function"?(!e.unique||!c.has(n))&&a.push(n):n&&n.length&&i!=="string"&&r(n)})})(arguments),i?o=a.length:n&&(s=t,l(n))}return this},remove:function(){return a&&v.each(arguments,function(e,t){var n;while((n=v.inArray(t,a,n))>-1)a.splice(n,1),i&&(n<=o&&o--,n<=u&&u--)}),this},has:function(e){return v.inArray(e,a)>-1},empty:function(){return a=[],this},disable:function(){return a=f=n=t,this},disabled:function(){return!a},lock:function(){return f=t,n||c.disable(),this},locked:function(){return!f},fireWith:function(e,t){return t=t||[],t=[e,t.slice?t.slice():t],a&&(!r||f)&&(i?f.push(t):l(t)),this},fire:function(){return c.fireWith(this,arguments),this},fired:function(){return!!r}};return c},v.extend({Deferred:function(e){var t=[["resolve","done",v.Callbacks("once memory"),"resolved"],["reject","fail",v.Callbacks("once memory"),"rejected"],["notify","progress",v.Callbacks("memory")]],n="pending",r={state:function(){return n},always:function(){return i.done(arguments).fail(arguments),this},then:function(){var e=arguments;return v.Deferred(function(n){v.each(t,function(t,r){var s=r[0],o=e[t];i[r[1]](v.isFunction(o)?function(){var e=o.apply(this,arguments);e&&v.isFunction(e.promise)?e.promise().done(n.resolve).fail(n.reject).progress(n.notify):n[s+"With"](this===i?n:this,[e])}:n[s])}),e=null}).promise()},promise:function(e){return e!=null?v.extend(e,r):r}},i={};return r.pipe=r.then,v.each(t,function(e,s){var o=s[2],u=s[3];r[s[1]]=o.add,u&&o.add(function(){n=u},t[e^1][2].disable,t[2][2].lock),i[s[0]]=o.fire,i[s[0]+"With"]=o.fireWith}),r.promise(i),e&&e.call(i,i),i},when:function(e){var t=0,n=l.call(arguments),r=n.length,i=r!==1||e&&v.isFunction(e.promise)?r:0,s=i===1?e:v.Deferred(),o=function(e,t,n){return function(r){t[e]=this,n[e]=arguments.length>1?l.call(arguments):r,n===u?s.notifyWith(t,n):--i||s.resolveWith(t,n)}},u,a,f;if(r>1){u=new Array(r),a=new Array(r),f=new Array(r);for(;t<r;t++)n[t]&&v.isFunction(n[t].promise)?n[t].promise().done(o(t,f,n)).fail(s.reject).progress(o(t,a,u)):--i}return i||s.resolveWith(f,n),s.promise()}}),v.support=function(){var t,n,r,s,o,u,a,f,l,c,h,p=i.createElement("div");p.setAttribute("className","t"),p.innerHTML="  <link/><table></table><a href='/a'>a</a><input type='checkbox'/>",n=p.getElementsByTagName("*"),r=p.getElementsByTagName("a")[0];if(!n||!r||!n.length)return{};s=i.createElement("select"),o=s.appendChild(i.createElement("option")),u=p.getElementsByTagName("input")[0],r.style.cssText="top:1px;float:left;opacity:.5",t={leadingWhitespace:p.firstChild.nodeType===3,tbody:!p.getElementsByTagName("tbody").length,htmlSerialize:!!p.getElementsByTagName("link").length,style:/top/.test(r.getAttribute("style")),hrefNormalized:r.getAttribute("href")==="/a",opacity:/^0.5/.test(r.style.opacity),cssFloat:!!r.style.cssFloat,checkOn:u.value==="on",optSelected:o.selected,getSetAttribute:p.className!=="t",enctype:!!i.createElement("form").enctype,html5Clone:i.createElement("nav").cloneNode(!0).outerHTML!=="<:nav></:nav>",boxModel:i.compatMode==="CSS1Compat",submitBubbles:!0,changeBubbles:!0,focusinBubbles:!1,deleteExpando:!0,noCloneEvent:!0,inlineBlockNeedsLayout:!1,shrinkWrapBlocks:!1,reliableMarginRight:!0,boxSizingReliable:!0,pixelPosition:!1},u.checked=!0,t.noCloneChecked=u.cloneNode(!0).checked,s.disabled=!0,t.optDisabled=!o.disabled;try{delete p.test}catch(d){t.deleteExpando=!1}!p.addEventListener&&p.attachEvent&&p.fireEvent&&(p.attachEvent("onclick",h=function(){t.noCloneEvent=!1}),p.cloneNode(!0).fireEvent("onclick"),p.detachEvent("onclick",h)),u=i.createElement("input"),u.value="t",u.setAttribute("type","radio"),t.radioValue=u.value==="t",u.setAttribute("checked","checked"),u.setAttribute("name","t"),p.appendChild(u),a=i.createDocumentFragment(),a.appendChild(p.lastChild),t.checkClone=a.cloneNode(!0).cloneNode(!0).lastChild.checked,t.appendChecked=u.checked,a.removeChild(u),a.appendChild(p);if(p.attachEvent)for(l in{submit:!0,change:!0,focusin:!0})f="on"+l,c=f in p,c||(p.setAttribute(f,"return;"),c=typeof p[f]=="function"),t[l+"Bubbles"]=c;return v(function(){var n,r,s,o,u="padding:0;margin:0;border:0;display:block;overflow:hidden;",a=i.getElementsByTagName("body")[0];if(!a)return;n=i.createElement("div"),n.style.cssText="visibility:hidden;border:0;width:0;height:0;position:static;top:0;margin-top:1px",a.insertBefore(n,a.firstChild),r=i.createElement("div"),n.appendChild(r),r.innerHTML="<table><tr><td></td><td>t</td></tr></table>",s=r.getElementsByTagName("td"),s[0].style.cssText="padding:0;margin:0;border:0;display:none",c=s[0].offsetHeight===0,s[0].style.display="",s[1].style.display="none",t.reliableHiddenOffsets=c&&s[0].offsetHeight===0,r.innerHTML="",r.style.cssText="box-sizing:border-box;-moz-box-sizing:border-box;-webkit-box-sizing:border-box;padding:1px;border:1px;display:block;width:4px;margin-top:1%;position:absolute;top:1%;",t.boxSizing=r.offsetWidth===4,t.doesNotIncludeMarginInBodyOffset=a.offsetTop!==1,e.getComputedStyle&&(t.pixelPosition=(e.getComputedStyle(r,null)||{}).top!=="1%",t.boxSizingReliable=(e.getComputedStyle(r,null)||{width:"4px"}).width==="4px",o=i.createElement("div"),o.style.cssText=r.style.cssText=u,o.style.marginRight=o.style.width="0",r.style.width="1px",r.appendChild(o),t.reliableMarginRight=!parseFloat((e.getComputedStyle(o,null)||{}).marginRight)),typeof r.style.zoom!="undefined"&&(r.innerHTML="",r.style.cssText=u+"width:1px;padding:1px;display:inline;zoom:1",t.inlineBlockNeedsLayout=r.offsetWidth===3,r.style.display="block",r.style.overflow="visible",r.innerHTML="<div></div>",r.firstChild.style.width="5px",t.shrinkWrapBlocks=r.offsetWidth!==3,n.style.zoom=1),a.removeChild(n),n=r=s=o=null}),a.removeChild(p),n=r=s=o=u=a=p=null,t}();var D=/(?:\{[\s\S]*\}|\[[\s\S]*\])$/,P=/([A-Z])/g;v.extend({cache:{},deletedIds:[],uuid:0,expando:"jQuery"+(v.fn.jquery+Math.random()).replace(/\D/g,""),noData:{embed:!0,object:"clsid:D27CDB6E-AE6D-11cf-96B8-444553540000",applet:!0},hasData:function(e){return e=e.nodeType?v.cache[e[v.expando]]:e[v.expando],!!e&&!B(e)},data:function(e,n,r,i){if(!v.acceptData(e))return;var s,o,u=v.expando,a=typeof n=="string",f=e.nodeType,l=f?v.cache:e,c=f?e[u]:e[u]&&u;if((!c||!l[c]||!i&&!l[c].data)&&a&&r===t)return;c||(f?e[u]=c=v.deletedIds.pop()||v.guid++:c=u),l[c]||(l[c]={},f||(l[c].toJSON=v.noop));if(typeof n=="object"||typeof n=="function")i?l[c]=v.extend(l[c],n):l[c].data=v.extend(l[c].data,n);return s=l[c],i||(s.data||(s.data={}),s=s.data),r!==t&&(s[v.camelCase(n)]=r),a?(o=s[n],o==null&&(o=s[v.camelCase(n)])):o=s,o},removeData:function(e,t,n){if(!v.acceptData(e))return;var r,i,s,o=e.nodeType,u=o?v.cache:e,a=o?e[v.expando]:v.expando;if(!u[a])return;if(t){r=n?u[a]:u[a].data;if(r){v.isArray(t)||(t in r?t=[t]:(t=v.camelCase(t),t in r?t=[t]:t=t.split(" ")));for(i=0,s=t.length;i<s;i++)delete r[t[i]];if(!(n?B:v.isEmptyObject)(r))return}}if(!n){delete u[a].data;if(!B(u[a]))return}o?v.cleanData([e],!0):v.support.deleteExpando||u!=u.window?delete u[a]:u[a]=null},_data:function(e,t,n){return v.data(e,t,n,!0)},acceptData:function(e){var t=e.nodeName&&v.noData[e.nodeName.toLowerCase()];return!t||t!==!0&&e.getAttribute("classid")===t}}),v.fn.extend({data:function(e,n){var r,i,s,o,u,a=this[0],f=0,l=null;if(e===t){if(this.length){l=v.data(a);if(a.nodeType===1&&!v._data(a,"parsedAttrs")){s=a.attributes;for(u=s.length;f<u;f++)o=s[f].name,o.indexOf("data-")||(o=v.camelCase(o.substring(5)),H(a,o,l[o]));v._data(a,"parsedAttrs",!0)}}return l}return typeof e=="object"?this.each(function(){v.data(this,e)}):(r=e.split(".",2),r[1]=r[1]?"."+r[1]:"",i=r[1]+"!",v.access(this,function(n){if(n===t)return l=this.triggerHandler("getData"+i,[r[0]]),l===t&&a&&(l=v.data(a,e),l=H(a,e,l)),l===t&&r[1]?this.data(r[0]):l;r[1]=n,this.each(function(){var t=v(this);t.triggerHandler("setData"+i,r),v.data(this,e,n),t.triggerHandler("changeData"+i,r)})},null,n,arguments.length>1,null,!1))},removeData:function(e){return this.each(function(){v.removeData(this,e)})}}),v.extend({queue:function(e,t,n){var r;if(e)return t=(t||"fx")+"queue",r=v._data(e,t),n&&(!r||v.isArray(n)?r=v._data(e,t,v.makeArray(n)):r.push(n)),r||[]},dequeue:function(e,t){t=t||"fx";var n=v.queue(e,t),r=n.length,i=n.shift(),s=v._queueHooks(e,t),o=function(){v.dequeue(e,t)};i==="inprogress"&&(i=n.shift(),r--),i&&(t==="fx"&&n.unshift("inprogress"),delete s.stop,i.call(e,o,s)),!r&&s&&s.empty.fire()},_queueHooks:function(e,t){var n=t+"queueHooks";return v._data(e,n)||v._data(e,n,{empty:v.Callbacks("once memory").add(function(){v.removeData(e,t+"queue",!0),v.removeData(e,n,!0)})})}}),v.fn.extend({queue:function(e,n){var r=2;return typeof e!="string"&&(n=e,e="fx",r--),arguments.length<r?v.queue(this[0],e):n===t?this:this.each(function(){var t=v.queue(this,e,n);v._queueHooks(this,e),e==="fx"&&t[0]!=="inprogress"&&v.dequeue(this,e)})},dequeue:function(e){return this.each(function(){v.dequeue(this,e)})},delay:function(e,t){return e=v.fx?v.fx.speeds[e]||e:e,t=t||"fx",this.queue(t,function(t,n){var r=setTimeout(t,e);n.stop=function(){clearTimeout(r)}})},clearQueue:function(e){return this.queue(e||"fx",[])},promise:function(e,n){var r,i=1,s=v.Deferred(),o=this,u=this.length,a=function(){--i||s.resolveWith(o,[o])};typeof e!="string"&&(n=e,e=t),e=e||"fx";while(u--)r=v._data(o[u],e+"queueHooks"),r&&r.empty&&(i++,r.empty.add(a));return a(),s.promise(n)}});var j,F,I,q=/[\t\r\n]/g,R=/\r/g,U=/^(?:button|input)$/i,z=/^(?:button|input|object|select|textarea)$/i,W=/^a(?:rea|)$/i,X=/^(?:autofocus|autoplay|async|checked|controls|defer|disabled|hidden|loop|multiple|open|readonly|required|scoped|selected)$/i,V=v.support.getSetAttribute;v.fn.extend({attr:function(e,t){return v.access(this,v.attr,e,t,arguments.length>1)},removeAttr:function(e){return this.each(function(){v.removeAttr(this,e)})},prop:function(e,t){return v.access(this,v.prop,e,t,arguments.length>1)},removeProp:function(e){return e=v.propFix[e]||e,this.each(function(){try{this[e]=t,delete this[e]}catch(n){}})},addClass:function(e){var t,n,r,i,s,o,u;if(v.isFunction(e))return this.each(function(t){v(this).addClass(e.call(this,t,this.className))});if(e&&typeof e=="string"){t=e.split(y);for(n=0,r=this.length;n<r;n++){i=this[n];if(i.nodeType===1)if(!i.className&&t.length===1)i.className=e;else{s=" "+i.className+" ";for(o=0,u=t.length;o<u;o++)s.indexOf(" "+t[o]+" ")<0&&(s+=t[o]+" ");i.className=v.trim(s)}}}return this},removeClass:function(e){var n,r,i,s,o,u,a;if(v.isFunction(e))return this.each(function(t){v(this).removeClass(e.call(this,t,this.className))});if(e&&typeof e=="string"||e===t){n=(e||"").split(y);for(u=0,a=this.length;u<a;u++){i=this[u];if(i.nodeType===1&&i.className){r=(" "+i.className+" ").replace(q," ");for(s=0,o=n.length;s<o;s++)while(r.indexOf(" "+n[s]+" ")>=0)r=r.replace(" "+n[s]+" "," ");i.className=e?v.trim(r):""}}}return this},toggleClass:function(e,t){var n=typeof e,r=typeof t=="boolean";return v.isFunction(e)?this.each(function(n){v(this).toggleClass(e.call(this,n,this.className,t),t)}):this.each(function(){if(n==="string"){var i,s=0,o=v(this),u=t,a=e.split(y);while(i=a[s++])u=r?u:!o.hasClass(i),o[u?"addClass":"removeClass"](i)}else if(n==="undefined"||n==="boolean")this.className&&v._data(this,"__className__",this.className),this.className=this.className||e===!1?"":v._data(this,"__className__")||""})},hasClass:function(e){var t=" "+e+" ",n=0,r=this.length;for(;n<r;n++)if(this[n].nodeType===1&&(" "+this[n].className+" ").replace(q," ").indexOf(t)>=0)return!0;return!1},val:function(e){var n,r,i,s=this[0];if(!arguments.length){if(s)return n=v.valHooks[s.type]||v.valHooks[s.nodeName.toLowerCase()],n&&"get"in n&&(r=n.get(s,"value"))!==t?r:(r=s.value,typeof r=="string"?r.replace(R,""):r==null?"":r);return}return i=v.isFunction(e),this.each(function(r){var s,o=v(this);if(this.nodeType!==1)return;i?s=e.call(this,r,o.val()):s=e,s==null?s="":typeof s=="number"?s+="":v.isArray(s)&&(s=v.map(s,function(e){return e==null?"":e+""})),n=v.valHooks[this.type]||v.valHooks[this.nodeName.toLowerCase()];if(!n||!("set"in n)||n.set(this,s,"value")===t)this.value=s})}}),v.extend({valHooks:{option:{get:function(e){var t=e.attributes.value;return!t||t.specified?e.value:e.text}},select:{get:function(e){var t,n,r=e.options,i=e.selectedIndex,s=e.type==="select-one"||i<0,o=s?null:[],u=s?i+1:r.length,a=i<0?u:s?i:0;for(;a<u;a++){n=r[a];if((n.selected||a===i)&&(v.support.optDisabled?!n.disabled:n.getAttribute("disabled")===null)&&(!n.parentNode.disabled||!v.nodeName(n.parentNode,"optgroup"))){t=v(n).val();if(s)return t;o.push(t)}}return o},set:function(e,t){var n=v.makeArray(t);return v(e).find("option").each(function(){this.selected=v.inArray(v(this).val(),n)>=0}),n.length||(e.selectedIndex=-1),n}}},attrFn:{},attr:function(e,n,r,i){var s,o,u,a=e.nodeType;if(!e||a===3||a===8||a===2)return;if(i&&v.isFunction(v.fn[n]))return v(e)[n](r);if(typeof e.getAttribute=="undefined")return v.prop(e,n,r);u=a!==1||!v.isXMLDoc(e),u&&(n=n.toLowerCase(),o=v.attrHooks[n]||(X.test(n)?F:j));if(r!==t){if(r===null){v.removeAttr(e,n);return}return o&&"set"in o&&u&&(s=o.set(e,r,n))!==t?s:(e.setAttribute(n,r+""),r)}return o&&"get"in o&&u&&(s=o.get(e,n))!==null?s:(s=e.getAttribute(n),s===null?t:s)},removeAttr:function(e,t){var n,r,i,s,o=0;if(t&&e.nodeType===1){r=t.split(y);for(;o<r.length;o++)i=r[o],i&&(n=v.propFix[i]||i,s=X.test(i),s||v.attr(e,i,""),e.removeAttribute(V?i:n),s&&n in e&&(e[n]=!1))}},attrHooks:{type:{set:function(e,t){if(U.test(e.nodeName)&&e.parentNode)v.error("type property can't be changed");else if(!v.support.radioValue&&t==="radio"&&v.nodeName(e,"input")){var n=e.value;return e.setAttribute("type",t),n&&(e.value=n),t}}},value:{get:function(e,t){return j&&v.nodeName(e,"button")?j.get(e,t):t in e?e.value:null},set:function(e,t,n){if(j&&v.nodeName(e,"button"))return j.set(e,t,n);e.value=t}}},propFix:{tabindex:"tabIndex",readonly:"readOnly","for":"htmlFor","class":"className",maxlength:"maxLength",cellspacing:"cellSpacing",cellpadding:"cellPadding",rowspan:"rowSpan",colspan:"colSpan",usemap:"useMap",frameborder:"frameBorder",contenteditable:"contentEditable"},prop:function(e,n,r){var i,s,o,u=e.nodeType;if(!e||u===3||u===8||u===2)return;return o=u!==1||!v.isXMLDoc(e),o&&(n=v.propFix[n]||n,s=v.propHooks[n]),r!==t?s&&"set"in s&&(i=s.set(e,r,n))!==t?i:e[n]=r:s&&"get"in s&&(i=s.get(e,n))!==null?i:e[n]},propHooks:{tabIndex:{get:function(e){var n=e.getAttributeNode("tabindex");return n&&n.specified?parseInt(n.value,10):z.test(e.nodeName)||W.test(e.nodeName)&&e.href?0:t}}}}),F={get:function(e,n){var r,i=v.prop(e,n);return i===!0||typeof i!="boolean"&&(r=e.getAttributeNode(n))&&r.nodeValue!==!1?n.toLowerCase():t},set:function(e,t,n){var r;return t===!1?v.removeAttr(e,n):(r=v.propFix[n]||n,r in e&&(e[r]=!0),e.setAttribute(n,n.toLowerCase())),n}},V||(I={name:!0,id:!0,coords:!0},j=v.valHooks.button={get:function(e,n){var r;return r=e.getAttributeNode(n),r&&(I[n]?r.value!=="":r.specified)?r.value:t},set:function(e,t,n){var r=e.getAttributeNode(n);return r||(r=i.createAttribute(n),e.setAttributeNode(r)),r.value=t+""}},v.each(["width","height"],function(e,t){v.attrHooks[t]=v.extend(v.attrHooks[t],{set:function(e,n){if(n==="")return e.setAttribute(t,"auto"),n}})}),v.attrHooks.contenteditable={get:j.get,set:function(e,t,n){t===""&&(t="false"),j.set(e,t,n)}}),v.support.hrefNormalized||v.each(["href","src","width","height"],function(e,n){v.attrHooks[n]=v.extend(v.attrHooks[n],{get:function(e){var r=e.getAttribute(n,2);return r===null?t:r}})}),v.support.style||(v.attrHooks.style={get:function(e){return e.style.cssText.toLowerCase()||t},set:function(e,t){return e.style.cssText=t+""}}),v.support.optSelected||(v.propHooks.selected=v.extend(v.propHooks.selected,{get:function(e){var t=e.parentNode;return t&&(t.selectedIndex,t.parentNode&&t.parentNode.selectedIndex),null}})),v.support.enctype||(v.propFix.enctype="encoding"),v.support.checkOn||v.each(["radio","checkbox"],function(){v.valHooks[this]={get:function(e){return e.getAttribute("value")===null?"on":e.value}}}),v.each(["radio","checkbox"],function(){v.valHooks[this]=v.extend(v.valHooks[this],{set:function(e,t){if(v.isArray(t))return e.checked=v.inArray(v(e).val(),t)>=0}})});var $=/^(?:textarea|input|select)$/i,J=/^([^\.]*|)(?:\.(.+)|)$/,K=/(?:^|\s)hover(\.\S+|)\b/,Q=/^key/,G=/^(?:mouse|contextmenu)|click/,Y=/^(?:focusinfocus|focusoutblur)$/,Z=function(e){return v.event.special.hover?e:e.replace(K,"mouseenter$1 mouseleave$1")};v.event={add:function(e,n,r,i,s){var o,u,a,f,l,c,h,p,d,m,g;if(e.nodeType===3||e.nodeType===8||!n||!r||!(o=v._data(e)))return;r.handler&&(d=r,r=d.handler,s=d.selector),r.guid||(r.guid=v.guid++),a=o.events,a||(o.events=a={}),u=o.handle,u||(o.handle=u=function(e){return typeof v=="undefined"||!!e&&v.event.triggered===e.type?t:v.event.dispatch.apply(u.elem,arguments)},u.elem=e),n=v.trim(Z(n)).split(" ");for(f=0;f<n.length;f++){l=J.exec(n[f])||[],c=l[1],h=(l[2]||"").split(".").sort(),g=v.event.special[c]||{},c=(s?g.delegateType:g.bindType)||c,g=v.event.special[c]||{},p=v.extend({type:c,origType:l[1],data:i,handler:r,guid:r.guid,selector:s,needsContext:s&&v.expr.match.needsContext.test(s),namespace:h.join(".")},d),m=a[c];if(!m){m=a[c]=[],m.delegateCount=0;if(!g.setup||g.setup.call(e,i,h,u)===!1)e.addEventListener?e.addEventListener(c,u,!1):e.attachEvent&&e.attachEvent("on"+c,u)}g.add&&(g.add.call(e,p),p.handler.guid||(p.handler.guid=r.guid)),s?m.splice(m.delegateCount++,0,p):m.push(p),v.event.global[c]=!0}e=null},global:{},remove:function(e,t,n,r,i){var s,o,u,a,f,l,c,h,p,d,m,g=v.hasData(e)&&v._data(e);if(!g||!(h=g.events))return;t=v.trim(Z(t||"")).split(" ");for(s=0;s<t.length;s++){o=J.exec(t[s])||[],u=a=o[1],f=o[2];if(!u){for(u in h)v.event.remove(e,u+t[s],n,r,!0);continue}p=v.event.special[u]||{},u=(r?p.delegateType:p.bindType)||u,d=h[u]||[],l=d.length,f=f?new RegExp("(^|\\.)"+f.split(".").sort().join("\\.(?:.*\\.|)")+"(\\.|$)"):null;for(c=0;c<d.length;c++)m=d[c],(i||a===m.origType)&&(!n||n.guid===m.guid)&&(!f||f.test(m.namespace))&&(!r||r===m.selector||r==="**"&&m.selector)&&(d.splice(c--,1),m.selector&&d.delegateCount--,p.remove&&p.remove.call(e,m));d.length===0&&l!==d.length&&((!p.teardown||p.teardown.call(e,f,g.handle)===!1)&&v.removeEvent(e,u,g.handle),delete h[u])}v.isEmptyObject(h)&&(delete g.handle,v.removeData(e,"events",!0))},customEvent:{getData:!0,setData:!0,changeData:!0},trigger:function(n,r,s,o){if(!s||s.nodeType!==3&&s.nodeType!==8){var u,a,f,l,c,h,p,d,m,g,y=n.type||n,b=[];if(Y.test(y+v.event.triggered))return;y.indexOf("!")>=0&&(y=y.slice(0,-1),a=!0),y.indexOf(".")>=0&&(b=y.split("."),y=b.shift(),b.sort());if((!s||v.event.customEvent[y])&&!v.event.global[y])return;n=typeof n=="object"?n[v.expando]?n:new v.Event(y,n):new v.Event(y),n.type=y,n.isTrigger=!0,n.exclusive=a,n.namespace=b.join("."),n.namespace_re=n.namespace?new RegExp("(^|\\.)"+b.join("\\.(?:.*\\.|)")+"(\\.|$)"):null,h=y.indexOf(":")<0?"on"+y:"";if(!s){u=v.cache;for(f in u)u[f].events&&u[f].events[y]&&v.event.trigger(n,r,u[f].handle.elem,!0);return}n.result=t,n.target||(n.target=s),r=r!=null?v.makeArray(r):[],r.unshift(n),p=v.event.special[y]||{};if(p.trigger&&p.trigger.apply(s,r)===!1)return;m=[[s,p.bindType||y]];if(!o&&!p.noBubble&&!v.isWindow(s)){g=p.delegateType||y,l=Y.test(g+y)?s:s.parentNode;for(c=s;l;l=l.parentNode)m.push([l,g]),c=l;c===(s.ownerDocument||i)&&m.push([c.defaultView||c.parentWindow||e,g])}for(f=0;f<m.length&&!n.isPropagationStopped();f++)l=m[f][0],n.type=m[f][1],d=(v._data(l,"events")||{})[n.type]&&v._data(l,"handle"),d&&d.apply(l,r),d=h&&l[h],d&&v.acceptData(l)&&d.apply&&d.apply(l,r)===!1&&n.preventDefault();return n.type=y,!o&&!n.isDefaultPrevented()&&(!p._default||p._default.apply(s.ownerDocument,r)===!1)&&(y!=="click"||!v.nodeName(s,"a"))&&v.acceptData(s)&&h&&s[y]&&(y!=="focus"&&y!=="blur"||n.target.offsetWidth!==0)&&!v.isWindow(s)&&(c=s[h],c&&(s[h]=null),v.event.triggered=y,s[y](),v.event.triggered=t,c&&(s[h]=c)),n.result}return},dispatch:function(n){n=v.event.fix(n||e.event);var r,i,s,o,u,a,f,c,h,p,d=(v._data(this,"events")||{})[n.type]||[],m=d.delegateCount,g=l.call(arguments),y=!n.exclusive&&!n.namespace,b=v.event.special[n.type]||{},w=[];g[0]=n,n.delegateTarget=this;if(b.preDispatch&&b.preDispatch.call(this,n)===!1)return;if(m&&(!n.button||n.type!=="click"))for(s=n.target;s!=this;s=s.parentNode||this)if(s.disabled!==!0||n.type!=="click"){u={},f=[];for(r=0;r<m;r++)c=d[r],h=c.selector,u[h]===t&&(u[h]=c.needsContext?v(h,this).index(s)>=0:v.find(h,this,null,[s]).length),u[h]&&f.push(c);f.length&&w.push({elem:s,matches:f})}d.length>m&&w.push({elem:this,matches:d.slice(m)});for(r=0;r<w.length&&!n.isPropagationStopped();r++){a=w[r],n.currentTarget=a.elem;for(i=0;i<a.matches.length&&!n.isImmediatePropagationStopped();i++){c=a.matches[i];if(y||!n.namespace&&!c.namespace||n.namespace_re&&n.namespace_re.test(c.namespace))n.data=c.data,n.handleObj=c,o=((v.event.special[c.origType]||{}).handle||c.handler).apply(a.elem,g),o!==t&&(n.result=o,o===!1&&(n.preventDefault(),n.stopPropagation()))}}return b.postDispatch&&b.postDispatch.call(this,n),n.result},props:"attrChange attrName relatedNode srcElement altKey bubbles cancelable ctrlKey currentTarget eventPhase metaKey relatedTarget shiftKey target timeStamp view which".split(" "),fixHooks:{},keyHooks:{props:"char charCode key keyCode".split(" "),filter:function(e,t){return e.which==null&&(e.which=t.charCode!=null?t.charCode:t.keyCode),e}},mouseHooks:{props:"button buttons clientX clientY fromElement offsetX offsetY pageX pageY screenX screenY toElement".split(" "),filter:function(e,n){var r,s,o,u=n.button,a=n.fromElement;return e.pageX==null&&n.clientX!=null&&(r=e.target.ownerDocument||i,s=r.documentElement,o=r.body,e.pageX=n.clientX+(s&&s.scrollLeft||o&&o.scrollLeft||0)-(s&&s.clientLeft||o&&o.clientLeft||0),e.pageY=n.clientY+(s&&s.scrollTop||o&&o.scrollTop||0)-(s&&s.clientTop||o&&o.clientTop||0)),!e.relatedTarget&&a&&(e.relatedTarget=a===e.target?n.toElement:a),!e.which&&u!==t&&(e.which=u&1?1:u&2?3:u&4?2:0),e}},fix:function(e){if(e[v.expando])return e;var t,n,r=e,s=v.event.fixHooks[e.type]||{},o=s.props?this.props.concat(s.props):this.props;e=v.Event(r);for(t=o.length;t;)n=o[--t],e[n]=r[n];return e.target||(e.target=r.srcElement||i),e.target.nodeType===3&&(e.target=e.target.parentNode),e.metaKey=!!e.metaKey,s.filter?s.filter(e,r):e},special:{load:{noBubble:!0},focus:{delegateType:"focusin"},blur:{delegateType:"focusout"},beforeunload:{setup:function(e,t,n){v.isWindow(this)&&(this.onbeforeunload=n)},teardown:function(e,t){this.onbeforeunload===t&&(this.onbeforeunload=null)}}},simulate:function(e,t,n,r){var i=v.extend(new v.Event,n,{type:e,isSimulated:!0,originalEvent:{}});r?v.event.trigger(i,null,t):v.event.dispatch.call(t,i),i.isDefaultPrevented()&&n.preventDefault()}},v.event.handle=v.event.dispatch,v.removeEvent=i.removeEventListener?function(e,t,n){e.removeEventListener&&e.removeEventListener(t,n,!1)}:function(e,t,n){var r="on"+t;e.detachEvent&&(typeof e[r]=="undefined"&&(e[r]=null),e.detachEvent(r,n))},v.Event=function(e,t){if(!(this instanceof v.Event))return new v.Event(e,t);e&&e.type?(this.originalEvent=e,this.type=e.type,this.isDefaultPrevented=e.defaultPrevented||e.returnValue===!1||e.getPreventDefault&&e.getPreventDefault()?tt:et):this.type=e,t&&v.extend(this,t),this.timeStamp=e&&e.timeStamp||v.now(),this[v.expando]=!0},v.Event.prototype={preventDefault:function(){this.isDefaultPrevented=tt;var e=this.originalEvent;if(!e)return;e.preventDefault?e.preventDefault():e.returnValue=!1},stopPropagation:function(){this.isPropagationStopped=tt;var e=this.originalEvent;if(!e)return;e.stopPropagation&&e.stopPropagation(),e.cancelBubble=!0},stopImmediatePropagation:function(){this.isImmediatePropagationStopped=tt,this.stopPropagation()},isDefaultPrevented:et,isPropagationStopped:et,isImmediatePropagationStopped:et},v.each({mouseenter:"mouseover",mouseleave:"mouseout"},function(e,t){v.event.special[e]={delegateType:t,bindType:t,handle:function(e){var n,r=this,i=e.relatedTarget,s=e.handleObj,o=s.selector;if(!i||i!==r&&!v.contains(r,i))e.type=s.origType,n=s.handler.apply(this,arguments),e.type=t;return n}}}),v.support.submitBubbles||(v.event.special.submit={setup:function(){if(v.nodeName(this,"form"))return!1;v.event.add(this,"click._submit keypress._submit",function(e){var n=e.target,r=v.nodeName(n,"input")||v.nodeName(n,"button")?n.form:t;r&&!v._data(r,"_submit_attached")&&(v.event.add(r,"submit._submit",function(e){e._submit_bubble=!0}),v._data(r,"_submit_attached",!0))})},postDispatch:function(e){e._submit_bubble&&(delete e._submit_bubble,this.parentNode&&!e.isTrigger&&v.event.simulate("submit",this.parentNode,e,!0))},teardown:function(){if(v.nodeName(this,"form"))return!1;v.event.remove(this,"._submit")}}),v.support.changeBubbles||(v.event.special.change={setup:function(){if($.test(this.nodeName)){if(this.type==="checkbox"||this.type==="radio")v.event.add(this,"propertychange._change",function(e){e.originalEvent.propertyName==="checked"&&(this._just_changed=!0)}),v.event.add(this,"click._change",function(e){this._just_changed&&!e.isTrigger&&(this._just_changed=!1),v.event.simulate("change",this,e,!0)});return!1}v.event.add(this,"beforeactivate._change",function(e){var t=e.target;$.test(t.nodeName)&&!v._data(t,"_change_attached")&&(v.event.add(t,"change._change",function(e){this.parentNode&&!e.isSimulated&&!e.isTrigger&&v.event.simulate("change",this.parentNode,e,!0)}),v._data(t,"_change_attached",!0))})},handle:function(e){var t=e.target;if(this!==t||e.isSimulated||e.isTrigger||t.type!=="radio"&&t.type!=="checkbox")return e.handleObj.handler.apply(this,arguments)},teardown:function(){return v.event.remove(this,"._change"),!$.test(this.nodeName)}}),v.support.focusinBubbles||v.each({focus:"focusin",blur:"focusout"},function(e,t){var n=0,r=function(e){v.event.simulate(t,e.target,v.event.fix(e),!0)};v.event.special[t]={setup:function(){n++===0&&i.addEventListener(e,r,!0)},teardown:function(){--n===0&&i.removeEventListener(e,r,!0)}}}),v.fn.extend({on:function(e,n,r,i,s){var o,u;if(typeof e=="object"){typeof n!="string"&&(r=r||n,n=t);for(u in e)this.on(u,n,r,e[u],s);return this}r==null&&i==null?(i=n,r=n=t):i==null&&(typeof n=="string"?(i=r,r=t):(i=r,r=n,n=t));if(i===!1)i=et;else if(!i)return this;return s===1&&(o=i,i=function(e){return v().off(e),o.apply(this,arguments)},i.guid=o.guid||(o.guid=v.guid++)),this.each(function(){v.event.add(this,e,i,r,n)})},one:function(e,t,n,r){return this.on(e,t,n,r,1)},off:function(e,n,r){var i,s;if(e&&e.preventDefault&&e.handleObj)return i=e.handleObj,v(e.delegateTarget).off(i.namespace?i.origType+"."+i.namespace:i.origType,i.selector,i.handler),this;if(typeof e=="object"){for(s in e)this.off(s,n,e[s]);return this}if(n===!1||typeof n=="function")r=n,n=t;return r===!1&&(r=et),this.each(function(){v.event.remove(this,e,r,n)})},bind:function(e,t,n){return this.on(e,null,t,n)},unbind:function(e,t){return this.off(e,null,t)},live:function(e,t,n){return v(this.context).on(e,this.selector,t,n),this},die:function(e,t){return v(this.context).off(e,this.selector||"**",t),this},delegate:function(e,t,n,r){return this.on(t,e,n,r)},undelegate:function(e,t,n){return arguments.length===1?this.off(e,"**"):this.off(t,e||"**",n)},trigger:function(e,t){return this.each(function(){v.event.trigger(e,t,this)})},triggerHandler:function(e,t){if(this[0])return v.event.trigger(e,t,this[0],!0)},toggle:function(e){var t=arguments,n=e.guid||v.guid++,r=0,i=function(n){var i=(v._data(this,"lastToggle"+e.guid)||0)%r;return v._data(this,"lastToggle"+e.guid,i+1),n.preventDefault(),t[i].apply(this,arguments)||!1};i.guid=n;while(r<t.length)t[r++].guid=n;return this.click(i)},hover:function(e,t){return this.mouseenter(e).mouseleave(t||e)}}),v.each("blur focus focusin focusout load resize scroll unload click dblclick mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave change select submit keydown keypress keyup error contextmenu".split(" "),function(e,t){v.fn[t]=function(e,n){return n==null&&(n=e,e=null),arguments.length>0?this.on(t,null,e,n):this.trigger(t)},Q.test(t)&&(v.event.fixHooks[t]=v.event.keyHooks),G.test(t)&&(v.event.fixHooks[t]=v.event.mouseHooks)}),function(e,t){function nt(e,t,n,r){n=n||[],t=t||g;var i,s,a,f,l=t.nodeType;if(!e||typeof e!="string")return n;if(l!==1&&l!==9)return[];a=o(t);if(!a&&!r)if(i=R.exec(e))if(f=i[1]){if(l===9){s=t.getElementById(f);if(!s||!s.parentNode)return n;if(s.id===f)return n.push(s),n}else if(t.ownerDocument&&(s=t.ownerDocument.getElementById(f))&&u(t,s)&&s.id===f)return n.push(s),n}else{if(i[2])return S.apply(n,x.call(t.getElementsByTagName(e),0)),n;if((f=i[3])&&Z&&t.getElementsByClassName)return S.apply(n,x.call(t.getElementsByClassName(f),0)),n}return vt(e.replace(j,"$1"),t,n,r,a)}function rt(e){return function(t){var n=t.nodeName.toLowerCase();return n==="input"&&t.type===e}}function it(e){return function(t){var n=t.nodeName.toLowerCase();return(n==="input"||n==="button")&&t.type===e}}function st(e){return N(function(t){return t=+t,N(function(n,r){var i,s=e([],n.length,t),o=s.length;while(o--)n[i=s[o]]&&(n[i]=!(r[i]=n[i]))})})}function ot(e,t,n){if(e===t)return n;var r=e.nextSibling;while(r){if(r===t)return-1;r=r.nextSibling}return 1}function ut(e,t){var n,r,s,o,u,a,f,l=L[d][e+" "];if(l)return t?0:l.slice(0);u=e,a=[],f=i.preFilter;while(u){if(!n||(r=F.exec(u)))r&&(u=u.slice(r[0].length)||u),a.push(s=[]);n=!1;if(r=I.exec(u))s.push(n=new m(r.shift())),u=u.slice(n.length),n.type=r[0].replace(j," ");for(o in i.filter)(r=J[o].exec(u))&&(!f[o]||(r=f[o](r)))&&(s.push(n=new m(r.shift())),u=u.slice(n.length),n.type=o,n.matches=r);if(!n)break}return t?u.length:u?nt.error(e):L(e,a).slice(0)}function at(e,t,r){var i=t.dir,s=r&&t.dir==="parentNode",o=w++;return t.first?function(t,n,r){while(t=t[i])if(s||t.nodeType===1)return e(t,n,r)}:function(t,r,u){if(!u){var a,f=b+" "+o+" ",l=f+n;while(t=t[i])if(s||t.nodeType===1){if((a=t[d])===l)return t.sizset;if(typeof a=="string"&&a.indexOf(f)===0){if(t.sizset)return t}else{t[d]=l;if(e(t,r,u))return t.sizset=!0,t;t.sizset=!1}}}else while(t=t[i])if(s||t.nodeType===1)if(e(t,r,u))return t}}function ft(e){return e.length>1?function(t,n,r){var i=e.length;while(i--)if(!e[i](t,n,r))return!1;return!0}:e[0]}function lt(e,t,n,r,i){var s,o=[],u=0,a=e.length,f=t!=null;for(;u<a;u++)if(s=e[u])if(!n||n(s,r,i))o.push(s),f&&t.push(u);return o}function ct(e,t,n,r,i,s){return r&&!r[d]&&(r=ct(r)),i&&!i[d]&&(i=ct(i,s)),N(function(s,o,u,a){var f,l,c,h=[],p=[],d=o.length,v=s||dt(t||"*",u.nodeType?[u]:u,[]),m=e&&(s||!t)?lt(v,h,e,u,a):v,g=n?i||(s?e:d||r)?[]:o:m;n&&n(m,g,u,a);if(r){f=lt(g,p),r(f,[],u,a),l=f.length;while(l--)if(c=f[l])g[p[l]]=!(m[p[l]]=c)}if(s){if(i||e){if(i){f=[],l=g.length;while(l--)(c=g[l])&&f.push(m[l]=c);i(null,g=[],f,a)}l=g.length;while(l--)(c=g[l])&&(f=i?T.call(s,c):h[l])>-1&&(s[f]=!(o[f]=c))}}else g=lt(g===o?g.splice(d,g.length):g),i?i(null,o,g,a):S.apply(o,g)})}function ht(e){var t,n,r,s=e.length,o=i.relative[e[0].type],u=o||i.relative[" "],a=o?1:0,f=at(function(e){return e===t},u,!0),l=at(function(e){return T.call(t,e)>-1},u,!0),h=[function(e,n,r){return!o&&(r||n!==c)||((t=n).nodeType?f(e,n,r):l(e,n,r))}];for(;a<s;a++)if(n=i.relative[e[a].type])h=[at(ft(h),n)];else{n=i.filter[e[a].type].apply(null,e[a].matches);if(n[d]){r=++a;for(;r<s;r++)if(i.relative[e[r].type])break;return ct(a>1&&ft(h),a>1&&e.slice(0,a-1).join("").replace(j,"$1"),n,a<r&&ht(e.slice(a,r)),r<s&&ht(e=e.slice(r)),r<s&&e.join(""))}h.push(n)}return ft(h)}function pt(e,t){var r=t.length>0,s=e.length>0,o=function(u,a,f,l,h){var p,d,v,m=[],y=0,w="0",x=u&&[],T=h!=null,N=c,C=u||s&&i.find.TAG("*",h&&a.parentNode||a),k=b+=N==null?1:Math.E;T&&(c=a!==g&&a,n=o.el);for(;(p=C[w])!=null;w++){if(s&&p){for(d=0;v=e[d];d++)if(v(p,a,f)){l.push(p);break}T&&(b=k,n=++o.el)}r&&((p=!v&&p)&&y--,u&&x.push(p))}y+=w;if(r&&w!==y){for(d=0;v=t[d];d++)v(x,m,a,f);if(u){if(y>0)while(w--)!x[w]&&!m[w]&&(m[w]=E.call(l));m=lt(m)}S.apply(l,m),T&&!u&&m.length>0&&y+t.length>1&&nt.uniqueSort(l)}return T&&(b=k,c=N),x};return o.el=0,r?N(o):o}function dt(e,t,n){var r=0,i=t.length;for(;r<i;r++)nt(e,t[r],n);return n}function vt(e,t,n,r,s){var o,u,f,l,c,h=ut(e),p=h.length;if(!r&&h.length===1){u=h[0]=h[0].slice(0);if(u.length>2&&(f=u[0]).type==="ID"&&t.nodeType===9&&!s&&i.relative[u[1].type]){t=i.find.ID(f.matches[0].replace($,""),t,s)[0];if(!t)return n;e=e.slice(u.shift().length)}for(o=J.POS.test(e)?-1:u.length-1;o>=0;o--){f=u[o];if(i.relative[l=f.type])break;if(c=i.find[l])if(r=c(f.matches[0].replace($,""),z.test(u[0].type)&&t.parentNode||t,s)){u.splice(o,1),e=r.length&&u.join("");if(!e)return S.apply(n,x.call(r,0)),n;break}}}return a(e,h)(r,t,s,n,z.test(e)),n}function mt(){}var n,r,i,s,o,u,a,f,l,c,h=!0,p="undefined",d=("sizcache"+Math.random()).replace(".",""),m=String,g=e.document,y=g.documentElement,b=0,w=0,E=[].pop,S=[].push,x=[].slice,T=[].indexOf||function(e){var t=0,n=this.length;for(;t<n;t++)if(this[t]===e)return t;return-1},N=function(e,t){return e[d]=t==null||t,e},C=function(){var e={},t=[];return N(function(n,r){return t.push(n)>i.cacheLength&&delete e[t.shift()],e[n+" "]=r},e)},k=C(),L=C(),A=C(),O="[\\x20\\t\\r\\n\\f]",M="(?:\\\\.|[-\\w]|[^\\x00-\\xa0])+",_=M.replace("w","w#"),D="([*^$|!~]?=)",P="\\["+O+"*("+M+")"+O+"*(?:"+D+O+"*(?:(['\"])((?:\\\\.|[^\\\\])*?)\\3|("+_+")|)|)"+O+"*\\]",H=":("+M+")(?:\\((?:(['\"])((?:\\\\.|[^\\\\])*?)\\2|([^()[\\]]*|(?:(?:"+P+")|[^:]|\\\\.)*|.*))\\)|)",B=":(even|odd|eq|gt|lt|nth|first|last)(?:\\("+O+"*((?:-\\d)?\\d*)"+O+"*\\)|)(?=[^-]|$)",j=new RegExp("^"+O+"+|((?:^|[^\\\\])(?:\\\\.)*)"+O+"+$","g"),F=new RegExp("^"+O+"*,"+O+"*"),I=new RegExp("^"+O+"*([\\x20\\t\\r\\n\\f>+~])"+O+"*"),q=new RegExp(H),R=/^(?:#([\w\-]+)|(\w+)|\.([\w\-]+))$/,U=/^:not/,z=/[\x20\t\r\n\f]*[+~]/,W=/:not\($/,X=/h\d/i,V=/input|select|textarea|button/i,$=/\\(?!\\)/g,J={ID:new RegExp("^#("+M+")"),CLASS:new RegExp("^\\.("+M+")"),NAME:new RegExp("^\\[name=['\"]?("+M+")['\"]?\\]"),TAG:new RegExp("^("+M.replace("w","w*")+")"),ATTR:new RegExp("^"+P),PSEUDO:new RegExp("^"+H),POS:new RegExp(B,"i"),CHILD:new RegExp("^:(only|nth|first|last)-child(?:\\("+O+"*(even|odd|(([+-]|)(\\d*)n|)"+O+"*(?:([+-]|)"+O+"*(\\d+)|))"+O+"*\\)|)","i"),needsContext:new RegExp("^"+O+"*[>+~]|"+B,"i")},K=function(e){var t=g.createElement("div");try{return e(t)}catch(n){return!1}finally{t=null}},Q=K(function(e){return e.appendChild(g.createComment("")),!e.getElementsByTagName("*").length}),G=K(function(e){return e.innerHTML="<a href='#'></a>",e.firstChild&&typeof e.firstChild.getAttribute!==p&&e.firstChild.getAttribute("href")==="#"}),Y=K(function(e){e.innerHTML="<select></select>";var t=typeof e.lastChild.getAttribute("multiple");return t!=="boolean"&&t!=="string"}),Z=K(function(e){return e.innerHTML="<div class='hidden e'></div><div class='hidden'></div>",!e.getElementsByClassName||!e.getElementsByClassName("e").length?!1:(e.lastChild.className="e",e.getElementsByClassName("e").length===2)}),et=K(function(e){e.id=d+0,e.innerHTML="<a name='"+d+"'></a><div name='"+d+"'></div>",y.insertBefore(e,y.firstChild);var t=g.getElementsByName&&g.getElementsByName(d).length===2+g.getElementsByName(d+0).length;return r=!g.getElementById(d),y.removeChild(e),t});try{x.call(y.childNodes,0)[0].nodeType}catch(tt){x=function(e){var t,n=[];for(;t=this[e];e++)n.push(t);return n}}nt.matches=function(e,t){return nt(e,null,null,t)},nt.matchesSelector=function(e,t){return nt(t,null,null,[e]).length>0},s=nt.getText=function(e){var t,n="",r=0,i=e.nodeType;if(i){if(i===1||i===9||i===11){if(typeof e.textContent=="string")return e.textContent;for(e=e.firstChild;e;e=e.nextSibling)n+=s(e)}else if(i===3||i===4)return e.nodeValue}else for(;t=e[r];r++)n+=s(t);return n},o=nt.isXML=function(e){var t=e&&(e.ownerDocument||e).documentElement;return t?t.nodeName!=="HTML":!1},u=nt.contains=y.contains?function(e,t){var n=e.nodeType===9?e.documentElement:e,r=t&&t.parentNode;return e===r||!!(r&&r.nodeType===1&&n.contains&&n.contains(r))}:y.compareDocumentPosition?function(e,t){return t&&!!(e.compareDocumentPosition(t)&16)}:function(e,t){while(t=t.parentNode)if(t===e)return!0;return!1},nt.attr=function(e,t){var n,r=o(e);return r||(t=t.toLowerCase()),(n=i.attrHandle[t])?n(e):r||Y?e.getAttribute(t):(n=e.getAttributeNode(t),n?typeof e[t]=="boolean"?e[t]?t:null:n.specified?n.value:null:null)},i=nt.selectors={cacheLength:50,createPseudo:N,match:J,attrHandle:G?{}:{href:function(e){return e.getAttribute("href",2)},type:function(e){return e.getAttribute("type")}},find:{ID:r?function(e,t,n){if(typeof t.getElementById!==p&&!n){var r=t.getElementById(e);return r&&r.parentNode?[r]:[]}}:function(e,n,r){if(typeof n.getElementById!==p&&!r){var i=n.getElementById(e);return i?i.id===e||typeof i.getAttributeNode!==p&&i.getAttributeNode("id").value===e?[i]:t:[]}},TAG:Q?function(e,t){if(typeof t.getElementsByTagName!==p)return t.getElementsByTagName(e)}:function(e,t){var n=t.getElementsByTagName(e);if(e==="*"){var r,i=[],s=0;for(;r=n[s];s++)r.nodeType===1&&i.push(r);return i}return n},NAME:et&&function(e,t){if(typeof t.getElementsByName!==p)return t.getElementsByName(name)},CLASS:Z&&function(e,t,n){if(typeof t.getElementsByClassName!==p&&!n)return t.getElementsByClassName(e)}},relative:{">":{dir:"parentNode",first:!0}," ":{dir:"parentNode"},"+":{dir:"previousSibling",first:!0},"~":{dir:"previousSibling"}},preFilter:{ATTR:function(e){return e[1]=e[1].replace($,""),e[3]=(e[4]||e[5]||"").replace($,""),e[2]==="~="&&(e[3]=" "+e[3]+" "),e.slice(0,4)},CHILD:function(e){return e[1]=e[1].toLowerCase(),e[1]==="nth"?(e[2]||nt.error(e[0]),e[3]=+(e[3]?e[4]+(e[5]||1):2*(e[2]==="even"||e[2]==="odd")),e[4]=+(e[6]+e[7]||e[2]==="odd")):e[2]&&nt.error(e[0]),e},PSEUDO:function(e){var t,n;if(J.CHILD.test(e[0]))return null;if(e[3])e[2]=e[3];else if(t=e[4])q.test(t)&&(n=ut(t,!0))&&(n=t.indexOf(")",t.length-n)-t.length)&&(t=t.slice(0,n),e[0]=e[0].slice(0,n)),e[2]=t;return e.slice(0,3)}},filter:{ID:r?function(e){return e=e.replace($,""),function(t){return t.getAttribute("id")===e}}:function(e){return e=e.replace($,""),function(t){var n=typeof t.getAttributeNode!==p&&t.getAttributeNode("id");return n&&n.value===e}},TAG:function(e){return e==="*"?function(){return!0}:(e=e.replace($,"").toLowerCase(),function(t){return t.nodeName&&t.nodeName.toLowerCase()===e})},CLASS:function(e){var t=k[d][e+" "];return t||(t=new RegExp("(^|"+O+")"+e+"("+O+"|$)"))&&k(e,function(e){return t.test(e.className||typeof e.getAttribute!==p&&e.getAttribute("class")||"")})},ATTR:function(e,t,n){return function(r,i){var s=nt.attr(r,e);return s==null?t==="!=":t?(s+="",t==="="?s===n:t==="!="?s!==n:t==="^="?n&&s.indexOf(n)===0:t==="*="?n&&s.indexOf(n)>-1:t==="$="?n&&s.substr(s.length-n.length)===n:t==="~="?(" "+s+" ").indexOf(n)>-1:t==="|="?s===n||s.substr(0,n.length+1)===n+"-":!1):!0}},CHILD:function(e,t,n,r){return e==="nth"?function(e){var t,i,s=e.parentNode;if(n===1&&r===0)return!0;if(s){i=0;for(t=s.firstChild;t;t=t.nextSibling)if(t.nodeType===1){i++;if(e===t)break}}return i-=r,i===n||i%n===0&&i/n>=0}:function(t){var n=t;switch(e){case"only":case"first":while(n=n.previousSibling)if(n.nodeType===1)return!1;if(e==="first")return!0;n=t;case"last":while(n=n.nextSibling)if(n.nodeType===1)return!1;return!0}}},PSEUDO:function(e,t){var n,r=i.pseudos[e]||i.setFilters[e.toLowerCase()]||nt.error("unsupported pseudo: "+e);return r[d]?r(t):r.length>1?(n=[e,e,"",t],i.setFilters.hasOwnProperty(e.toLowerCase())?N(function(e,n){var i,s=r(e,t),o=s.length;while(o--)i=T.call(e,s[o]),e[i]=!(n[i]=s[o])}):function(e){return r(e,0,n)}):r}},pseudos:{not:N(function(e){var t=[],n=[],r=a(e.replace(j,"$1"));return r[d]?N(function(e,t,n,i){var s,o=r(e,null,i,[]),u=e.length;while(u--)if(s=o[u])e[u]=!(t[u]=s)}):function(e,i,s){return t[0]=e,r(t,null,s,n),!n.pop()}}),has:N(function(e){return function(t){return nt(e,t).length>0}}),contains:N(function(e){return function(t){return(t.textContent||t.innerText||s(t)).indexOf(e)>-1}}),enabled:function(e){return e.disabled===!1},disabled:function(e){return e.disabled===!0},checked:function(e){var t=e.nodeName.toLowerCase();return t==="input"&&!!e.checked||t==="option"&&!!e.selected},selected:function(e){return e.parentNode&&e.parentNode.selectedIndex,e.selected===!0},parent:function(e){return!i.pseudos.empty(e)},empty:function(e){var t;e=e.firstChild;while(e){if(e.nodeName>"@"||(t=e.nodeType)===3||t===4)return!1;e=e.nextSibling}return!0},header:function(e){return X.test(e.nodeName)},text:function(e){var t,n;return e.nodeName.toLowerCase()==="input"&&(t=e.type)==="text"&&((n=e.getAttribute("type"))==null||n.toLowerCase()===t)},radio:rt("radio"),checkbox:rt("checkbox"),file:rt("file"),password:rt("password"),image:rt("image"),submit:it("submit"),reset:it("reset"),button:function(e){var t=e.nodeName.toLowerCase();return t==="input"&&e.type==="button"||t==="button"},input:function(e){return V.test(e.nodeName)},focus:function(e){var t=e.ownerDocument;return e===t.activeElement&&(!t.hasFocus||t.hasFocus())&&!!(e.type||e.href||~e.tabIndex)},active:function(e){return e===e.ownerDocument.activeElement},first:st(function(){return[0]}),last:st(function(e,t){return[t-1]}),eq:st(function(e,t,n){return[n<0?n+t:n]}),even:st(function(e,t){for(var n=0;n<t;n+=2)e.push(n);return e}),odd:st(function(e,t){for(var n=1;n<t;n+=2)e.push(n);return e}),lt:st(function(e,t,n){for(var r=n<0?n+t:n;--r>=0;)e.push(r);return e}),gt:st(function(e,t,n){for(var r=n<0?n+t:n;++r<t;)e.push(r);return e})}},f=y.compareDocumentPosition?function(e,t){return e===t?(l=!0,0):(!e.compareDocumentPosition||!t.compareDocumentPosition?e.compareDocumentPosition:e.compareDocumentPosition(t)&4)?-1:1}:function(e,t){if(e===t)return l=!0,0;if(e.sourceIndex&&t.sourceIndex)return e.sourceIndex-t.sourceIndex;var n,r,i=[],s=[],o=e.parentNode,u=t.parentNode,a=o;if(o===u)return ot(e,t);if(!o)return-1;if(!u)return 1;while(a)i.unshift(a),a=a.parentNode;a=u;while(a)s.unshift(a),a=a.parentNode;n=i.length,r=s.length;for(var f=0;f<n&&f<r;f++)if(i[f]!==s[f])return ot(i[f],s[f]);return f===n?ot(e,s[f],-1):ot(i[f],t,1)},[0,0].sort(f),h=!l,nt.uniqueSort=function(e){var t,n=[],r=1,i=0;l=h,e.sort(f);if(l){for(;t=e[r];r++)t===e[r-1]&&(i=n.push(r));while(i--)e.splice(n[i],1)}return e},nt.error=function(e){throw new Error("Syntax error, unrecognized expression: "+e)},a=nt.compile=function(e,t){var n,r=[],i=[],s=A[d][e+" "];if(!s){t||(t=ut(e)),n=t.length;while(n--)s=ht(t[n]),s[d]?r.push(s):i.push(s);s=A(e,pt(i,r))}return s},g.querySelectorAll&&function(){var e,t=vt,n=/'|\\/g,r=/\=[\x20\t\r\n\f]*([^'"\]]*)[\x20\t\r\n\f]*\]/g,i=[":focus"],s=[":active"],u=y.matchesSelector||y.mozMatchesSelector||y.webkitMatchesSelector||y.oMatchesSelector||y.msMatchesSelector;K(function(e){e.innerHTML="<select><option selected=''></option></select>",e.querySelectorAll("[selected]").length||i.push("\\["+O+"*(?:checked|disabled|ismap|multiple|readonly|selected|value)"),e.querySelectorAll(":checked").length||i.push(":checked")}),K(function(e){e.innerHTML="<p test=''></p>",e.querySelectorAll("[test^='']").length&&i.push("[*^$]="+O+"*(?:\"\"|'')"),e.innerHTML="<input type='hidden'/>",e.querySelectorAll(":enabled").length||i.push(":enabled",":disabled")}),i=new RegExp(i.join("|")),vt=function(e,r,s,o,u){if(!o&&!u&&!i.test(e)){var a,f,l=!0,c=d,h=r,p=r.nodeType===9&&e;if(r.nodeType===1&&r.nodeName.toLowerCase()!=="object"){a=ut(e),(l=r.getAttribute("id"))?c=l.replace(n,"\\$&"):r.setAttribute("id",c),c="[id='"+c+"'] ",f=a.length;while(f--)a[f]=c+a[f].join("");h=z.test(e)&&r.parentNode||r,p=a.join(",")}if(p)try{return S.apply(s,x.call(h.querySelectorAll(p),0)),s}catch(v){}finally{l||r.removeAttribute("id")}}return t(e,r,s,o,u)},u&&(K(function(t){e=u.call(t,"div");try{u.call(t,"[test!='']:sizzle"),s.push("!=",H)}catch(n){}}),s=new RegExp(s.join("|")),nt.matchesSelector=function(t,n){n=n.replace(r,"='$1']");if(!o(t)&&!s.test(n)&&!i.test(n))try{var a=u.call(t,n);if(a||e||t.document&&t.document.nodeType!==11)return a}catch(f){}return nt(n,null,null,[t]).length>0})}(),i.pseudos.nth=i.pseudos.eq,i.filters=mt.prototype=i.pseudos,i.setFilters=new mt,nt.attr=v.attr,v.find=nt,v.expr=nt.selectors,v.expr[":"]=v.expr.pseudos,v.unique=nt.uniqueSort,v.text=nt.getText,v.isXMLDoc=nt.isXML,v.contains=nt.contains}(e);var nt=/Until$/,rt=/^(?:parents|prev(?:Until|All))/,it=/^.[^:#\[\.,]*$/,st=v.expr.match.needsContext,ot={children:!0,contents:!0,next:!0,prev:!0};v.fn.extend({find:function(e){var t,n,r,i,s,o,u=this;if(typeof e!="string")return v(e).filter(function(){for(t=0,n=u.length;t<n;t++)if(v.contains(u[t],this))return!0});o=this.pushStack("","find",e);for(t=0,n=this.length;t<n;t++){r=o.length,v.find(e,this[t],o);if(t>0)for(i=r;i<o.length;i++)for(s=0;s<r;s++)if(o[s]===o[i]){o.splice(i--,1);break}}return o},has:function(e){var t,n=v(e,this),r=n.length;return this.filter(function(){for(t=0;t<r;t++)if(v.contains(this,n[t]))return!0})},not:function(e){return this.pushStack(ft(this,e,!1),"not",e)},filter:function(e){return this.pushStack(ft(this,e,!0),"filter",e)},is:function(e){return!!e&&(typeof e=="string"?st.test(e)?v(e,this.context).index(this[0])>=0:v.filter(e,this).length>0:this.filter(e).length>0)},closest:function(e,t){var n,r=0,i=this.length,s=[],o=st.test(e)||typeof e!="string"?v(e,t||this.context):0;for(;r<i;r++){n=this[r];while(n&&n.ownerDocument&&n!==t&&n.nodeType!==11){if(o?o.index(n)>-1:v.find.matchesSelector(n,e)){s.push(n);break}n=n.parentNode}}return s=s.length>1?v.unique(s):s,this.pushStack(s,"closest",e)},index:function(e){return e?typeof e=="string"?v.inArray(this[0],v(e)):v.inArray(e.jquery?e[0]:e,this):this[0]&&this[0].parentNode?this.prevAll().length:-1},add:function(e,t){var n=typeof e=="string"?v(e,t):v.makeArray(e&&e.nodeType?[e]:e),r=v.merge(this.get(),n);return this.pushStack(ut(n[0])||ut(r[0])?r:v.unique(r))},addBack:function(e){return this.add(e==null?this.prevObject:this.prevObject.filter(e))}}),v.fn.andSelf=v.fn.addBack,v.each({parent:function(e){var t=e.parentNode;return t&&t.nodeType!==11?t:null},parents:function(e){return v.dir(e,"parentNode")},parentsUntil:function(e,t,n){return v.dir(e,"parentNode",n)},next:function(e){return at(e,"nextSibling")},prev:function(e){return at(e,"previousSibling")},nextAll:function(e){return v.dir(e,"nextSibling")},prevAll:function(e){return v.dir(e,"previousSibling")},nextUntil:function(e,t,n){return v.dir(e,"nextSibling",n)},prevUntil:function(e,t,n){return v.dir(e,"previousSibling",n)},siblings:function(e){return v.sibling((e.parentNode||{}).firstChild,e)},children:function(e){return v.sibling(e.firstChild)},contents:function(e){return v.nodeName(e,"iframe")?e.contentDocument||e.contentWindow.document:v.merge([],e.childNodes)}},function(e,t){v.fn[e]=function(n,r){var i=v.map(this,t,n);return nt.test(e)||(r=n),r&&typeof r=="string"&&(i=v.filter(r,i)),i=this.length>1&&!ot[e]?v.unique(i):i,this.length>1&&rt.test(e)&&(i=i.reverse()),this.pushStack(i,e,l.call(arguments).join(","))}}),v.extend({filter:function(e,t,n){return n&&(e=":not("+e+")"),t.length===1?v.find.matchesSelector(t[0],e)?[t[0]]:[]:v.find.matches(e,t)},dir:function(e,n,r){var i=[],s=e[n];while(s&&s.nodeType!==9&&(r===t||s.nodeType!==1||!v(s).is(r)))s.nodeType===1&&i.push(s),s=s[n];return i},sibling:function(e,t){var n=[];for(;e;e=e.nextSibling)e.nodeType===1&&e!==t&&n.push(e);return n}});var ct="abbr|article|aside|audio|bdi|canvas|data|datalist|details|figcaption|figure|footer|header|hgroup|mark|meter|nav|output|progress|section|summary|time|video",ht=/ jQuery\d+="(?:null|\d+)"/g,pt=/^\s+/,dt=/<(?!area|br|col|embed|hr|img|input|link|meta|param)(([\w:]+)[^>]*)\/>/gi,vt=/<([\w:]+)/,mt=/<tbody/i,gt=/<|&#?\w+;/,yt=/<(?:script|style|link)/i,bt=/<(?:script|object|embed|option|style)/i,wt=new RegExp("<(?:"+ct+")[\\s/>]","i"),Et=/^(?:checkbox|radio)$/,St=/checked\s*(?:[^=]|=\s*.checked.)/i,xt=/\/(java|ecma)script/i,Tt=/^\s*<!(?:\[CDATA\[|\-\-)|[\]\-]{2}>\s*$/g,Nt={option:[1,"<select multiple='multiple'>","</select>"],legend:[1,"<fieldset>","</fieldset>"],thead:[1,"<table>","</table>"],tr:[2,"<table><tbody>","</tbody></table>"],td:[3,"<table><tbody><tr>","</tr></tbody></table>"],col:[2,"<table><tbody></tbody><colgroup>","</colgroup></table>"],area:[1,"<map>","</map>"],_default:[0,"",""]},Ct=lt(i),kt=Ct.appendChild(i.createElement("div"));Nt.optgroup=Nt.option,Nt.tbody=Nt.tfoot=Nt.colgroup=Nt.caption=Nt.thead,Nt.th=Nt.td,v.support.htmlSerialize||(Nt._default=[1,"X<div>","</div>"]),v.fn.extend({text:function(e){return v.access(this,function(e){return e===t?v.text(this):this.empty().append((this[0]&&this[0].ownerDocument||i).createTextNode(e))},null,e,arguments.length)},wrapAll:function(e){if(v.isFunction(e))return this.each(function(t){v(this).wrapAll(e.call(this,t))});if(this[0]){var t=v(e,this[0].ownerDocument).eq(0).clone(!0);this[0].parentNode&&t.insertBefore(this[0]),t.map(function(){var e=this;while(e.firstChild&&e.firstChild.nodeType===1)e=e.firstChild;return e}).append(this)}return this},wrapInner:function(e){return v.isFunction(e)?this.each(function(t){v(this).wrapInner(e.call(this,t))}):this.each(function(){var t=v(this),n=t.contents();n.length?n.wrapAll(e):t.append(e)})},wrap:function(e){var t=v.isFunction(e);return this.each(function(n){v(this).wrapAll(t?e.call(this,n):e)})},unwrap:function(){return this.parent().each(function(){v.nodeName(this,"body")||v(this).replaceWith(this.childNodes)}).end()},append:function(){return this.domManip(arguments,!0,function(e){(this.nodeType===1||this.nodeType===11)&&this.appendChild(e)})},prepend:function(){return this.domManip(arguments,!0,function(e){(this.nodeType===1||this.nodeType===11)&&this.insertBefore(e,this.firstChild)})},before:function(){if(!ut(this[0]))return this.domManip(arguments,!1,function(e){this.parentNode.insertBefore(e,this)});if(arguments.length){var e=v.clean(arguments);return this.pushStack(v.merge(e,this),"before",this.selector)}},after:function(){if(!ut(this[0]))return this.domManip(arguments,!1,function(e){this.parentNode.insertBefore(e,this.nextSibling)});if(arguments.length){var e=v.clean(arguments);return this.pushStack(v.merge(this,e),"after",this.selector)}},remove:function(e,t){var n,r=0;for(;(n=this[r])!=null;r++)if(!e||v.filter(e,[n]).length)!t&&n.nodeType===1&&(v.cleanData(n.getElementsByTagName("*")),v.cleanData([n])),n.parentNode&&n.parentNode.removeChild(n);return this},empty:function(){var e,t=0;for(;(e=this[t])!=null;t++){e.nodeType===1&&v.cleanData(e.getElementsByTagName("*"));while(e.firstChild)e.removeChild(e.firstChild)}return this},clone:function(e,t){return e=e==null?!1:e,t=t==null?e:t,this.map(function(){return v.clone(this,e,t)})},html:function(e){return v.access(this,function(e){var n=this[0]||{},r=0,i=this.length;if(e===t)return n.nodeType===1?n.innerHTML.replace(ht,""):t;if(typeof e=="string"&&!yt.test(e)&&(v.support.htmlSerialize||!wt.test(e))&&(v.support.leadingWhitespace||!pt.test(e))&&!Nt[(vt.exec(e)||["",""])[1].toLowerCase()]){e=e.replace(dt,"<$1></$2>");try{for(;r<i;r++)n=this[r]||{},n.nodeType===1&&(v.cleanData(n.getElementsByTagName("*")),n.innerHTML=e);n=0}catch(s){}}n&&this.empty().append(e)},null,e,arguments.length)},replaceWith:function(e){return ut(this[0])?this.length?this.pushStack(v(v.isFunction(e)?e():e),"replaceWith",e):this:v.isFunction(e)?this.each(function(t){var n=v(this),r=n.html();n.replaceWith(e.call(this,t,r))}):(typeof e!="string"&&(e=v(e).detach()),this.each(function(){var t=this.nextSibling,n=this.parentNode;v(this).remove(),t?v(t).before(e):v(n).append(e)}))},detach:function(e){return this.remove(e,!0)},domManip:function(e,n,r){e=[].concat.apply([],e);var i,s,o,u,a=0,f=e[0],l=[],c=this.length;if(!v.support.checkClone&&c>1&&typeof f=="string"&&St.test(f))return this.each(function(){v(this).domManip(e,n,r)});if(v.isFunction(f))return this.each(function(i){var s=v(this);e[0]=f.call(this,i,n?s.html():t),s.domManip(e,n,r)});if(this[0]){i=v.buildFragment(e,this,l),o=i.fragment,s=o.firstChild,o.childNodes.length===1&&(o=s);if(s){n=n&&v.nodeName(s,"tr");for(u=i.cacheable||c-1;a<c;a++)r.call(n&&v.nodeName(this[a],"table")?Lt(this[a],"tbody"):this[a],a===u?o:v.clone(o,!0,!0))}o=s=null,l.length&&v.each(l,function(e,t){t.src?v.ajax?v.ajax({url:t.src,type:"GET",dataType:"script",async:!1,global:!1,"throws":!0}):v.error("no ajax"):v.globalEval((t.text||t.textContent||t.innerHTML||"").replace(Tt,"")),t.parentNode&&t.parentNode.removeChild(t)})}return this}}),v.buildFragment=function(e,n,r){var s,o,u,a=e[0];return n=n||i,n=!n.nodeType&&n[0]||n,n=n.ownerDocument||n,e.length===1&&typeof a=="string"&&a.length<512&&n===i&&a.charAt(0)==="<"&&!bt.test(a)&&(v.support.checkClone||!St.test(a))&&(v.support.html5Clone||!wt.test(a))&&(o=!0,s=v.fragments[a],u=s!==t),s||(s=n.createDocumentFragment(),v.clean(e,n,s,r),o&&(v.fragments[a]=u&&s)),{fragment:s,cacheable:o}},v.fragments={},v.each({appendTo:"append",prependTo:"prepend",insertBefore:"before",insertAfter:"after",replaceAll:"replaceWith"},function(e,t){v.fn[e]=function(n){var r,i=0,s=[],o=v(n),u=o.length,a=this.length===1&&this[0].parentNode;if((a==null||a&&a.nodeType===11&&a.childNodes.length===1)&&u===1)return o[t](this[0]),this;for(;i<u;i++)r=(i>0?this.clone(!0):this).get(),v(o[i])[t](r),s=s.concat(r);return this.pushStack(s,e,o.selector)}}),v.extend({clone:function(e,t,n){var r,i,s,o;v.support.html5Clone||v.isXMLDoc(e)||!wt.test("<"+e.nodeName+">")?o=e.cloneNode(!0):(kt.innerHTML=e.outerHTML,kt.removeChild(o=kt.firstChild));if((!v.support.noCloneEvent||!v.support.noCloneChecked)&&(e.nodeType===1||e.nodeType===11)&&!v.isXMLDoc(e)){Ot(e,o),r=Mt(e),i=Mt(o);for(s=0;r[s];++s)i[s]&&Ot(r[s],i[s])}if(t){At(e,o);if(n){r=Mt(e),i=Mt(o);for(s=0;r[s];++s)At(r[s],i[s])}}return r=i=null,o},clean:function(e,t,n,r){var s,o,u,a,f,l,c,h,p,d,m,g,y=t===i&&Ct,b=[];if(!t||typeof t.createDocumentFragment=="undefined")t=i;for(s=0;(u=e[s])!=null;s++){typeof u=="number"&&(u+="");if(!u)continue;if(typeof u=="string")if(!gt.test(u))u=t.createTextNode(u);else{y=y||lt(t),c=t.createElement("div"),y.appendChild(c),u=u.replace(dt,"<$1></$2>"),a=(vt.exec(u)||["",""])[1].toLowerCase(),f=Nt[a]||Nt._default,l=f[0],c.innerHTML=f[1]+u+f[2];while(l--)c=c.lastChild;if(!v.support.tbody){h=mt.test(u),p=a==="table"&&!h?c.firstChild&&c.firstChild.childNodes:f[1]==="<table>"&&!h?c.childNodes:[];for(o=p.length-1;o>=0;--o)v.nodeName(p[o],"tbody")&&!p[o].childNodes.length&&p[o].parentNode.removeChild(p[o])}!v.support.leadingWhitespace&&pt.test(u)&&c.insertBefore(t.createTextNode(pt.exec(u)[0]),c.firstChild),u=c.childNodes,c.parentNode.removeChild(c)}u.nodeType?b.push(u):v.merge(b,u)}c&&(u=c=y=null);if(!v.support.appendChecked)for(s=0;(u=b[s])!=null;s++)v.nodeName(u,"input")?_t(u):typeof u.getElementsByTagName!="undefined"&&v.grep(u.getElementsByTagName("input"),_t);if(n){m=function(e){if(!e.type||xt.test(e.type))return r?r.push(e.parentNode?e.parentNode.removeChild(e):e):n.appendChild(e)};for(s=0;(u=b[s])!=null;s++)if(!v.nodeName(u,"script")||!m(u))n.appendChild(u),typeof u.getElementsByTagName!="undefined"&&(g=v.grep(v.merge([],u.getElementsByTagName("script")),m),b.splice.apply(b,[s+1,0].concat(g)),s+=g.length)}return b},cleanData:function(e,t){var n,r,i,s,o=0,u=v.expando,a=v.cache,f=v.support.deleteExpando,l=v.event.special;for(;(i=e[o])!=null;o++)if(t||v.acceptData(i)){r=i[u],n=r&&a[r];if(n){if(n.events)for(s in n.events)l[s]?v.event.remove(i,s):v.removeEvent(i,s,n.handle);a[r]&&(delete a[r],f?delete i[u]:i.removeAttribute?i.removeAttribute(u):i[u]=null,v.deletedIds.push(r))}}}}),function(){var e,t;v.uaMatch=function(e){e=e.toLowerCase();var t=/(chrome)[ \/]([\w.]+)/.exec(e)||/(webkit)[ \/]([\w.]+)/.exec(e)||/(opera)(?:.*version|)[ \/]([\w.]+)/.exec(e)||/(msie) ([\w.]+)/.exec(e)||e.indexOf("compatible")<0&&/(mozilla)(?:.*? rv:([\w.]+)|)/.exec(e)||[];return{browser:t[1]||"",version:t[2]||"0"}},e=v.uaMatch(o.userAgent),t={},e.browser&&(t[e.browser]=!0,t.version=e.version),t.chrome?t.webkit=!0:t.webkit&&(t.safari=!0),v.browser=t,v.sub=function(){function e(t,n){return new e.fn.init(t,n)}v.extend(!0,e,this),e.superclass=this,e.fn=e.prototype=this(),e.fn.constructor=e,e.sub=this.sub,e.fn.init=function(r,i){return i&&i instanceof v&&!(i instanceof e)&&(i=e(i)),v.fn.init.call(this,r,i,t)},e.fn.init.prototype=e.fn;var t=e(i);return e}}();var Dt,Pt,Ht,Bt=/alpha\([^)]*\)/i,jt=/opacity=([^)]*)/,Ft=/^(top|right|bottom|left)$/,It=/^(none|table(?!-c[ea]).+)/,qt=/^margin/,Rt=new RegExp("^("+m+")(.*)$","i"),Ut=new RegExp("^("+m+")(?!px)[a-z%]+$","i"),zt=new RegExp("^([-+])=("+m+")","i"),Wt={BODY:"block"},Xt={position:"absolute",visibility:"hidden",display:"block"},Vt={letterSpacing:0,fontWeight:400},$t=["Top","Right","Bottom","Left"],Jt=["Webkit","O","Moz","ms"],Kt=v.fn.toggle;v.fn.extend({css:function(e,n){return v.access(this,function(e,n,r){return r!==t?v.style(e,n,r):v.css(e,n)},e,n,arguments.length>1)},show:function(){return Yt(this,!0)},hide:function(){return Yt(this)},toggle:function(e,t){var n=typeof e=="boolean";return v.isFunction(e)&&v.isFunction(t)?Kt.apply(this,arguments):this.each(function(){(n?e:Gt(this))?v(this).show():v(this).hide()})}}),v.extend({cssHooks:{opacity:{get:function(e,t){if(t){var n=Dt(e,"opacity");return n===""?"1":n}}}},cssNumber:{fillOpacity:!0,fontWeight:!0,lineHeight:!0,opacity:!0,orphans:!0,widows:!0,zIndex:!0,zoom:!0},cssProps:{"float":v.support.cssFloat?"cssFloat":"styleFloat"},style:function(e,n,r,i){if(!e||e.nodeType===3||e.nodeType===8||!e.style)return;var s,o,u,a=v.camelCase(n),f=e.style;n=v.cssProps[a]||(v.cssProps[a]=Qt(f,a)),u=v.cssHooks[n]||v.cssHooks[a];if(r===t)return u&&"get"in u&&(s=u.get(e,!1,i))!==t?s:f[n];o=typeof r,o==="string"&&(s=zt.exec(r))&&(r=(s[1]+1)*s[2]+parseFloat(v.css(e,n)),o="number");if(r==null||o==="number"&&isNaN(r))return;o==="number"&&!v.cssNumber[a]&&(r+="px");if(!u||!("set"in u)||(r=u.set(e,r,i))!==t)try{f[n]=r}catch(l){}},css:function(e,n,r,i){var s,o,u,a=v.camelCase(n);return n=v.cssProps[a]||(v.cssProps[a]=Qt(e.style,a)),u=v.cssHooks[n]||v.cssHooks[a],u&&"get"in u&&(s=u.get(e,!0,i)),s===t&&(s=Dt(e,n)),s==="normal"&&n in Vt&&(s=Vt[n]),r||i!==t?(o=parseFloat(s),r||v.isNumeric(o)?o||0:s):s},swap:function(e,t,n){var r,i,s={};for(i in t)s[i]=e.style[i],e.style[i]=t[i];r=n.call(e);for(i in t)e.style[i]=s[i];return r}}),e.getComputedStyle?Dt=function(t,n){var r,i,s,o,u=e.getComputedStyle(t,null),a=t.style;return u&&(r=u.getPropertyValue(n)||u[n],r===""&&!v.contains(t.ownerDocument,t)&&(r=v.style(t,n)),Ut.test(r)&&qt.test(n)&&(i=a.width,s=a.minWidth,o=a.maxWidth,a.minWidth=a.maxWidth=a.width=r,r=u.width,a.width=i,a.minWidth=s,a.maxWidth=o)),r}:i.documentElement.currentStyle&&(Dt=function(e,t){var n,r,i=e.currentStyle&&e.currentStyle[t],s=e.style;return i==null&&s&&s[t]&&(i=s[t]),Ut.test(i)&&!Ft.test(t)&&(n=s.left,r=e.runtimeStyle&&e.runtimeStyle.left,r&&(e.runtimeStyle.left=e.currentStyle.left),s.left=t==="fontSize"?"1em":i,i=s.pixelLeft+"px",s.left=n,r&&(e.runtimeStyle.left=r)),i===""?"auto":i}),v.each(["height","width"],function(e,t){v.cssHooks[t]={get:function(e,n,r){if(n)return e.offsetWidth===0&&It.test(Dt(e,"display"))?v.swap(e,Xt,function(){return tn(e,t,r)}):tn(e,t,r)},set:function(e,n,r){return Zt(e,n,r?en(e,t,r,v.support.boxSizing&&v.css(e,"boxSizing")==="border-box"):0)}}}),v.support.opacity||(v.cssHooks.opacity={get:function(e,t){return jt.test((t&&e.currentStyle?e.currentStyle.filter:e.style.filter)||"")?.01*parseFloat(RegExp.$1)+"":t?"1":""},set:function(e,t){var n=e.style,r=e.currentStyle,i=v.isNumeric(t)?"alpha(opacity="+t*100+")":"",s=r&&r.filter||n.filter||"";n.zoom=1;if(t>=1&&v.trim(s.replace(Bt,""))===""&&n.removeAttribute){n.removeAttribute("filter");if(r&&!r.filter)return}n.filter=Bt.test(s)?s.replace(Bt,i):s+" "+i}}),v(function(){v.support.reliableMarginRight||(v.cssHooks.marginRight={get:function(e,t){return v.swap(e,{display:"inline-block"},function(){if(t)return Dt(e,"marginRight")})}}),!v.support.pixelPosition&&v.fn.position&&v.each(["top","left"],function(e,t){v.cssHooks[t]={get:function(e,n){if(n){var r=Dt(e,t);return Ut.test(r)?v(e).position()[t]+"px":r}}}})}),v.expr&&v.expr.filters&&(v.expr.filters.hidden=function(e){return e.offsetWidth===0&&e.offsetHeight===0||!v.support.reliableHiddenOffsets&&(e.style&&e.style.display||Dt(e,"display"))==="none"},v.expr.filters.visible=function(e){return!v.expr.filters.hidden(e)}),v.each({margin:"",padding:"",border:"Width"},function(e,t){v.cssHooks[e+t]={expand:function(n){var r,i=typeof n=="string"?n.split(" "):[n],s={};for(r=0;r<4;r++)s[e+$t[r]+t]=i[r]||i[r-2]||i[0];return s}},qt.test(e)||(v.cssHooks[e+t].set=Zt)});var rn=/%20/g,sn=/\[\]$/,on=/\r?\n/g,un=/^(?:color|date|datetime|datetime-local|email|hidden|month|number|password|range|search|tel|text|time|url|week)$/i,an=/^(?:select|textarea)/i;v.fn.extend({serialize:function(){return v.param(this.serializeArray())},serializeArray:function(){return this.map(function(){return this.elements?v.makeArray(this.elements):this}).filter(function(){return this.name&&!this.disabled&&(this.checked||an.test(this.nodeName)||un.test(this.type))}).map(function(e,t){var n=v(this).val();return n==null?null:v.isArray(n)?v.map(n,function(e,n){return{name:t.name,value:e.replace(on,"\r\n")}}):{name:t.name,value:n.replace(on,"\r\n")}}).get()}}),v.param=function(e,n){var r,i=[],s=function(e,t){t=v.isFunction(t)?t():t==null?"":t,i[i.length]=encodeURIComponent(e)+"="+encodeURIComponent(t)};n===t&&(n=v.ajaxSettings&&v.ajaxSettings.traditional);if(v.isArray(e)||e.jquery&&!v.isPlainObject(e))v.each(e,function(){s(this.name,this.value)});else for(r in e)fn(r,e[r],n,s);return i.join("&").replace(rn,"+")};var ln,cn,hn=/#.*$/,pn=/^(.*?):[ \t]*([^\r\n]*)\r?$/mg,dn=/^(?:about|app|app\-storage|.+\-extension|file|res|widget):$/,vn=/^(?:GET|HEAD)$/,mn=/^\/\//,gn=/\?/,yn=/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,bn=/([?&])_=[^&]*/,wn=/^([\w\+\.\-]+:)(?:\/\/([^\/?#:]*)(?::(\d+)|)|)/,En=v.fn.load,Sn={},xn={},Tn=["*/"]+["*"];try{cn=s.href}catch(Nn){cn=i.createElement("a"),cn.href="",cn=cn.href}ln=wn.exec(cn.toLowerCase())||[],v.fn.load=function(e,n,r){if(typeof e!="string"&&En)return En.apply(this,arguments);if(!this.length)return this;var i,s,o,u=this,a=e.indexOf(" ");return a>=0&&(i=e.slice(a,e.length),e=e.slice(0,a)),v.isFunction(n)?(r=n,n=t):n&&typeof n=="object"&&(s="POST"),v.ajax({url:e,type:s,dataType:"html",data:n,complete:function(e,t){r&&u.each(r,o||[e.responseText,t,e])}}).done(function(e){o=arguments,u.html(i?v("<div>").append(e.replace(yn,"")).find(i):e)}),this},v.each("ajaxStart ajaxStop ajaxComplete ajaxError ajaxSuccess ajaxSend".split(" "),function(e,t){v.fn[t]=function(e){return this.on(t,e)}}),v.each(["get","post"],function(e,n){v[n]=function(e,r,i,s){return v.isFunction(r)&&(s=s||i,i=r,r=t),v.ajax({type:n,url:e,data:r,success:i,dataType:s})}}),v.extend({getScript:function(e,n){return v.get(e,t,n,"script")},getJSON:function(e,t,n){return v.get(e,t,n,"json")},ajaxSetup:function(e,t){return t?Ln(e,v.ajaxSettings):(t=e,e=v.ajaxSettings),Ln(e,t),e},ajaxSettings:{url:cn,isLocal:dn.test(ln[1]),global:!0,type:"GET",contentType:"application/x-www-form-urlencoded; charset=UTF-8",processData:!0,async:!0,accepts:{xml:"application/xml, text/xml",html:"text/html",text:"text/plain",json:"application/json, text/javascript","*":Tn},contents:{xml:/xml/,html:/html/,json:/json/},responseFields:{xml:"responseXML",text:"responseText"},converters:{"* text":e.String,"text html":!0,"text json":v.parseJSON,"text xml":v.parseXML},flatOptions:{context:!0,url:!0}},ajaxPrefilter:Cn(Sn),ajaxTransport:Cn(xn),ajax:function(e,n){function T(e,n,s,a){var l,y,b,w,S,T=n;if(E===2)return;E=2,u&&clearTimeout(u),o=t,i=a||"",x.readyState=e>0?4:0,s&&(w=An(c,x,s));if(e>=200&&e<300||e===304)c.ifModified&&(S=x.getResponseHeader("Last-Modified"),S&&(v.lastModified[r]=S),S=x.getResponseHeader("Etag"),S&&(v.etag[r]=S)),e===304?(T="notmodified",l=!0):(l=On(c,w),T=l.state,y=l.data,b=l.error,l=!b);else{b=T;if(!T||e)T="error",e<0&&(e=0)}x.status=e,x.statusText=(n||T)+"",l?d.resolveWith(h,[y,T,x]):d.rejectWith(h,[x,T,b]),x.statusCode(g),g=t,f&&p.trigger("ajax"+(l?"Success":"Error"),[x,c,l?y:b]),m.fireWith(h,[x,T]),f&&(p.trigger("ajaxComplete",[x,c]),--v.active||v.event.trigger("ajaxStop"))}typeof e=="object"&&(n=e,e=t),n=n||{};var r,i,s,o,u,a,f,l,c=v.ajaxSetup({},n),h=c.context||c,p=h!==c&&(h.nodeType||h instanceof v)?v(h):v.event,d=v.Deferred(),m=v.Callbacks("once memory"),g=c.statusCode||{},b={},w={},E=0,S="canceled",x={readyState:0,setRequestHeader:function(e,t){if(!E){var n=e.toLowerCase();e=w[n]=w[n]||e,b[e]=t}return this},getAllResponseHeaders:function(){return E===2?i:null},getResponseHeader:function(e){var n;if(E===2){if(!s){s={};while(n=pn.exec(i))s[n[1].toLowerCase()]=n[2]}n=s[e.toLowerCase()]}return n===t?null:n},overrideMimeType:function(e){return E||(c.mimeType=e),this},abort:function(e){return e=e||S,o&&o.abort(e),T(0,e),this}};d.promise(x),x.success=x.done,x.error=x.fail,x.complete=m.add,x.statusCode=function(e){if(e){var t;if(E<2)for(t in e)g[t]=[g[t],e[t]];else t=e[x.status],x.always(t)}return this},c.url=((e||c.url)+"").replace(hn,"").replace(mn,ln[1]+"//"),c.dataTypes=v.trim(c.dataType||"*").toLowerCase().split(y),c.crossDomain==null&&(a=wn.exec(c.url.toLowerCase()),c.crossDomain=!(!a||a[1]===ln[1]&&a[2]===ln[2]&&(a[3]||(a[1]==="http:"?80:443))==(ln[3]||(ln[1]==="http:"?80:443)))),c.data&&c.processData&&typeof c.data!="string"&&(c.data=v.param(c.data,c.traditional)),kn(Sn,c,n,x);if(E===2)return x;f=c.global,c.type=c.type.toUpperCase(),c.hasContent=!vn.test(c.type),f&&v.active++===0&&v.event.trigger("ajaxStart");if(!c.hasContent){c.data&&(c.url+=(gn.test(c.url)?"&":"?")+c.data,delete c.data),r=c.url;if(c.cache===!1){var N=v.now(),C=c.url.replace(bn,"$1_="+N);c.url=C+(C===c.url?(gn.test(c.url)?"&":"?")+"_="+N:"")}}(c.data&&c.hasContent&&c.contentType!==!1||n.contentType)&&x.setRequestHeader("Content-Type",c.contentType),c.ifModified&&(r=r||c.url,v.lastModified[r]&&x.setRequestHeader("If-Modified-Since",v.lastModified[r]),v.etag[r]&&x.setRequestHeader("If-None-Match",v.etag[r])),x.setRequestHeader("Accept",c.dataTypes[0]&&c.accepts[c.dataTypes[0]]?c.accepts[c.dataTypes[0]]+(c.dataTypes[0]!=="*"?", "+Tn+"; q=0.01":""):c.accepts["*"]);for(l in c.headers)x.setRequestHeader(l,c.headers[l]);if(!c.beforeSend||c.beforeSend.call(h,x,c)!==!1&&E!==2){S="abort";for(l in{success:1,error:1,complete:1})x[l](c[l]);o=kn(xn,c,n,x);if(!o)T(-1,"No Transport");else{x.readyState=1,f&&p.trigger("ajaxSend",[x,c]),c.async&&c.timeout>0&&(u=setTimeout(function(){x.abort("timeout")},c.timeout));try{E=1,o.send(b,T)}catch(k){if(!(E<2))throw k;T(-1,k)}}return x}return x.abort()},active:0,lastModified:{},etag:{}});var Mn=[],_n=/\?/,Dn=/(=)\?(?=&|$)|\?\?/,Pn=v.now();v.ajaxSetup({jsonp:"callback",jsonpCallback:function(){var e=Mn.pop()||v.expando+"_"+Pn++;return this[e]=!0,e}}),v.ajaxPrefilter("json jsonp",function(n,r,i){var s,o,u,a=n.data,f=n.url,l=n.jsonp!==!1,c=l&&Dn.test(f),h=l&&!c&&typeof a=="string"&&!(n.contentType||"").indexOf("application/x-www-form-urlencoded")&&Dn.test(a);if(n.dataTypes[0]==="jsonp"||c||h)return s=n.jsonpCallback=v.isFunction(n.jsonpCallback)?n.jsonpCallback():n.jsonpCallback,o=e[s],c?n.url=f.replace(Dn,"$1"+s):h?n.data=a.replace(Dn,"$1"+s):l&&(n.url+=(_n.test(f)?"&":"?")+n.jsonp+"="+s),n.converters["script json"]=function(){return u||v.error(s+" was not called"),u[0]},n.dataTypes[0]="json",e[s]=function(){u=arguments},i.always(function(){e[s]=o,n[s]&&(n.jsonpCallback=r.jsonpCallback,Mn.push(s)),u&&v.isFunction(o)&&o(u[0]),u=o=t}),"script"}),v.ajaxSetup({accepts:{script:"text/javascript, application/javascript, application/ecmascript, application/x-ecmascript"},contents:{script:/javascript|ecmascript/},converters:{"text script":function(e){return v.globalEval(e),e}}}),v.ajaxPrefilter("script",function(e){e.cache===t&&(e.cache=!1),e.crossDomain&&(e.type="GET",e.global=!1)}),v.ajaxTransport("script",function(e){if(e.crossDomain){var n,r=i.head||i.getElementsByTagName("head")[0]||i.documentElement;return{send:function(s,o){n=i.createElement("script"),n.async="async",e.scriptCharset&&(n.charset=e.scriptCharset),n.src=e.url,n.onload=n.onreadystatechange=function(e,i){if(i||!n.readyState||/loaded|complete/.test(n.readyState))n.onload=n.onreadystatechange=null,r&&n.parentNode&&r.removeChild(n),n=t,i||o(200,"success")},r.insertBefore(n,r.firstChild)},abort:function(){n&&n.onload(0,1)}}}});var Hn,Bn=e.ActiveXObject?function(){for(var e in Hn)Hn[e](0,1)}:!1,jn=0;v.ajaxSettings.xhr=e.ActiveXObject?function(){return!this.isLocal&&Fn()||In()}:Fn,function(e){v.extend(v.support,{ajax:!!e,cors:!!e&&"withCredentials"in e})}(v.ajaxSettings.xhr()),v.support.ajax&&v.ajaxTransport(function(n){if(!n.crossDomain||v.support.cors){var r;return{send:function(i,s){var o,u,a=n.xhr();n.username?a.open(n.type,n.url,n.async,n.username,n.password):a.open(n.type,n.url,n.async);if(n.xhrFields)for(u in n.xhrFields)a[u]=n.xhrFields[u];n.mimeType&&a.overrideMimeType&&a.overrideMimeType(n.mimeType),!n.crossDomain&&!i["X-Requested-With"]&&(i["X-Requested-With"]="XMLHttpRequest");try{for(u in i)a.setRequestHeader(u,i[u])}catch(f){}a.send(n.hasContent&&n.data||null),r=function(e,i){var u,f,l,c,h;try{if(r&&(i||a.readyState===4)){r=t,o&&(a.onreadystatechange=v.noop,Bn&&delete Hn[o]);if(i)a.readyState!==4&&a.abort();else{u=a.status,l=a.getAllResponseHeaders(),c={},h=a.responseXML,h&&h.documentElement&&(c.xml=h);try{c.text=a.responseText}catch(p){}try{f=a.statusText}catch(p){f=""}!u&&n.isLocal&&!n.crossDomain?u=c.text?200:404:u===1223&&(u=204)}}}catch(d){i||s(-1,d)}c&&s(u,f,c,l)},n.async?a.readyState===4?setTimeout(r,0):(o=++jn,Bn&&(Hn||(Hn={},v(e).unload(Bn)),Hn[o]=r),a.onreadystatechange=r):r()},abort:function(){r&&r(0,1)}}}});var qn,Rn,Un=/^(?:toggle|show|hide)$/,zn=new RegExp("^(?:([-+])=|)("+m+")([a-z%]*)$","i"),Wn=/queueHooks$/,Xn=[Gn],Vn={"*":[function(e,t){var n,r,i=this.createTween(e,t),s=zn.exec(t),o=i.cur(),u=+o||0,a=1,f=20;if(s){n=+s[2],r=s[3]||(v.cssNumber[e]?"":"px");if(r!=="px"&&u){u=v.css(i.elem,e,!0)||n||1;do a=a||".5",u/=a,v.style(i.elem,e,u+r);while(a!==(a=i.cur()/o)&&a!==1&&--f)}i.unit=r,i.start=u,i.end=s[1]?u+(s[1]+1)*n:n}return i}]};v.Animation=v.extend(Kn,{tweener:function(e,t){v.isFunction(e)?(t=e,e=["*"]):e=e.split(" ");var n,r=0,i=e.length;for(;r<i;r++)n=e[r],Vn[n]=Vn[n]||[],Vn[n].unshift(t)},prefilter:function(e,t){t?Xn.unshift(e):Xn.push(e)}}),v.Tween=Yn,Yn.prototype={constructor:Yn,init:function(e,t,n,r,i,s){this.elem=e,this.prop=n,this.easing=i||"swing",this.options=t,this.start=this.now=this.cur(),this.end=r,this.unit=s||(v.cssNumber[n]?"":"px")},cur:function(){var e=Yn.propHooks[this.prop];return e&&e.get?e.get(this):Yn.propHooks._default.get(this)},run:function(e){var t,n=Yn.propHooks[this.prop];return this.options.duration?this.pos=t=v.easing[this.easing](e,this.options.duration*e,0,1,this.options.duration):this.pos=t=e,this.now=(this.end-this.start)*t+this.start,this.options.step&&this.options.step.call(this.elem,this.now,this),n&&n.set?n.set(this):Yn.propHooks._default.set(this),this}},Yn.prototype.init.prototype=Yn.prototype,Yn.propHooks={_default:{get:function(e){var t;return e.elem[e.prop]==null||!!e.elem.style&&e.elem.style[e.prop]!=null?(t=v.css(e.elem,e.prop,!1,""),!t||t==="auto"?0:t):e.elem[e.prop]},set:function(e){v.fx.step[e.prop]?v.fx.step[e.prop](e):e.elem.style&&(e.elem.style[v.cssProps[e.prop]]!=null||v.cssHooks[e.prop])?v.style(e.elem,e.prop,e.now+e.unit):e.elem[e.prop]=e.now}}},Yn.propHooks.scrollTop=Yn.propHooks.scrollLeft={set:function(e){e.elem.nodeType&&e.elem.parentNode&&(e.elem[e.prop]=e.now)}},v.each(["toggle","show","hide"],function(e,t){var n=v.fn[t];v.fn[t]=function(r,i,s){return r==null||typeof r=="boolean"||!e&&v.isFunction(r)&&v.isFunction(i)?n.apply(this,arguments):this.animate(Zn(t,!0),r,i,s)}}),v.fn.extend({fadeTo:function(e,t,n,r){return this.filter(Gt).css("opacity",0).show().end().animate({opacity:t},e,n,r)},animate:function(e,t,n,r){var i=v.isEmptyObject(e),s=v.speed(t,n,r),o=function(){var t=Kn(this,v.extend({},e),s);i&&t.stop(!0)};return i||s.queue===!1?this.each(o):this.queue(s.queue,o)},stop:function(e,n,r){var i=function(e){var t=e.stop;delete e.stop,t(r)};return typeof e!="string"&&(r=n,n=e,e=t),n&&e!==!1&&this.queue(e||"fx",[]),this.each(function(){var t=!0,n=e!=null&&e+"queueHooks",s=v.timers,o=v._data(this);if(n)o[n]&&o[n].stop&&i(o[n]);else for(n in o)o[n]&&o[n].stop&&Wn.test(n)&&i(o[n]);for(n=s.length;n--;)s[n].elem===this&&(e==null||s[n].queue===e)&&(s[n].anim.stop(r),t=!1,s.splice(n,1));(t||!r)&&v.dequeue(this,e)})}}),v.each({slideDown:Zn("show"),slideUp:Zn("hide"),slideToggle:Zn("toggle"),fadeIn:{opacity:"show"},fadeOut:{opacity:"hide"},fadeToggle:{opacity:"toggle"}},function(e,t){v.fn[e]=function(e,n,r){return this.animate(t,e,n,r)}}),v.speed=function(e,t,n){var r=e&&typeof e=="object"?v.extend({},e):{complete:n||!n&&t||v.isFunction(e)&&e,duration:e,easing:n&&t||t&&!v.isFunction(t)&&t};r.duration=v.fx.off?0:typeof r.duration=="number"?r.duration:r.duration in v.fx.speeds?v.fx.speeds[r.duration]:v.fx.speeds._default;if(r.queue==null||r.queue===!0)r.queue="fx";return r.old=r.complete,r.complete=function(){v.isFunction(r.old)&&r.old.call(this),r.queue&&v.dequeue(this,r.queue)},r},v.easing={linear:function(e){return e},swing:function(e){return.5-Math.cos(e*Math.PI)/2}},v.timers=[],v.fx=Yn.prototype.init,v.fx.tick=function(){var e,n=v.timers,r=0;qn=v.now();for(;r<n.length;r++)e=n[r],!e()&&n[r]===e&&n.splice(r--,1);n.length||v.fx.stop(),qn=t},v.fx.timer=function(e){e()&&v.timers.push(e)&&!Rn&&(Rn=setInterval(v.fx.tick,v.fx.interval))},v.fx.interval=13,v.fx.stop=function(){clearInterval(Rn),Rn=null},v.fx.speeds={slow:600,fast:200,_default:400},v.fx.step={},v.expr&&v.expr.filters&&(v.expr.filters.animated=function(e){return v.grep(v.timers,function(t){return e===t.elem}).length});var er=/^(?:body|html)$/i;v.fn.offset=function(e){if(arguments.length)return e===t?this:this.each(function(t){v.offset.setOffset(this,e,t)});var n,r,i,s,o,u,a,f={top:0,left:0},l=this[0],c=l&&l.ownerDocument;if(!c)return;return(r=c.body)===l?v.offset.bodyOffset(l):(n=c.documentElement,v.contains(n,l)?(typeof l.getBoundingClientRect!="undefined"&&(f=l.getBoundingClientRect()),i=tr(c),s=n.clientTop||r.clientTop||0,o=n.clientLeft||r.clientLeft||0,u=i.pageYOffset||n.scrollTop,a=i.pageXOffset||n.scrollLeft,{top:f.top+u-s,left:f.left+a-o}):f)},v.offset={bodyOffset:function(e){var t=e.offsetTop,n=e.offsetLeft;return v.support.doesNotIncludeMarginInBodyOffset&&(t+=parseFloat(v.css(e,"marginTop"))||0,n+=parseFloat(v.css(e,"marginLeft"))||0),{top:t,left:n}},setOffset:function(e,t,n){var r=v.css(e,"position");r==="static"&&(e.style.position="relative");var i=v(e),s=i.offset(),o=v.css(e,"top"),u=v.css(e,"left"),a=(r==="absolute"||r==="fixed")&&v.inArray("auto",[o,u])>-1,f={},l={},c,h;a?(l=i.position(),c=l.top,h=l.left):(c=parseFloat(o)||0,h=parseFloat(u)||0),v.isFunction(t)&&(t=t.call(e,n,s)),t.top!=null&&(f.top=t.top-s.top+c),t.left!=null&&(f.left=t.left-s.left+h),"using"in t?t.using.call(e,f):i.css(f)}},v.fn.extend({position:function(){if(!this[0])return;var e=this[0],t=this.offsetParent(),n=this.offset(),r=er.test(t[0].nodeName)?{top:0,left:0}:t.offset();return n.top-=parseFloat(v.css(e,"marginTop"))||0,n.left-=parseFloat(v.css(e,"marginLeft"))||0,r.top+=parseFloat(v.css(t[0],"borderTopWidth"))||0,r.left+=parseFloat(v.css(t[0],"borderLeftWidth"))||0,{top:n.top-r.top,left:n.left-r.left}},offsetParent:function(){return this.map(function(){var e=this.offsetParent||i.body;while(e&&!er.test(e.nodeName)&&v.css(e,"position")==="static")e=e.offsetParent;return e||i.body})}}),v.each({scrollLeft:"pageXOffset",scrollTop:"pageYOffset"},function(e,n){var r=/Y/.test(n);v.fn[e]=function(i){return v.access(this,function(e,i,s){var o=tr(e);if(s===t)return o?n in o?o[n]:o.document.documentElement[i]:e[i];o?o.scrollTo(r?v(o).scrollLeft():s,r?s:v(o).scrollTop()):e[i]=s},e,i,arguments.length,null)}}),v.each({Height:"height",Width:"width"},function(e,n){v.each({padding:"inner"+e,content:n,"":"outer"+e},function(r,i){v.fn[i]=function(i,s){var o=arguments.length&&(r||typeof i!="boolean"),u=r||(i===!0||s===!0?"margin":"border");return v.access(this,function(n,r,i){var s;return v.isWindow(n)?n.document.documentElement["client"+e]:n.nodeType===9?(s=n.documentElement,Math.max(n.body["scroll"+e],s["scroll"+e],n.body["offset"+e],s["offset"+e],s["client"+e])):i===t?v.css(n,r,i,u):v.style(n,r,i,u)},n,o?i:t,o,null)}})}),e.jQuery=e.$=v,typeof define=="function"&&define.amd&&define.amd.jQuery&&define("jquery",[],function(){return v})})(window);
// Knockout JavaScript library v2.2.1
// (c) Steven Sanderson - http://knockoutjs.com/
// License: MIT (http://www.opensource.org/licenses/mit-license.php)
(function () {
    function j(w) {
        throw w;
    }
    var m = !0,
        p = null,
        r = !1;

    function u(w) {
        return function () {
            return w
        }
    };
    var x = window,
        y = document,
        ga = navigator,
        F = window.jQuery,
        I = void 0;

    function L(w) {
        function ha(a, d, c, e, f) {
            var g = [];
            a = b.j(function () {
                var a = d(c, f) || [];
                0 < g.length && (b.a.Ya(M(g), a), e && b.r.K(e, p, [c, a, f]));
                g.splice(0, g.length);
                b.a.P(g, a)
            }, p, {
                W: a,
                Ka: function () {
                    return 0 == g.length || !b.a.X(g[0])
                }
            });
            return {
                M: g,
                j: a.pa() ? a : I
            }
        }
        function M(a) {
            for (; a.length && !b.a.X(a[0]);) a.splice(0, 1);
            if (1 < a.length) {
                for (var d = a[0], c = a[a.length - 1], e = [d]; d !== c;) {
                    d = d.nextSibling;
                    if (!d) return;
                    e.push(d)
                }
                Array.prototype.splice.apply(a, [0, a.length].concat(e))
            }
            return a
        }
        function S(a, b, c, e, f) {
            var g = Math.min,
                h = Math.max,
                k = [],
                l, n = a.length,
                q, s = b.length,
                v = s - n || 1,
                G = n + s + 1,
                J, A, z;
            for (l = 0; l <= n; l++) {
                A = J;
                k.push(J = []);
                z = g(s, l + v);
                for (q = h(0, l - 1); q <= z; q++) J[q] = q ? l ? a[l - 1] === b[q - 1] ? A[q - 1] : g(A[q] || G, J[q - 1] || G) + 1 : q + 1 : l + 1
            }
            g = [];
            h = [];
            v = [];
            l = n;
            for (q = s; l || q;) s = k[l][q] - 1, q && s === k[l][q - 1] ? h.push(g[g.length] = {
                    status: c,
                    value: b[--q],
                    index: q
                }) : l && s === k[l - 1][q] ? v.push(g[g.length] = {
                    status: e,
                    value: a[--l],
                    index: l
                }) : (g.push({
                    status: "retained",
                    value: b[--q]
                }), --l);
            if (h.length && v.length) {
                a = 10 * n;
                var t;
                for (b = c = 0;
                (f || b < a) && (t = h[c]); c++) {
                    for (e =
                        0; k = v[e]; e++) if (t.value === k.value) {
                            t.moved = k.index;
                            k.moved = t.index;
                            v.splice(e, 1);
                            b = e = 0;
                            break
                        }
                    b += e
                }
            }
            return g.reverse()
        }
        function T(a, d, c, e, f) {
            f = f || {};
            var g = a && N(a),
                g = g && g.ownerDocument,
                h = f.templateEngine || O;
            b.za.vb(c, h, g);
            c = h.renderTemplate(c, e, f, g);
            ("number" != typeof c.length || 0 < c.length && "number" != typeof c[0].nodeType) && j(Error("Template engine must return an array of DOM nodes"));
            g = r;
            switch (d) {
            case "replaceChildren":
                b.e.N(a, c);
                g = m;
                break;
            case "replaceNode":
                b.a.Ya(a, c);
                g = m;
                break;
            case "ignoreTargetNode":
                break;
            default:
                j(Error("Unknown renderMode: " + d))
            }
            g && (U(c, e), f.afterRender && b.r.K(f.afterRender, p, [c, e.$data]));
            return c
        }
        function N(a) {
            return a.nodeType ? a : 0 < a.length ? a[0] : p
        }
        function U(a, d) {
            if (a.length) {
                var c = a[0],
                    e = a[a.length - 1];
                V(c, e, function (a) {
                    b.Da(d, a)
                });
                V(c, e, function (a) {
                    b.s.ib(a, [d])
                })
            }
        }
        function V(a, d, c) {
            var e;
            for (d = b.e.nextSibling(d); a && (e = a) !== d;) a = b.e.nextSibling(e), (1 === e.nodeType || 8 === e.nodeType) && c(e)
        }
        function W(a, d, c) {
            a = b.g.aa(a);
            for (var e = b.g.Q, f = 0; f < a.length; f++) {
                var g = a[f].key;
                if (e.hasOwnProperty(g)) {
                    var h =
                        e[g];
                    "function" === typeof h ? (g = h(a[f].value)) && j(Error(g)) : h || j(Error("This template engine does not support the '" + g + "' binding within its templates"))
                }
            }
            a = "ko.__tr_ambtns(function($context,$element){return(function(){return{ " + b.g.ba(a) + " } })()})";
            return c.createJavaScriptEvaluatorBlock(a) + d
        }
        function X(a, d, c, e) {
            function f(a) {
                return function () {
                    return k[a]
                }
            }
            function g() {
                return k
            }
            var h = 0,
                k, l;
            b.j(function () {
                var n = c && c instanceof b.z ? c : new b.z(b.a.d(c)),
                    q = n.$data;
                e && b.eb(a, n);
                if (k = ("function" == typeof d ?
                    d(n, a) : d) || b.J.instance.getBindings(a, n)) {
                    if (0 === h) {
                        h = 1;
                        for (var s in k) {
                            var v = b.c[s];
                            v && 8 === a.nodeType && !b.e.I[s] && j(Error("The binding '" + s + "' cannot be used with virtual elements"));
                            if (v && "function" == typeof v.init && (v = (0, v.init)(a, f(s), g, q, n)) && v.controlsDescendantBindings) l !== I && j(Error("Multiple bindings (" + l + " and " + s + ") are trying to control descendant bindings of the same element. You cannot use these bindings together on the same element.")), l = s
                        }
                        h = 2
                    }
                    if (2 === h) for (s in k)(v = b.c[s]) && "function" ==
                                typeof v.update && (0, v.update)(a, f(s), g, q, n)
                }
            }, p, {
                W: a
            });
            return {
                Nb: l === I
            }
        }
        function Y(a, d, c) {
            var e = m,
                f = 1 === d.nodeType;
            f && b.e.Ta(d);
            if (f && c || b.J.instance.nodeHasBindings(d)) e = X(d, p, a, c).Nb;
            e && Z(a, d, !f)
        }
        function Z(a, d, c) {
            for (var e = b.e.firstChild(d); d = e;) e = b.e.nextSibling(d), Y(a, d, c)
        }
        function $(a, b) {
            var c = aa(a, b);
            return c ? 0 < c.length ? c[c.length - 1].nextSibling : a.nextSibling : p
        }
        function aa(a, b) {
            for (var c = a, e = 1, f = []; c = c.nextSibling;) {
                if (H(c) && (e--, 0 === e)) return f;
                f.push(c);
                B(c) && e++
            }
            b || j(Error("Cannot find closing comment tag to match: " +
                a.nodeValue));
            return p
        }
        function H(a) {
            return 8 == a.nodeType && (K ? a.text : a.nodeValue).match(ia)
        }
        function B(a) {
            return 8 == a.nodeType && (K ? a.text : a.nodeValue).match(ja)
        }
        function P(a, b) {
            for (var c = p; a != c;) c = a, a = a.replace(ka, function (a, c) {
                    return b[c]
                });
            return a
        }
        function la() {
            var a = [],
                d = [];
            this.save = function (c, e) {
                var f = b.a.i(a, c);
                0 <= f ? d[f] = e : (a.push(c), d.push(e))
            };
            this.get = function (c) {
                c = b.a.i(a, c);
                return 0 <= c ? d[c] : I
            }
        }
        function ba(a, b, c) {
            function e(e) {
                var g = b(a[e]);
                switch (typeof g) {
                case "boolean":
                case "number":
                case "string":
                case "function":
                    f[e] =
                        g;
                    break;
                case "object":
                case "undefined":
                    var h = c.get(g);
                    f[e] = h !== I ? h : ba(g, b, c)
                }
            }
            c = c || new la;
            a = b(a);
            if (!("object" == typeof a && a !== p && a !== I && !(a instanceof Date))) return a;
            var f = a instanceof Array ? [] : {};
            c.save(a, f);
            var g = a;
            if (g instanceof Array) {
                for (var h = 0; h < g.length; h++) e(h);
                "function" == typeof g.toJSON && e("toJSON")
            } else for (h in g) e(h);
            return f
        }
        function ca(a, d) {
            if (a) if (8 == a.nodeType) {
                    var c = b.s.Ua(a.nodeValue);
                    c != p && d.push({
                        sb: a,
                        Fb: c
                    })
                } else if (1 == a.nodeType) for (var c = 0, e = a.childNodes, f = e.length; c < f; c++) ca(e[c],
                        d)
        }
        function Q(a, d, c, e) {
            b.c[a] = {
                init: function (a) {
                    b.a.f.set(a, da, {});
                    return {
                        controlsDescendantBindings: m
                    }
                },
                update: function (a, g, h, k, l) {
                    h = b.a.f.get(a, da);
                    g = b.a.d(g());
                    k = !c !== !g;
                    var n = !h.Za;
                    if (n || d || k !== h.qb) n && (h.Za = b.a.Ia(b.e.childNodes(a), m)), k ? (n || b.e.N(a, b.a.Ia(h.Za)), b.Ea(e ? e(l, g) : l, a)) : b.e.Y(a), h.qb = k
                }
            };
            b.g.Q[a] = r;
            b.e.I[a] = m
        }
        function ea(a, d, c) {
            c && d !== b.k.q(a) && b.k.T(a, d);
            d !== b.k.q(a) && b.r.K(b.a.Ba, p, [a, "change"])
        }
        var b = "undefined" !== typeof w ? w : {};
        b.b = function (a, d) {
            for (var c = a.split("."), e = b, f = 0; f <
                c.length - 1; f++) e = e[c[f]];
            e[c[c.length - 1]] = d
        };
        b.p = function (a, b, c) {
            a[b] = c
        };
        b.version = "2.2.1";
        b.b("version", b.version);
        b.a = new function () {
            function a(a, d) {
                if ("input" !== b.a.u(a) || !a.type || "click" != d.toLowerCase()) return r;
                var c = a.type;
                return "checkbox" == c || "radio" == c
            }
            var d = /^(\s|\u00A0)+|(\s|\u00A0)+$/g,
                c = {}, e = {};
            c[/Firefox\/2/i.test(ga.userAgent) ? "KeyboardEvent" : "UIEvents"] = ["keyup", "keydown", "keypress"];
            c.MouseEvents = "click dblclick mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave".split(" ");
            for (var f in c) {
                var g = c[f];
                if (g.length) for (var h = 0, k = g.length; h < k; h++) e[g[h]] = f
            }
            var l = {
                propertychange: m
            }, n, c = 3;
            f = y.createElement("div");
            for (g = f.getElementsByTagName("i"); f.innerHTML = "\x3c!--[if gt IE " + ++c + "]><i></i><![endif]--\x3e", g[0];);
            n = 4 < c ? c : I;
            return {
                Na: ["authenticity_token", /^__RequestVerificationToken(_.*)?$/],
                o: function (a, b) {
                    for (var d = 0, c = a.length; d < c; d++) b(a[d])
                },
                i: function (a, b) {
                    if ("function" == typeof Array.prototype.indexOf) return Array.prototype.indexOf.call(a, b);
                    for (var d = 0, c = a.length; d <
                        c; d++) if (a[d] === b) return d;
                    return -1
                },
                lb: function (a, b, d) {
                    for (var c = 0, e = a.length; c < e; c++) if (b.call(d, a[c])) return a[c];
                    return p
                },
                ga: function (a, d) {
                    var c = b.a.i(a, d);
                    0 <= c && a.splice(c, 1)
                },
                Ga: function (a) {
                    a = a || [];
                    for (var d = [], c = 0, e = a.length; c < e; c++) 0 > b.a.i(d, a[c]) && d.push(a[c]);
                    return d
                },
                V: function (a, b) {
                    a = a || [];
                    for (var d = [], c = 0, e = a.length; c < e; c++) d.push(b(a[c]));
                    return d
                },
                fa: function (a, b) {
                    a = a || [];
                    for (var d = [], c = 0, e = a.length; c < e; c++) b(a[c]) && d.push(a[c]);
                    return d
                },
                P: function (a, b) {
                    if (b instanceof Array) a.push.apply(a,
                            b);
                    else for (var d = 0, c = b.length; d < c; d++) a.push(b[d]);
                    return a
                },
                extend: function (a, b) {
                    if (b) for (var d in b) b.hasOwnProperty(d) && (a[d] = b[d]);
                    return a
                },
                ka: function (a) {
                    for (; a.firstChild;) b.removeNode(a.firstChild)
                },
                Hb: function (a) {
                    a = b.a.L(a);
                    for (var d = y.createElement("div"), c = 0, e = a.length; c < e; c++) d.appendChild(b.A(a[c]));
                    return d
                },
                Ia: function (a, d) {
                    for (var c = 0, e = a.length, g = []; c < e; c++) {
                        var f = a[c].cloneNode(m);
                        g.push(d ? b.A(f) : f)
                    }
                    return g
                },
                N: function (a, d) {
                    b.a.ka(a);
                    if (d) for (var c = 0, e = d.length; c < e; c++) a.appendChild(d[c])
                },
                Ya: function (a, d) {
                    var c = a.nodeType ? [a] : a;
                    if (0 < c.length) {
                        for (var e = c[0], g = e.parentNode, f = 0, h = d.length; f < h; f++) g.insertBefore(d[f], e);
                        f = 0;
                        for (h = c.length; f < h; f++) b.removeNode(c[f])
                    }
                },
                bb: function (a, b) {
                    7 > n ? a.setAttribute("selected", b) : a.selected = b
                },
                D: function (a) {
                    return (a || "").replace(d, "")
                },
                Rb: function (a, d) {
                    for (var c = [], e = (a || "").split(d), f = 0, g = e.length; f < g; f++) {
                        var h = b.a.D(e[f]);
                        "" !== h && c.push(h)
                    }
                    return c
                },
                Ob: function (a, b) {
                    a = a || "";
                    return b.length > a.length ? r : a.substring(0, b.length) === b
                },
                tb: function (a, b) {
                    if (b.compareDocumentPosition) return 16 ==
                            (b.compareDocumentPosition(a) & 16);
                    for (; a != p;) {
                        if (a == b) return m;
                        a = a.parentNode
                    }
                    return r
                },
                X: function (a) {
                    return b.a.tb(a, a.ownerDocument)
                },
                u: function (a) {
                    return a && a.tagName && a.tagName.toLowerCase()
                },
                n: function (b, d, c) {
                    var e = n && l[d];
                    if (!e && "undefined" != typeof F) {
                        if (a(b, d)) {
                            var f = c;
                            c = function (a, b) {
                                var d = this.checked;
                                b && (this.checked = b.nb !== m);
                                f.call(this, a);
                                this.checked = d
                            }
                        }
                        F(b).bind(d, c)
                    } else !e && "function" == typeof b.addEventListener ? b.addEventListener(d, c, r) : "undefined" != typeof b.attachEvent ? b.attachEvent("on" +
                        d, function (a) {
                        c.call(b, a)
                    }) : j(Error("Browser doesn't support addEventListener or attachEvent"))
                },
                Ba: function (b, d) {
                    (!b || !b.nodeType) && j(Error("element must be a DOM node when calling triggerEvent"));
                    if ("undefined" != typeof F) {
                        var c = [];
                        a(b, d) && c.push({
                            nb: b.checked
                        });
                        F(b).trigger(d, c)
                    } else "function" == typeof y.createEvent ? "function" == typeof b.dispatchEvent ? (c = y.createEvent(e[d] || "HTMLEvents"), c.initEvent(d, m, m, x, 0, 0, 0, 0, 0, r, r, r, r, 0, b), b.dispatchEvent(c)) : j(Error("The supplied element doesn't support dispatchEvent")) :
                            "undefined" != typeof b.fireEvent ? (a(b, d) && (b.checked = b.checked !== m), b.fireEvent("on" + d)) : j(Error("Browser doesn't support triggering events"))
                },
                d: function (a) {
                    return b.$(a) ? a() : a
                },
                ua: function (a) {
                    return b.$(a) ? a.t() : a
                },
                da: function (a, d, c) {
                    if (d) {
                        var e = /[\w-]+/g,
                            f = a.className.match(e) || [];
                        b.a.o(d.match(e), function (a) {
                            var d = b.a.i(f, a);
                            0 <= d ? c || f.splice(d, 1) : c && f.push(a)
                        });
                        a.className = f.join(" ")
                    }
                },
                cb: function (a, d) {
                    var c = b.a.d(d);
                    if (c === p || c === I) c = "";
                    if (3 === a.nodeType) a.data = c;
                    else {
                        var e = b.e.firstChild(a);
                        !e || 3 != e.nodeType || b.e.nextSibling(e) ? b.e.N(a, [y.createTextNode(c)]) : e.data = c;
                        b.a.wb(a)
                    }
                },
                ab: function (a, b) {
                    a.name = b;
                    if (7 >= n) try {
                            a.mergeAttributes(y.createElement("<input name='" + a.name + "'/>"), r)
                    } catch (d) {}
                },
                wb: function (a) {
                    9 <= n && (a = 1 == a.nodeType ? a : a.parentNode, a.style && (a.style.zoom = a.style.zoom))
                },
                ub: function (a) {
                    if (9 <= n) {
                        var b = a.style.width;
                        a.style.width = 0;
                        a.style.width = b
                    }
                },
                Lb: function (a, d) {
                    a = b.a.d(a);
                    d = b.a.d(d);
                    for (var c = [], e = a; e <= d; e++) c.push(e);
                    return c
                },
                L: function (a) {
                    for (var b = [], d = 0, c = a.length; d <
                        c; d++) b.push(a[d]);
                    return b
                },
                Pb: 6 === n,
                Qb: 7 === n,
                Z: n,
                Oa: function (a, d) {
                    for (var c = b.a.L(a.getElementsByTagName("input")).concat(b.a.L(a.getElementsByTagName("textarea"))), e = "string" == typeof d ? function (a) {
                            return a.name === d
                        } : function (a) {
                            return d.test(a.name)
                        }, f = [], g = c.length - 1; 0 <= g; g--) e(c[g]) && f.push(c[g]);
                    return f
                },
                Ib: function (a) {
                    return "string" == typeof a && (a = b.a.D(a)) ? x.JSON && x.JSON.parse ? x.JSON.parse(a) : (new Function("return " + a))() : p
                },
                xa: function (a, d, c) {
                    ("undefined" == typeof JSON || "undefined" == typeof JSON.stringify) &&
                        j(Error("Cannot find JSON.stringify(). Some browsers (e.g., IE < 8) don't support it natively, but you can overcome this by adding a script reference to json2.js, downloadable from http://www.json.org/json2.js"));
                    return JSON.stringify(b.a.d(a), d, c)
                },
                Jb: function (a, d, c) {
                    c = c || {};
                    var e = c.params || {}, f = c.includeFields || this.Na,
                        g = a;
                    if ("object" == typeof a && "form" === b.a.u(a)) for (var g = a.action, h = f.length - 1; 0 <= h; h--) for (var k = b.a.Oa(a, f[h]), l = k.length - 1; 0 <= l; l--) e[k[l].name] = k[l].value;
                    d = b.a.d(d);
                    var n = y.createElement("form");
                    n.style.display = "none";
                    n.action = g;
                    n.method = "post";
                    for (var w in d) a = y.createElement("input"), a.name = w, a.value = b.a.xa(b.a.d(d[w])), n.appendChild(a);
                    for (w in e) a = y.createElement("input"), a.name = w, a.value = e[w], n.appendChild(a);
                    y.body.appendChild(n);
                    c.submitter ? c.submitter(n) : n.submit();
                    setTimeout(function () {
                        n.parentNode.removeChild(n)
                    }, 0)
                }
            }
        };
        b.b("utils", b.a);
        b.b("utils.arrayForEach", b.a.o);
        b.b("utils.arrayFirst", b.a.lb);
        b.b("utils.arrayFilter", b.a.fa);
        b.b("utils.arrayGetDistinctValues", b.a.Ga);
        b.b("utils.arrayIndexOf",
            b.a.i);
        b.b("utils.arrayMap", b.a.V);
        b.b("utils.arrayPushAll", b.a.P);
        b.b("utils.arrayRemoveItem", b.a.ga);
        b.b("utils.extend", b.a.extend);
        b.b("utils.fieldsIncludedWithJsonPost", b.a.Na);
        b.b("utils.getFormFields", b.a.Oa);
        b.b("utils.peekObservable", b.a.ua);
        b.b("utils.postJson", b.a.Jb);
        b.b("utils.parseJson", b.a.Ib);
        b.b("utils.registerEventHandler", b.a.n);
        b.b("utils.stringifyJson", b.a.xa);
        b.b("utils.range", b.a.Lb);
        b.b("utils.toggleDomNodeCssClass", b.a.da);
        b.b("utils.triggerEvent", b.a.Ba);
        b.b("utils.unwrapObservable",
            b.a.d);
        Function.prototype.bind || (Function.prototype.bind = function (a) {
            var b = this,
                c = Array.prototype.slice.call(arguments);
            a = c.shift();
            return function () {
                return b.apply(a, c.concat(Array.prototype.slice.call(arguments)))
            }
        });
        b.a.f = new function () {
            var a = 0,
                d = "__ko__" + (new Date).getTime(),
                c = {};
            return {
                get: function (a, d) {
                    var c = b.a.f.la(a, r);
                    return c === I ? I : c[d]
                },
                set: function (a, d, c) {
                    c === I && b.a.f.la(a, r) === I || (b.a.f.la(a, m)[d] = c)
                },
                la: function (b, f) {
                    var g = b[d];
                    if (!g || !("null" !== g && c[g])) {
                        if (!f) return I;
                        g = b[d] = "ko" +
                            a++;
                        c[g] = {}
                    }
                    return c[g]
                },
                clear: function (a) {
                    var b = a[d];
                    return b ? (delete c[b], a[d] = p, m) : r
                }
            }
        };
        b.b("utils.domData", b.a.f);
        b.b("utils.domData.clear", b.a.f.clear);
        b.a.F = new function () {
            function a(a, d) {
                var e = b.a.f.get(a, c);
                e === I && d && (e = [], b.a.f.set(a, c, e));
                return e
            }
            function d(c) {
                var e = a(c, r);
                if (e) for (var e = e.slice(0), k = 0; k < e.length; k++) e[k](c);
                b.a.f.clear(c);
                "function" == typeof F && "function" == typeof F.cleanData && F.cleanData([c]);
                if (f[c.nodeType]) for (e = c.firstChild; c = e;) e = c.nextSibling, 8 === c.nodeType && d(c)
            }
            var c = "__ko_domNodeDisposal__" + (new Date).getTime(),
                e = {
                    1: m,
                    8: m,
                    9: m
                }, f = {
                    1: m,
                    9: m
                };
            return {
                Ca: function (b, d) {
                    "function" != typeof d && j(Error("Callback must be a function"));
                    a(b, m).push(d)
                },
                Xa: function (d, e) {
                    var f = a(d, r);
                    f && (b.a.ga(f, e), 0 == f.length && b.a.f.set(d, c, I))
                },
                A: function (a) {
                    if (e[a.nodeType] && (d(a), f[a.nodeType])) {
                        var c = [];
                        b.a.P(c, a.getElementsByTagName("*"));
                        for (var k = 0, l = c.length; k < l; k++) d(c[k])
                    }
                    return a
                },
                removeNode: function (a) {
                    b.A(a);
                    a.parentNode && a.parentNode.removeChild(a)
                }
            }
        };
        b.A = b.a.F.A;
        b.removeNode =
            b.a.F.removeNode;
        b.b("cleanNode", b.A);
        b.b("removeNode", b.removeNode);
        b.b("utils.domNodeDisposal", b.a.F);
        b.b("utils.domNodeDisposal.addDisposeCallback", b.a.F.Ca);
        b.b("utils.domNodeDisposal.removeDisposeCallback", b.a.F.Xa);
        b.a.ta = function (a) {
            var d;
            if ("undefined" != typeof F) if (F.parseHTML) d = F.parseHTML(a);
                else {
                    if ((d = F.clean([a])) && d[0]) {
                        for (a = d[0]; a.parentNode && 11 !== a.parentNode.nodeType;) a = a.parentNode;
                        a.parentNode && a.parentNode.removeChild(a)
                    }
                } else {
                    var c = b.a.D(a).toLowerCase();
                    d = y.createElement("div");
                    c = c.match(/^<(thead|tbody|tfoot)/) && [1, "<table>", "</table>"] || !c.indexOf("<tr") && [2, "<table><tbody>", "</tbody></table>"] || (!c.indexOf("<td") || !c.indexOf("<th")) && [3, "<table><tbody><tr>", "</tr></tbody></table>"] || [0, "", ""];
                    a = "ignored<div>" + c[1] + a + c[2] + "</div>";
                    for ("function" == typeof x.innerShiv ? d.appendChild(x.innerShiv(a)) : d.innerHTML = a; c[0]--;) d = d.lastChild;
                    d = b.a.L(d.lastChild.childNodes)
                }
            return d
        };
        b.a.ca = function (a, d) {
            b.a.ka(a);
            d = b.a.d(d);
            if (d !== p && d !== I) if ("string" != typeof d && (d = d.toString()),
                    "undefined" != typeof F) F(a).html(d);
                else for (var c = b.a.ta(d), e = 0; e < c.length; e++) a.appendChild(c[e])
        };
        b.b("utils.parseHtmlFragment", b.a.ta);
        b.b("utils.setHtml", b.a.ca);
        var R = {};
        b.s = {
            ra: function (a) {
                "function" != typeof a && j(Error("You can only pass a function to ko.memoization.memoize()"));
                var b = (4294967296 * (1 + Math.random()) | 0).toString(16).substring(1) + (4294967296 * (1 + Math.random()) | 0).toString(16).substring(1);
                R[b] = a;
                return "\x3c!--[ko_memo:" + b + "]--\x3e"
            },
            hb: function (a, b) {
                var c = R[a];
                c === I && j(Error("Couldn't find any memo with ID " +
                    a + ". Perhaps it's already been unmemoized."));
                try {
                    return c.apply(p, b || []), m
                } catch(err) {
                } finally {
                    delete R[a]
                }
            },
            ib: function (a, d) {
                var c = [];
                ca(a, c);
                for (var e = 0, f = c.length; e < f; e++) {
                    var g = c[e].sb,
                        h = [g];
                    d && b.a.P(h, d);
                    b.s.hb(c[e].Fb, h);
                    g.nodeValue = "";
                    g.parentNode && g.parentNode.removeChild(g)
                }
            },
            Ua: function (a) {
                return (a = a.match(/^\[ko_memo\:(.*?)\]$/)) ? a[1] : p
            }
        };
        b.b("memoization", b.s);
        b.b("memoization.memoize", b.s.ra);
        b.b("memoization.unmemoize", b.s.hb);
        b.b("memoization.parseMemoText", b.s.Ua);
        b.b("memoization.unmemoizeDomNodeAndDescendants",
            b.s.ib);
        b.Ma = {
            throttle: function (a, d) {
                a.throttleEvaluation = d;
                var c = p;
                return b.j({
                    read: a,
                    write: function (b) {
                        clearTimeout(c);
                        c = setTimeout(function () {
                            a(b)
                        }, d)
                    }
                })
            },
            notify: function (a, d) {
                a.equalityComparer = "always" == d ? u(r) : b.m.fn.equalityComparer;
                return a
            }
        };
        b.b("extenders", b.Ma);
        b.fb = function (a, d, c) {
            this.target = a;
            this.ha = d;
            this.rb = c;
            b.p(this, "dispose", this.B)
        };
        b.fb.prototype.B = function () {
            this.Cb = m;
            this.rb()
        };
        b.S = function () {
            this.w = {};
            b.a.extend(this, b.S.fn);
            b.p(this, "subscribe", this.ya);
            b.p(this, "extend",
                this.extend);
            b.p(this, "getSubscriptionsCount", this.yb)
        };
        b.S.fn = {
            ya: function (a, d, c) {
                c = c || "change";
                var e = new b.fb(this, d ? a.bind(d) : a, function () {
                    b.a.ga(this.w[c], e)
                }.bind(this));
                this.w[c] || (this.w[c] = []);
                this.w[c].push(e);
                return e
            },
            notifySubscribers: function (a, d) {
                d = d || "change";
                this.w[d] && b.r.K(function () {
                    b.a.o(this.w[d].slice(0), function (b) {
                        b && b.Cb !== m && b.ha(a)
                    })
                }, this)
            },
            yb: function () {
                var a = 0,
                    b;
                for (b in this.w) this.w.hasOwnProperty(b) && (a += this.w[b].length);
                return a
            },
            extend: function (a) {
                var d = this;
                if (a) for (var c in a) {
                        var e =
                            b.Ma[c];
                        "function" == typeof e && (d = e(d, a[c]))
                }
                return d
            }
        };
        b.Qa = function (a) {
            return "function" == typeof a.ya && "function" == typeof a.notifySubscribers
        };
        b.b("subscribable", b.S);
        b.b("isSubscribable", b.Qa);
        var C = [];
        b.r = {
            mb: function (a) {
                C.push({
                    ha: a,
                    La: []
                })
            },
            end: function () {
                C.pop()
            },
            Wa: function (a) {
                b.Qa(a) || j(Error("Only subscribable things can act as dependencies"));
                if (0 < C.length) {
                    var d = C[C.length - 1];
                    d && !(0 <= b.a.i(d.La, a)) && (d.La.push(a), d.ha(a))
                }
            },
            K: function (a, b, c) {
                try {
                    return C.push(p), a.apply(b, c || [])
                } catch(err) {
                } finally {
                    C.pop()
                }
            }
        };
        var ma = {
            undefined: m,
            "boolean": m,
            number: m,
            string: m
        };
        b.m = function (a) {
            function d() {
                if (0 < arguments.length) {
                    if (!d.equalityComparer || !d.equalityComparer(c, arguments[0])) d.H(), c = arguments[0], d.G();
                    return this
                }
                b.r.Wa(d);
                return c
            }
            var c = a;
            b.S.call(d);
            d.t = function () {
                return c
            };
            d.G = function () {
                d.notifySubscribers(c)
            };
            d.H = function () {
                d.notifySubscribers(c, "beforeChange")
            };
            b.a.extend(d, b.m.fn);
            b.p(d, "peek", d.t);
            b.p(d, "valueHasMutated", d.G);
            b.p(d, "valueWillMutate", d.H);
            return d
        };
        b.m.fn = {
            equalityComparer: function (a,
                b) {
                return a === p || typeof a in ma ? a === b : r
            }
        };
        var E = b.m.Kb = "__ko_proto__";
        b.m.fn[E] = b.m;
        b.ma = function (a, d) {
            return a === p || a === I || a[E] === I ? r : a[E] === d ? m : b.ma(a[E], d)
        };
        b.$ = function (a) {
            return b.ma(a, b.m)
        };
        b.Ra = function (a) {
            return "function" == typeof a && a[E] === b.m || "function" == typeof a && a[E] === b.j && a.zb ? m : r
        };
        b.b("observable", b.m);
        b.b("isObservable", b.$);
        b.b("isWriteableObservable", b.Ra);
        b.R = function (a) {
            0 == arguments.length && (a = []);
            a !== p && (a !== I && !("length" in a)) && j(Error("The argument passed when initializing an observable array must be an array, or null, or undefined."));
            var d = b.m(a);
            b.a.extend(d, b.R.fn);
            return d
        };
        b.R.fn = {
            remove: function (a) {
                for (var b = this.t(), c = [], e = "function" == typeof a ? a : function (b) {
                        return b === a
                    }, f = 0; f < b.length; f++) {
                    var g = b[f];
                    e(g) && (0 === c.length && this.H(), c.push(g), b.splice(f, 1), f--)
                }
                c.length && this.G();
                return c
            },
            removeAll: function (a) {
                if (a === I) {
                    var d = this.t(),
                        c = d.slice(0);
                    this.H();
                    d.splice(0, d.length);
                    this.G();
                    return c
                }
                return !a ? [] : this.remove(function (d) {
                    return 0 <= b.a.i(a, d)
                })
            },
            destroy: function (a) {
                var b = this.t(),
                    c = "function" == typeof a ? a : function (b) {
                        return b ===
                            a
                    };
                this.H();
                for (var e = b.length - 1; 0 <= e; e--) c(b[e]) && (b[e]._destroy = m);
                this.G()
            },
            destroyAll: function (a) {
                return a === I ? this.destroy(u(m)) : !a ? [] : this.destroy(function (d) {
                    return 0 <= b.a.i(a, d)
                })
            },
            indexOf: function (a) {
                var d = this();
                return b.a.i(d, a)
            },
            replace: function (a, b) {
                var c = this.indexOf(a);
                0 <= c && (this.H(), this.t()[c] = b, this.G())
            }
        };
        b.a.o("pop push reverse shift sort splice unshift".split(" "), function (a) {
            b.R.fn[a] = function () {
                var b = this.t();
                this.H();
                b = b[a].apply(b, arguments);
                this.G();
                return b
            }
        });
        b.a.o(["slice"], function (a) {
            b.R.fn[a] = function () {
                var b = this();
                return b[a].apply(b, arguments)
            }
        });
        b.b("observableArray", b.R);
        b.j = function (a, d, c) {
            function e() {
                b.a.o(z, function (a) {
                    a.B()
                });
                z = []
            }
            function f() {
                var a = h.throttleEvaluation;
                a && 0 <= a ? (clearTimeout(t), t = setTimeout(g, a)) : g()
            }
            function g() {
                if (!q) if (n && w()) A();
                    else {
                        q = m;
                        try {
                            var a = b.a.V(z, function (a) {
                                return a.target
                            });
                            b.r.mb(function (c) {
                                var d;
                                0 <= (d = b.a.i(a, c)) ? a[d] = I : z.push(c.ya(f))
                            });
                            for (var c = s.call(d), e = a.length - 1; 0 <= e; e--) a[e] && z.splice(e, 1)[0].B();
                            n = m;
                            h.notifySubscribers(l,
                                "beforeChange");
                            l = c
                        } catch(err) {
                        } finally {
                            b.r.end()
                        }
                        h.notifySubscribers(l);
                        q = r;
                        z.length || A()
                    }
            }
            function h() {
                if (0 < arguments.length) return "function" === typeof v ? v.apply(d, arguments) : j(Error("Cannot write a value to a ko.computed unless you specify a 'write' option. If you wish to read the current value, don't pass any parameters.")), this;
                n || g();
                b.r.Wa(h);
                return l
            }
            function k() {
                return !n || 0 < z.length
            }
            var l, n = r,
                q = r,
                s = a;
            s && "object" == typeof s ? (c = s, s = c.read) : (c = c || {}, s || (s = c.read));
            "function" != typeof s && j(Error("Pass a function that returns the value of the ko.computed"));
            var v = c.write,
                G = c.disposeWhenNodeIsRemoved || c.W || p,
                w = c.disposeWhen || c.Ka || u(r),
                A = e,
                z = [],
                t = p;
            d || (d = c.owner);
            h.t = function () {
                n || g();
                return l
            };
            h.xb = function () {
                return z.length
            };
            h.zb = "function" === typeof c.write;
            h.B = function () {
                A()
            };
            h.pa = k;
            b.S.call(h);
            b.a.extend(h, b.j.fn);
            b.p(h, "peek", h.t);
            b.p(h, "dispose", h.B);
            b.p(h, "isActive", h.pa);
            b.p(h, "getDependenciesCount", h.xb);
            c.deferEvaluation !== m && g();
            if (G && k()) {
                A = function () {
                    b.a.F.Xa(G, arguments.callee);
                    e()
                };
                b.a.F.Ca(G, A);
                var D = w,
                    w = function () {
                        return !b.a.X(G) || D()
                    }
            }
            return h
        };
        b.Bb = function (a) {
            return b.ma(a, b.j)
        };
        w = b.m.Kb;
        b.j[w] = b.m;
        b.j.fn = {};
        b.j.fn[w] = b.j;
        b.b("dependentObservable", b.j);
        b.b("computed", b.j);
        b.b("isComputed", b.Bb);
        b.gb = function (a) {
            0 == arguments.length && j(Error("When calling ko.toJS, pass the object you want to convert."));
            return ba(a, function (a) {
                for (var c = 0; b.$(a) && 10 > c; c++) a = a();
                return a
            })
        };
        b.toJSON = function (a, d, c) {
            a = b.gb(a);
            return b.a.xa(a, d, c)
        };
        b.b("toJS", b.gb);
        b.b("toJSON", b.toJSON);
        b.k = {
            q: function (a) {
                switch (b.a.u(a)) {
                case "option":
                    return a.__ko__hasDomDataOptionValue__ ===
                        m ? b.a.f.get(a, b.c.options.sa) : 7 >= b.a.Z ? a.getAttributeNode("value").specified ? a.value : a.text : a.value;
                case "select":
                    return 0 <= a.selectedIndex ? b.k.q(a.options[a.selectedIndex]) : I;
                default:
                    return a.value
                }
            },
            T: function (a, d) {
                switch (b.a.u(a)) {
                case "option":
                    switch (typeof d) {
                    case "string":
                        b.a.f.set(a, b.c.options.sa, I);
                        "__ko__hasDomDataOptionValue__" in a && delete a.__ko__hasDomDataOptionValue__;
                        a.value = d;
                        break;
                    default:
                        b.a.f.set(a, b.c.options.sa, d), a.__ko__hasDomDataOptionValue__ = m, a.value = "number" === typeof d ?
                            d : ""
                    }
                    break;
                case "select":
                    for (var c = a.options.length - 1; 0 <= c; c--) if (b.k.q(a.options[c]) == d) {
                            a.selectedIndex = c;
                            break
                        }
                    break;
                default:
                    if (d === p || d === I) d = "";
                    a.value = d
                }
            }
        };
        b.b("selectExtensions", b.k);
        b.b("selectExtensions.readValue", b.k.q);
        b.b("selectExtensions.writeValue", b.k.T);
        var ka = /\@ko_token_(\d+)\@/g,
            na = ["true", "false"],
            oa = /^(?:[$_a-z][$\w]*|(.+)(\.\s*[$_a-z][$\w]*|\[.+\]))$/i;
        b.g = {
            Q: [],
            aa: function (a) {
                var d = b.a.D(a);
                if (3 > d.length) return [];
                "{" === d.charAt(0) && (d = d.substring(1, d.length - 1));
                a = [];
                for (var c =
                    p, e, f = 0; f < d.length; f++) {
                    var g = d.charAt(f);
                    if (c === p) switch (g) {
                        case '"':
                        case "'":
                        case "/":
                            c = f, e = g
                    } else if (g == e && "\\" !== d.charAt(f - 1)) {
                        g = d.substring(c, f + 1);
                        a.push(g);
                        var h = "@ko_token_" + (a.length - 1) + "@",
                            d = d.substring(0, c) + h + d.substring(f + 1),
                            f = f - (g.length - h.length),
                            c = p
                    }
                }
                e = c = p;
                for (var k = 0, l = p, f = 0; f < d.length; f++) {
                    g = d.charAt(f);
                    if (c === p) switch (g) {
                        case "{":
                            c = f;
                            l = g;
                            e = "}";
                            break;
                        case "(":
                            c = f;
                            l = g;
                            e = ")";
                            break;
                        case "[":
                            c = f, l = g, e = "]"
                    }
                    g === l ? k++ : g === e && (k--, 0 === k && (g = d.substring(c, f + 1), a.push(g), h = "@ko_token_" + (a.length -
                        1) + "@", d = d.substring(0, c) + h + d.substring(f + 1), f -= g.length - h.length, c = p))
                }
                e = [];
                d = d.split(",");
                c = 0;
                for (f = d.length; c < f; c++) k = d[c], l = k.indexOf(":"), 0 < l && l < k.length - 1 ? (g = k.substring(l + 1), e.push({
                        key: P(k.substring(0, l), a),
                        value: P(g, a)
                    })) : e.push({
                        unknown: P(k, a)
                    });
                return e
            },
            ba: function (a) {
                var d = "string" === typeof a ? b.g.aa(a) : a,
                    c = [];
                a = [];
                for (var e, f = 0; e = d[f]; f++) if (0 < c.length && c.push(","), e.key) {
                        var g;
                        a: {
                            g = e.key;
                            var h = b.a.D(g);
                            switch (h.length && h.charAt(0)) {
                            case "'":
                            case '"':
                                break a;
                            default:
                                g = "'" + h + "'"
                            }
                        }
                        e = e.value;
                        c.push(g);
                        c.push(":");
                        c.push(e);
                        e = b.a.D(e);
                        0 <= b.a.i(na, b.a.D(e).toLowerCase()) ? e = r : (h = e.match(oa), e = h === p ? r : h[1] ? "Object(" + h[1] + ")" + h[2] : e);
                        e && (0 < a.length && a.push(", "), a.push(g + " : function(__ko_value) { " + e + " = __ko_value; }"))
                    } else e.unknown && c.push(e.unknown);
                d = c.join("");
                0 < a.length && (d = d + ", '_ko_property_writers' : { " + a.join("") + " } ");
                return d
            },
            Eb: function (a, d) {
                for (var c = 0; c < a.length; c++) if (b.a.D(a[c].key) == d) return m;
                return r
            },
            ea: function (a, d, c, e, f) {
                if (!a || !b.Ra(a)) {
                    if ((a = d()._ko_property_writers) &&
                        a[c]) a[c](e)
                } else(!f || a.t() !== e) && a(e)
            }
        };
        b.b("expressionRewriting", b.g);
        b.b("expressionRewriting.bindingRewriteValidators", b.g.Q);
        b.b("expressionRewriting.parseObjectLiteral", b.g.aa);
        b.b("expressionRewriting.preProcessBindings", b.g.ba);
        b.b("jsonExpressionRewriting", b.g);
        b.b("jsonExpressionRewriting.insertPropertyAccessorsIntoJson", b.g.ba);
        var K = "\x3c!--test--\x3e" === y.createComment("test").text,
            ja = K ? /^\x3c!--\s*ko(?:\s+(.+\s*\:[\s\S]*))?\s*--\x3e$/ : /^\s*ko(?:\s+(.+\s*\:[\s\S]*))?\s*$/,
            ia = K ? /^\x3c!--\s*\/ko\s*--\x3e$/ :
                /^\s*\/ko\s*$/,
            pa = {
                ul: m,
                ol: m
            };
        b.e = {
            I: {},
            childNodes: function (a) {
                return B(a) ? aa(a) : a.childNodes
            },
            Y: function (a) {
                if (B(a)) {
                    a = b.e.childNodes(a);
                    for (var d = 0, c = a.length; d < c; d++) b.removeNode(a[d])
                } else b.a.ka(a)
            },
            N: function (a, d) {
                if (B(a)) {
                    b.e.Y(a);
                    for (var c = a.nextSibling, e = 0, f = d.length; e < f; e++) c.parentNode.insertBefore(d[e], c)
                } else b.a.N(a, d)
            },
            Va: function (a, b) {
                B(a) ? a.parentNode.insertBefore(b, a.nextSibling) : a.firstChild ? a.insertBefore(b, a.firstChild) : a.appendChild(b)
            },
            Pa: function (a, d, c) {
                c ? B(a) ? a.parentNode.insertBefore(d,
                    c.nextSibling) : c.nextSibling ? a.insertBefore(d, c.nextSibling) : a.appendChild(d) : b.e.Va(a, d)
            },
            firstChild: function (a) {
                return !B(a) ? a.firstChild : !a.nextSibling || H(a.nextSibling) ? p : a.nextSibling
            },
            nextSibling: function (a) {
                B(a) && (a = $(a));
                return a.nextSibling && H(a.nextSibling) ? p : a.nextSibling
            },
            jb: function (a) {
                return (a = B(a)) ? a[1] : p
            },
            Ta: function (a) {
                if (pa[b.a.u(a)]) {
                    var d = a.firstChild;
                    if (d) {
                        do if (1 === d.nodeType) {
                                var c;
                                c = d.firstChild;
                                var e = p;
                                if (c) {
                                    do if (e) e.push(c);
                                        else if (B(c)) {
                                        var f = $(c, m);
                                        f ? c = f : e = [c]
                                    } else H(c) &&
                                            (e = [c]);
                                    while (c = c.nextSibling)
                                }
                                if (c = e) {
                                    e = d.nextSibling;
                                    for (f = 0; f < c.length; f++) e ? a.insertBefore(c[f], e) : a.appendChild(c[f])
                                }
                            } while (d = d.nextSibling)
                    }
                }
            }
        };
        b.b("virtualElements", b.e);
        b.b("virtualElements.allowedBindings", b.e.I);
        b.b("virtualElements.emptyNode", b.e.Y);
        b.b("virtualElements.insertAfter", b.e.Pa);
        b.b("virtualElements.prepend", b.e.Va);
        b.b("virtualElements.setDomNodeChildren", b.e.N);
        b.J = function () {
            this.Ha = {}
        };
        b.a.extend(b.J.prototype, {
            nodeHasBindings: function (a) {
                switch (a.nodeType) {
                case 1:
                    return a.getAttribute("data-bind") !=
                        p;
                case 8:
                    return b.e.jb(a) != p;
                default:
                    return r
                }
            },
            getBindings: function (a, b) {
                var c = this.getBindingsString(a, b);
                return c ? this.parseBindingsString(c, b, a) : p
            },
            getBindingsString: function (a) {
                switch (a.nodeType) {
                case 1:
                    return a.getAttribute("data-bind");
                case 8:
                    return b.e.jb(a);
                default:
                    return p
                }
            },
            parseBindingsString: function (a, d, c) {
                try {
                    var e;
                    if (!(e = this.Ha[a])) {
                        var f = this.Ha,
                            g, h = "with($context){with($data||{}){return{" + b.g.ba(a) + "}}}";
                        g = new Function("$context", "$element", h);
                        e = f[a] = g
                    }
                    return e(d, c)
                } catch (k) {
                    j(Error("Unable to parse bindings.\nMessage: " +
                        k + ";\nBindings value: " + a))
                }
            }
        });
        b.J.instance = new b.J;
        b.b("bindingProvider", b.J);
        b.c = {};
        b.z = function (a, d, c) {
            d ? (b.a.extend(this, d), this.$parentContext = d, this.$parent = d.$data, this.$parents = (d.$parents || []).slice(0), this.$parents.unshift(this.$parent)) : (this.$parents = [], this.$root = a, this.ko = b);
            this.$data = a;
            c && (this[c] = a)
        };
        b.z.prototype.createChildContext = function (a, d) {
            return new b.z(a, this, d)
        };
        b.z.prototype.extend = function (a) {
            var d = b.a.extend(new b.z, this);
            return b.a.extend(d, a)
        };
        b.eb = function (a, d) {
            if (2 ==
                arguments.length) b.a.f.set(a, "__ko_bindingContext__", d);
            else return b.a.f.get(a, "__ko_bindingContext__")
        };
        b.Fa = function (a, d, c) {
            1 === a.nodeType && b.e.Ta(a);
            return X(a, d, c, m)
        };
        b.Ea = function (a, b) {
            (1 === b.nodeType || 8 === b.nodeType) && Z(a, b, m)
        };
        b.Da = function (a, b) {
            b && (1 !== b.nodeType && 8 !== b.nodeType) && j(Error("ko.applyBindings: first parameter should be your view model; second parameter should be a DOM node"));
            b = b || x.document.body;
            Y(a, b, m)
        };
        b.ja = function (a) {
            switch (a.nodeType) {
            case 1:
            case 8:
                var d = b.eb(a);
                if (d) return d;
                if (a.parentNode) return b.ja(a.parentNode)
            }
            return I
        };
        b.pb = function (a) {
            return (a = b.ja(a)) ? a.$data : I
        };
        b.b("bindingHandlers", b.c);
        b.b("applyBindings", b.Da);
        b.b("applyBindingsToDescendants", b.Ea);
        b.b("applyBindingsToNode", b.Fa);
        b.b("contextFor", b.ja);
        b.b("dataFor", b.pb);
        var fa = {
            "class": "className",
            "for": "htmlFor"
        };
        b.c.attr = {
            update: function (a, d) {
                var c = b.a.d(d()) || {}, e;
                for (e in c) if ("string" == typeof e) {
                        var f = b.a.d(c[e]),
                            g = f === r || f === p || f === I;
                        g && a.removeAttribute(e);
                        8 >= b.a.Z && e in fa ? (e = fa[e], g ? a.removeAttribute(e) :
                            a[e] = f) : g || a.setAttribute(e, f.toString());
                        "name" === e && b.a.ab(a, g ? "" : f.toString())
                    }
            }
        };
        b.c.checked = {
            init: function (a, d, c) {
                b.a.n(a, "click", function () {
                    var e;
                    if ("checkbox" == a.type) e = a.checked;
                    else if ("radio" == a.type && a.checked) e = a.value;
                    else return;
                    var f = d(),
                        g = b.a.d(f);
                    "checkbox" == a.type && g instanceof Array ? (e = b.a.i(g, a.value), a.checked && 0 > e ? f.push(a.value) : !a.checked && 0 <= e && f.splice(e, 1)) : b.g.ea(f, c, "checked", e, m)
                });
                "radio" == a.type && !a.name && b.c.uniqueName.init(a, u(m))
            },
            update: function (a, d) {
                var c = b.a.d(d());
                "checkbox" == a.type ? a.checked = c instanceof Array ? 0 <= b.a.i(c, a.value) : c : "radio" == a.type && (a.checked = a.value == c)
            }
        };
        b.c.css = {
            update: function (a, d) {
                var c = b.a.d(d());
                if ("object" == typeof c) for (var e in c) {
                        var f = b.a.d(c[e]);
                        b.a.da(a, e, f)
                } else c = String(c || ""), b.a.da(a, a.__ko__cssValue, r), a.__ko__cssValue = c, b.a.da(a, c, m)
            }
        };
        b.c.enable = {
            update: function (a, d) {
                var c = b.a.d(d());
                c && a.disabled ? a.removeAttribute("disabled") : !c && !a.disabled && (a.disabled = m)
            }
        };
        b.c.disable = {
            update: function (a, d) {
                b.c.enable.update(a, function () {
                    return !b.a.d(d())
                })
            }
        };
        b.c.event = {
            init: function (a, d, c, e) {
                var f = d() || {}, g;
                for (g in f)(function () {
                        var f = g;
                        "string" == typeof f && b.a.n(a, f, function (a) {
                            var g, n = d()[f];
                            if (n) {
                                var q = c();
                                try {
                                    var s = b.a.L(arguments);
                                    s.unshift(e);
                                    g = n.apply(e, s)
                                } catch(err) {
                                } finally {
                                    g !== m && (a.preventDefault ? a.preventDefault() : a.returnValue = r)
                                }
                                q[f + "Bubble"] === r && (a.cancelBubble = m, a.stopPropagation && a.stopPropagation())
                            }
                        })
                    })()
            }
        };
        b.c.foreach = {
            Sa: function (a) {
                return function () {
                    var d = a(),
                        c = b.a.ua(d);
                    if (!c || "number" == typeof c.length) return {
                            foreach: d,
                            templateEngine: b.C.oa
                    };
                    b.a.d(d);
                    return {
                        foreach: c.data,
                        as: c.as,
                        includeDestroyed: c.includeDestroyed,
                        afterAdd: c.afterAdd,
                        beforeRemove: c.beforeRemove,
                        afterRender: c.afterRender,
                        beforeMove: c.beforeMove,
                        afterMove: c.afterMove,
                        templateEngine: b.C.oa
                    }
                }
            },
            init: function (a, d) {
                return b.c.template.init(a, b.c.foreach.Sa(d))
            },
            update: function (a, d, c, e, f) {
                return b.c.template.update(a, b.c.foreach.Sa(d), c, e, f)
            }
        };
        b.g.Q.foreach = r;
        b.e.I.foreach = m;
        b.c.hasfocus = {
            init: function (a, d, c) {
                function e(e) {
                    a.__ko_hasfocusUpdating = m;
                    var f = a.ownerDocument;
                    "activeElement" in
                        f && (e = f.activeElement === a);
                    f = d();
                    b.g.ea(f, c, "hasfocus", e, m);
                    a.__ko_hasfocusUpdating = r
                }
                var f = e.bind(p, m),
                    g = e.bind(p, r);
                b.a.n(a, "focus", f);
                b.a.n(a, "focusin", f);
                b.a.n(a, "blur", g);
                b.a.n(a, "focusout", g)
            },
            update: function (a, d) {
                var c = b.a.d(d());
                a.__ko_hasfocusUpdating || (c ? a.focus() : a.blur(), b.r.K(b.a.Ba, p, [a, c ? "focusin" : "focusout"]))
            }
        };
        b.c.html = {
            init: function () {
                return {
                    controlsDescendantBindings: m
                }
            },
            update: function (a, d) {
                b.a.ca(a, d())
            }
        };
        var da = "__ko_withIfBindingData";
        Q("if");
        Q("ifnot", r, m);
        Q("with", m, r, function (a,
            b) {
            return a.createChildContext(b)
        });
        b.c.options = {
            update: function (a, d, c) {
                "select" !== b.a.u(a) && j(Error("options binding applies only to SELECT elements"));
                for (var e = 0 == a.length, f = b.a.V(b.a.fa(a.childNodes, function (a) {
                        return a.tagName && "option" === b.a.u(a) && a.selected
                    }), function (a) {
                        return b.k.q(a) || a.innerText || a.textContent
                    }), g = a.scrollTop, h = b.a.d(d()); 0 < a.length;) b.A(a.options[0]), a.remove(0);
                if (h) {
                    c = c();
                    var k = c.optionsIncludeDestroyed;
                    "number" != typeof h.length && (h = [h]);
                    if (c.optionsCaption) {
                        var l = y.createElement("option");
                        b.a.ca(l, c.optionsCaption);
                        b.k.T(l, I);
                        a.appendChild(l)
                    }
                    d = 0;
                    for (var n = h.length; d < n; d++) {
                        var q = h[d];
                        if (!q || !q._destroy || k) {
                            var l = y.createElement("option"),
                                s = function (a, b, c) {
                                    var d = typeof b;
                                    return "function" == d ? b(a) : "string" == d ? a[b] : c
                                }, v = s(q, c.optionsValue, q);
                            b.k.T(l, b.a.d(v));
                            q = s(q, c.optionsText, v);
                            b.a.cb(l, q);
                            a.appendChild(l)
                        }
                    }
                    h = a.getElementsByTagName("option");
                    d = k = 0;
                    for (n = h.length; d < n; d++) 0 <= b.a.i(f, b.k.q(h[d])) && (b.a.bb(h[d], m), k++);
                    a.scrollTop = g;
                    e && "value" in c && ea(a, b.a.ua(c.value), m);
                    b.a.ub(a)
                }
            }
        };
        b.c.options.sa = "__ko.optionValueDomData__";
        b.c.selectedOptions = {
            init: function (a, d, c) {
                b.a.n(a, "change", function () {
                    var e = d(),
                        f = [];
                    b.a.o(a.getElementsByTagName("option"), function (a) {
                        a.selected && f.push(b.k.q(a))
                    });
                    b.g.ea(e, c, "value", f)
                })
            },
            update: function (a, d) {
                "select" != b.a.u(a) && j(Error("values binding applies only to SELECT elements"));
                var c = b.a.d(d());
                c && "number" == typeof c.length && b.a.o(a.getElementsByTagName("option"), function (a) {
                    var d = 0 <= b.a.i(c, b.k.q(a));
                    b.a.bb(a, d)
                })
            }
        };
        b.c.style = {
            update: function (a,
                d) {
                var c = b.a.d(d() || {}),
                    e;
                for (e in c) if ("string" == typeof e) {
                        var f = b.a.d(c[e]);
                        a.style[e] = f || ""
                    }
            }
        };
        b.c.submit = {
            init: function (a, d, c, e) {
                "function" != typeof d() && j(Error("The value for a submit binding must be a function"));
                b.a.n(a, "submit", function (b) {
                    var c, h = d();
                    try {
                        c = h.call(e, a)
                    } catch(err) {
                    } finally {
                        c !== m && (b.preventDefault ? b.preventDefault() : b.returnValue = r)
                    }
                })
            }
        };
        b.c.text = {
            update: function (a, d) {
                b.a.cb(a, d())
            }
        };
        b.e.I.text = m;
        b.c.uniqueName = {
            init: function (a, d) {
                if (d()) {
                    var c = "ko_unique_" + ++b.c.uniqueName.ob;
                    b.a.ab(a,
                        c)
                }
            }
        };
        b.c.uniqueName.ob = 0;
        b.c.value = {
            init: function (a, d, c) {
                function e() {
                    h = r;
                    var e = d(),
                        f = b.k.q(a);
                    b.g.ea(e, c, "value", f)
                }
                var f = ["change"],
                    g = c().valueUpdate,
                    h = r;
                g && ("string" == typeof g && (g = [g]), b.a.P(f, g), f = b.a.Ga(f));
                if (b.a.Z && ("input" == a.tagName.toLowerCase() && "text" == a.type && "off" != a.autocomplete && (!a.form || "off" != a.form.autocomplete)) && -1 == b.a.i(f, "propertychange")) b.a.n(a, "propertychange", function () {
                        h = m
                    }), b.a.n(a, "blur", function () {
                        h && e()
                    });
                b.a.o(f, function (c) {
                    var d = e;
                    b.a.Ob(c, "after") && (d = function () {
                        setTimeout(e,
                            0)
                    }, c = c.substring(5));
                    b.a.n(a, c, d)
                })
            },
            update: function (a, d) {
                var c = "select" === b.a.u(a),
                    e = b.a.d(d()),
                    f = b.k.q(a),
                    g = e != f;
                0 === e && (0 !== f && "0" !== f) && (g = m);
                g && (f = function () {
                    b.k.T(a, e)
                }, f(), c && setTimeout(f, 0));
                c && 0 < a.length && ea(a, e, r)
            }
        };
        b.c.visible = {
            update: function (a, d) {
                var c = b.a.d(d()),
                    e = "none" != a.style.display;
                c && !e ? a.style.display = "" : !c && e && (a.style.display = "none")
            }
        };
        b.c.click = {
            init: function (a, d, c, e) {
                return b.c.event.init.call(this, a, function () {
                    var a = {};
                    a.click = d();
                    return a
                }, c, e)
            }
        };
        b.v = function () {};
        b.v.prototype.renderTemplateSource = function () {
            j(Error("Override renderTemplateSource"))
        };
        b.v.prototype.createJavaScriptEvaluatorBlock = function () {
            j(Error("Override createJavaScriptEvaluatorBlock"))
        };
        b.v.prototype.makeTemplateSource = function (a, d) {
            if ("string" == typeof a) {
                d = d || y;
                var c = d.getElementById(a);
                c || j(Error("Cannot find template with ID " + a));
                return new b.l.h(c)
            }
            if (1 == a.nodeType || 8 == a.nodeType) return new b.l.O(a);
            j(Error("Unknown template type: " + a))
        };
        b.v.prototype.renderTemplate = function (a, b, c, e) {
            a = this.makeTemplateSource(a, e);
            return this.renderTemplateSource(a, b, c)
        };
        b.v.prototype.isTemplateRewritten = function (a, b) {
            return this.allowTemplateRewriting === r ? m : this.makeTemplateSource(a, b).data("isRewritten")
        };
        b.v.prototype.rewriteTemplate = function (a, b, c) {
            a = this.makeTemplateSource(a, c);
            b = b(a.text());
            a.text(b);
            a.data("isRewritten", m)
        };
        b.b("templateEngine", b.v);
        var qa = /(<[a-z]+\d*(\s+(?!data-bind=)[a-z0-9\-]+(=(\"[^\"]*\"|\'[^\']*\'))?)*\s+)data-bind=(["'])([\s\S]*?)\5/gi,
            ra = /\x3c!--\s*ko\b\s*([\s\S]*?)\s*--\x3e/g;
        b.za = {
            vb: function (a,
                d, c) {
                d.isTemplateRewritten(a, c) || d.rewriteTemplate(a, function (a) {
                    return b.za.Gb(a, d)
                }, c)
            },
            Gb: function (a, b) {
                return a.replace(qa, function (a, e, f, g, h, k, l) {
                    return W(l, e, b)
                }).replace(ra, function (a, e) {
                    return W(e, "\x3c!-- ko --\x3e", b)
                })
            },
            kb: function (a) {
                return b.s.ra(function (d, c) {
                    d.nextSibling && b.Fa(d.nextSibling, a, c)
                })
            }
        };
        b.b("__tr_ambtns", b.za.kb);
        b.l = {};
        b.l.h = function (a) {
            this.h = a
        };
        b.l.h.prototype.text = function () {
            var a = b.a.u(this.h),
                a = "script" === a ? "text" : "textarea" === a ? "value" : "innerHTML";
            if (0 == arguments.length) return this.h[a];
            var d = arguments[0];
            "innerHTML" === a ? b.a.ca(this.h, d) : this.h[a] = d
        };
        b.l.h.prototype.data = function (a) {
            if (1 === arguments.length) return b.a.f.get(this.h, "templateSourceData_" + a);
            b.a.f.set(this.h, "templateSourceData_" + a, arguments[1])
        };
        b.l.O = function (a) {
            this.h = a
        };
        b.l.O.prototype = new b.l.h;
        b.l.O.prototype.text = function () {
            if (0 == arguments.length) {
                var a = b.a.f.get(this.h, "__ko_anon_template__") || {};
                a.Aa === I && a.ia && (a.Aa = a.ia.innerHTML);
                return a.Aa
            }
            b.a.f.set(this.h, "__ko_anon_template__", {
                Aa: arguments[0]
            })
        };
        b.l.h.prototype.nodes = function () {
            if (0 == arguments.length) return (b.a.f.get(this.h, "__ko_anon_template__") || {}).ia;
            b.a.f.set(this.h, "__ko_anon_template__", {
                ia: arguments[0]
            })
        };
        b.b("templateSources", b.l);
        b.b("templateSources.domElement", b.l.h);
        b.b("templateSources.anonymousTemplate", b.l.O);
        var O;
        b.wa = function (a) {
            a != I && !(a instanceof b.v) && j(Error("templateEngine must inherit from ko.templateEngine"));
            O = a
        };
        b.va = function (a, d, c, e, f) {
            c = c || {};
            (c.templateEngine || O) == I && j(Error("Set a template engine before calling renderTemplate"));
            f = f || "replaceChildren";
            if (e) {
                var g = N(e);
                return b.j(function () {
                    var h = d && d instanceof b.z ? d : new b.z(b.a.d(d)),
                        k = "function" == typeof a ? a(h.$data, h) : a,
                        h = T(e, f, k, h, c);
                    "replaceNode" == f && (e = h, g = N(e))
                }, p, {
                    Ka: function () {
                        return !g || !b.a.X(g)
                    },
                    W: g && "replaceNode" == f ? g.parentNode : g
                })
            }
            return b.s.ra(function (e) {
                b.va(a, d, c, e, "replaceNode")
            })
        };
        b.Mb = function (a, d, c, e, f) {
            function g(a, b) {
                U(b, k);
                c.afterRender && c.afterRender(b, a)
            }
            function h(d, e) {
                k = f.createChildContext(b.a.d(d), c.as);
                k.$index = e;
                var g = "function" == typeof a ?
                    a(d, k) : a;
                return T(p, "ignoreTargetNode", g, k, c)
            }
            var k;
            return b.j(function () {
                var a = b.a.d(d) || [];
                "undefined" == typeof a.length && (a = [a]);
                a = b.a.fa(a, function (a) {
                    return c.includeDestroyed || a === I || a === p || !b.a.d(a._destroy)
                });
                b.r.K(b.a.$a, p, [e, a, h, c, g])
            }, p, {
                W: e
            })
        };
        b.c.template = {
            init: function (a, d) {
                var c = b.a.d(d());
                if ("string" != typeof c && !c.name && (1 == a.nodeType || 8 == a.nodeType)) c = 1 == a.nodeType ? a.childNodes : b.e.childNodes(a), c = b.a.Hb(c), (new b.l.O(a)).nodes(c);
                return {
                    controlsDescendantBindings: m
                }
            },
            update: function (a,
                d, c, e, f) {
                d = b.a.d(d());
                c = {};
                e = m;
                var g, h = p;
                "string" != typeof d && (c = d, d = c.name, "if" in c && (e = b.a.d(c["if"])), e && "ifnot" in c && (e = !b.a.d(c.ifnot)), g = b.a.d(c.data));
                "foreach" in c ? h = b.Mb(d || a, e && c.foreach || [], c, a, f) : e ? (f = "data" in c ? f.createChildContext(g, c.as) : f, h = b.va(d || a, f, c, a)) : b.e.Y(a);
                f = h;
                (g = b.a.f.get(a, "__ko__templateComputedDomDataKey__")) && "function" == typeof g.B && g.B();
                b.a.f.set(a, "__ko__templateComputedDomDataKey__", f && f.pa() ? f : I)
            }
        };
        b.g.Q.template = function (a) {
            a = b.g.aa(a);
            return 1 == a.length && a[0].unknown ||
                b.g.Eb(a, "name") ? p : "This template engine does not support anonymous templates nested within its templates"
        };
        b.e.I.template = m;
        b.b("setTemplateEngine", b.wa);
        b.b("renderTemplate", b.va);
        b.a.Ja = function (a, b, c) {
            a = a || [];
            b = b || [];
            return a.length <= b.length ? S(a, b, "added", "deleted", c) : S(b, a, "deleted", "added", c)
        };
        b.b("utils.compareArrays", b.a.Ja);
        b.a.$a = function (a, d, c, e, f) {
            function g(a, b) {
                t = l[b];
                w !== b && (z[a] = t);
                t.na(w++);
                M(t.M);
                s.push(t);
                A.push(t)
            }
            function h(a, c) {
                if (a) for (var d = 0, e = c.length; d < e; d++) c[d] && b.a.o(c[d].M, function (b) {
                            a(b, d, c[d].U)
                        })
            }
            d = d || [];
            e = e || {};
            var k = b.a.f.get(a, "setDomNodeChildrenFromArrayMapping_lastMappingResult") === I,
                l = b.a.f.get(a, "setDomNodeChildrenFromArrayMapping_lastMappingResult") || [],
                n = b.a.V(l, function (a) {
                    return a.U
                }),
                q = b.a.Ja(n, d),
                s = [],
                v = 0,
                w = 0,
                B = [],
                A = [];
            d = [];
            for (var z = [], n = [], t, D = 0, C, E; C = q[D]; D++) switch (E = C.moved, C.status) {
                case "deleted":
                    E === I && (t = l[v], t.j && t.j.B(), B.push.apply(B, M(t.M)), e.beforeRemove && (d[D] = t, A.push(t)));
                    v++;
                    break;
                case "retained":
                    g(D, v++);
                    break;
                case "added":
                    E !== I ?
                        g(D, E) : (t = {
                        U: C.value,
                        na: b.m(w++)
                    }, s.push(t), A.push(t), k || (n[D] = t))
            }
            h(e.beforeMove, z);
            b.a.o(B, e.beforeRemove ? b.A : b.removeNode);
            for (var D = 0, k = b.e.firstChild(a), H; t = A[D]; D++) {
                t.M || b.a.extend(t, ha(a, c, t.U, f, t.na));
                for (v = 0; q = t.M[v]; k = q.nextSibling, H = q, v++) q !== k && b.e.Pa(a, q, H);
                !t.Ab && f && (f(t.U, t.M, t.na), t.Ab = m)
            }
            h(e.beforeRemove, d);
            h(e.afterMove, z);
            h(e.afterAdd, n);
            b.a.f.set(a, "setDomNodeChildrenFromArrayMapping_lastMappingResult", s)
        };
        b.b("utils.setDomNodeChildrenFromArrayMapping", b.a.$a);
        b.C = function () {
            this.allowTemplateRewriting =
                r
        };
        b.C.prototype = new b.v;
        b.C.prototype.renderTemplateSource = function (a) {
            var d = !(9 > b.a.Z) && a.nodes ? a.nodes() : p;
            if (d) return b.a.L(d.cloneNode(m).childNodes);
            a = a.text();
            return b.a.ta(a)
        };
        b.C.oa = new b.C;
        b.wa(b.C.oa);
        b.b("nativeTemplateEngine", b.C);
        b.qa = function () {
            var a = this.Db = function () {
                if ("undefined" == typeof F || !F.tmpl) return 0;
                try {
                    if (0 <= F.tmpl.tag.tmpl.open.toString().indexOf("__")) return 2
                } catch (a) {}
                return 1
            }();
            this.renderTemplateSource = function (b, c, e) {
                e = e || {};
                2 > a && j(Error("Your version of jQuery.tmpl is too old. Please upgrade to jQuery.tmpl 1.0.0pre or later."));
                var f = b.data("precompiled");
                f || (f = b.text() || "", f = F.template(p, "{{ko_with $item.koBindingContext}}" + f + "{{/ko_with}}"), b.data("precompiled", f));
                b = [c.$data];
                c = F.extend({
                    koBindingContext: c
                }, e.templateOptions);
                c = F.tmpl(f, b, c);
                c.appendTo(y.createElement("div"));
                F.fragments = {};
                return c
            };
            this.createJavaScriptEvaluatorBlock = function (a) {
                return "{{ko_code ((function() { return " + a + " })()) }}"
            };
            this.addTemplate = function (a, b) {
                y.write("<script type='text/html' id='" + a + "'>" + b + "\x3c/script>")
            };
            0 < a && (F.tmpl.tag.ko_code = {
                open: "__.push($1 || '');"
            }, F.tmpl.tag.ko_with = {
                open: "with($1) {",
                close: "} "
            })
        };
        b.qa.prototype = new b.v;
        w = new b.qa;
        0 < w.Db && b.wa(w);
        b.b("jqueryTmplTemplateEngine", b.qa)
    }
    "function" === typeof require && "object" === typeof exports && "object" === typeof module ? L(module.exports || exports) : "function" === typeof define && define.amd ? define(["exports"], L) : L(x.ko = {});
    m;
})();
// =============  Custom jQuery shake animation =================

$(function(){
    $.fn.shake = function(){
        this.animate({
            marginLeft: '-6px',
            marginRight: '6px'
            }, 30, function (el) {
            $(this).animate({
            marginLeft: '6px',
            marginRight: '-6px'
            }, 30, function (el) {
            $(this).animate({
            marginLeft: '0',
            marginRight: '0'
            }, 30)
            });
        });
    }
});


// ===========  Utils module =============
var utils = (function(){
    var username,session;
    var credentials = function(){
        return {uname:username,session:session};
    }
    return {
        // issues all ajax calls to server
        issue : function (method, command, Json, cb) {
            var postdata;
            Json ? postdata = JSON.stringify($.extend(Json, credentials())) : postdata = JSON.stringify(credentials());
            console.log('issueing')
            var url = command;
            var error = false;
            $.ajax({
                url: url,
                type: method,
                contentType: 'application/json',
                data: postdata,
                error: function(dat){
                    error == true;
                },
                complete: function(dat){
                    cb(error,dat.status,dat.responseText);
                return
                }
            }); 
        },
        setCredentials : function(name,sess){
            username = name;session = sess
        }
    }
})();

function League(obj){
	this._id = obj.id;
	this.league_key = obj.league_key;
	this.name = obj.name;
	this.url = obj.url;
}
function Player(obj){
	var self = this;
	_id = obj.id;
	self.team_key = obj.team_key;
	self.team_name = obj.team_name;
	self.player_key = obj.player_key;
	self.player_full_name = obj.name.full;
	self.player_first = obj.name.first;
	self.player_last = obj.name.last;
	self.position = obj.eligible_positions.position;
	self.selected_position = ko.observable(obj.selected_position.position)
	self.selected_position.subscribe(function(val){
		utils.issue("PUT", "method/lineup", {
			player_key: self.player_key,
			team_key: self.team_key,
			move_to: val
		},function(err,stat,text){
			console.log(err,stat,text)
		});
		console.log('player '+self.player_full_name+" was moved to "+val)
	})
	self.injury_status = obj.status ? obj.status : "A";
	self.bye_week = obj.bye_weeks.week;
	self.undroppable = obj.undroppable;
	self.image_url = obj.image_url;
	self.projected_points = {};
	self.settings = {
		never_drop: ko.observable(obj.settings.never_drop),
		start_if_probable: ko.observable(obj.settings.start_if_probable),
		start_if_questionable: ko.observable(obj.settings.start_if_questionable)
	};
}

function position(obj){
	var self = this;
	self.position = obj.position;
	self.count = obj.count;
	self.starters = ko.computed(function(){
		var numberOfStarters = ko.utils.arrayFilter(fantasyslackr.viewmodel.selectedPlayers(),function(pos){
			return ((pos.selected_position() == pos.position) && (pos.selected_position() == self.position))
		})
		return numberOfStarters.length
	});
	self.team_key = obj.team_key;
}
function Team(obj){
	var self = this;
	self._id = obj.id
	self.team_key = obj.team_key;
	self.name = obj.name;
	self.league = obj.league;
	self.game = obj.game;
	self.active = ko.observable(obj.active);
	self.settings = {
		probable_player: ko.observable(obj.settings.probable_player),
		questionable_player: ko.observable(obj.settings.questionable_player),
		out_player: ko.observable(obj.settings.out_player),
		lack_of_players: ko.observable(obj.settings.lack_of_players),
		ask_qb: ko.observable(obj.settings.ask_qb),
		ask_rb: ko.observable(obj.settings.ask_rb),
		ask_wr: ko.observable(obj.settings.ask_wr),
		ask_te: ko.observable(obj.settings.ask_te),
		ask_def: ko.observable(obj.settings.ask_def),
		ask_k: ko.observable(obj.settings.ask_k),
		emails: ko.observable(obj.settings.emails),
		injury_reports: ko.observable(obj.settings.injury_reports) 
	};
}
ko.observable.fn.subscribeAjaxIcons = function(type,cb){
    this.subscribe(function(value){
        cb('loading')
        var obj = {
            type: type,
            value: value
        }
        console.log('sending issue')
        utils.issue("POST", "method/checkValue",obj,function(err,stat,text){
            if (stat == 200){
                cb('verified');
            } else if (stat == 400) {
                cb('rejected');
            } else {
                cb('');
            }
        })
    });
}
ko.observable.fn.subscribeCheckPass = function(cb){
    this.subscribe(function(value){
        if (value.length > 8) {
            cb('verified');
        } else {
            cb ('rejected');
        }
    })
}
ko.bindingHandlers.modalVis = {
	init: function(element, valueAccessor) {
        var value = valueAccessor();
    },
    update: function(element, valueAccessor) {
        var value = valueAccessor();
        var showon = $(element).data("showon")
        if (value() == showon){
        	$(element).modal('show');
        } else {
        	$(element).modal('hide')
        }
    }
};
ko.bindingHandlers.formShake = {
    init: function(element, valueAccessor) {
        var value = valueAccessor();
    },
    update: function(element, valueAccessor) {
        var value = valueAccessor();
        var showon = $(element).data("shakeon")
        if (value() == showon){
            $(element).shake()
        } 
    }
};
ko.bindingHandlers.ajaxIcons = {
    init: function(element, valueAccessor) {
        var value = valueAccessor();
    },
    update: function(element, valueAccessor) {
        var value = valueAccessor();
        $(element).removeClass('loading').removeClass('verified').removeClass('rejected');
        if (value() != '') {
            $(element).addClass(value());
        }
    }
};
ko.bindingHandlers.changeSetting = {
    init: function(element, valueAccessor){
        var value = valueAccessor()
        $(element).change(function(){
            value(this.value);
        })
    },
    update: function(element, valueAccessor){
        var value = valueAccessor()
        $(element).val(value());
    }
}
ko.bindingHandlers.accordianClick = {
    init: function(element, valueAccessor){
        var value = valueAccessor();
        $(element).click(function(){
            var select = "#" + value;
            console.log(value);
            $(select).collapse();
            console.log($(select))
        })
    },
    update: function(element, valueAccessor){
        var value = valueAccessor()
        $(element).val(value());
    }
}
ko.bindingHandlers.startOrBench = {
    init: function(element, valueAccessor,ab,vm,bc){
        var value = valueAccessor();
        $(element).click(function(){
            var player = vm;
            var positions = bc.$root.positions();
            var button = $(this).text();

                // Only move player to start if there is an open spot for that position.
                // Can always move player to bench
            $(positions).each(function(obj,ind){
                if (this.team_key == vm.team_key && this.position == vm.position){
                    if (button == 'Start'){
                        if (this.starters() >= parseInt(this.count)){
                            $(element).addClass("btn-danger");
                            setTimeout(function(){
                                $(element).removeClass("btn-danger");
                            },500)
                        } else {
                            value.selected_position(value.position)
                        }
                    } else {
                        value.selected_position("BN");
                    }
                }
            })
        })
    },
    update: function(element, valueAccessor){
        console.log()
        var value = valueAccessor();
        if ((value.selected_position() == "BN") && ($(element).text() == "Bench")){
            $(element).addClass("btn-primary");
        } else if ((value.selected_position() != "BN") && ($(element).text() != "Bench")){
            $(element).addClass("btn-primary");
        } else {
            $(element).removeClass("btn-primary");
        }
    }
}
ko.bindingHandlers.positionCountIndicator = {
    init: function(element, valueAccessor){},
    update: function(element, valueAccessor){
        var value = valueAccessor()
        if (value.starters() > parseInt(value.count)){
            $(element).addClass('position-danger').removeClass('position-success');
        } else if (value.starters() == parseInt(value.count)){
            $(element).addClass('position-success').removeClass('position-danger');
        } else {
            $(element).removeClass('position-danger').removeClass('position-success');
        }
    }
}
ko.bindingHandlers.checkSelPlayer = {
    init: function(element){},
    update: function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext){
        var value = valueAccessor();
        if (bindingContext.$data.player_key == value()){
            console.log('checking '+bindingContext.$data.player_full_name)
            $(element).addClass("btn-primary").removeClass("btn-default")
        } else {
            $(element).addClass("btn-default").removeClass("btn-primary")
        }
    }
}
ko.bindingHandlers.formatDate = {
    update: function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext){
        var value = valueAccessor();
        var d = new Date(value);
        var months = ['January','February','March','April','May','June','July','Auguest','September','October','November','December'];

        function daySuffix(d) {
            d = String(d);
            return d.substr(-(Math.min(d.length, 2))) > 3 && d.substr(-(Math.min(d.length, 2))) > 21 ? "th" : ["th", "st", "nd", "rd", "th"][Math.min(Number(d)%10, 4)];
        }

        var dateString = months[d.getMonth()] + " " + d.getDate()  + daySuffix(d.getDate()) + ", " + d.getFullYear();

        $(element).text(dateString);
    }
}
ko.bindingHandlers.collapse = {
    update: function(element,valueAccessor){
        var val = valueAccessor();
        console.log(val)
        if (val){
            $(element).collapse('show')
        } else {
            $(element).collapse('hide');
        }
    }
}
ko.bindingHandlers.switchPanel = {
    init:function(element,valueAccessor,ab,vm,bc){
        $(element).click(function(){
            var val = valueAccessor();
            vm.showPanel(val);
        })
        
    }
}







function AppViewModel() {
	var self = this;
	var user = {}

	// Laundry list of observables
	self.modalStatus = ko.observable('none');
	self.displayPage = ko.observable('login').extend({logChange: "first name"});
	self.showPanel = ko.observable('team')
	self.loginName = ko.observable();
	self.loginPass = ko.observable();
	
	self.yahooValidated = ko.observable('Nothing yet');
	self.signupFeedback = ko.observable('');
	self.loginFeedback = ko.observable('');


	// signup form name handlers
	self.signupName = ko.observable();
	self.signupNameStatus = ko.observable();
	self.signupName.subscribeAjaxIcons("name",function(status){self.signupNameStatus(status)});

	// signup form email handlers
	self.signupEmail = ko.observable();
	self.signupEmailStatus = ko.observable();
	self.signupEmail.subscribeAjaxIcons("email",function(status){self.signupEmailStatus(status)});

	// signup form password handlers
	self.signupPass = ko.observable();
	self.signupPassStatus = ko.observable();
	self.signupPass.subscribeCheckPass(function(status){self.signupPassStatus(status)});

	self.players = ko.observableArray([]);
	self.teams = ko.observableArray([]);
	self.leagues = ko.observableArray([]);
	self.positions = ko.observableArray([]);
	self.activityEntries = ko.observableArray([]);

	// selected team changes UI
	self.selectedTeam = ko.observable();
	self.selectedPlayer = ko.observable();
	self.selectedPlayers = ko.computed(function(){
		return ko.utils.arrayFilter(self.players(),function(player){
			return player.team_key == self.selectedTeam().team_key;
		})
	})


	// modal controls

	self.showSignup = function(){
		self.modalStatus('signup');
	}
	self.closeModals = function(){
		self.modalStatus('none');
	}
	self.showAbout = function(){
		self.modalStatus('about');
	}
	self.switchPanel = function(data){
		console.log(data)
	}


	// login/signup controls

	self.login = function(uname,upass){
		var username, password;
		if (uname && upass){
			username = uname;
			password = upass;
		} else {
			username = self.loginName();
			password = self.loginPass();
		}
		utils.issue("POST","user/login",{
		uname: username,
		upass: password
		},function(err,stat,text){
			if (stat == 200) {
				var data = JSON.parse(text);
				utils.setCredentials(username,data.session)

				self.loginFeedback('');
				self.loginName('');
				self.loginPass('');
				
				self.getUserData(data);
			} else if (stat == 400) {
				var data = JSON.parse(text)
				var missing = data.RequestParameterMissing;
				if (missing) {
					self.loginFeedback('Missing Username or Password')
				} else {
					var error = data.error;
					self.loginFeedback(error);
				}
				self.shake('login')
			} else {
				self.modalStatus('server-error');
			}
		})
	}
	self.signup = function(){
		console.log('runngin');
		utils.issue("POST","method/createNewUser",{
			uname: self.signupName(),
			uemail: self.signupEmail(),
			upass: self.signupPass()
		},function(err,stat,text){
			if (stat == 200) {
				var data = JSON.parse(text);
				var oauthURL = data.url;
				open(oauthURL,"FantasySlackr", "width=600,height=450");
			} else if (stat == 400) {
				var data = JSON.parse(text);
				if (data.error){
					self.signupFeedback(data.error);
				}
				self.shake('signup')
			} else {
				self.modalStatus('server-error');
			}
		})
	}
	self.yahooValidated = function(){
		setTimeout(function(){
			console.log(new Date().getTime())
			utils.issue("POST","method/login",{
				uname: self.signupName(),
				upass: self.signupPass()
			},function(err,stat,text){
				if (stat == 200) {
					var data = JSON.parse(text);
					utils.setCredentials(data.name,data.currentLogin);

					
					
					self.modalStatus('');
				} else if (stat == 400) {
					self.shake('login')
				} else {
					self.modalStatus('server-error');
				}
			})
		},2000)
		console.log(new Date().getTime())
	}
	
	self.getUserData = function(data){
		async.parallel({
			setPlayers:function(cb){
				async.each(data.players,function(p,nP){
					self.players.push(new Player(p));
					nP();
				},function(){
					cb(null);
				});
			},
			setTeams:function(cb){
				async.each(data.teams,function(p,nP){
					self.teams.push(new Team(p));
					nP();
				},function(){
					cb(null);
				});
			},
			setLeagues: function(cb){
				async.each(data.leagues,function(p,nP){
					self.leagues.push(new League(p));
					nP();
				},function(){
					cb(null);
				});
			},
			setActivity: function(cb){
				async.each(data.activity,function(p,nP){
					self.activityEntries.push(p);
					nP();
				},function(){
					cb(null);
				});
			}
		},function(){
			self.displayPage('dashboard');
		});
	}
	// 	if (this.roster.length > 0){
	// 	$(this.roster).each(function(indexi, obji){
	// 		this.team_key = thisTeamKey;
	// 		this.team_name = thisTeamName;
	// 		self.players.push(new player(this))
	// 	});
	// }
	self.startDemo = function(){
		self.login('name','pass');
	}


	// ui functions
	self.shake = ko.observable();
	self.shake.subscribe(function(value){
		if (value != ''){
			setTimeout(function(){
				self.resetShake();
			},400)
		}
	});
	self.resetShake = function(){
		self.shake('');
	}
	self.selectPlayer = function(data){
		self.showPanel('player')
		self.selectedPlayer(data.player_key);
	}

}

var fantasyslackr = { viewmodel : new AppViewModel()}

ko.applyBindings(fantasyslackr.viewmodel);