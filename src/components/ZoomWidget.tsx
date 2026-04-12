import React from "react";

interface Props {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}

export default function ZoomWidget({ zoom, onZoomIn, onZoomOut, onReset }: Props) {
  return (
    <div className="nm-zoom-widget">
      <button
        className="nm-zoom-btn"
        onClick={onZoomOut}
        title="Zoom out"
        aria-label="Zoom out"
      >
        −
      </button>
      <button
        className="nm-zoom-pct"
        onClick={onReset}
        title="Reset to 100%"
        aria-label="Reset zoom"
      >
        {Math.round(zoom * 100)}%
      </button>
      <button
        className="nm-zoom-btn"
        onClick={onZoomIn}
        title="Zoom in"
        aria-label="Zoom in"
      >
        +
      </button>
    </div>
  );
}
