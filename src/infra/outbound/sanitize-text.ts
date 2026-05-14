/**
 * 为纯文本消息界面消毒模型输出。
 *
 * LLM 偶尔会生成 HTML 标签（`<br>`、`<b>`、`<i>` 等），这些标签
 * 在 Web 上渲染正确，但在 WhatsApp、Signal、SMS 和 IRC 上显示为字面文本。
 *
 * 将常见的内联 HTML 转换为 WhatsApp/Signal/Telegram 使用的轻量标记
 * 等价形式，并剥离其余标签。
 *
 * @see https://github.com/wang301208/zhushou/issues/31884
 * @see https://github.com/wang301208/zhushou/issues/18558
 */

/**
 * 将常见 HTML 标签转换为纯文本/轻量标记等价形式，
 * 并剥离其余所有标签。
 *
 * 此函数故意保守 — 仅针对已知模型会生成的标签，
 * 并避免对正常散文中的尖括号产生误判（例如 `a < b`）。
 */
export function sanitizeForPlainText(text: string): string {
  return (
    text
      // 在剥离标签前将尖括号自动链接保留为纯 URL。
      .replace(/<((?:https?:\/\/|mailto:)[^<>\s]+)>/gi, "$1")
      // 换行
      .replace(/<br\s*\/?>/gi, "\n")
      // 块元素 → 换行
      .replace(/<\/?(p|div)>/gi, "\n")
      // 粗体 → WhatsApp/Signal 粗体
      .replace(/<(b|strong)>(.*?)<\/\1>/gi, "*$2*")
      // 斜体 → WhatsApp/Signal 斜体
      .replace(/<(i|em)>(.*?)<\/\1>/gi, "_$2_")
      // 删除线 → WhatsApp/Signal 删除线
      .replace(/<(s|strike|del)>(.*?)<\/\1>/gi, "~$2~")
      // 行内代码
      .replace(/<code>(.*?)<\/code>/gi, "`$1`")
      // 标题 → 粗体文本加换行
      .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, "\n*$1*\n")
      // 列表项 → 项目符号
      .replace(/<li[^>]*>(.*?)<\/li>/gi, "• $1\n")
      // 剥离剩余 HTML 标签（要求标签式结构：<word...>）
      .replace(/<\/?[a-z][a-z0-9]*\b[^>]*>/gi, "")
      // 将 3 个及以上连续换行折叠为 2 个
      .replace(/\n{3,}/g, "\n\n")
  );
}
