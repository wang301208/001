import { PRODUCT_NAME } from "../wizard/zhushou-constants.js";

const DEFAULT_TAGLINE = `所有对话，一个${PRODUCT_NAME}入口。`;
export type TaglineMode = "random" | "default" | "off";

const HOLIDAY_TAGLINES = {
  newYear:
    "元旦：新的任务入口已经就绪。",
  lunarNewYear:
    "春节：会话、任务与工具保持在线。",
  christmas:
    "圣诞节：助手终端已准备处理新的目标。",
  eid: "开斋节：任务队列已就绪。",
  diwali:
    "排灯节：日志、工具与会话保持清晰。",
  easter:
    "复活节：继续从上下文中恢复任务。",
  hanukkah:
    "光明节：网关、模型与会话保持可用。",
  halloween:
    "万圣节：异常会被记录并交给任务流处理。",
  thanksgiving:
    "感恩节：长期任务和短期任务都可继续推进。",
  valentines:
    "情人节：把目标交给助手即可。",
} as const;

const TAGLINES: string[] = [
  "本地终端已接入助手，输入目标即可执行。",
  "左侧显示身份与状态，右侧提供命令入口。",
  "网关在线，工具、技能与记忆可被自然语言调用。",
  "输入 /help 查看命令，或直接描述要完成的任务。",
  "长期任务、短期任务和会话上下文会持续记录。",
  "模型、代理、会话可随时切换。",
  "所有对话，一个助手入口。",
  "本地运行，面向任务，持续交付。",
  "把目标说清楚，助手会拆解、执行并反馈结果。",
  "任务队列已就绪。",
  "会话上下文已加载。",
  "工具输出会被折叠、展开并持续流式更新。",
  "自然语言是主入口，斜杠命令是快捷方式。",
  "当前终端已进入助手模式。",
  "技能、记忆、工具集会在任务中协同工作。",
  "配置、模型与网关状态可通过命令查看。",
  "执行前先理解目标，执行中持续反馈状态。",
  "上下文压缩会在长会话中自动介入。",
  "多代理任务会被拆分、排队和汇总。",
  "所有结果回到当前会话。",
  HOLIDAY_TAGLINES.newYear,
  HOLIDAY_TAGLINES.lunarNewYear,
  HOLIDAY_TAGLINES.christmas,
  HOLIDAY_TAGLINES.eid,
  HOLIDAY_TAGLINES.diwali,
  HOLIDAY_TAGLINES.easter,
  HOLIDAY_TAGLINES.hanukkah,
  HOLIDAY_TAGLINES.halloween,
  HOLIDAY_TAGLINES.thanksgiving,
  HOLIDAY_TAGLINES.valentines,
];

type HolidayRule = (date: Date) => boolean;

const DAY_MS = 24 * 60 * 60 * 1000;

function utcParts(date: Date) {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth(),
    day: date.getUTCDate(),
  };
}

const onMonthDay =
  (month: number, day: number): HolidayRule =>
  (date) => {
    const parts = utcParts(date);
    return parts.month === month && parts.day === day;
  };

const onSpecificDates =
  (dates: Array<[number, number, number]>, durationDays = 1): HolidayRule =>
  (date) => {
    const parts = utcParts(date);
    return dates.some(([year, month, day]) => {
      if (parts.year !== year) {
        return false;
      }
      const start = Date.UTC(year, month, day);
      const current = Date.UTC(parts.year, parts.month, parts.day);
      return current >= start && current < start + durationDays * DAY_MS;
    });
  };

const inYearWindow =
  (
    windows: Array<{
      year: number;
      month: number;
      day: number;
      duration: number;
    }>,
  ): HolidayRule =>
  (date) => {
    const parts = utcParts(date);
    const window = windows.find((entry) => entry.year === parts.year);
    if (!window) {
      return false;
    }
    const start = Date.UTC(window.year, window.month, window.day);
    const current = Date.UTC(parts.year, parts.month, parts.day);
    return current >= start && current < start + window.duration * DAY_MS;
  };

const isFourthThursdayOfNovember: HolidayRule = (date) => {
  const parts = utcParts(date);
  if (parts.month !== 10) {
    return false;
  } // November
  const firstDay = new Date(Date.UTC(parts.year, 10, 1)).getUTCDay();
  const offsetToThursday = (4 - firstDay + 7) % 7; // 4 = Thursday
  const fourthThursday = 1 + offsetToThursday + 21; // 1st + offset + 3 weeks
  return parts.day === fourthThursday;
};

const HOLIDAY_RULES = new Map<string, HolidayRule>([
  [HOLIDAY_TAGLINES.newYear, onMonthDay(0, 1)],
  [
    HOLIDAY_TAGLINES.lunarNewYear,
    onSpecificDates(
      [
        [2025, 0, 29],
        [2026, 1, 17],
        [2027, 1, 6],
      ],
      1,
    ),
  ],
  [
    HOLIDAY_TAGLINES.eid,
    onSpecificDates(
      [
        [2025, 2, 30],
        [2025, 2, 31],
        [2026, 2, 20],
        [2027, 2, 10],
      ],
      1,
    ),
  ],
  [
    HOLIDAY_TAGLINES.diwali,
    onSpecificDates(
      [
        [2025, 9, 20],
        [2026, 10, 8],
        [2027, 9, 28],
      ],
      1,
    ),
  ],
  [
    HOLIDAY_TAGLINES.easter,
    onSpecificDates(
      [
        [2025, 3, 20],
        [2026, 3, 5],
        [2027, 2, 28],
      ],
      1,
    ),
  ],
  [
    HOLIDAY_TAGLINES.hanukkah,
    inYearWindow([
      { year: 2025, month: 11, day: 15, duration: 8 },
      { year: 2026, month: 11, day: 5, duration: 8 },
      { year: 2027, month: 11, day: 25, duration: 8 },
    ]),
  ],
  [HOLIDAY_TAGLINES.halloween, onMonthDay(9, 31)],
  [HOLIDAY_TAGLINES.thanksgiving, isFourthThursdayOfNovember],
  [HOLIDAY_TAGLINES.valentines, onMonthDay(1, 14)],
  [HOLIDAY_TAGLINES.christmas, onMonthDay(11, 25)],
]);

function isTaglineActive(tagline: string, date: Date): boolean {
  const rule = HOLIDAY_RULES.get(tagline);
  if (!rule) {
    return true;
  }
  return rule(date);
}

export interface TaglineOptions {
  env?: NodeJS.ProcessEnv;
  random?: () => number;
  now?: () => Date;
  mode?: TaglineMode;
}

export function activeTaglines(options: TaglineOptions = {}): string[] {
  if (TAGLINES.length === 0) {
    return [DEFAULT_TAGLINE];
  }
  const today = options.now ? options.now() : new Date();
  const filtered = TAGLINES.filter((tagline) => isTaglineActive(tagline, today));
  return filtered.length > 0 ? filtered : TAGLINES;
}

export function pickTagline(options: TaglineOptions = {}): string {
  if (options.mode === "off") {
    return "";
  }
  if (options.mode === "default") {
    return DEFAULT_TAGLINE;
  }
  const env = options.env ?? process.env;
  const override = env?.ZHUSHOU_TAGLINE_INDEX;
  if (override !== undefined) {
    const parsed = Number.parseInt(override, 10);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      const pool = TAGLINES.length > 0 ? TAGLINES : [DEFAULT_TAGLINE];
      return pool[parsed % pool.length];
    }
  }
  const pool = activeTaglines(options);
  const rand = options.random ?? Math.random;
  const index = Math.floor(rand() * pool.length) % pool.length;
  return pool[index];
}

export { TAGLINES, HOLIDAY_RULES, DEFAULT_TAGLINE };
