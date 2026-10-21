import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// fonts are bundled into the single HTML file (no external font server)
import "./fonts.css";
import "./index.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
