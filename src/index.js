import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { BrowserRouter } from "react-router-dom";
import { ToastProvider } from "./useToast";
import { AuthProvider } from "./context/AuthContext";
import { VenueProvider } from "./context/VenueContext";
import { CategoryCardsProvider } from "./context/CategoryCardsContext";
import { ModalProvider } from "./context/ModalContext";

import 'bootstrap/dist/css/bootstrap.min.css';
import * as bootstrap from 'bootstrap/dist/js/bootstrap.bundle.min.js';
// bootstrap's UMD bundle attaches itself to `window.bootstrap` in a plain
// <script> tag, but under a bundler (webpack/CRA) it's imported as an ES
// module instead — so nothing sets window.bootstrap automatically. Every
// tooltip in the app (see useGlobalTooltips.js and any manual
// data-bs-toggle="tooltip" markup) initializes via window.bootstrap.Tooltip,
// so without this line tooltips silently never appear.
window.bootstrap = bootstrap;

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <BrowserRouter>
    <AuthProvider>
      <VenueProvider>
        <CategoryCardsProvider>
          <ToastProvider>
            <ModalProvider>
              <App />
            </ModalProvider>
          </ToastProvider>
        </CategoryCardsProvider>
      </VenueProvider>
    </AuthProvider>
  </BrowserRouter>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
