import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App.tsx";
import { detectPlatform } from "./storage/install.ts";
import "./styles/base.css";
import "./App.css";

/**
 * O sistema fica no `<html>`, nao numa prop de componente.
 *
 * O que muda entre plataformas e sobretudo MATERIAL — a barra de abas no iOS 26
 * e vidro flutuante, no Android e uma barra assente. Isso e CSS, e CSS nao
 * deveria depender de um componente React repassar um booleano ate a folha.
 * Com o atributo na raiz, qualquer regra pode se ajustar sem tocar em JSX.
 */
document.documentElement.dataset.platform = detectPlatform();

const root = document.getElementById("root");
if (!root) throw new Error("#root nao existe no index.html");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
