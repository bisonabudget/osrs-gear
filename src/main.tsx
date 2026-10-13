import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
// The fonts are kept on the site, so visitors' browsers don't contact Google Fonts.
import '@fontsource/anton/400.css';
import '@fontsource/roboto-condensed/400.css';
import '@fontsource/roboto-condensed/500.css';
import '@fontsource/roboto-condensed/700.css';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
