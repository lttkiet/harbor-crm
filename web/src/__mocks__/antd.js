const React = require('react');

const MockComponent = ({ children, ...props }) => React.createElement('div', props, children);
const MockForm = ({ children, ...props }) => React.createElement('form', props, children);
MockForm.Item = MockComponent;
MockForm.useForm = () => [{}];

module.exports = new Proxy({
  Alert: MockComponent,
  Button: MockComponent,
  Card: MockComponent,
  Col: MockComponent,
  Divider: MockComponent,
  Empty: MockComponent,
  Input: Object.assign(MockComponent, { Search: MockComponent }),
  InputNumber: MockComponent,
  Modal: MockComponent,
  Row: MockComponent,
  Space: MockComponent,
  Statistic: MockComponent,
  Table: MockComponent,
  Tag: MockComponent,

  Form: MockForm,
  Select: Object.assign(MockComponent, { Option: MockComponent }),
  Typography: Object.assign(MockComponent, { Title: MockComponent, Text: MockComponent }),
  Tabs: Object.assign(MockComponent, { TabPane: MockComponent }),
}, {
  get: function(target, prop) {
    if (prop === '__esModule') return true;
    if (target[prop]) return target[prop];
    return MockComponent;
  }
});
