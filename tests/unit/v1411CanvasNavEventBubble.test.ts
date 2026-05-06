import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * v1.14.11: CanvasNav sits inside the canvas area, which has its own
 * onContextMenu (big tools menu) and onClick (deselect) handlers. In
 * v1.14.10 right-clicking a nav row to delete a page popped the
 * confirm dialog AND the canvas tools menu on top — Dan: "if i right
 * click for a delete pop up, the big tool pane pops up too." Same
 * leak meant left-clicking a section/page also deselected canvas
 * objects in the background.
 *
 * The fix is to stopPropagation on the nav shell for the four mouse
 * events the canvas area listens to: click, dblclick, contextmenu,
 * mousedown. These tests pin the contract at the source level so a
 * future refactor can't silently re-introduce the leak.
 */

const ROOT = join(__dirname, "..", "..");
const NAV_SRC = readFileSync(join(ROOT, "src/components/CanvasNav.tsx"), "utf8");

describe("v1.14.11 — CanvasNav stops mouse events from bubbling to canvas area", () => {
  it("renders the open-state shell with onClick that stops propagation", () => {
    // The shell is the <div className="noteometry-nav" ...> at the bottom.
    // It must have onClick wired to a handler that stops propagation —
    // otherwise clicking a section/page leaks to handleCanvasAreaClick
    // and deselects the canvas. Look for the open-state shell tag and
    // the onClick handler on it.
    const shellMatch = NAV_SRC.match(
      /<div\s+className="noteometry-nav"[\s\S]*?aria-label="Noteometry pages"[\s\S]*?onClick=\{[^}]+\}[\s\S]*?>/
    );
    expect(shellMatch, "open-state nav shell missing onClick").toBeTruthy();
  });

  it("stops contextmenu on the open-state shell", () => {
    // Right-click on a row would otherwise pop the canvas big-tools
    // menu on top of the delete confirm. The shell must catch and
    // stop contextmenu before it reaches handleCanvasContextMenu.
    const shellMatch = NAV_SRC.match(
      /<div\s+className="noteometry-nav"[\s\S]*?aria-label="Noteometry pages"[\s\S]*?onContextMenu=\{[^}]+\}[\s\S]*?>/
    );
    expect(shellMatch, "open-state nav shell missing onContextMenu").toBeTruthy();
  });

  it("stops dblclick + mousedown on the open-state shell", () => {
    // Double-click is used by row-rename; mousedown is the earliest
    // event the canvas might react to. Both should be contained.
    const shellMatch = NAV_SRC.match(
      /<div\s+className="noteometry-nav"[\s\S]*?aria-label="Noteometry pages"[\s\S]*?onDoubleClick=\{[^}]+\}[\s\S]*?onMouseDown=\{[^}]+\}[\s\S]*?>/
    );
    expect(shellMatch, "open-state nav shell missing onDoubleClick + onMouseDown").toBeTruthy();
  });

  it("stops click + contextmenu on the collapsed-state shell", () => {
    // The collapsed rail is also a child of the canvas area. Same leak,
    // same fix. Tests the noteometry-nav-collapsed branch.
    const collapsedMatch = NAV_SRC.match(
      /noteometry-nav noteometry-nav-collapsed[\s\S]*?onClick=\{\(e\) => e\.stopPropagation\(\)\}[\s\S]*?onContextMenu=\{\(e\) => e\.stopPropagation\(\)\}/
    );
    expect(collapsedMatch, "collapsed nav shell missing stopPropagation handlers").toBeTruthy();
  });

  it("the stopMouseBubble helper actually calls stopPropagation", () => {
    // Belt-and-braces: the helper assigned to the shell handlers must
    // invoke stopPropagation. A future refactor that renames the
    // helper to a no-op (or comments out the call) would silently
    // re-introduce the bug — pin the call at the source level.
    expect(NAV_SRC).toMatch(/const stopMouseBubble\s*=\s*\(e:\s*React\.MouseEvent\)\s*=>\s*e\.stopPropagation\(\);/);
  });
});
