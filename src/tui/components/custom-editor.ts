import { Editor, truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
import { Key, matchesKey } from "../adapters/index.js";

export class CustomEditor extends Editor {
  onEscape?: () => void;
  onCtrlC?: () => void;
  onCtrlD?: () => void;
  onCtrlG?: () => void;
  onCtrlL?: () => void;
  onCtrlO?: () => void;
  onCtrlP?: () => void;
  onCtrlT?: () => void;
  onCtrlY?: () => void;
  onCtrlA?: () => void;
  onCtrlS?: () => void;
  onCtrlF?: () => void;
  onCtrlJ?: () => void;
  onCtrlM?: () => void;
  onCtrlW?: () => void;
  onCtrlX?: () => void;
  onCtrlE?: () => void;
  onCtrlQ?: () => void;
  onCtrlR?: () => void;
  onCtrlU?: () => void;
  onCtrl1?: () => void;
  onCtrl2?: () => void;
  onCtrl3?: () => void;
  onCtrl4?: () => void;
  onCtrl5?: () => void;
  onCtrl6?: () => void;
  onShiftTab?: () => void;
  onAltEnter?: () => void;
  onAltUp?: () => void;
  private promptHint = ">";

  setPromptHint(value: string): void {
    this.promptHint = value || ">";
    this.invalidate();
  }

  render(width: number): string[] {
    const hint = `${this.promptHint} `;
    const hintWidth = visibleWidth(hint);
    const editorWidth = Math.max(1, width - hintWidth);
    const lines = super.render(editorWidth);
    if (lines.length < 3) {
      return lines.map((line) => truncateToWidth(line, width, "", true));
    }
    const inputLineIndex = lines.length - 2;
    lines[inputLineIndex] = `${hint}${lines[inputLineIndex] ?? ""}`;
    return lines.map((line) => truncateToWidth(line, width, "", true));
  }

  handleInput(data: string): void {
    if (matchesKey(data, Key.alt("enter")) && this.onAltEnter) {
      this.onAltEnter();
      return;
    }
    if (matchesKey(data, Key.alt("up")) && this.onAltUp) {
      this.onAltUp();
      return;
    }
    if (matchesKey(data, Key.ctrl("l")) && this.onCtrlL) {
      this.onCtrlL();
      return;
    }
    if (matchesKey(data, Key.ctrl("o")) && this.onCtrlO) {
      this.onCtrlO();
      return;
    }
    if (matchesKey(data, Key.ctrl("p")) && this.onCtrlP) {
      this.onCtrlP();
      return;
    }
    if (matchesKey(data, Key.ctrl("g")) && this.onCtrlG) {
      this.onCtrlG();
      return;
    }
    if (matchesKey(data, Key.ctrl("t")) && this.onCtrlT) {
      this.onCtrlT();
      return;
    }
    if (matchesKey(data, Key.ctrl("y")) && this.onCtrlY) {
      this.onCtrlY();
      return;
    }
    if (matchesKey(data, Key.ctrl("a")) && this.onCtrlA) {
      this.onCtrlA();
      return;
    }
    if (matchesKey(data, Key.ctrl("s")) && this.onCtrlS) {
      this.onCtrlS();
      return;
    }
    if (matchesKey(data, Key.ctrl("f")) && this.onCtrlF) {
      this.onCtrlF();
      return;
    }
    if (matchesKey(data, Key.ctrl("j")) && this.onCtrlJ) {
      this.onCtrlJ();
      return;
    }
    if (matchesKey(data, Key.ctrl("m")) && this.onCtrlM) {
      this.onCtrlM();
      return;
    }
    if (matchesKey(data, Key.ctrl("w")) && this.onCtrlW) {
      this.onCtrlW();
      return;
    }
    if (matchesKey(data, Key.ctrl("x")) && this.onCtrlX) {
      this.onCtrlX();
      return;
    }
    if (matchesKey(data, Key.ctrl("e")) && this.onCtrlE) {
      this.onCtrlE();
      return;
    }
    if (matchesKey(data, Key.ctrl("q")) && this.onCtrlQ) {
      this.onCtrlQ();
      return;
    }
    if (matchesKey(data, Key.ctrl("r")) && this.onCtrlR) {
      this.onCtrlR();
      return;
    }
    if (matchesKey(data, Key.ctrl("u")) && this.onCtrlU) {
      this.onCtrlU();
      return;
    }
    if (matchesKey(data, Key.ctrl("1")) && this.onCtrl1) {
      this.onCtrl1();
      return;
    }
    if (matchesKey(data, Key.ctrl("2")) && this.onCtrl2) {
      this.onCtrl2();
      return;
    }
    if (matchesKey(data, Key.ctrl("3")) && this.onCtrl3) {
      this.onCtrl3();
      return;
    }
    if (matchesKey(data, Key.ctrl("4")) && this.onCtrl4) {
      this.onCtrl4();
      return;
    }
    if (matchesKey(data, Key.ctrl("5")) && this.onCtrl5) {
      this.onCtrl5();
      return;
    }
    if (matchesKey(data, Key.ctrl("6")) && this.onCtrl6) {
      this.onCtrl6();
      return;
    }
    if (matchesKey(data, Key.shift("tab")) && this.onShiftTab) {
      this.onShiftTab();
      return;
    }
    if (matchesKey(data, Key.escape) && this.onEscape && !this.isShowingAutocomplete()) {
      this.onEscape();
      return;
    }
    if (matchesKey(data, Key.ctrl("c")) && this.onCtrlC) {
      this.onCtrlC();
      return;
    }
    if (matchesKey(data, Key.ctrl("d"))) {
      if (this.getText().length === 0 && this.onCtrlD) {
        this.onCtrlD();
      }
      return;
    }
    super.handleInput(data);
  }
}
