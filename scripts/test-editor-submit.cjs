const keys = require("../node_modules/@mariozechner/pi-tui/dist/keys.js");
const kbMod = require("../node_modules/@mariozechner/pi-tui/dist/keybindings.js");

keys.setKittyProtocolActive(false);
const kb = new kbMod.KeybindingsManager(kbMod.TUI_KEYBINDINGS);

console.log("=== Editor submit 键匹配验证 ===");
console.log("submit CR (\\r):", kb.matches("\r", "tui.input.submit"));
console.log("submit mOK (\\x1b[27;1;13~):", kb.matches("\x1b[27;1;13~", "tui.input.submit"));
console.log("submit LF (\\n):", kb.matches("\n", "tui.input.submit"));
console.log("tab CR:", kb.matches("\t", "tui.input.tab"));
console.log("tab mOK:", kb.matches("\x1b[27;1;9~", "tui.input.tab"));

console.log("\n=== matchesKey 直接验证 ===");
console.log("Enter mOK:", keys.matchesKey("\x1b[27;1;13~", "enter"));
console.log("Enter CR:", keys.matchesKey("\r", "enter"));
console.log("Tab mOK:", keys.matchesKey("\x1b[27;1;9~", "tab"));

console.log("\n=== Editor.getKeybindings() 验证 ===");
const editorMod = require("../node_modules/@mariozechner/pi-tui/dist/components/editor.js");
// Editor 类内部使用 getKeybindings() 获取 KeybindingsManager
// 验证其获取的实例是否使用修复后的 matchesKey
