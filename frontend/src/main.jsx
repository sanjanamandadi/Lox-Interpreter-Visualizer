import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

/**
 * The entry point. It hands React the empty <div id="root"> from index.html,
 * and React manages everything inside it from then on.
 *
 * <StrictMode> is a development-only helper that double-renders components to
 * surface side effects in the wrong place. It has no effect on a production build.
 */
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
