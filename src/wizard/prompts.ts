export type WizardSelectOption<T = string> = {
  value: T;
  label: string;
  hint?: string;
};

export type WizardSelectParams<T = string> = {
  message: string;
  options: Array<WizardSelectOption<T>>;
  initialValue?: T;
};

export type WizardMultiSelectParams<T = string> = {
  message: string;
  options: Array<WizardSelectOption<T>>;
  initialValues?: T[];
  searchable?: boolean;
};

export type WizardTextParams = {
  message: string;
  initialValue?: string;
  placeholder?: string;
  validate?: (value: string) => string | undefined;
};

export type WizardConfirmParams = {
  message: string;
  initialValue?: boolean;
};

export type WizardProgress = {
  update: (message: string) => void;
  stop: (message?: string) => void;
};

/** `showValidationErrors` 中显示的单个验证问题。 */
export type WizardValidationIssue = {
  /** 问题关联的点分隔配置路径（例如 "gateway.auth.mode"）。 */
  path: string;
  message: string;
  /** "error" 阻止继续；"conflict" 为互斥对；"warning" 为建议。 */
  severity: "error" | "conflict" | "warning";
};

/** `showConfigDiff` 中显示的配置变更前后差异条目。 */
export type WizardConfigDiffEntry = {
  path: string;
  before: unknown;
  after: unknown;
};

export type WizardPrompter = {
  intro: (title: string) => Promise<void>;
  outro: (message: string) => Promise<void>;
  note: (message: string, title?: string) => Promise<void>;
  select: <T>(params: WizardSelectParams<T>) => Promise<T>;
  multiselect: <T>(params: WizardMultiSelectParams<T>) => Promise<T[]>;
  text: (params: WizardTextParams) => Promise<string>;
  confirm: (params: WizardConfirmParams) => Promise<boolean>;
  progress: (label: string) => WizardProgress;
  /** 按严重性分组显示结构化验证问题。 */
  showValidationErrors: (issues: WizardValidationIssue[], title?: string) => Promise<void>;
  /** 显示配置变更前后差异供用户审核。 */
  showConfigDiff: (entries: WizardConfigDiffEntry[], title?: string) => Promise<void>;
};

export class WizardCancelledError extends Error {
  constructor(message = "向导已取消") {
    super(message);
    this.name = "WizardCancelledError";
  }
}
