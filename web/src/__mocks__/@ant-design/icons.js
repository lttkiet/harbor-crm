const React = require('react');

const mockIcon = () => React.createElement('span', null, 'Icon');

module.exports = new Proxy({}, {
  get: function(target, prop) {
    if (prop === '__esModule') return true;
    return mockIcon;
  }
});
