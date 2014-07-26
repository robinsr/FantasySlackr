/**
 * Module dependencies.
 */

var express =       require('express'),
    mongoStore =    require('connect-mongo')(express),
    flash =         require('connect-flash'),
    winston =       require('winston'),
    Loggly =        require('winston-loggly'),
    expressWinston = require('express-winston'),
    helpers =       require('view-helpers'),
    pkg =           require(__dirname + '/../../package.json')

    var env = process.env.NODE_ENV || 'development';




module.exports = function(app, config, passport) {

    //CORS middleware
    var allowCrossDomain = function(req, res, next) {
        res.header('Access-Control-Allow-Origin', config.allowedDomains);
        res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
        res.header('Access-Control-Allow-Headers', 'Content-Type');

        next();
    }
    app.set('showStackError', true)

    // should be placed before express.static
    app.use(express.compress({
        filter: function(req, res) {
            return /json|text|javascript|css/.test(res.getHeader('Content-Type'))
        },
        level: 9
    }))

    app.use(express.favicon())
    //app.use(express.static(config.root + '/voyager-desktop/.tmp'))
    //app.use('/bower_components', express.static(config.root + '/voyager-desktop/bower_components'))
    app.use(express.static(__dirname + '/../public/'))

    // Logging
    // Use winston on production
    var loggerConfig
    if (env !== 'development') {
      winston.add(Loggly, {
        level: 'silly',
        subdomain: 'robinsr',
        inputToken: '95b210cc-e934-467a-89db-810414250427',
        json: true,
      });
      loggerConfig = {
          transports: [
            new winston.transports.Loggly()
          ]
        }
    } else {
      loggerConfig = transports: [
        new winston.transports.Console({
          json: true,
          colorize: true
        })
      ]
    }

    // set views path, template engine and default layout
    app.set('views', config.root + '/app/views')
    app.set('view engine', 'jade');

    var csrfValue = function(req) {
        var token = (req.body && req.body._csrf)
        || (req.query && req.query._csrf)
        || (req.headers['x-csrf-token'])
        || (req.headers['x-xsrf-token']);
        return token;
    };

    app.configure(function() {
        // expose package.json and env to views
        app.use(function(req, res, next) {
            res.locals.pkg = pkg;
            res.locals.env = env;
            next()
        })

        // cookieParser should be above session
        app.use(express.cookieParser())

        // bodyParser should be above methodOverride
        app.use(express.bodyParser())
        app.use(express.methodOverride())

        // CORS
        app.use(allowCrossDomain);

        // express/mongo session storage
        app.use(express.session({
            secret: ,name,
            store: new mongoStore({
                url: ,db,
                collection: 'sessions'
            })
        }))

        // use passport session
        app.use(passport.initialize())
        app.use(passport.session())

        // connect flash for flash messages - should be declared after sessions
        app.use(flash())

        // should be declared after session and flash
        app.use(helpers(pkg.name))

        // adds CSRF support
        if (process.env.NODE_ENV !== 'test') {
            app.use(express.csrf({value: csrfValue}))

            // This could be moved to view-helpers :-)
            app.use(function(req, res, next) {
                res.cookie('XSRF-TOKEN', req.csrfToken());
                next();
            });
        }

        // routes should be at the last
        app.use(app.router)


        app.use(expressWinston.errorLogger(loggerConfig));

        // assume "not found" in the error msgs
        // is a 404. this is somewhat silly, but
        // valid, you can do whatever you like, set
        // properties, use instanceof etc.
        app.use(function(err, req, res, next) {
            // treat as 404
            if (err.message && (~err.message.indexOf('not found') || (~err.message.indexOf('Cast to ObjectId failed')))) {
                return next()
            }

            // log it
            // send emails if you want
            console.error(err.stack)

            // error page
            res.status(500).render('500', {
                error: ,stack
            })
        })

        // assume 404 since no middleware responded
        app.use(function(req, res, next) {
            res.status(404).render('404', {
                url: ,originalUrl,
                error: 'Not found'
            })
        })
    })

    // development env config
    app.configure('development', function() {
        app.locals.pretty = true
    })
}
