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

/** An individual validation issue shown in `showValidationErrors`. */
export type WizardValidationIssue = {
  /** Dot-separated config path the issue relates to (e.g. "gateway.auth.mode"). */
  path: string;
  message: string;
  /** "error" blocks continuation; "conflict" is a mutually-exclusive pair; "warning" is advisory. */
  severity: "error" | "conflict" | "warning";
};

/** A before/after config diff entry shown in `showConfigDiff`. */
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
  /** Display structured validation issues grouped by severity. */
  showValidationErrors: (issues: WizardValidationIssue[], title?: string) => Promise<void>;
  /** Display a before/after diff of config changes for user review. */
  showConfigDiff: (entries: WizardConfigDiffEntry[], title?: string) => Promise<void>;
};

export class WizardCancelledError extends Error {
  constructor(message = "wizard cancelled") {
    super(message);
    this.name = "WizardCancelledError";
  }
}
