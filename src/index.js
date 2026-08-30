import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import PublicRegisterPage from './components/PublicRegisterPage.jsx';
import { isPublicRegisterPath } from './publicRegisterApi.js';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    {isPublicRegisterPath() ? <PublicRegisterPage /> : <App />}
  </React.StrictMode>
);
