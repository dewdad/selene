'use strict';

const URL = require('url');
const assign = require('object-assign');
const webdriver = require('selenium-webdriver');

const SeActions = require('./actions');
const build = require('./build');
const element = require('./element');
const QueryFactory = require('./QueryFactory');

const Se = {

  _decorateElement(el) {
    return element(el, this);
  },

  findElement(locator) {
    return this._decorateElement(this.driver.findElement(locator));
  },

  findElements(locator) {
    return this.driver.findElements(locator).then(
      elements => elements.map(el => this._decorateElement(el))
    );
  },

  wait(until, timeout, message) {
    const condition = this.createCondition(until);
    const ret = this.driver.wait.call(this, condition, timeout, message);
    if (ret instanceof webdriver.WebElementPromise) {
      return this._decorateElement(ret);
    }
    return ret;
  },

  reloadUntil(until, timeout, message) {
    const condition = this.createCondition(until);
    const reload = () => { this.navigate().refresh(); };
    const innerWait = () => this.wait(condition, 1).catch(reload);
    return this.wait(innerWait, timeout, message || condition.description);
  },

  find(selector, filter, timeout) {
    return this.createQuery(getLocator(selector), filter, timeout).one(this);
  },

  findAll(selector, filter, timeout) {
    return this.createQuery(selector, filter, timeout).all(this);
  },

  exists(selector, opts) {
    return this.createQuery(getLocator(selector), opts).one(this)
      .then(res => res).catch(() => false);
  },

  click(selector, filter, timeout) {
    return this.find(getLocator(selector), filter, timeout).click();
  },

  then(cb) {
    return this.sleep(0).then(cb);
  },

  goto(url) {
    const base = this.opts.base || '';
    const target = URL.resolve(base, url);

    if (this.opts.auth && !this.authenticated) {
      const temp = URL.parse(target);
      temp.auth = [this.opts.auth.user, this.opts.auth.pass].join(':');
      this.authenticated = true;
      this.navigate().to(URL.format(temp)).then(() => this.navigate().to(target));
    } else {
      this.navigate().to(target);
    }
    return this;
  },

  fill(attr, values) {
    if (values === undefined) {
      values = attr;
      attr = 'name';
    }
    Object.keys(values).forEach(name => {
      this.find(`[${attr}=${name}]`).clear().type(values[name]);
    });
    return this;
  },

  actions() {
    return new SeActions(this);
  },

  getLogEntries(type) {
    const t = webdriver.logging.Type[type.toUpperCase()];
    if (!t) throw new Error(`No such log type: ${type}`);
    return this.manage().logs().get(t);
  },

  use(plugin) {
    plugin(this);
    return this;
  }
};

function getLocator(locator){
    if(typeof locator === 'string' && /^\.?\/\//.test(locator)){
        return {xpath: locator};
    }
    return locator;
}

function decorateDriver(driver, opts) {
  return assign(Object.create(driver), Se, new QueryFactory(), {
    opts: opts || {},
    driver
  });
}

function selene(driver, opts) {
  if (driver && driver instanceof webdriver.WebDriver) {
    return decorateDriver(driver, opts);
  }
  opts = driver || {};
  if (typeof opts == 'string') opts = { base: opts };
  return decorateDriver(build(opts), opts);
}

module.exports = selene;
module.exports.webdriver = webdriver;
