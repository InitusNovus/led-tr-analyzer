import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
// Self-hosted fonts: Latin and digits in JetBrains Mono, Hangul in Pretendard (see docs/FONTS.md).
import '@fontsource-variable/jetbrains-mono/wght.css';
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import './index.css';
ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><ErrorBoundary><App /></ErrorBoundary></React.StrictMode>);
