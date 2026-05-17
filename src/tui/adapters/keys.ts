let _kittyProtocolActive: boolean = false;

export function setKittyProtocolActive(active: boolean): void {
    _kittyProtocolActive = active;
}

export function isKittyProtocolActive(): boolean {
    return _kittyProtocolActive;
}

export const Key: {
    escape: string;
    esc: string;
    enter: string;
    return: string;
    tab: string;
    space: string;
    backspace: string;
    delete: string;
    insert: string;
    clear: string;
    home: string;
    end: string;
    pageUp: string;
    pageDown: string;
    up: string;
    down: string;
    left: string;
    right: string;
    f1: string;
    f2: string;
    f3: string;
    f4: string;
    f5: string;
    f6: string;
    f7: string;
    f8: string;
    f9: string;
    f10: string;
    f11: string;
    f12: string;
    backtick: string;
    hyphen: string;
    equals: string;
    leftbracket: string;
    rightbracket: string;
    backslash: string;
    semicolon: string;
    quote: string;
    comma: string;
    period: string;
    slash: string;
    exclamation: string;
    at: string;
    hash: string;
    dollar: string;
    percent: string;
    caret: string;
    ampersand: string;
    asterisk: string;
    leftparen: string;
    rightparen: string;
    underscore: string;
    plus: string;
    pipe: string;
    tilde: string;
    leftbrace: string;
    rightbrace: string;
    colon: string;
    lessthan: string;
    greaterthan: string;
    question: string;
    ctrl: (key: string) => string;
    shift: (key: string) => string;
    alt: (key: string) => string;
    ctrlShift: (key: string) => string;
    shiftCtrl: (key: string) => string;
    ctrlAlt: (key: string) => string;
    altCtrl: (key: string) => string;
    shiftAlt: (key: string) => string;
    altShift: (key: string) => string;
    ctrlShiftAlt: (key: string) => string;
} = {
    escape: "escape",
    esc: "esc",
    enter: "enter",
    return: "return",
    tab: "tab",
    space: "space",
    backspace: "backspace",
    delete: "delete",
    insert: "insert",
    clear: "clear",
    home: "home",
    end: "end",
    pageUp: "pageUp",
    pageDown: "pageDown",
    up: "up",
    down: "down",
    left: "left",
    right: "right",
    f1: "f1",
    f2: "f2",
    f3: "f3",
    f4: "f4",
    f5: "f5",
    f6: "f6",
    f7: "f7",
    f8: "f8",
    f9: "f9",
    f10: "f10",
    f11: "f11",
    f12: "f12",
    backtick: "`",
    hyphen: "-",
    equals: "=",
    leftbracket: "[",
    rightbracket: "]",
    backslash: "\\",
    semicolon: ";",
    quote: "'",
    comma: ",",
    period: ".",
    slash: "/",
    exclamation: "!",
    at: "@",
    hash: "#",
    dollar: "$",
    percent: "%",
    caret: "^",
    ampersand: "&",
    asterisk: "*",
    leftparen: "(",
    rightparen: ")",
    underscore: "_",
    plus: "+",
    pipe: "|",
    tilde: "~",
    leftbrace: "{",
    rightbrace: "}",
    colon: ":",
    lessthan: "<",
    greaterthan: ">",
    question: "?",
    ctrl: (key: string): string => `ctrl+${key}`,
    shift: (key: string): string => `shift+${key}`,
    alt: (key: string): string => `alt+${key}`,
    ctrlShift: (key: string): string => `ctrl+shift+${key}`,
    shiftCtrl: (key: string): string => `shift+ctrl+${key}`,
    ctrlAlt: (key: string): string => `ctrl+alt+${key}`,
    altCtrl: (key: string): string => `alt+ctrl+${key}`,
    shiftAlt: (key: string): string => `shift+alt+${key}`,
    altShift: (key: string): string => `alt+shift+${key}`,
    ctrlShiftAlt: (key: string): string => `ctrl+shift+alt+${key}`,
};

const SYMBOL_KEYS: Set<string> = new Set([
    "`", "-", "=", "[", "]", "\\", ";", "'", ",", ".", "/",
    "!", "@", "#", "$", "%", "^", "&", "*", "(", ")",
    "_", "+", "|", "~", "{", "}", ":", "<", ">", "?",
]);

export const MODIFIERS: { shift: number; alt: number; ctrl: number } = {
    shift: 1,
    alt: 2,
    ctrl: 4,
};

const LOCK_MASK: number = 64 + 128;

export const CODEPOINTS: { escape: number; tab: number; enter: number; space: number; backspace: number; kpEnter: number } = {
    escape: 27,
    tab: 9,
    enter: 13,
    space: 32,
    backspace: 127,
    kpEnter: 57414,
};

const ARROW_CODEPOINTS: { up: number; down: number; right: number; left: number } = {
    up: -1,
    down: -2,
    right: -3,
    left: -4,
};

const FUNCTIONAL_CODEPOINTS: { delete: number; insert: number; pageUp: number; pageDown: number; home: number; end: number } = {
    delete: -10,
    insert: -11,
    pageUp: -12,
    pageDown: -13,
    home: -14,
    end: -15,
};

const KITTY_FUNCTIONAL_KEY_EQUIVALENTS: Map<number, number> = new Map([
    [57399, 48],
    [57400, 49],
    [57401, 50],
    [57402, 51],
    [57403, 52],
    [57404, 53],
    [57405, 54],
    [57406, 55],
    [57407, 56],
    [57408, 57],
    [57409, 46],
    [57410, 47],
    [57411, 42],
    [57412, 45],
    [57413, 43],
    [57415, 61],
    [57416, 44],
    [57417, ARROW_CODEPOINTS.left],
    [57418, ARROW_CODEPOINTS.right],
    [57419, ARROW_CODEPOINTS.up],
    [57420, ARROW_CODEPOINTS.down],
    [57421, FUNCTIONAL_CODEPOINTS.pageUp],
    [57422, FUNCTIONAL_CODEPOINTS.pageDown],
    [57423, FUNCTIONAL_CODEPOINTS.home],
    [57424, FUNCTIONAL_CODEPOINTS.end],
    [57425, FUNCTIONAL_CODEPOINTS.insert],
    [57426, FUNCTIONAL_CODEPOINTS.delete],
]);

function normalizeKittyFunctionalCodepoint(codepoint: number): number {
    return KITTY_FUNCTIONAL_KEY_EQUIVALENTS.get(codepoint) ?? codepoint;
}

const LEGACY_KEY_SEQUENCES: Record<string, string[]> = {
    up: ["\x1b[A", "\x1bOA"],
    down: ["\x1b[B", "\x1bOB"],
    right: ["\x1b[C", "\x1bOC"],
    left: ["\x1b[D", "\x1bOD"],
    home: ["\x1b[H", "\x1bOH", "\x1b[1~", "\x1b[7~"],
    end: ["\x1b[F", "\x1bOF", "\x1b[4~", "\x1b[8~"],
    insert: ["\x1b[2~"],
    delete: ["\x1b[3~"],
    pageUp: ["\x1b[5~", "\x1b[[5~"],
    pageDown: ["\x1b[6~", "\x1b[[6~"],
    clear: ["\x1b[E", "\x1bOE"],
    f1: ["\x1bOP", "\x1b[11~", "\x1b[[A"],
    f2: ["\x1bOQ", "\x1b[12~", "\x1b[[B"],
    f3: ["\x1bOR", "\x1b[13~", "\x1b[[C"],
    f4: ["\x1bOS", "\x1b[14~", "\x1b[[D"],
    f5: ["\x1b[15~", "\x1b[[E"],
    f6: ["\x1b[17~"],
    f7: ["\x1b[18~"],
    f8: ["\x1b[19~"],
    f9: ["\x1b[20~"],
    f10: ["\x1b[21~"],
    f11: ["\x1b[23~"],
    f12: ["\x1b[24~"],
};

const LEGACY_SHIFT_SEQUENCES: Record<string, string[]> = {
    up: ["\x1b[a"],
    down: ["\x1b[b"],
    right: ["\x1b[c"],
    left: ["\x1b[d"],
    clear: ["\x1b[e"],
    insert: ["\x1b[2$"],
    delete: ["\x1b[3$"],
    pageUp: ["\x1b[5$"],
    pageDown: ["\x1b[6$"],
    home: ["\x1b[7$"],
    end: ["\x1b[8$"],
};

const LEGACY_CTRL_SEQUENCES: Record<string, string[]> = {
    up: ["\x1bOa"],
    down: ["\x1bOb"],
    right: ["\x1bOc"],
    left: ["\x1bOd"],
    clear: ["\x1bOe"],
    insert: ["\x1b[2^"],
    delete: ["\x1b[3^"],
    pageUp: ["\x1b[5^"],
    pageDown: ["\x1b[6^"],
    home: ["\x1b[7^"],
    end: ["\x1b[8^"],
};

const LEGACY_SEQUENCE_KEY_IDS: Record<string, string> = {
    "\x1bOA": "up",
    "\x1bOB": "down",
    "\x1bOC": "right",
    "\x1bOD": "left",
    "\x1bOH": "home",
    "\x1bOF": "end",
    "\x1b[E": "clear",
    "\x1bOE": "clear",
    "\x1bOe": "ctrl+clear",
    "\x1b[e": "shift+clear",
    "\x1b[2~": "insert",
    "\x1b[2$": "shift+insert",
    "\x1b[2^": "ctrl+insert",
    "\x1b[3$": "shift+delete",
    "\x1b[3^": "ctrl+delete",
    "\x1b[[5~": "pageUp",
    "\x1b[[6~": "pageDown",
    "\x1b[a": "shift+up",
    "\x1b[b": "shift+down",
    "\x1b[c": "shift+right",
    "\x1b[d": "shift+left",
    "\x1bOa": "ctrl+up",
    "\x1bOb": "ctrl+down",
    "\x1bOc": "ctrl+right",
    "\x1bOd": "ctrl+left",
    "\x1b[5$": "shift+pageUp",
    "\x1b[6$": "shift+pageDown",
    "\x1b[7$": "shift+home",
    "\x1b[8$": "shift+end",
    "\x1b[5^": "ctrl+pageUp",
    "\x1b[6^": "ctrl+pageDown",
    "\x1b[7^": "ctrl+home",
    "\x1b[8^": "ctrl+end",
    "\x1bOP": "f1",
    "\x1bOQ": "f2",
    "\x1bOR": "f3",
    "\x1bOS": "f4",
    "\x1b[11~": "f1",
    "\x1b[12~": "f2",
    "\x1b[13~": "f3",
    "\x1b[14~": "f4",
    "\x1b[[A": "f1",
    "\x1b[[B": "f2",
    "\x1b[[C": "f3",
    "\x1b[[D": "f4",
    "\x1b[[E": "f5",
    "\x1b[15~": "f5",
    "\x1b[17~": "f6",
    "\x1b[18~": "f7",
    "\x1b[19~": "f8",
    "\x1b[20~": "f9",
    "\x1b[21~": "f10",
    "\x1b[23~": "f11",
    "\x1b[24~": "f12",
    "\x1bb": "alt+left",
    "\x1bf": "alt+right",
    "\x1bp": "alt+up",
    "\x1bn": "alt+down",
};

const matchesLegacySequence = (data: string, sequences: string[]): boolean => sequences.includes(data);

const matchesLegacyModifierSequence = (data: string, key: string, modifier: number): boolean => {
    if (modifier === MODIFIERS.shift) {
        return matchesLegacySequence(data, LEGACY_SHIFT_SEQUENCES[key]);
    }
    if (modifier === MODIFIERS.ctrl) {
        return matchesLegacySequence(data, LEGACY_CTRL_SEQUENCES[key]);
    }
    return false;
};

let _lastEventType: "press" | "repeat" | "release" = "press";

export function isKeyRelease(data: string): boolean {
    if (data.includes("\x1b[200~")) {
        return false;
    }
    if (data.includes(":3u") ||
        data.includes(":3~") ||
        data.includes(":3A") ||
        data.includes(":3B") ||
        data.includes(":3C") ||
        data.includes(":3D") ||
        data.includes(":3H") ||
        data.includes(":3F")) {
        return true;
    }
    return false;
}

export function isKeyRepeat(data: string): boolean {
    if (data.includes("\x1b[200~")) {
        return false;
    }
    if (data.includes(":2u") ||
        data.includes(":2~") ||
        data.includes(":2A") ||
        data.includes(":2B") ||
        data.includes(":2C") ||
        data.includes(":2D") ||
        data.includes(":2H") ||
        data.includes(":2F")) {
        return true;
    }
    return false;
}

function parseEventType(eventTypeStr: string | undefined): "press" | "repeat" | "release" {
    if (!eventTypeStr)
        return "press";
    const eventType: number = parseInt(eventTypeStr, 10);
    if (eventType === 2)
        return "repeat";
    if (eventType === 3)
        return "release";
    return "press";
}

interface ParsedKittySequence {
    codepoint: number;
    shiftedKey?: number;
    baseLayoutKey?: number;
    modifier: number;
    eventType: "press" | "repeat" | "release";
}

function parseKittySequence(data: string): ParsedKittySequence | null {
    const csiUMatch: RegExpMatchArray | null = data.match(/^\x1b\[(\d+)(?::(\d*))?(?::(\d+))?(?:;(\d+))?(?::(\d+))?u$/);
    if (csiUMatch) {
        const codepoint: number = parseInt(csiUMatch[1], 10);
        const shiftedKey: number | undefined = csiUMatch[2] && csiUMatch[2].length > 0 ? parseInt(csiUMatch[2], 10) : undefined;
        const baseLayoutKey: number | undefined = csiUMatch[3] ? parseInt(csiUMatch[3], 10) : undefined;
        const modValue: number = csiUMatch[4] ? parseInt(csiUMatch[4], 10) : 1;
        const eventType: "press" | "repeat" | "release" = parseEventType(csiUMatch[5]);
        _lastEventType = eventType;
        return { codepoint, shiftedKey, baseLayoutKey, modifier: modValue - 1, eventType };
    }
    const arrowMatch: RegExpMatchArray | null = data.match(/^\x1b\[1;(\d+)(?::(\d+))?([ABCD])$/);
    if (arrowMatch) {
        const modValue: number = parseInt(arrowMatch[1], 10);
        const eventType: "press" | "repeat" | "release" = parseEventType(arrowMatch[2]);
        const arrowCodes: Record<string, number> = { A: -1, B: -2, C: -3, D: -4 };
        _lastEventType = eventType;
        return { codepoint: arrowCodes[arrowMatch[3]], modifier: modValue - 1, eventType };
    }
    const funcMatch: RegExpMatchArray | null = data.match(/^\x1b\[(\d+)(?:;(\d+))?(?::(\d+))?~$/);
    if (funcMatch) {
        const keyNum: number = parseInt(funcMatch[1], 10);
        const modValue: number = funcMatch[2] ? parseInt(funcMatch[2], 10) : 1;
        const eventType: "press" | "repeat" | "release" = parseEventType(funcMatch[3]);
        const funcCodes: Record<number, number> = {
            2: FUNCTIONAL_CODEPOINTS.insert,
            3: FUNCTIONAL_CODEPOINTS.delete,
            5: FUNCTIONAL_CODEPOINTS.pageUp,
            6: FUNCTIONAL_CODEPOINTS.pageDown,
            7: FUNCTIONAL_CODEPOINTS.home,
            8: FUNCTIONAL_CODEPOINTS.end,
        };
        const codepoint: number | undefined = funcCodes[keyNum];
        if (codepoint !== undefined) {
            _lastEventType = eventType;
            return { codepoint, modifier: modValue - 1, eventType };
        }
    }
    const homeEndMatch: RegExpMatchArray | null = data.match(/^\x1b\[1;(\d+)(?::(\d+))?([HF])$/);
    if (homeEndMatch) {
        const modValue: number = parseInt(homeEndMatch[1], 10);
        const eventType: "press" | "repeat" | "release" = parseEventType(homeEndMatch[2]);
        const codepoint: number = homeEndMatch[3] === "H" ? FUNCTIONAL_CODEPOINTS.home : FUNCTIONAL_CODEPOINTS.end;
        _lastEventType = eventType;
        return { codepoint, modifier: modValue - 1, eventType };
    }
    return null;
}

function matchesKittySequence(data: string, expectedCodepoint: number, expectedModifier: number): boolean {
    const parsed: ParsedKittySequence | null = parseKittySequence(data);
    if (!parsed)
        return false;
    const actualMod: number = parsed.modifier & ~LOCK_MASK;
    const expectedMod: number = expectedModifier & ~LOCK_MASK;
    if (actualMod !== expectedMod)
        return false;
    const normalizedCodepoint: number = normalizeKittyFunctionalCodepoint(parsed.codepoint);
    const normalizedExpectedCodepoint: number = normalizeKittyFunctionalCodepoint(expectedCodepoint);
    if (normalizedCodepoint === normalizedExpectedCodepoint)
        return true;
    if (parsed.baseLayoutKey !== undefined && parsed.baseLayoutKey === expectedCodepoint) {
        const cp: number = normalizedCodepoint;
        const isLatinLetter: boolean = cp >= 97 && cp <= 122;
        const isKnownSymbol: boolean = SYMBOL_KEYS.has(String.fromCharCode(cp));
        if (!isLatinLetter && !isKnownSymbol)
            return true;
    }
    return false;
}

interface ParsedModifyOtherKeys {
    codepoint: number;
    modifier: number;
}

function parseModifyOtherKeysSequence(data: string): ParsedModifyOtherKeys | null {
    const match: RegExpMatchArray | null = data.match(/^\x1b\[27;(\d+);(\d+)~$/);
    if (!match)
        return null;
    const modValue: number = parseInt(match[1], 10);
    const codepoint: number = parseInt(match[2], 10);
    return { codepoint, modifier: modValue - 1 };
}

function matchesModifyOtherKeys(data: string, expectedKeycode: number, expectedModifier: number): boolean {
    const parsed: ParsedModifyOtherKeys | null = parseModifyOtherKeysSequence(data);
    if (!parsed)
        return false;
    return parsed.codepoint === expectedKeycode && parsed.modifier === expectedModifier;
}

function isWindowsTerminalSession(): boolean {
    return (Boolean(process.env.WT_SESSION) && !process.env.SSH_CONNECTION && !process.env.SSH_CLIENT && !process.env.SSH_TTY);
}

function matchesRawBackspace(data: string, expectedModifier: number): boolean {
    if (data === "\x7f")
        return expectedModifier === 0;
    if (data !== "\x08")
        return false;
    return isWindowsTerminalSession() ? expectedModifier === MODIFIERS.ctrl : expectedModifier === 0;
}

function rawCtrlChar(key: string): string | null {
    const char: string = key.toLowerCase();
    const code: number = char.charCodeAt(0);
    if ((code >= 97 && code <= 122) || char === "[" || char === "\\" || char === "]" || char === "_") {
        return String.fromCharCode(code & 0x1f);
    }
    if (char === "-") {
        return String.fromCharCode(31);
    }
    return null;
}

function isDigitKey(key: string): boolean {
    return key >= "0" && key <= "9";
}

function matchesPrintableModifyOtherKeys(data: string, expectedKeycode: number, expectedModifier: number): boolean {
    if (expectedModifier === 0)
        return false;
    return matchesModifyOtherKeys(data, expectedKeycode, expectedModifier);
}

function formatKeyNameWithModifiers(keyName: string, modifier: number): string | undefined {
    const mods: string[] = [];
    const effectiveMod: number = modifier & ~LOCK_MASK;
    const supportedModifierMask: number = MODIFIERS.shift | MODIFIERS.ctrl | MODIFIERS.alt;
    if ((effectiveMod & ~supportedModifierMask) !== 0)
        return undefined;
    if (effectiveMod & MODIFIERS.shift)
        mods.push("shift");
    if (effectiveMod & MODIFIERS.ctrl)
        mods.push("ctrl");
    if (effectiveMod & MODIFIERS.alt)
        mods.push("alt");
    return mods.length > 0 ? `${mods.join("+")}+${keyName}` : keyName;
}

interface ParsedKeyId {
    key: string;
    ctrl: boolean;
    shift: boolean;
    alt: boolean;
}

function parseKeyId(keyId: string): ParsedKeyId | null {
    const parts: string[] = keyId.toLowerCase().split("+");
    const key: string = parts[parts.length - 1];
    if (!key)
        return null;
    return {
        key,
        ctrl: parts.includes("ctrl"),
        shift: parts.includes("shift"),
        alt: parts.includes("alt"),
    };
}

export function matchesKey(data: string, keyId: string): boolean {
    const parsed: ParsedKeyId | null = parseKeyId(keyId);
    if (!parsed)
        return false;
    const { key, ctrl, shift, alt } = parsed;
    let modifier: number = 0;
    if (shift)
        modifier |= MODIFIERS.shift;
    if (alt)
        modifier |= MODIFIERS.alt;
    if (ctrl)
        modifier |= MODIFIERS.ctrl;
    switch (key) {
        case "escape":
        case "esc":
            if (modifier !== 0)
                return false;
            return (data === "\x1b" ||
                matchesKittySequence(data, CODEPOINTS.escape, 0) ||
                matchesModifyOtherKeys(data, CODEPOINTS.escape, 0));
        case "space":
            if (!_kittyProtocolActive) {
                if (ctrl && !alt && !shift && data === "\x00") {
                    return true;
                }
                if (alt && !ctrl && !shift && data === "\x1b ") {
                    return true;
                }
            }
            if (modifier === 0) {
                return (data === " " ||
                    matchesKittySequence(data, CODEPOINTS.space, 0) ||
                    matchesModifyOtherKeys(data, CODEPOINTS.space, 0));
            }
            return (matchesKittySequence(data, CODEPOINTS.space, modifier) ||
                matchesModifyOtherKeys(data, CODEPOINTS.space, modifier));
        case "tab":
            if (shift && !ctrl && !alt) {
                return (data === "\x1b[Z" ||
                    matchesKittySequence(data, CODEPOINTS.tab, MODIFIERS.shift) ||
                    matchesModifyOtherKeys(data, CODEPOINTS.tab, MODIFIERS.shift));
            }
            if (modifier === 0) {
                return data === "\t" || matchesKittySequence(data, CODEPOINTS.tab, 0) || matchesModifyOtherKeys(data, CODEPOINTS.tab, 0);
            }
            return (matchesKittySequence(data, CODEPOINTS.tab, modifier) ||
                matchesModifyOtherKeys(data, CODEPOINTS.tab, modifier));
        case "enter":
        case "return":
            if (shift && !ctrl && !alt) {
                if (matchesKittySequence(data, CODEPOINTS.enter, MODIFIERS.shift) ||
                    matchesKittySequence(data, CODEPOINTS.kpEnter, MODIFIERS.shift)) {
                    return true;
                }
                if (matchesModifyOtherKeys(data, CODEPOINTS.enter, MODIFIERS.shift)) {
                    return true;
                }
                if (_kittyProtocolActive) {
                    return data === "\x1b\r" || data === "\n";
                }
                return false;
            }
            if (alt && !ctrl && !shift) {
                if (matchesKittySequence(data, CODEPOINTS.enter, MODIFIERS.alt) ||
                    matchesKittySequence(data, CODEPOINTS.kpEnter, MODIFIERS.alt)) {
                    return true;
                }
                if (matchesModifyOtherKeys(data, CODEPOINTS.enter, MODIFIERS.alt)) {
                    return true;
                }
                if (!_kittyProtocolActive) {
                    return data === "\x1b\r";
                }
                return false;
            }
            if (modifier === 0) {
                return (data === "\r" ||
                    (!_kittyProtocolActive && data === "\n") ||
                    data === "\x1bOM" ||
                    matchesKittySequence(data, CODEPOINTS.enter, 0) ||
                    matchesKittySequence(data, CODEPOINTS.kpEnter, 0) ||
                    matchesModifyOtherKeys(data, CODEPOINTS.enter, 0));
            }
            return (matchesKittySequence(data, CODEPOINTS.enter, modifier) ||
                matchesKittySequence(data, CODEPOINTS.kpEnter, modifier) ||
                matchesModifyOtherKeys(data, CODEPOINTS.enter, modifier));
        case "backspace":
            if (alt && !ctrl && !shift) {
                if (data === "\x1b\x7f" || data === "\x1b\b") {
                    return true;
                }
                return (matchesKittySequence(data, CODEPOINTS.backspace, MODIFIERS.alt) ||
                    matchesModifyOtherKeys(data, CODEPOINTS.backspace, MODIFIERS.alt));
            }
            if (ctrl && !alt && !shift) {
                if (matchesRawBackspace(data, MODIFIERS.ctrl))
                    return true;
                return (matchesKittySequence(data, CODEPOINTS.backspace, MODIFIERS.ctrl) ||
                    matchesModifyOtherKeys(data, CODEPOINTS.backspace, MODIFIERS.ctrl));
            }
            if (modifier === 0) {
                return (matchesRawBackspace(data, 0) ||
                    matchesKittySequence(data, CODEPOINTS.backspace, 0) ||
                    matchesModifyOtherKeys(data, CODEPOINTS.backspace, 0));
            }
            return (matchesKittySequence(data, CODEPOINTS.backspace, modifier) ||
                matchesModifyOtherKeys(data, CODEPOINTS.backspace, modifier));
        case "insert":
            if (modifier === 0) {
                return (matchesLegacySequence(data, LEGACY_KEY_SEQUENCES.insert) ||
                    matchesKittySequence(data, FUNCTIONAL_CODEPOINTS.insert, 0) ||
                    matchesModifyOtherKeys(data, FUNCTIONAL_CODEPOINTS.insert, 0));
            }
            if (matchesLegacyModifierSequence(data, "insert", modifier)) {
                return true;
            }
            return matchesKittySequence(data, FUNCTIONAL_CODEPOINTS.insert, modifier);
        case "delete":
            if (modifier === 0) {
                return (matchesLegacySequence(data, LEGACY_KEY_SEQUENCES.delete) ||
                    matchesKittySequence(data, FUNCTIONAL_CODEPOINTS.delete, 0) ||
                    matchesModifyOtherKeys(data, FUNCTIONAL_CODEPOINTS.delete, 0));
            }
            if (matchesLegacyModifierSequence(data, "delete", modifier)) {
                return true;
            }
            return matchesKittySequence(data, FUNCTIONAL_CODEPOINTS.delete, modifier);
        case "clear":
            if (modifier === 0) {
                return matchesLegacySequence(data, LEGACY_KEY_SEQUENCES.clear);
            }
            return matchesLegacyModifierSequence(data, "clear", modifier);
        case "home":
            if (modifier === 0) {
                return (matchesLegacySequence(data, LEGACY_KEY_SEQUENCES.home) ||
                    matchesKittySequence(data, FUNCTIONAL_CODEPOINTS.home, 0) ||
                    matchesModifyOtherKeys(data, FUNCTIONAL_CODEPOINTS.home, 0));
            }
            if (matchesLegacyModifierSequence(data, "home", modifier)) {
                return true;
            }
            return matchesKittySequence(data, FUNCTIONAL_CODEPOINTS.home, modifier);
        case "end":
            if (modifier === 0) {
                return (matchesLegacySequence(data, LEGACY_KEY_SEQUENCES.end) ||
                    matchesKittySequence(data, FUNCTIONAL_CODEPOINTS.end, 0) ||
                    matchesModifyOtherKeys(data, FUNCTIONAL_CODEPOINTS.end, 0));
            }
            if (matchesLegacyModifierSequence(data, "end", modifier)) {
                return true;
            }
            return matchesKittySequence(data, FUNCTIONAL_CODEPOINTS.end, modifier);
        case "pageup":
            if (modifier === 0) {
                return (matchesLegacySequence(data, LEGACY_KEY_SEQUENCES.pageUp) ||
                    matchesKittySequence(data, FUNCTIONAL_CODEPOINTS.pageUp, 0) ||
                    matchesModifyOtherKeys(data, FUNCTIONAL_CODEPOINTS.pageUp, 0));
            }
            if (matchesLegacyModifierSequence(data, "pageUp", modifier)) {
                return true;
            }
            return matchesKittySequence(data, FUNCTIONAL_CODEPOINTS.pageUp, modifier);
        case "pagedown":
            if (modifier === 0) {
                return (matchesLegacySequence(data, LEGACY_KEY_SEQUENCES.pageDown) ||
                    matchesKittySequence(data, FUNCTIONAL_CODEPOINTS.pageDown, 0) ||
                    matchesModifyOtherKeys(data, FUNCTIONAL_CODEPOINTS.pageDown, 0));
            }
            if (matchesLegacyModifierSequence(data, "pageDown", modifier)) {
                return true;
            }
            return matchesKittySequence(data, FUNCTIONAL_CODEPOINTS.pageDown, modifier);
        case "up":
            if (alt && !ctrl && !shift) {
                return data === "\x1bp" || matchesKittySequence(data, ARROW_CODEPOINTS.up, MODIFIERS.alt);
            }
            if (modifier === 0) {
                return (matchesLegacySequence(data, LEGACY_KEY_SEQUENCES.up) ||
                    matchesKittySequence(data, ARROW_CODEPOINTS.up, 0) ||
                    matchesModifyOtherKeys(data, ARROW_CODEPOINTS.up, 0));
            }
            if (matchesLegacyModifierSequence(data, "up", modifier)) {
                return true;
            }
            return matchesKittySequence(data, ARROW_CODEPOINTS.up, modifier);
        case "down":
            if (alt && !ctrl && !shift) {
                return data === "\x1bn" || matchesKittySequence(data, ARROW_CODEPOINTS.down, MODIFIERS.alt);
            }
            if (modifier === 0) {
                return (matchesLegacySequence(data, LEGACY_KEY_SEQUENCES.down) ||
                    matchesKittySequence(data, ARROW_CODEPOINTS.down, 0) ||
                    matchesModifyOtherKeys(data, ARROW_CODEPOINTS.down, 0));
            }
            if (matchesLegacyModifierSequence(data, "down", modifier)) {
                return true;
            }
            return matchesKittySequence(data, ARROW_CODEPOINTS.down, modifier);
        case "left":
            if (alt && !ctrl && !shift) {
                return (data === "\x1b[1;3D" ||
                    (!_kittyProtocolActive && data === "\x1bB") ||
                    data === "\x1bb" ||
                    matchesKittySequence(data, ARROW_CODEPOINTS.left, MODIFIERS.alt));
            }
            if (ctrl && !alt && !shift) {
                return (data === "\x1b[1;5D" ||
                    matchesLegacyModifierSequence(data, "left", MODIFIERS.ctrl) ||
                    matchesKittySequence(data, ARROW_CODEPOINTS.left, MODIFIERS.ctrl));
            }
            if (modifier === 0) {
                return (matchesLegacySequence(data, LEGACY_KEY_SEQUENCES.left) ||
                    matchesKittySequence(data, ARROW_CODEPOINTS.left, 0) ||
                    matchesModifyOtherKeys(data, ARROW_CODEPOINTS.left, 0));
            }
            if (matchesLegacyModifierSequence(data, "left", modifier)) {
                return true;
            }
            return matchesKittySequence(data, ARROW_CODEPOINTS.left, modifier);
        case "right":
            if (alt && !ctrl && !shift) {
                return (data === "\x1b[1;3C" ||
                    (!_kittyProtocolActive && data === "\x1bF") ||
                    data === "\x1bf" ||
                    matchesKittySequence(data, ARROW_CODEPOINTS.right, MODIFIERS.alt));
            }
            if (ctrl && !alt && !shift) {
                return (data === "\x1b[1;5C" ||
                    matchesLegacyModifierSequence(data, "right", MODIFIERS.ctrl) ||
                    matchesKittySequence(data, ARROW_CODEPOINTS.right, MODIFIERS.ctrl));
            }
            if (modifier === 0) {
                return (matchesLegacySequence(data, LEGACY_KEY_SEQUENCES.right) ||
                    matchesKittySequence(data, ARROW_CODEPOINTS.right, 0) ||
                    matchesModifyOtherKeys(data, ARROW_CODEPOINTS.right, 0));
            }
            if (matchesLegacyModifierSequence(data, "right", modifier)) {
                return true;
            }
            return matchesKittySequence(data, ARROW_CODEPOINTS.right, modifier);
        case "f1":
        case "f2":
        case "f3":
        case "f4":
        case "f5":
        case "f6":
        case "f7":
        case "f8":
        case "f9":
        case "f10":
        case "f11":
        case "f12": {
            if (modifier !== 0) {
                return false;
            }
            const functionKey: string = key;
            return matchesLegacySequence(data, LEGACY_KEY_SEQUENCES[functionKey]);
        }
    }
    if (key.length === 1 && ((key >= "a" && key <= "z") || isDigitKey(key) || SYMBOL_KEYS.has(key))) {
        const codepoint: number = key.charCodeAt(0);
        const rawCtrl: string | null = rawCtrlChar(key);
        const isLetter: boolean = key >= "a" && key <= "z";
        const isDigit: boolean = isDigitKey(key);
        if (ctrl && alt && !shift && !_kittyProtocolActive && rawCtrl) {
            return data === `\x1b${rawCtrl}`;
        }
        if (alt && !ctrl && !shift && !_kittyProtocolActive && (isLetter || isDigit)) {
            if (data === `\x1b${key}`)
                return true;
        }
        if (ctrl && !shift && !alt) {
            if (rawCtrl && data === rawCtrl)
                return true;
            return (matchesKittySequence(data, codepoint, MODIFIERS.ctrl) ||
                matchesPrintableModifyOtherKeys(data, codepoint, MODIFIERS.ctrl));
        }
        if (ctrl && shift && !alt) {
            return (matchesKittySequence(data, codepoint, MODIFIERS.shift + MODIFIERS.ctrl) ||
                matchesPrintableModifyOtherKeys(data, codepoint, MODIFIERS.shift + MODIFIERS.ctrl));
        }
        if (shift && !ctrl && !alt) {
            if (isLetter && data === key.toUpperCase())
                return true;
            return (matchesKittySequence(data, codepoint, MODIFIERS.shift) ||
                matchesPrintableModifyOtherKeys(data, codepoint, MODIFIERS.shift));
        }
        if (modifier !== 0) {
            return (matchesKittySequence(data, codepoint, modifier) ||
                matchesPrintableModifyOtherKeys(data, codepoint, modifier));
        }
        return data === key || matchesKittySequence(data, codepoint, 0);
    }
    return false;
}

function formatParsedKey(codepoint: number, modifier: number, baseLayoutKey?: number): string | undefined {
    const normalizedCodepoint: number = normalizeKittyFunctionalCodepoint(codepoint);
    const isLatinLetter: boolean = normalizedCodepoint >= 97 && normalizedCodepoint <= 122;
    const isDigit: boolean = normalizedCodepoint >= 48 && normalizedCodepoint <= 57;
    const isKnownSymbol: boolean = SYMBOL_KEYS.has(String.fromCharCode(normalizedCodepoint));
    const effectiveCodepoint: number = isLatinLetter || isDigit || isKnownSymbol ? normalizedCodepoint : (baseLayoutKey ?? normalizedCodepoint);
    let keyName: string | undefined;
    if (effectiveCodepoint === CODEPOINTS.escape)
        keyName = "escape";
    else if (effectiveCodepoint === CODEPOINTS.tab)
        keyName = "tab";
    else if (effectiveCodepoint === CODEPOINTS.enter || effectiveCodepoint === CODEPOINTS.kpEnter)
        keyName = "enter";
    else if (effectiveCodepoint === CODEPOINTS.space)
        keyName = "space";
    else if (effectiveCodepoint === CODEPOINTS.backspace)
        keyName = "backspace";
    else if (effectiveCodepoint === FUNCTIONAL_CODEPOINTS.delete)
        keyName = "delete";
    else if (effectiveCodepoint === FUNCTIONAL_CODEPOINTS.insert)
        keyName = "insert";
    else if (effectiveCodepoint === FUNCTIONAL_CODEPOINTS.home)
        keyName = "home";
    else if (effectiveCodepoint === FUNCTIONAL_CODEPOINTS.end)
        keyName = "end";
    else if (effectiveCodepoint === FUNCTIONAL_CODEPOINTS.pageUp)
        keyName = "pageUp";
    else if (effectiveCodepoint === FUNCTIONAL_CODEPOINTS.pageDown)
        keyName = "pageDown";
    else if (effectiveCodepoint === ARROW_CODEPOINTS.up)
        keyName = "up";
    else if (effectiveCodepoint === ARROW_CODEPOINTS.down)
        keyName = "down";
    else if (effectiveCodepoint === ARROW_CODEPOINTS.left)
        keyName = "left";
    else if (effectiveCodepoint === ARROW_CODEPOINTS.right)
        keyName = "right";
    else if (effectiveCodepoint >= 48 && effectiveCodepoint <= 57)
        keyName = String.fromCharCode(effectiveCodepoint);
    else if (effectiveCodepoint >= 97 && effectiveCodepoint <= 122)
        keyName = String.fromCharCode(effectiveCodepoint);
    else if (SYMBOL_KEYS.has(String.fromCharCode(effectiveCodepoint)))
        keyName = String.fromCharCode(effectiveCodepoint);
    if (!keyName)
        return undefined;
    return formatKeyNameWithModifiers(keyName, modifier);
}

export function parseKey(data: string): string | undefined {
    const kitty: ParsedKittySequence | null = parseKittySequence(data);
    if (kitty) {
        return formatParsedKey(kitty.codepoint, kitty.modifier, kitty.baseLayoutKey);
    }
    const modifyOtherKeys: ParsedModifyOtherKeys | null = parseModifyOtherKeysSequence(data);
    if (modifyOtherKeys) {
        return formatParsedKey(modifyOtherKeys.codepoint, modifyOtherKeys.modifier);
    }
    if (_kittyProtocolActive) {
        if (data === "\x1b\r" || data === "\n")
            return "shift+enter";
    }
    const legacySequenceKeyId: string = LEGACY_SEQUENCE_KEY_IDS[data];
    if (legacySequenceKeyId)
        return legacySequenceKeyId;
    if (data === "\x1b")
        return "escape";
    if (data === "\x1c")
        return "ctrl+\\";
    if (data === "\x1d")
        return "ctrl+]";
    if (data === "\x1f")
        return "ctrl+-";
    if (data === "\x1b\x1b")
        return "ctrl+alt+[";
    if (data === "\x1b\x1c")
        return "ctrl+alt+\\";
    if (data === "\x1b\x1d")
        return "ctrl+alt+]";
    if (data === "\x1b\x1f")
        return "ctrl+alt+-";
    if (data === "\t")
        return "tab";
    if (data === "\r" || (!_kittyProtocolActive && data === "\n") || data === "\x1bOM")
        return "enter";
    if (data === "\x00")
        return "ctrl+space";
    if (data === " ")
        return "space";
    if (data === "\x7f")
        return "backspace";
    if (data === "\x08")
        return isWindowsTerminalSession() ? "ctrl+backspace" : "backspace";
    if (data === "\x1b[Z")
        return "shift+tab";
    if (!_kittyProtocolActive && data === "\x1b\r")
        return "alt+enter";
    if (!_kittyProtocolActive && data === "\x1b ")
        return "alt+space";
    if (data === "\x1b\x7f" || data === "\x1b\b")
        return "alt+backspace";
    if (!_kittyProtocolActive && data === "\x1bB")
        return "alt+left";
    if (!_kittyProtocolActive && data === "\x1bF")
        return "alt+right";
    if (!_kittyProtocolActive && data.length === 2 && data[0] === "\x1b") {
        const code: number = data.charCodeAt(1);
        if (code >= 1 && code <= 26) {
            return `ctrl+alt+${String.fromCharCode(code + 96)}`;
        }
        if ((code >= 97 && code <= 122) || (code >= 48 && code <= 57)) {
            return `alt+${String.fromCharCode(code)}`;
        }
    }
    if (data === "\x1b[A")
        return "up";
    if (data === "\x1b[B")
        return "down";
    if (data === "\x1b[C")
        return "right";
    if (data === "\x1b[D")
        return "left";
    if (data === "\x1b[H" || data === "\x1bOH")
        return "home";
    if (data === "\x1b[F" || data === "\x1bOF")
        return "end";
    if (data === "\x1b[3~")
        return "delete";
    if (data === "\x1b[5~")
        return "pageUp";
    if (data === "\x1b[6~")
        return "pageDown";
    if (data.length === 1) {
        const code: number = data.charCodeAt(0);
        if (code >= 1 && code <= 26) {
            return `ctrl+${String.fromCharCode(code + 96)}`;
        }
        if (code >= 32 && code <= 126) {
            return data;
        }
    }
    return undefined;
}

const KITTY_CSI_U_REGEX: RegExp = /^\x1b\[(\d+)(?::(\d*))?(?::(\d+))?(?:;(\d+))?(?::(\d+))?u$/;
const KITTY_PRINTABLE_ALLOWED_MODIFIERS: number = MODIFIERS.shift | LOCK_MASK;

export function decodeKittyPrintable(data: string): string | undefined {
    const match: RegExpMatchArray | null = data.match(KITTY_CSI_U_REGEX);
    if (!match)
        return undefined;
    const codepoint: number = Number.parseInt(match[1] ?? "", 10);
    if (!Number.isFinite(codepoint))
        return undefined;
    const shiftedKey: number | undefined = match[2] && match[2].length > 0 ? Number.parseInt(match[2], 10) : undefined;
    const modValue: number = match[4] ? Number.parseInt(match[4], 10) : 1;
    const modifier: number = Number.isFinite(modValue) ? modValue - 1 : 0;
    if ((modifier & ~KITTY_PRINTABLE_ALLOWED_MODIFIERS) !== 0)
        return undefined;
    if (modifier & (MODIFIERS.alt | MODIFIERS.ctrl))
        return undefined;
    let effectiveCodepoint: number = codepoint;
    if (modifier & MODIFIERS.shift && typeof shiftedKey === "number") {
        effectiveCodepoint = shiftedKey;
    }
    effectiveCodepoint = normalizeKittyFunctionalCodepoint(effectiveCodepoint);
    if (!Number.isFinite(effectiveCodepoint) || effectiveCodepoint < 32)
        return undefined;
    try {
        return String.fromCodePoint(effectiveCodepoint);
    }
    catch {
        return undefined;
    }
}
