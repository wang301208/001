import { Container, Spacer, Text } from "@mariozechner/pi-tui";
import { theme } from "../theme/theme.js";
import { ZhushouMessageComponent } from "./zhushou-message.js";

type BtwInlineMessageParams = {
  question: string;
  text: string;
  isError?: boolean;
};

export class BtwInlineMessage extends Container {
  constructor(params: BtwInlineMessageParams) {
    super();
    this.setResult(params);
  }

  setResult(params: BtwInlineMessageParams) {
    this.clear();
    this.addChild(new Spacer(1));
    this.addChild(new Text(theme.header(`顺便问一下：${params.question}`), 1, 0));
    if (params.isError) {
      this.addChild(new Text(theme.error(params.text), 1, 0));
    } else {
      this.addChild(new ZhushouMessageComponent(params.text));
    }
    this.addChild(new Text(theme.dim("按 Enter 或 Esc 关闭"), 1, 0));
  }
}
