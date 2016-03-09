var URL = require('url');
var webdriver = require('selenium-webdriver');

var until = webdriver.until;
var Condition = until.Condition;

function all(conds, method) {
  if (conds.length == 1) {
    return conds[0];
  }
  if (!method) method = 'every';

  var descriptions = conds.map(function (c) {
    return c.description();
  });

  var desc = ['for ' + method + ' of these:'].concat(descriptions).join('\n* ');

  return new Condition(desc, function (driver) {
    return webdriver.promise.all(conds.map(function (cond) {
      return cond.fn(driver);
    }))
    .then(function (values) {
      return values[method](Boolean);
    });
  });
}

var builders = {

  element: function (query) {
    return new until.WebElementCondition('for ' + query,
      function (driver) {
        return driver.locate(query).catch(function () {
          return undefined;
        });
      }
    );
  },

  scoped: function (opts) {
    return new webdriver.until.WebElementCondition('for ' + opts.query,
      function (driver) {
        return driver.locate(opts.query, opts.scope).catch(function () {
          return undefined;
        });
      }
    );
  },

  url: function (url) {
    return new Condition('for URL to become ' + url, function (driver) {
      return driver.getCurrentUrl().then(function (current) {
        return URL.resolve(current, url) == current;
      });
    });
  },

  title: function (title) {
    if (title instanceof RegExp) return until.titleMatches(title);
    return until.titles(title);
  },

  visible: function (sel) {
    return new until.WebElementCondition('for ' + sel + ' to become visible',
      function (driver) {
        if (typeof sel == 'string') {
          sel = { css: sel };
        }
        return driver.findElements(sel).then(function (elements) {
          var el = elements[0];
          return el && el.isDisplayed().then(function (v) {
            return v ? el : null;
          });
        });
      }
    );
  },

  unless: function (spec) {
    var cond = build(spec);
    return new Condition('unless ' + spec, function (driver) {
      return new webdriver.promise.Promise(function (res, rej) {
        cond.fn(driver).then(function (value) {
          var err = new Error(cond.description());
          err.cause = value;
          err.fn = cond.fn;
          rej(err);
        });
      });
    });
  }
};

function build(spec) {
  // if an array is given wait until ANY condition is satisfied
  if (Array.isArray(spec)) return all(spec.map(build), 'some');

  // if an object is given, wait until ALL props are satisfied
  return all(Object.keys(spec).map(function (name) {
    if (!builders[name]) throw Error('no such condition:' + name);
    return builders[name](spec[name]);
  }));
}

module.exports = build;
