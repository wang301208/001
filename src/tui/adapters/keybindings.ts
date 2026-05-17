import { matchesKey } from "./keys.js";

export const TUI_KEYBINDINGS: Record<string, { defaultKeys: string | string[]; description: string }> = {
    "tui.editor.cursorUp": { defaultKeys: "up", description: "Move cursor up" },
    "tui.editor.cursorDown": { defaultKeys: "down", description: "Move cursor down" },
    "tui.editor.cursorLeft": {
        defaultKeys: ["left", "ctrl+b"],
        description: "Move cursor left",
    },
    "tui.editor.cursorRight": {
        defaultKeys: ["right", "ctrl+f"],
        description: "Move cursor right",
    },
    "tui.editor.cursorWordLeft": {
        defaultKeys: ["alt+left", "ctrl+left", "alt+b"],
        description: "Move cursor word left",
    },
    "tui.editor.cursorWordRight": {
        defaultKeys: ["alt+right", "ctrl+right", "alt+f"],
        description: "Move cursor word right",
    },
    "tui.editor.cursorLineStart": {
        defaultKeys: ["home", "ctrl+a"],
        description: "Move to line start",
    },
    "tui.editor.cursorLineEnd": {
        defaultKeys: ["end", "ctrl+e"],
        description: "Move to line end",
    },
    "tui.editor.jumpForward": {
        defaultKeys: "ctrl+]",
        description: "Jump forward to character",
    },
    "tui.editor.jumpBackward": {
        defaultKeys: "ctrl+alt+]",
        description: "Jump backward to character",
    },
    "tui.editor.pageUp": { defaultKeys: "pageUp", description: "Page up" },
    "tui.editor.pageDown": { defaultKeys: "pageDown", description: "Page down" },
    "tui.editor.deleteCharBackward": {
        defaultKeys: "backspace",
        description: "Delete character backward",
    },
    "tui.editor.deleteCharForward": {
        defaultKeys: ["delete", "ctrl+d"],
        description: "Delete character forward",
    },
    "tui.editor.deleteWordBackward": {
        defaultKeys: ["ctrl+w", "alt+backspace"],
        description: "Delete word backward",
    },
    "tui.editor.deleteWordForward": {
        defaultKeys: ["alt+d", "alt+delete"],
        description: "Delete word forward",
    },
    "tui.editor.deleteToLineStart": {
        defaultKeys: "ctrl+u",
        description: "Delete to line start",
    },
    "tui.editor.deleteToLineEnd": {
        defaultKeys: "ctrl+k",
        description: "Delete to line end",
    },
    "tui.editor.yank": { defaultKeys: "ctrl+y", description: "Yank" },
    "tui.editor.yankPop": { defaultKeys: "alt+y", description: "Yank pop" },
    "tui.editor.undo": { defaultKeys: "ctrl+-", description: "Undo" },
    "tui.input.newLine": { defaultKeys: "shift+enter", description: "Insert newline" },
    "tui.input.submit": { defaultKeys: "enter", description: "Submit input" },
    "tui.input.tab": { defaultKeys: "tab", description: "Tab / autocomplete" },
    "tui.input.copy": { defaultKeys: "ctrl+c", description: "Copy selection" },
    "tui.select.up": { defaultKeys: "up", description: "Move selection up" },
    "tui.select.down": { defaultKeys: "down", description: "Move selection down" },
    "tui.select.pageUp": { defaultKeys: "pageUp", description: "Selection page up" },
    "tui.select.pageDown": {
        defaultKeys: "pageDown",
        description: "Selection page down",
    },
    "tui.select.confirm": { defaultKeys: "enter", description: "Confirm selection" },
    "tui.select.cancel": {
        defaultKeys: ["escape", "ctrl+c"],
        description: "Cancel selection",
    },
};

function normalizeKeys(keys: string | string[] | undefined): string[] {
    if (keys === undefined)
        return [];
    const keyList: string[] = Array.isArray(keys) ? keys : [keys];
    const seen: Set<string> = new Set();
    const result: string[] = [];
    for (const key of keyList) {
        if (!seen.has(key)) {
            seen.add(key);
            result.push(key);
        }
    }
    return result;
}

interface KeybindingDefinition {
    defaultKeys: string | string[];
    description: string;
}

interface Conflict {
    key: string;
    keybindings: string[];
}

export class KeybindingsManager {
    definitions: Record<string, KeybindingDefinition>;
    userBindings: Record<string, string | string[] | undefined>;
    keysById: Map<string, string[]> = new Map();
    conflicts: Conflict[] = [];

    constructor(definitions: Record<string, KeybindingDefinition>, userBindings: Record<string, string | string[] | undefined> = {}) {
        this.definitions = definitions;
        this.userBindings = userBindings;
        this.rebuild();
    }

    rebuild(): void {
        this.keysById.clear();
        this.conflicts = [];
        const userClaims: Map<string, Set<string>> = new Map();
        for (const [keybinding, keys] of Object.entries(this.userBindings)) {
            if (!(keybinding in this.definitions))
                continue;
            for (const key of normalizeKeys(keys)) {
                const claimants: Set<string> = userClaims.get(key) ?? new Set();
                claimants.add(keybinding);
                userClaims.set(key, claimants);
            }
        }
        for (const [key, keybindings] of userClaims) {
            if (keybindings.size > 1) {
                this.conflicts.push({ key, keybindings: [...keybindings] });
            }
        }
        for (const [id, definition] of Object.entries(this.definitions)) {
            const userKeys: string | string[] | undefined = this.userBindings[id];
            const keys: string[] = userKeys === undefined ? normalizeKeys(definition.defaultKeys) : normalizeKeys(userKeys);
            this.keysById.set(id, keys);
        }
    }

    matches(data: string, keybinding: string): boolean {
        const keys: string[] = this.keysById.get(keybinding) ?? [];
        for (const key of keys) {
            if (matchesKey(data, key))
                return true;
        }
        return false;
    }

    getKeys(keybinding: string): string[] {
        return [...(this.keysById.get(keybinding) ?? [])];
    }

    getDefinition(keybinding: string): KeybindingDefinition | undefined {
        return this.definitions[keybinding];
    }

    getConflicts(): Conflict[] {
        return this.conflicts.map((conflict: Conflict): Conflict => ({ ...conflict, keybindings: [...conflict.keybindings] }));
    }

    setUserBindings(userBindings: Record<string, string | string[] | undefined>): void {
        this.userBindings = userBindings;
        this.rebuild();
    }

    getUserBindings(): Record<string, string | string[] | undefined> {
        return { ...this.userBindings };
    }

    getResolvedBindings(): Record<string, string | string[]> {
        const resolved: Record<string, string | string[]> = {};
        for (const id of Object.keys(this.definitions)) {
            const keys: string[] = this.keysById.get(id) ?? [];
            resolved[id] = keys.length === 1 ? keys[0] : [...keys];
        }
        return resolved;
    }
}

let globalKeybindings: KeybindingsManager | null = null;

export function setKeybindings(keybindings: KeybindingsManager): void {
    globalKeybindings = keybindings;
}

export function getKeybindings(): KeybindingsManager {
    if (!globalKeybindings) {
        globalKeybindings = new KeybindingsManager(TUI_KEYBINDINGS);
    }
    return globalKeybindings;
}
