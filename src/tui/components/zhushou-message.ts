import { Container, Spacer } from "@mariozechner/pi-tui";
import { markdownTheme, theme } from "../theme/theme.js";
import { HyperlinkMarkdown } from "./hyperlink-markdown.js";

export class ZhushouMessageComponent extends Container {
  private body: HyperlinkMarkdown;

  constructor(text: string) {
    super();
    this.body = new HyperlinkMarkdown(formatZhushouText(text), 0, 0, markdownTheme, {
      // Keep zhushou body text in terminal default foreground so contrast
      // follows the user's terminal theme (dark or light).
      color: (line) => theme.zhushouText(line),
    });
    this.addChild(new Spacer(1));
    this.addChild(this.body);
  }

  setText(text: string) {
    this.body.setText(formatZhushouText(text));
  }
}

function formatZhushouText(text: string) {
  return text.trim() ? `${theme.accent("-")} ${text}` : theme.dim("-");
}
