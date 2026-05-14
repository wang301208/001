// ANSI 转义序列的正则模式（从字符串构建，以
// 满足 no-control-regex lint 规则）。
const SGR_PATTERN = "\\x1b\\[[0-9;]*m";
const OSC8_PATTERN = "\\x1b\\]8;;.*?(?:\\x07|\\x1b\\\\)";
const ANSI_RE = new RegExp(`${SGR_PATTERN}|${OSC8_PATTERN}`, "g");
const SGR_START_RE = new RegExp(`^${SGR_PATTERN}`);
const OSC8_START_RE = new RegExp(`^${OSC8_PATTERN}`);

/** 用 OSC 8 终端超链接包裹文本。 */
export function wrapOsc8(url: string, text: string): string {
  return `\x1b]8;;${url}\x07${text}\x1b]8;;\x07`;
}

/**
 * 从原始 Markdown 文本中提取所有唯一 URL。
 * 同时查找裸 URL 和 Markdown 链接地址 [text](url)。
 */
export function extractUrls(markdown: string): string[] {
  const urls = new Set<string>();

  // Markdown 链接地址：[text](url)，可选 <...> 和可选标题。
  const mdLinkRe = /\[(?:[^\]]*)\]\(\s*<?(https?:\/\/[^)\s>]+)>?(?:\s+["'][^"']*["'])?\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = mdLinkRe.exec(markdown)) !== null) {
    urls.add(m[1]);
  }

  // 裸 URL（先移除 Markdown 链接以避免重复匹配）
  const stripped = markdown.replace(
    /\[(?:[^\]]*)\]\(\s*<?https?:\/\/[^)\s>]+>?(?:\s+["'][^"']*["'])?\s*\)/g,
    "",
  );
  const bareRe = /https?:\/\/[^\s)\]>]+/g;
  while ((m = bareRe.exec(stripped)) !== null) {
    urls.add(m[0]);
  }

  return [...urls];
}

/** Strip ANSI SGR and OSC 8 sequences to get visible text. */
function stripAnsi(input: string): string {
  return input.replace(ANSI_RE, "");
}

interface UrlRange {
  start: number; // visible text start index
  end: number; // visible text end index (exclusive)
  url: string; // full URL to link to
}

/**
 * Find URL ranges in a line's visible text, handling cross-line URL splits.
 */
function findUrlRanges(
  visibleText: string,
  knownUrls: string[],
  pending: { url: string; consumed: number } | null,
): { ranges: UrlRange[]; pending: { url: string; consumed: number } | null } {
  const ranges: UrlRange[] = [];
  let newPending: { url: string; consumed: number } | null = null;
  let searchFrom = 0;

  // 处理从上一行断开的 URL 延续
  if (pending) {
    const remaining = pending.url.slice(pending.consumed);
    const trimmed = visibleText.trimStart();
    const leadingSpaces = visibleText.length - trimmed.length;

    let matchLen = 0;
    for (let j = 0; j < remaining.length && j < trimmed.length; j++) {
      if (remaining[j] === trimmed[j]) {
        matchLen++;
      } else {
        break;
      }
    }

    if (matchLen > 0) {
      ranges.push({
        start: leadingSpaces,
        end: leadingSpaces + matchLen,
        url: pending.url,
      });
      searchFrom = leadingSpaces + matchLen;

      if (pending.consumed + matchLen < pending.url.length) {
        newPending = { url: pending.url, consumed: pending.consumed + matchLen };
      }
    }
  }

  // 在可见文本中查找新 URL 起点
  const urlRe = /https?:\/\/[^\s)\]>]+/g;
  urlRe.lastIndex = searchFrom;
  let match: RegExpExecArray | null;

  while ((match = urlRe.exec(visibleText)) !== null) {
    const fragment = match[0];
    const start = match.index;

    // 将片段解析为已知 URL（精确 > 前缀 > 超串）
    let resolvedUrl = fragment;
    let found = false;

    for (const known of knownUrls) {
      if (known === fragment) {
        resolvedUrl = known;
        found = true;
        break;
      }
    }
    if (!found) {
      let bestLen = 0;
      for (const known of knownUrls) {
        if (known.startsWith(fragment) && known.length > bestLen) {
          resolvedUrl = known;
          bestLen = known.length;
          found = true;
        }
      }
    }
    if (!found) {
      let bestLen = 0;
      for (const known of knownUrls) {
        if (fragment.startsWith(known) && known.length > bestLen) {
          resolvedUrl = known;
          bestLen = known.length;
        }
      }
    }

    ranges.push({ start, end: start + fragment.length, url: resolvedUrl });

    // 如果片段是解析 URL 的严格前缀，它可能被分行
    if (resolvedUrl.length > fragment.length && resolvedUrl.startsWith(fragment)) {
      newPending = { url: resolvedUrl, consumed: fragment.length };
    }
  }

  return { ranges, pending: newPending };
}

/**
 * 基于可见文本 URL 范围，对一行应用 OSC 8 超链接序列。
 * 逐字符遍历原始字符串，在 URL 范围边界插入 OSC 8
 * 开/关序列，同时保留 ANSI 代码。
 */
function applyOsc8Ranges(line: string, ranges: UrlRange[]): string {
  if (ranges.length === 0) {
    return line;
  }

  // 构建查找表：可见位置 → URL
  const urlAt = new Map<number, string>();
  for (const r of ranges) {
    for (let p = r.start; p < r.end; p++) {
      urlAt.set(p, r.url);
    }
  }

  let result = "";
  let visiblePos = 0;
  let activeUrl: string | null = null;
  let i = 0;

  while (i < line.length) {
    // 快速路径：仅在遇到 ESC 时检查转义序列
    if (line.charCodeAt(i) === 0x1b) {
      // ANSI SGR 序列
      const sgr = line.slice(i).match(SGR_START_RE);
      if (sgr) {
        result += sgr[0];
        i += sgr[0].length;
        continue;
      }

      // 已有 OSC 8 序列（直接传递）
      const osc = line.slice(i).match(OSC8_START_RE);
      if (osc) {
        result += osc[0];
        i += osc[0].length;
        continue;
      }
    }

    // 可见字符 — 在范围边界切换 OSC 8
    const targetUrl = urlAt.get(visiblePos) ?? null;
    if (targetUrl !== activeUrl) {
      if (activeUrl !== null) {
        result += "\x1b]8;;\x07";
      }
      if (targetUrl !== null) {
        result += `\x1b]8;;${targetUrl}\x07`;
      }
      activeUrl = targetUrl;
    }

    result += line[i];
    visiblePos++;
    i++;
  }

  if (activeUrl !== null) {
    result += "\x1b]8;;\x07";
  }

  return result;
}

/**
 * Add OSC 8 hyperlinks to rendered lines using a pre-extracted URL list.
 *
 * For each line, finds URL-like substrings in the visible text, matches them
 * against known URLs, and wraps each fragment with OSC 8 escape sequences.
 * Handles URLs broken across multiple lines by pi-tui's word wrapping.
 */
export function addOsc8Hyperlinks(lines: string[], urls: string[]): string[] {
  if (urls.length === 0) {
    return lines;
  }

  let pending: { url: string; consumed: number } | null = null;

  return lines.map((line) => {
    const visible = stripAnsi(line);
    const result = findUrlRanges(visible, urls, pending);
    pending = result.pending;
    return applyOsc8Ranges(line, result.ranges);
  });
}
