import React from "react";
import { createRoot } from "react-dom/client";
import {
  configureTextMeasurement,
  getTextMeasurementRuntimeState,
  initializePretextTextMeasurement
} from "@engine";
import { App } from "./App";
import "./styles.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Missing #root element");
}
const mountNode: HTMLElement = rootElement;

async function bootstrap(): Promise<void> {
  configureTextMeasurement({
    font: "15px Inter",
    lineHeight: 22,
    whiteSpace: "normal"
  });

  await initializePretextTextMeasurement({
    font: "15px Inter",
    lineHeight: 22,
    whiteSpace: "normal"
  });

  // Useful signal in devtools to confirm whether Pretext is active.
  console.info("[fluidUI] text measurement runtime:", getTextMeasurementRuntimeState());

  createRoot(mountNode).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

void bootstrap();
