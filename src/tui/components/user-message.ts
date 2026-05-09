import { theme } from "../theme/theme.js";
import { MarkdownMessageComponent } from "./markdown-message.js";

export class UserMessageComponent extends MarkdownMessageComponent {
  constructor(text: string) {
    super(`${theme.prompt(">")} ${text}`, 1, {
      color: (line) => theme.userText(line),
    });
  }
}
