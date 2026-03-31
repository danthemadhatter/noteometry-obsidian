import React from "react";

const SYMBOLS = [
  { label: "R", title: "Resistor" },
  { label: "C", title: "Capacitor" },
  { label: "L", title: "Inductor" },
  { label: "D", title: "Diode" },
  { label: "V", title: "Voltage Source" },
  { label: "I", title: "Current Source" },
  { label: "GND", title: "Ground" },
  { label: "OpAmp", title: "Op-Amp" },
  { label: "SW", title: "Switch" },
  { label: "LED", title: "LED" },
  { label: "NPN", title: "NPN Transistor" },
  { label: "PNP", title: "PNP Transistor" },
];

export default function CircuitPalette({ onInsert }: { onInsert: (s: string) => void }) {
  return (
    <div className="noteometry-palette noteometry-palette-circuit">
      {SYMBOLS.map(({ label, title }) => (
        <button key={label} onClick={() => onInsert(label)} title={title}>
          {label}
        </button>
      ))}
    </div>
  );
}
