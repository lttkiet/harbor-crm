import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider } from 'antd';
import enGB from 'antd/locale/en_GB';
import dayjs from 'dayjs';
import 'dayjs/locale/en-gb';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'antd/dist/reset.css';
import './styles.css';
import App from './App';
import { AuthProvider } from './AuthContext';
import { persistor, store } from './store';

dayjs.locale('en-gb');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider locale={enGB}>
      <Provider store={store}><PersistGate loading={null} persistor={persistor}><AuthProvider><App /></AuthProvider></PersistGate></Provider>
    </ConfigProvider>
  </React.StrictMode>,
);
