import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App.tsx";
import "./styles/base.css";
import "./App.css";

const root = document.getElementById("root");
if (!root) throw new Error("#root nao existe no index.html");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
