import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { configureViewportMode } from "./configureViewportMode";
import "./index.css";
import { registerServiceWorker } from "./registerServiceWorker";

registerServiceWorker();
configureViewportMode();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
