from __future__ import annotations

import json
import os
import queue
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path
from typing import Any, Callable

try:
    sys.stdin.reconfigure(encoding="utf-8")
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

DEFAULT_PROVIDER = "openai"
DEFAULT_MODEL = "gpt-5.4"
DEFAULT_CONTEXT_TOKENS = 200_000
MIN_CONTEXT_TOKENS = 128_000
DEFAULT_COMPACTION_RESERVE_TOKENS = 20_000
DEFAULT_COMPACTION_KEEP_RECENT_TOKENS = 8_000
MAX_COMPACTION_SUMMARY_CHARS = 1_200
MAX_COMPACTION_CHECKPOINTS = 20
DEFAULT_AGENT_ID = "main"
DEFAULT_MAIN_KEY = "main"
SESSION_VERSION = 1
REMOTE_MODEL_PROBE_TIMEOUT_SECONDS = 15
REMOTE_CHAT_TIMEOUT_SECONDS = 120
ALLOWED_AGENT_FILE_NAMES = {
    "AGENTS.md",
    "SOUL.md",
    "TOOLS.md",
    "IDENTITY.md",
    "USER.md",
    "HEARTBEAT.md",
    "BOOTSTRAP.md",
    "MEMORY.md",
    "memory.md",
}

active_chat_runs: dict[str, dict[str, Any]] = {}

CORE_TOOL_GROUPS = [
    {
        "id": "fs",
        "label": "Files",
        "tools": [
            {"id": "read", "label": "read", "description": "Read file contents"},
            {"id": "write", "label": "write", "description": "Create or overwrite files"},
            {"id": "edit", "label": "edit", "description": "Make precise edits"},
            {"id": "apply_patch", "label": "apply_patch", "description": "Patch files"},
        ],
    },
    {
        "id": "runtime",
        "label": "Runtime",
        "tools": [
            {"id": "exec", "label": "exec", "description": "Run terminal commands"},
            {"id": "process", "label": "process", "description": "Manage long-running processes"},
            {"id": "code_execution", "label": "code_execution", "description": "Run sandboxed analysis"},
        ],
    },
    {
        "id": "web",
        "label": "Web",
        "tools": [
            {"id": "web_search", "label": "web_search", "description": "Search the web"},
            {"id": "web_fetch", "label": "web_fetch", "description": "Fetch web content"},
            {"id": "x_search", "label": "x_search", "description": "Search X posts"},
        ],
    },
    {
        "id": "memory",
        "label": "Memory",
        "tools": [
            {"id": "memory_search", "label": "memory_search", "description": "Search persistent memory"},
            {"id": "memory_get", "label": "memory_get", "description": "Read memory entries"},
        ],
    },
    {
        "id": "models",
        "label": "Models",
        "tools": [
            {"id": "models_list", "label": "models_list", "description": "List configured models"},
            {"id": "models_remote_list", "label": "models_remote_list", "description": "Probe remote model endpoints"},
        ],
    },
    {
        "id": "config",
        "label": "Config",
        "tools": [
            {"id": "config_get", "label": "config_get", "description": "Read runtime configuration"},
            {"id": "config_patch", "label": "config_patch", "description": "Merge runtime configuration"},
            {"id": "logs_tail", "label": "logs_tail", "description": "Read recent backend log lines"},
        ],
    },
    {
        "id": "sessions",
        "label": "Sessions",
        "tools": [
            {"id": "sessions_list", "label": "sessions_list", "description": "List sessions"},
            {"id": "sessions_history", "label": "sessions_history", "description": "Read session history"},
            {"id": "sessions_send", "label": "sessions_send", "description": "Send a session message"},
            {"id": "sessions_spawn", "label": "sessions_spawn", "description": "Spawn a child session"},
            {"id": "sessions_yield", "label": "sessions_yield", "description": "Yield until subagents respond"},
            {"id": "subagents", "label": "subagents", "description": "Manage subagents"},
            {"id": "session_status", "label": "session_status", "description": "Inspect session status"},
        ],
    },
    {
        "id": "automation",
        "label": "Automation",
        "tools": [
            {"id": "cron", "label": "cron", "description": "Schedule recurring or delayed tasks"},
            {"id": "gateway", "label": "gateway", "description": "Call gateway RPC methods"},
        ],
    },
    {
        "id": "skills",
        "label": "Skills",
        "tools": [
            {"id": "skills_search", "label": "skills_search", "description": "Search installed and generated skills"},
            {"id": "skills_status", "label": "skills_status", "description": "Inspect skill system status"},
        ],
    },
    {
        "id": "experience",
        "label": "Experience",
        "tools": [
            {"id": "experience_capture", "label": "experience_capture", "description": "Capture durable experience"},
            {"id": "experience_search", "label": "experience_search", "description": "Search experience and transcripts"},
            {"id": "strategy_memory", "label": "strategy_memory", "description": "Manage strategic memory cadence"},
            {"id": "self_model", "label": "self_model", "description": "Maintain persistent self and user models"},
        ],
    },
    {
        "id": "mcp",
        "label": "MCP",
        "tools": [
            {"id": "mcp_tools_list", "label": "mcp_tools_list", "description": "Discover configured MCP tools"},
            {"id": "mcp_tools_call", "label": "mcp_tools_call", "description": "Call configured MCP tools"},
        ],
    },
    {
        "id": "tasks",
        "label": "Tasks",
        "tools": [
            {"id": "business_tasks", "label": "business_tasks", "description": "Manage task-center work items"},
        ],
    },
    {
        "id": "agents",
        "label": "Agents",
        "tools": [
            {"id": "agents_files", "label": "agents_files", "description": "Manage agent context files"},
            {"id": "governance", "label": "governance", "description": "Inspect governance state"},
            {"id": "autonomy", "label": "autonomy", "description": "Inspect autonomy state"},
            {"id": "agents_list", "label": "agents_list", "description": "List configured agents"},
            {"id": "update_plan", "label": "update_plan", "description": "Maintain task plan"},
        ],
    },
    {
        "id": "media",
        "label": "Media",
        "tools": [
            {"id": "image", "label": "image", "description": "Understand images"},
            {"id": "image_generate", "label": "image_generate", "description": "Generate images"},
            {"id": "music_generate", "label": "music_generate", "description": "Generate music"},
            {"id": "video_generate", "label": "video_generate", "description": "Generate video"},
            {"id": "tts", "label": "tts", "description": "Convert text to speech"},
        ],
    },
    {
        "id": "ui",
        "label": "UI",
        "tools": [
            {"id": "browser", "label": "browser", "description": "Control a browser"},
            {"id": "canvas", "label": "canvas", "description": "Control canvases"},
            {"id": "nodes", "label": "nodes", "description": "Invoke connected nodes and devices"},
            {"id": "message", "label": "message", "description": "Send external messages"},
        ],
    },
]


def write_frame(frame: dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(frame, ensure_ascii=False, separators=(",", ":")) + "\n")
    sys.stdout.flush()


def emit_event(type_: str, payload: dict[str, Any] | None = None) -> None:
    write_frame(
        {
            "jsonrpc": "2.0",
            "method": "event",
            "params": {
                "type": type_,
                "payload": payload or {},
            },
        }
    )


def log_stderr(message: str) -> None:
    print(f"[tui-gateway] {message}", file=sys.stderr, flush=True)


def as_record(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def as_string(value: Any) -> str:
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, (int, float)):
        return str(value).strip()
    return ""


def require_string(value: Any, label: str) -> str:
    normalized = as_string(value)
    if not normalized:
        raise ValueError(f"{label} is required")
    return normalized


def normalize_token(value: Any, fallback: str = "") -> str:
    raw = as_string(value).lower()
    normalized = []
    previous_dash = False
    for ch in raw:
        if ch.isalnum() or ch in {"_", "-"}:
            normalized.append(ch)
            previous_dash = False
        else:
            if not previous_dash:
                normalized.append("-")
                previous_dash = True
    text = "".join(normalized).strip("-_")
    return (text[:64] if text else fallback) or fallback


def normalize_agent_id(value: Any = None) -> str:
    return normalize_token(value, DEFAULT_AGENT_ID)


def normalize_main_key(value: Any = None) -> str:
    return normalize_token(value, DEFAULT_MAIN_KEY)


def parse_agent_session_key(key: str) -> tuple[str, str] | None:
    if not key.startswith("agent:"):
        return None
    parts = key.split(":", 2)
    if len(parts) != 3 or not parts[1] or not parts[2]:
        return None
    return normalize_agent_id(parts[1]), parts[2].strip().lower()


def canonical_session_key(key: str, agent_id: str | None = None, main_key: str | None = None) -> str:
    raw = as_string(key).lower()
    parsed = parse_agent_session_key(raw)
    if parsed:
        return f"agent:{parsed[0]}:{parsed[1]}"
    if not raw or raw == DEFAULT_MAIN_KEY:
        return f"agent:{normalize_agent_id(agent_id)}:{normalize_main_key(main_key)}"
    return f"agent:{normalize_agent_id(agent_id)}:{raw}"


def home_dir() -> Path:
    override = os.environ.get("ASSISTANT_HOME") or os.environ.get("HOME") or os.environ.get("USERPROFILE")
    return Path(override).expanduser() if override else Path.home()


def state_dir() -> Path:
    override = os.environ.get("ASSISTANT_STATE_DIR")
    return Path(override).expanduser().resolve() if override else home_dir() / ".assistant"


def config_path() -> Path:
    override = os.environ.get("ASSISTANT_CONFIG_PATH")
    return Path(override).expanduser().resolve() if override else state_dir() / "assistant.json"


def experience_path() -> Path:
    return state_dir() / "experience" / "experience.json"


def cron_store_path() -> Path:
    return state_dir() / "cron" / "jobs.json"


def business_tasks_path() -> Path:
    return state_dir() / "tasks" / "business-tasks.json"


def parallel_batches_path() -> Path:
    return state_dir() / "agents" / "parallel-batches.json"


def log_path() -> Path:
    return state_dir() / "logs" / "assistant.log"


def generated_skills_dir() -> Path:
    return state_dir() / "skills" / "generated"


def read_json_file(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8-sig"))
    except FileNotFoundError:
        return default
    except Exception as exc:
        log_stderr(f"failed to read {path}: {exc}")
        return default


def write_json_file(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f".{path.name}.{uuid.uuid4().hex}.tmp")
    tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(tmp, path)
    try:
        path.chmod(0o600)
    except OSError:
        pass


def load_config() -> dict[str, Any]:
    cfg = read_json_file(config_path(), {})
    return cfg if isinstance(cfg, dict) else {}


def save_config(cfg: dict[str, Any]) -> None:
    write_json_file(config_path(), cfg)


def append_log(message: str) -> None:
    try:
        path = log_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        timestamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        with path.open("a", encoding="utf-8") as fh:
            fh.write(f"{timestamp} {message}\n")
    except Exception:
        pass


def default_experience_state() -> dict[str, Any]:
    return {
        "version": 1,
        "events": [],
        "skillCandidates": [],
        "skillUsage": [],
        "strategicMemories": [],
        "selfModel": {
            "strengths": [],
            "weaknesses": [],
            "preferences": [],
            "learnedPatterns": [],
            "nextGrowthAreas": [],
            "evidenceEventIds": [],
            "updatedAt": 0,
        },
        "userModel": {
            "preferences": [],
            "goals": [],
            "communicationStyle": [],
            "constraints": [],
            "contradictions": [],
            "evidenceEventIds": [],
            "updatedAt": 0,
        },
    }


def load_experience_state() -> dict[str, Any]:
    state = read_json_file(experience_path(), default_experience_state())
    base = default_experience_state()
    if not isinstance(state, dict):
        return base
    for key, value in base.items():
        if key not in state:
            state[key] = value
    for key in ("events", "skillCandidates", "skillUsage", "strategicMemories"):
        if not isinstance(state.get(key), list):
            state[key] = []
    if not isinstance(state.get("selfModel"), dict):
        state["selfModel"] = base["selfModel"]
    if not isinstance(state.get("userModel"), dict):
        state["userModel"] = base["userModel"]
    return state


def save_experience_state(state: dict[str, Any]) -> None:
    write_json_file(experience_path(), state)


def load_cron_store() -> dict[str, Any]:
    store = read_json_file(cron_store_path(), {"version": 1, "jobs": []})
    if not isinstance(store, dict):
        return {"version": 1, "jobs": []}
    if not isinstance(store.get("jobs"), list):
        store["jobs"] = []
    store["version"] = 1
    return store


def save_cron_store(store: dict[str, Any]) -> None:
    write_json_file(cron_store_path(), store)


def load_business_tasks_store() -> dict[str, Any]:
    store = read_json_file(business_tasks_path(), {"version": 1, "tasks": []})
    if not isinstance(store, dict):
        return {"version": 1, "tasks": []}
    if not isinstance(store.get("tasks"), list):
        store["tasks"] = []
    store["version"] = 1
    return store


def save_business_tasks_store(store: dict[str, Any]) -> None:
    write_json_file(business_tasks_path(), store)


def load_parallel_batches_store() -> dict[str, Any]:
    store = read_json_file(parallel_batches_path(), {"version": 1, "batches": []})
    if not isinstance(store, dict):
        return {"version": 1, "batches": []}
    if not isinstance(store.get("batches"), list):
        store["batches"] = []
    store["version"] = 1
    return store


def save_parallel_batches_store(store: dict[str, Any]) -> None:
    write_json_file(parallel_batches_path(), store)


def now_ms() -> int:
    return int(time.time() * 1000)


def create_id(prefix: str) -> str:
    return f"{prefix}_{now_ms()}_{uuid.uuid4().hex[:8]}"


def normalize_string_array(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    seen: set[str] = set()
    out: list[str] = []
    for item in value:
        text = as_string(item)
        if not text:
            continue
        key = text.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(text)
    return out


def merge_string_arrays(existing: Any, incoming: Any) -> list[str]:
    return normalize_string_array((existing if isinstance(existing, list) else []) + (incoming if isinstance(incoming, list) else []))


def score_text(query_terms: list[str], text: str) -> int:
    lower = text.lower()
    score = 0
    for term in query_terms:
        if term and term in lower:
            score += 2 if len(term) > 2 else 1
    if query_terms and " ".join(query_terms) in lower:
        score += 4
    return score


def tokenize_query(query: str) -> list[str]:
    return list(dict.fromkeys(part.strip().lower() for part in query.split() if part.strip()))


def slugify(value: str, fallback: str = "assistant-skill") -> str:
    chars: list[str] = []
    dash = False
    for ch in value.lower():
        if ch.isalnum():
            chars.append(ch)
            dash = False
        elif not dash:
            chars.append("-")
            dash = True
    slug = "".join(chars).strip("-")[:48]
    return slug or fallback


def normalize_skill_step(value: str) -> str:
    text = " ".join(value.strip().split())
    if not text:
        return ""
    return text[0].upper() + text[1:] if not text[0].isupper() else text


def normalize_status(value: Any, allowed: set[str], fallback: str) -> str:
    text = as_string(value).lower()
    return text if text in allowed else fallback


def normalize_int(value: Any, fallback: int, minimum: int | None = None, maximum: int | None = None) -> int:
    if isinstance(value, bool):
        parsed = fallback
    elif isinstance(value, (int, float)):
        parsed = int(value)
    elif isinstance(value, str):
        try:
            parsed = int(value.strip())
        except ValueError:
            parsed = fallback
    else:
        parsed = fallback
    if minimum is not None:
        parsed = max(minimum, parsed)
    if maximum is not None:
        parsed = min(maximum, parsed)
    return parsed


def is_complex_task_event(event: dict[str, Any]) -> bool:
    tags = [as_string(tag).lower() for tag in event.get("tags", []) if as_string(tag)]
    haystack = " ".join(
        [as_string(event.get("kind")), as_string(event.get("summary")), as_string(event.get("outcome"))]
        + [as_string(item) for item in event.get("evidence", [])]
    ).lower()
    return (
        event.get("kind") == "complex_task"
        or "complex-task" in tags
        or "skill-worthy" in tags
        or len(event.get("evidence", [])) >= 3
        or any(token in haystack for token in ["complex", "multi-step", "root cause", "verified", "修复", "验证"])
    )


def list_transcript_files() -> list[Path]:
    root = state_dir() / "agents"
    if not root.exists():
        return []
    return [path for path in root.rglob("*.jsonl") if path.is_file()]


def transcript_text_rows(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    try:
        for index, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
            if not line.strip():
                continue
            try:
                parsed = json.loads(line)
            except json.JSONDecodeError:
                continue
            message = as_record(parsed.get("message"))
            text = extract_text(message.get("content"))
            if text:
                rows.append(
                    {
                        "id": f"{path}:{index}",
                        "path": str(path),
                        "role": as_string(message.get("role")) or None,
                        "text": " ".join(text.split()),
                        "createdAt": parsed.get("timestamp"),
                    }
                )
    except Exception as exc:
        log_stderr(f"failed to scan transcript {path}: {exc}")
    return rows


def list_agent_entries(cfg: dict[str, Any]) -> list[dict[str, Any]]:
    agents = as_record(cfg.get("agents")).get("list")
    if not isinstance(agents, list):
        return []
    return [entry for entry in agents if isinstance(entry, dict)]


def resolve_default_agent_id(cfg: dict[str, Any]) -> str:
    agents = list_agent_entries(cfg)
    if not agents:
        return DEFAULT_AGENT_ID
    default = next((agent for agent in agents if agent.get("default") is True), None) or agents[0]
    return normalize_agent_id(default.get("id"))


def list_agents(cfg: dict[str, Any]) -> list[dict[str, Any]]:
    agents = list_agent_entries(cfg)
    if not agents:
        return [{"id": DEFAULT_AGENT_ID, "name": "助手"}]
    seen: set[str] = set()
    rows: list[dict[str, Any]] = []
    for entry in agents:
        agent_id = normalize_agent_id(entry.get("id"))
        if agent_id in seen:
            continue
        seen.add(agent_id)
        rows.append({"id": agent_id, "name": as_string(entry.get("name")) or agent_id})
    return rows or [{"id": DEFAULT_AGENT_ID, "name": "助手"}]


def session_scope(cfg: dict[str, Any]) -> str:
    raw = as_record(cfg.get("session")).get("scope")
    return raw if raw in {"per-sender", "global"} else "per-sender"


def session_main_key(cfg: dict[str, Any]) -> str:
    return normalize_main_key(as_record(cfg.get("session")).get("mainKey"))


def resolve_store_path(cfg: dict[str, Any], agent_id: str | None = None) -> Path:
    store = as_record(cfg.get("session")).get("store")
    resolved_agent = normalize_agent_id(agent_id)
    if isinstance(store, str) and store.strip():
        raw = store.replace("{agentId}", resolved_agent)
        return Path(raw).expanduser().resolve()
    return state_dir() / "agents" / resolved_agent / "sessions" / "sessions.json"


def agent_workspace_dir(agent_id: str | None = None) -> Path:
    cfg = load_config()
    normalized = normalize_agent_id(agent_id)
    for agent in list_agent_entries(cfg):
        if normalize_agent_id(agent.get("id")) != normalized:
            continue
        workspace = as_string(agent.get("workspace"))
        if workspace:
            return Path(workspace).expanduser().resolve()
    return state_dir() / "agents" / normalized / "workspace"


def load_store(path: Path) -> dict[str, Any]:
    store = read_json_file(path, {})
    return store if isinstance(store, dict) else {}


def save_store(path: Path, store: dict[str, Any]) -> None:
    write_json_file(path, store)


def resolve_default_model(cfg: dict[str, Any], agent_id: str | None = None) -> dict[str, Any]:
    agent_model = ""
    normalized_agent = normalize_agent_id(agent_id)
    for agent in list_agent_entries(cfg):
        if normalize_agent_id(agent.get("id")) == normalized_agent:
            raw_model = agent.get("model")
            if isinstance(raw_model, str):
                agent_model = raw_model.strip()
            elif isinstance(raw_model, dict):
                agent_model = as_string(raw_model.get("primary"))
            break
    defaults = as_record(as_record(cfg.get("agents")).get("defaults"))
    raw_default_model = defaults.get("model")
    if isinstance(raw_default_model, str):
        configured_model = raw_default_model.strip()
    elif isinstance(raw_default_model, dict):
        configured_model = as_string(raw_default_model.get("primary"))
    else:
        configured_model = ""
    model = agent_model or configured_model or DEFAULT_MODEL
    if "/" in model:
        provider, model_id = model.split("/", 1)
        return {"provider": provider or DEFAULT_PROVIDER, "model": model_id or DEFAULT_MODEL}
    providers = as_record(as_record(cfg.get("models")).get("providers"))
    for provider_id, provider_cfg in providers.items():
        models = as_record(provider_cfg).get("models")
        if not isinstance(models, list):
            continue
        for entry in models:
            model_id = entry if isinstance(entry, str) else as_record(entry).get("id")
            if as_string(model_id).lower() == model.lower():
                return {"provider": provider_id, "model": model}
    first_provider = next(iter(providers.items()), None)
    if first_provider:
        provider_id, provider_cfg = first_provider
        models = as_record(provider_cfg).get("models")
        if isinstance(models, list) and models:
            first_model = models[0]
            model_id = first_model if isinstance(first_model, str) else as_record(first_model).get("id")
            if as_string(model_id):
                return {"provider": provider_id, "model": as_string(model_id)}
    return {"provider": DEFAULT_PROVIDER, "model": model}


def resolve_session_model(cfg: dict[str, Any], entry: dict[str, Any] | None, agent_id: str) -> dict[str, Any]:
    default = resolve_default_model(cfg, agent_id)
    if entry:
        provider_override = as_string(entry.get("providerOverride"))
        model_override = as_string(entry.get("modelOverride"))
        runtime_provider = as_string(entry.get("modelProvider"))
        runtime_model = as_string(entry.get("model"))
        if model_override:
            return {"provider": provider_override or default["provider"], "model": model_override}
        if runtime_model:
            return {"provider": runtime_provider or default["provider"], "model": runtime_model}
    return default


def resolve_context_tokens(cfg: dict[str, Any], provider: str, model: str, entry: dict[str, Any] | None = None) -> int:
    def normalize(tokens: int | float) -> int:
        return max(MIN_CONTEXT_TOKENS, int(tokens))

    existing = entry.get("contextTokens") if entry else None
    if isinstance(existing, (int, float)) and existing > 0:
        return normalize(existing)
    defaults = as_record(as_record(cfg.get("agents")).get("defaults"))
    configured = defaults.get("contextTokens")
    if isinstance(configured, (int, float)) and configured > 0:
        return normalize(configured)
    provider_cfg = as_record(as_record(cfg.get("models")).get("providers")).get(provider)
    models = as_record(provider_cfg).get("models")
    if isinstance(models, list):
        for item in models:
            model_entry = as_record(item)
            if as_string(model_entry.get("id")) == model:
                context = model_entry.get("contextTokens") or model_entry.get("contextWindow")
                if isinstance(context, (int, float)) and context > 0:
                    return normalize(context)
    return normalize(DEFAULT_CONTEXT_TOKENS)


def session_kind(key: str, entry: dict[str, Any]) -> str:
    if key == "global":
        return "global"
    chat_type = entry.get("chatType") or entry.get("channel")
    if chat_type in {"group", "channel"} or entry.get("groupChannel") or entry.get("space"):
        return "group"
    if key and key != "unknown":
        return "direct"
    return "unknown"


def extract_text(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            rec = as_record(item)
            text = rec.get("text")
            if isinstance(text, str):
                parts.append(text)
            elif isinstance(rec.get("thinking"), str):
                parts.append(rec["thinking"])
        return "\n".join(parts).strip()
    return ""


def positive_int(value: Any, fallback: int) -> int:
    if isinstance(value, bool):
        return fallback
    if isinstance(value, (int, float)) and value > 0:
        return int(value)
    if isinstance(value, str):
        try:
            parsed = int(value.strip())
            if parsed > 0:
                return parsed
        except ValueError:
            return fallback
    return fallback


def estimate_text_tokens(text: str) -> int:
    normalized = " ".join(text.split())
    if not normalized:
        return 0
    # Cheap local estimate: enough to drive stdio compaction without requiring a tokenizer.
    return max(1, (len(normalized) + 3) // 4)


def message_text(message: Any) -> str:
    rec = as_record(message)
    summary = rec.get("summary")
    if isinstance(summary, str) and summary.strip():
        return summary.strip()
    return extract_text(rec.get("content"))


def estimate_message_tokens(message: Any) -> int:
    rec = as_record(message)
    role = as_string(rec.get("role"))
    return estimate_text_tokens(message_text(message)) + (4 if role else 2)


def estimate_messages_tokens(messages: list[Any]) -> int:
    return sum(estimate_message_tokens(message) for message in messages)


def compaction_config(cfg: dict[str, Any], context_tokens: int) -> dict[str, int | bool]:
    defaults = as_record(as_record(cfg.get("agents")).get("defaults"))
    raw = as_record(defaults.get("compaction"))
    enabled = raw.get("enabled")
    if enabled is False:
        return {"enabled": False, "reserveTokens": 0, "keepRecentTokens": 0}
    reserve = positive_int(raw.get("reserveTokens"), DEFAULT_COMPACTION_RESERVE_TOKENS)
    keep_recent = positive_int(raw.get("keepRecentTokens"), DEFAULT_COMPACTION_KEEP_RECENT_TOKENS)
    # Keep the reserve meaningful for tiny test/dev context windows.
    reserve = min(reserve, max(1, context_tokens // 2))
    keep_recent = min(keep_recent, max(0, context_tokens - reserve))
    return {"enabled": True, "reserveTokens": reserve, "keepRecentTokens": keep_recent}


def build_compaction_summary(messages: list[Any]) -> str:
    lines = [f"自动压缩摘要：已压缩 {len(messages)} 条历史消息。"]
    for index, message in enumerate(messages[-12:], start=1):
        rec = as_record(message)
        role = as_string(rec.get("role")) or "unknown"
        text = message_text(message).replace("\n", " ").strip()
        if not text:
            continue
        lines.append(f"{index}. {role}: {text[:180]}")
    summary = "\n".join(lines).strip()
    if len(summary) > MAX_COMPACTION_SUMMARY_CHARS:
        summary = summary[: MAX_COMPACTION_SUMMARY_CHARS - 12].rstrip() + "\n...[已截断]"
    return summary or "自动压缩摘要：历史消息已压缩。"


def select_recent_messages(messages: list[Any], keep_recent_tokens: int) -> tuple[list[Any], list[Any]]:
    if keep_recent_tokens <= 0:
        return messages, []
    kept_reversed: list[Any] = []
    used = 0
    for message in reversed(messages):
        tokens = estimate_message_tokens(message)
        if kept_reversed and used + tokens > keep_recent_tokens:
            break
        if not kept_reversed and tokens > keep_recent_tokens:
            break
        kept_reversed.append(message)
        used += tokens
    recent = list(reversed(kept_reversed))
    compacted = messages[: max(0, len(messages) - len(recent))]
    return compacted, recent


def write_transcript_messages(path: Path, session_id: str, messages: list[Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    header = {
        "type": "session",
        "version": SESSION_VERSION,
        "id": session_id,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "cwd": os.getcwd(),
    }
    tmp = path.with_name(f".{path.name}.{uuid.uuid4().hex}.tmp")
    with tmp.open("w", encoding="utf-8") as fh:
        fh.write(json.dumps(header, ensure_ascii=False, separators=(",", ":")) + "\n")
        for message in messages:
            frame = {
                "type": "message",
                "id": str(uuid.uuid4()),
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "message": message,
            }
            fh.write(json.dumps(frame, ensure_ascii=False, separators=(",", ":")) + "\n")
    os.replace(tmp, path)
    try:
        path.chmod(0o600)
    except OSError:
        pass


def read_messages_from_transcript(session_file: Path, limit: int | None = None) -> list[Any]:
    if not session_file.exists():
        return []
    messages: list[Any] = []
    try:
        for line in session_file.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            try:
                parsed = json.loads(line)
            except json.JSONDecodeError:
                continue
            if isinstance(parsed, dict) and "message" in parsed:
                messages.append(parsed["message"])
    except Exception as exc:
        log_stderr(f"failed to read transcript {session_file}: {exc}")
    return messages[-limit:] if limit and limit > 0 else messages


def resolve_transcript_path(store_path: Path, entry: dict[str, Any]) -> Path:
    session_file = as_string(entry.get("sessionFile"))
    if session_file:
        candidate = Path(session_file)
        return candidate if candidate.is_absolute() else store_path.parent / session_file
    return store_path.parent / f"{entry['sessionId']}.jsonl"


def ensure_transcript_header(path: Path, session_id: str) -> None:
    if path.exists():
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    header = {
        "type": "session",
        "version": SESSION_VERSION,
        "id": session_id,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "cwd": os.getcwd(),
    }
    with path.open("w", encoding="utf-8") as fh:
        fh.write(json.dumps(header, ensure_ascii=False, separators=(",", ":")) + "\n")
    try:
        path.chmod(0o600)
    except OSError:
        pass


def append_transcript_message(store_path: Path, entry: dict[str, Any], message: dict[str, Any]) -> None:
    transcript_path = resolve_transcript_path(store_path, entry)
    entry["sessionFile"] = str(transcript_path)
    ensure_transcript_header(transcript_path, entry["sessionId"])
    frame = {
        "type": "message",
        "id": str(uuid.uuid4()),
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "message": message,
    }
    with transcript_path.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(frame, ensure_ascii=False, separators=(",", ":")) + "\n")


def maybe_compact_session(
    cfg: dict[str, Any],
    store_path: Path,
    store: dict[str, Any],
    canonical: str,
    entry: dict[str, Any],
    run_id: str,
    context_tokens: int,
) -> None:
    settings = compaction_config(cfg, context_tokens)
    if settings.get("enabled") is not True:
        return

    transcript_path = resolve_transcript_path(store_path, entry)
    messages = read_messages_from_transcript(transcript_path)
    tokens_before = estimate_messages_tokens(messages)
    reserve_tokens = int(settings.get("reserveTokens") or 0)
    threshold = max(1, context_tokens - reserve_tokens)
    if tokens_before <= threshold:
        entry["totalTokens"] = tokens_before
        entry["totalTokensFresh"] = True
        return

    emit_event(
        "agent",
        {
            "runId": run_id,
            "stream": "compaction",
            "data": {
                "phase": "start",
                "tokensBefore": tokens_before,
                "contextTokens": context_tokens,
                "reserveTokens": reserve_tokens,
            },
        },
    )
    compacted, recent = select_recent_messages(messages, int(settings.get("keepRecentTokens") or 0))
    summary = build_compaction_summary(compacted or messages)
    summary_message = {
        "role": "compactionSummary",
        "summary": summary,
        "content": [{"type": "text", "text": summary}],
        "timestamp": now_ms(),
    }
    next_messages = [summary_message, *recent] if compacted else [summary_message]
    tokens_after = estimate_messages_tokens(next_messages)
    if tokens_after > context_tokens:
        # Tiny context windows can be smaller than the summary plus metadata. Keep a terse boundary.
        summary = f"自动压缩摘要：已压缩 {len(messages)} 条历史消息。"
        summary_message = {
            "role": "compactionSummary",
            "summary": summary,
            "content": [{"type": "text", "text": summary}],
            "timestamp": now_ms(),
        }
        next_messages = [summary_message]
        tokens_after = estimate_messages_tokens(next_messages)

    checkpoint = {
        "id": f"compact_{now_ms()}_{uuid.uuid4().hex[:8]}",
        "createdAt": now_ms(),
        "summary": summary,
        "tokensBefore": tokens_before,
        "tokensAfter": tokens_after,
        "messageCount": len(messages),
        "compactedCount": len(compacted) if compacted else len(messages),
        "sessionFile": str(transcript_path),
    }
    checkpoints = entry.get("compactionCheckpoints")
    if not isinstance(checkpoints, list):
        checkpoints = []
    checkpoints.append(checkpoint)
    entry["compactionCheckpoints"] = checkpoints[-MAX_COMPACTION_CHECKPOINTS:]
    entry["compactionCount"] = int(entry.get("compactionCount") or 0) + 1
    entry["totalTokens"] = tokens_after
    entry["totalTokensFresh"] = True
    entry["updatedAt"] = now_ms()
    write_transcript_messages(transcript_path, as_string(entry.get("sessionId")), next_messages)
    store[canonical] = entry
    save_store(store_path, store)
    emit_event(
        "agent",
        {
            "runId": run_id,
            "stream": "compaction",
            "data": {
                "phase": "end",
                "tokensBefore": tokens_before,
                "tokensAfter": tokens_after,
                "compactedCount": checkpoint["compactedCount"],
                "compactionCount": entry["compactionCount"],
            },
        },
    )


def ensure_session(cfg: dict[str, Any], session_key: str) -> tuple[str, str, Path, dict[str, Any], dict[str, Any]]:
    default_agent = resolve_default_agent_id(cfg)
    canonical = canonical_session_key(session_key, default_agent, session_main_key(cfg))
    parsed = parse_agent_session_key(canonical)
    agent_id = parsed[0] if parsed else default_agent
    store_path = resolve_store_path(cfg, agent_id)
    store = load_store(store_path)
    entry = as_record(store.get(canonical)).copy()
    now = int(time.time() * 1000)
    if not entry.get("sessionId"):
        entry["sessionId"] = str(uuid.uuid4())
    entry["updatedAt"] = max(int(entry.get("updatedAt") or 0), now)
    store[canonical] = entry
    save_store(store_path, store)
    return canonical, agent_id, store_path, store, entry


def handle_status(_params: dict[str, Any]) -> dict[str, Any]:
    cfg = load_config()
    agents = list_agents(cfg)
    default_agent = resolve_default_agent_id(cfg)
    default_model = resolve_default_model(cfg, default_agent)
    store_path = resolve_store_path(cfg, default_agent)
    store = load_store(store_path)
    defaults = {
        "modelProvider": default_model["provider"],
        "model": default_model["model"],
        "contextTokens": resolve_context_tokens(cfg, default_model["provider"], default_model["model"]),
    }
    return {
        "ok": True,
        "transport": "stdio",
        "runtimeVersion": "python-tui-gateway",
        "gateway": {"mode": "embedded-python-stdio", "ready": True},
        "agents": {"defaultId": default_agent, "count": len(agents)},
        "sessions": {
            "paths": [str(store_path)],
            "count": len(store),
            "defaults": defaults,
            "recent": [],
        },
        "providerSummary": ["transport: stdin/stdout JSON-RPC", "runtime: Python tui_gateway.entry"],
    }


def handle_agents_list(_params: dict[str, Any]) -> dict[str, Any]:
    cfg = load_config()
    return {
        "defaultId": resolve_default_agent_id(cfg),
        "mainKey": session_main_key(cfg),
        "scope": session_scope(cfg),
        "agents": list_agents(cfg),
    }


def handle_sessions_list(params: dict[str, Any]) -> dict[str, Any]:
    cfg = load_config()
    default_agent = resolve_default_agent_id(cfg)
    agent_id = normalize_agent_id(params.get("agentId") or default_agent)
    store_path = resolve_store_path(cfg, agent_id)
    store = load_store(store_path)
    default_model = resolve_default_model(cfg, agent_id)
    defaults = {
        "modelProvider": default_model["provider"],
        "model": default_model["model"],
        "contextTokens": resolve_context_tokens(cfg, default_model["provider"], default_model["model"]),
    }
    rows: list[dict[str, Any]] = []
    for key, raw_entry in store.items():
        if not isinstance(raw_entry, dict):
            continue
        entry = raw_entry
        parsed = parse_agent_session_key(str(key))
        if parsed and parsed[0] != agent_id:
            continue
        model_ref = resolve_session_model(cfg, entry, agent_id)
        rows.append(
            {
                "key": key,
                "kind": session_kind(str(key), entry),
                "label": entry.get("label"),
                "displayName": entry.get("displayName"),
                "updatedAt": entry.get("updatedAt"),
                "sessionId": entry.get("sessionId"),
                "thinkingLevel": entry.get("thinkingLevel"),
                "fastMode": entry.get("fastMode"),
                "verboseLevel": entry.get("verboseLevel"),
                "traceLevel": entry.get("traceLevel"),
                "reasoningLevel": entry.get("reasoningLevel"),
                "responseUsage": entry.get("responseUsage"),
                "modelProvider": model_ref["provider"],
                "model": model_ref["model"],
                "contextTokens": resolve_context_tokens(cfg, model_ref["provider"], model_ref["model"], entry),
                "inputTokens": entry.get("inputTokens"),
                "outputTokens": entry.get("outputTokens"),
                "totalTokens": entry.get("totalTokens"),
                "totalTokensFresh": entry.get("totalTokensFresh"),
                "compactionCount": entry.get("compactionCount"),
                "compactionCheckpointCount": len(entry.get("compactionCheckpoints") or [])
                if isinstance(entry.get("compactionCheckpoints"), list)
                else 0,
            }
        )
    rows.sort(key=lambda row: int(row.get("updatedAt") or 0), reverse=True)
    limit = params.get("limit")
    if isinstance(limit, int) and limit > 0:
        rows = rows[:limit]
    return {
        "ts": int(time.time() * 1000),
        "path": str(store_path),
        "count": len(rows),
        "defaults": defaults,
        "sessions": rows,
    }


def handle_chat_history(params: dict[str, Any]) -> dict[str, Any]:
    cfg = load_config()
    session_key = require_string(params.get("sessionKey") or params.get("key"), "sessionKey")
    canonical, _agent_id, store_path, _store, entry = ensure_session(cfg, session_key)
    limit = params.get("limit")
    normalized_limit = limit if isinstance(limit, int) and limit > 0 else None
    messages = read_messages_from_transcript(resolve_transcript_path(store_path, entry), normalized_limit)
    return {
        "sessionKey": canonical,
        "sessionId": entry.get("sessionId"),
        "messages": messages,
        "thinkingLevel": entry.get("thinkingLevel"),
        "fastMode": entry.get("fastMode"),
        "verboseLevel": entry.get("verboseLevel"),
        "traceLevel": entry.get("traceLevel"),
    }


def handle_sessions_patch(params: dict[str, Any]) -> dict[str, Any]:
    cfg = load_config()
    key = require_string(params.get("key"), "key")
    canonical, agent_id, store_path, store, entry = ensure_session(cfg, key)
    nullable_fields = [
        "label",
        "displayName",
        "thinkingLevel",
        "verboseLevel",
        "traceLevel",
        "reasoningLevel",
        "elevatedLevel",
        "execHost",
        "execSecurity",
        "execAsk",
        "execNode",
        "sendPolicy",
        "groupActivation",
    ]
    for field in nullable_fields:
        if field in params:
            if params[field] is None:
                entry.pop(field, None)
            elif as_string(params[field]):
                entry[field] = as_string(params[field])
    if "fastMode" in params:
        if params["fastMode"] is None:
            entry.pop("fastMode", None)
        elif isinstance(params["fastMode"], bool):
            entry["fastMode"] = params["fastMode"]
    if "responseUsage" in params:
        value = params["responseUsage"]
        if value in {None, "off"}:
            entry.pop("responseUsage", None)
        elif value in {"on", "tokens", "full"}:
            entry["responseUsage"] = value
    if "model" in params:
        model = as_string(params["model"])
        if not model:
            entry.pop("providerOverride", None)
            entry.pop("modelOverride", None)
        else:
            if "/" in model:
                provider, model_id = model.split("/", 1)
                entry["providerOverride"] = provider
                entry["modelOverride"] = model_id
            else:
                default = resolve_default_model(cfg, agent_id)
                entry["providerOverride"] = default["provider"]
                entry["modelOverride"] = model
            entry["modelOverrideSource"] = "user"
            entry.pop("model", None)
            entry.pop("modelProvider", None)
            entry.pop("contextTokens", None)
    entry["updatedAt"] = int(time.time() * 1000)
    store[canonical] = entry
    save_store(store_path, store)
    resolved = resolve_session_model(cfg, entry, agent_id)
    emit_event("sessions.changed", {"sessionKey": canonical, "reason": "patch", "ts": int(time.time() * 1000)})
    return {
        "ok": True,
        "path": str(store_path),
        "key": canonical,
        "entry": entry,
        "resolved": {"modelProvider": resolved["provider"], "model": resolved["model"]},
    }


def handle_sessions_reset(params: dict[str, Any]) -> dict[str, Any]:
    cfg = load_config()
    key = require_string(params.get("key"), "key")
    reason = "new" if params.get("reason") == "new" else "reset"
    canonical, _agent_id, store_path, store, entry = ensure_session(cfg, key)
    old_session_file = as_string(entry.get("sessionFile"))
    if old_session_file:
        old_path = Path(old_session_file)
        if not old_path.is_absolute():
            old_path = store_path.parent / old_path
        if old_path.exists():
            archived = old_path.with_name(f"{old_path.name}.{reason}.{int(time.time())}")
            try:
                old_path.rename(archived)
            except OSError as exc:
                log_stderr(f"failed to archive transcript {old_path}: {exc}")
    entry["sessionId"] = str(uuid.uuid4())
    entry["updatedAt"] = int(time.time() * 1000)
    entry.pop("sessionFile", None)
    store[canonical] = entry
    save_store(store_path, store)
    emit_event("sessions.changed", {"sessionKey": canonical, "reason": reason, "ts": int(time.time() * 1000)})
    return {"ok": True, "key": canonical, "entry": entry}


def handle_sessions_steer(params: dict[str, Any]) -> dict[str, Any]:
    cfg = load_config()
    key = require_string(params.get("key") or params.get("sessionKey"), "key")
    message = require_string(params.get("message"), "message")
    run_id = as_string(params.get("idempotencyKey")) or str(uuid.uuid4())
    canonical, agent_id, store_path, store, entry = ensure_session(cfg, key)
    steering_message = {
        "role": "user",
        "content": [{"type": "text", "text": f"/steer {message}"}],
        "timestamp": now_ms(),
    }
    append_transcript_message(store_path, entry, steering_message)
    model_ref = resolve_session_model(cfg, entry, agent_id)
    assistant_message = {
        "role": "assistant",
        "content": [{"type": "text", "text": message}],
        "provider": model_ref["provider"],
        "model": model_ref["model"],
        "api": "python-stdio",
        "timestamp": now_ms(),
        "stopReason": "stop",
    }
    append_transcript_message(store_path, entry, assistant_message)
    entry["updatedAt"] = now_ms()
    store[canonical] = entry
    save_store(store_path, store)
    emit_event(
        "chat",
        {
            "runId": run_id,
            "sessionKey": canonical,
            "state": "final",
            "message": assistant_message,
        },
    )
    return {"runId": run_id, "interruptedActiveRun": True, "sessionKey": canonical}


def handle_models_list(_params: dict[str, Any]) -> dict[str, Any]:
    cfg = load_config()
    models: list[dict[str, Any]] = []
    providers = as_record(as_record(cfg.get("models")).get("providers"))
    for provider_id, provider_cfg in providers.items():
        for item in as_record(provider_cfg).get("models") or []:
            if isinstance(item, str):
                models.append({"id": item, "name": item, "provider": provider_id})
            elif isinstance(item, dict):
                model_id = as_string(item.get("id"))
                if model_id:
                    models.append(
                        {
                            "id": model_id,
                            "name": as_string(item.get("name")) or model_id,
                            "provider": provider_id,
                            "contextWindow": item.get("contextTokens") or item.get("contextWindow"),
                            "reasoning": item.get("reasoning"),
                        }
                    )
    if not models:
        default = resolve_default_model(cfg, resolve_default_agent_id(cfg))
        models.append({"id": default["model"], "name": default["model"], "provider": default["provider"]})
    return {"models": models}


def append_endpoint_path(endpoint: str, suffix: str) -> str:
    endpoint = endpoint.rstrip("/")
    return f"{endpoint}{suffix}"


def normalize_provider_id(value: Any) -> str:
    return normalize_token(value, "custom").replace("_", "-") or "custom"


def parse_remote_models(payload: Any, api: str, provider: str) -> list[dict[str, Any]]:
    if api == "google-generative-ai":
        entries = payload.get("models") if isinstance(payload, dict) else []
        models = []
        if isinstance(entries, list):
            for entry in entries:
                rec = as_record(entry)
                raw_name = as_string(rec.get("name"))
                model_id = raw_name.removeprefix("models/")
                if model_id:
                    models.append({"id": model_id, "name": as_string(rec.get("displayName")) or model_id, "provider": provider})
        return models
    if api == "ollama":
        entries = payload.get("models") if isinstance(payload, dict) else []
        models = []
        if isinstance(entries, list):
            for entry in entries:
                name = as_string(as_record(entry).get("name"))
                if name:
                    models.append({"id": name, "name": name, "provider": provider})
        return models
    entries = payload.get("data") if isinstance(payload, dict) else []
    models = []
    if isinstance(entries, list):
        for entry in entries:
            model_id = as_string(as_record(entry).get("id"))
            if model_id:
                models.append({"id": model_id, "name": model_id, "provider": provider})
    return models


def handle_models_remote_list(params: dict[str, Any]) -> dict[str, Any]:
    endpoint = require_string(params.get("endpoint"), "endpoint")
    api = require_string(params.get("api"), "api")
    api_key = as_string(params.get("apiKey"))
    provider = normalize_provider_id(params.get("provider"))
    if api not in {"openai-completions", "openai-responses", "anthropic-messages", "google-generative-ai", "ollama"}:
        raise ValueError(f"unsupported api: {api}")
    if api != "ollama" and not api_key:
        raise ValueError("apiKey is required")
    if endpoint.startswith("mock://"):
        return {"models": []}
    headers = {"Accept": "application/json"}
    if api in {"openai-completions", "openai-responses"}:
        url = append_endpoint_path(endpoint, "/models")
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"
    elif api == "anthropic-messages":
        url = append_endpoint_path(endpoint, "/models")
        headers["x-api-key"] = api_key
        headers["anthropic-version"] = "2023-06-01"
    elif api == "google-generative-ai":
        url = append_endpoint_path(endpoint, "/models")
        sep = "&" if "?" in url else "?"
        url = f"{url}{sep}key={api_key}"
    else:
        url = append_endpoint_path(endpoint, "/api/tags")
    request = urllib.request.Request(url, headers=headers, method="GET")
    try:
        with urllib.request.urlopen(request, timeout=REMOTE_MODEL_PROBE_TIMEOUT_SECONDS) as response:
            status = getattr(response, "status", 200)
            if status < 200 or status >= 300:
                raise ValueError(f"remote model probe failed: HTTP {status}")
            payload = json.loads(response.read().decode("utf-8"))
            return {"models": parse_remote_models(payload, api, provider)}
    except urllib.error.HTTPError as exc:
        if exc.code in {401, 403}:
            raise ValueError(f"remote model probe failed: HTTP {exc.code} (authentication or permission rejected)")
        if exc.code == 404:
            raise ValueError("remote model probe failed: HTTP 404 (model list endpoint not found)")
        raise ValueError(f"remote model probe failed: HTTP {exc.code}")
    except TimeoutError:
        raise ValueError("remote model probe timed out")
    except Exception as exc:
        if isinstance(exc, ValueError):
            raise
        raise ValueError(f"remote model probe failed: {exc}")


def resolve_provider_config(cfg: dict[str, Any], provider: str) -> dict[str, Any]:
    providers = as_record(as_record(cfg.get("models")).get("providers"))
    if provider in providers and isinstance(providers.get(provider), dict):
        return as_record(providers.get(provider))
    normalized = normalize_provider_id(provider)
    for provider_id, provider_cfg in providers.items():
        if normalize_provider_id(provider_id) == normalized and isinstance(provider_cfg, dict):
            return as_record(provider_cfg)
    return {}


def text_from_openai_chat_payload(payload: Any) -> str:
    choices = as_record(payload).get("choices")
    if not isinstance(choices, list) or not choices:
        return ""
    first = as_record(choices[0])
    message = as_record(first.get("message"))
    content = message.get("content")
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            rec = as_record(item)
            text = as_string(rec.get("text"))
            if text:
                parts.append(text)
        return "\n".join(parts).strip()
    text = as_string(first.get("text"))
    return text.strip()


def usage_from_openai_payload(payload: Any) -> dict[str, Any] | None:
    usage = as_record(as_record(payload).get("usage"))
    if not usage:
        return None
    input_tokens = usage.get("prompt_tokens") or usage.get("input_tokens")
    output_tokens = usage.get("completion_tokens") or usage.get("output_tokens")
    total_tokens = usage.get("total_tokens")
    result: dict[str, Any] = {}
    if isinstance(input_tokens, (int, float)):
        result["inputTokens"] = int(input_tokens)
    if isinstance(output_tokens, (int, float)):
        result["outputTokens"] = int(output_tokens)
    if isinstance(total_tokens, (int, float)):
        result["totalTokens"] = int(total_tokens)
    return result or None


def call_openai_compatible_chat(
    provider_cfg: dict[str, Any],
    model: str,
    messages: list[dict[str, str]],
) -> dict[str, Any]:
    base_url = require_string(provider_cfg.get("baseUrl") or provider_cfg.get("endpoint"), "baseUrl")
    api_key = as_string(provider_cfg.get("apiKey") or provider_cfg.get("token"))
    url = append_endpoint_path(base_url, "/chat/completions")
    payload = {
        "model": model,
        "messages": messages,
        "stream": False,
    }
    max_tokens = provider_cfg.get("maxTokens")
    if isinstance(max_tokens, (int, float)) and max_tokens > 0:
        payload["max_tokens"] = int(max_tokens)
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    request = urllib.request.Request(url, data=data, headers=headers, method="POST")
    with urllib.request.urlopen(request, timeout=REMOTE_CHAT_TIMEOUT_SECONDS) as response:
        status = getattr(response, "status", 200)
        body = response.read().decode("utf-8")
        if status < 200 or status >= 300:
            raise ValueError(f"remote chat failed: HTTP {status}")
        payload = json.loads(body) if body else {}
        text = text_from_openai_chat_payload(payload)
        if not text:
            raise ValueError("remote chat returned no assistant text")
        return {"text": text, "usage": usage_from_openai_payload(payload)}


def call_remote_chat(cfg: dict[str, Any], model_ref: dict[str, Any], message: str) -> dict[str, Any] | None:
    provider_cfg = resolve_provider_config(cfg, model_ref["provider"])
    if not provider_cfg:
        return None
    api = as_string(provider_cfg.get("api")) or "openai-completions"
    if api in {"openai-completions", "openai-responses"}:
        return call_openai_compatible_chat(
            provider_cfg,
            model_ref["model"],
            [{"role": "user", "content": message}],
        )
    return None


def handle_chat_send(params: dict[str, Any]) -> dict[str, Any]:
    cfg = load_config()
    session_key = require_string(params.get("sessionKey") or params.get("key"), "sessionKey")
    message = require_string(params.get("message"), "message")
    run_id = as_string(params.get("idempotencyKey")) or str(uuid.uuid4())
    canonical, agent_id, store_path, store, entry = ensure_session(cfg, session_key)
    user_message = {"role": "user", "content": [{"type": "text", "text": message}], "timestamp": int(time.time() * 1000)}
    append_transcript_message(store_path, entry, user_message)
    active_chat_runs[run_id] = {"sessionKey": canonical, "aborted": False}
    try:
        if not active_chat_runs.get(run_id, {}).get("aborted"):
            model_ref = resolve_session_model(cfg, entry, agent_id)
            remote_result = call_remote_chat(cfg, model_ref, message)
            assistant_text = remote_result["text"] if remote_result else message
            assistant_message = {
                "role": "assistant",
                "content": [{"type": "text", "text": assistant_text}],
                "provider": model_ref["provider"],
                "model": model_ref["model"],
                "api": "remote" if remote_result else "python-stdio",
                "timestamp": int(time.time() * 1000),
                "stopReason": "stop",
            }
            usage = as_record(remote_result.get("usage")) if remote_result else {}
            if usage:
                assistant_message["usage"] = usage
            append_transcript_message(store_path, entry, assistant_message)
            entry["modelProvider"] = model_ref["provider"]
            entry["model"] = model_ref["model"]
            entry["contextTokens"] = resolve_context_tokens(cfg, model_ref["provider"], model_ref["model"], entry)
            if isinstance(usage.get("inputTokens"), int):
                entry["inputTokens"] = usage["inputTokens"]
            if isinstance(usage.get("outputTokens"), int):
                entry["outputTokens"] = usage["outputTokens"]
            if isinstance(usage.get("totalTokens"), int):
                entry["totalTokens"] = usage["totalTokens"]
                entry["totalTokensFresh"] = True
            entry["updatedAt"] = int(time.time() * 1000)
            maybe_compact_session(cfg, store_path, store, canonical, entry, run_id, entry["contextTokens"])
            store[canonical] = entry
            save_store(store_path, store)
            emit_event(
                "chat",
                {
                    "runId": run_id,
                    "sessionKey": canonical,
                    "state": "final",
                    "message": assistant_message,
                },
            )
    except Exception as exc:
        append_log(f"chat.send failed runId={run_id} error={exc}")
        emit_event(
            "chat",
            {
                "runId": run_id,
                "sessionKey": canonical,
                "state": "error",
                "errorMessage": str(exc),
            },
        )
        raise
    finally:
        active_chat_runs.pop(run_id, None)
    return {"status": "accepted", "runId": run_id}


def handle_chat_abort(params: dict[str, Any]) -> dict[str, Any]:
    run_id = require_string(params.get("runId"), "runId")
    run = active_chat_runs.get(run_id)
    if run:
        run["aborted"] = True
        emit_event("chat", {"runId": run_id, "sessionKey": run.get("sessionKey"), "state": "aborted"})
        active_chat_runs.pop(run_id, None)
    return {"ok": True, "aborted": bool(run)}


def governance_summary() -> dict[str, Any]:
    return {
        "charterDeclared": False,
        "charterLayer": None,
        "charterTitle": None,
        "charterToolAllow": [],
        "charterToolDeny": [],
        "freezeActive": False,
        "freezeDeny": [],
    }


def catalog_profiles() -> list[dict[str, Any]]:
    return [
        {"id": "minimal", "label": "Minimal"},
        {"id": "coding", "label": "Coding"},
        {"id": "messaging", "label": "Messaging"},
        {"id": "full", "label": "Full"},
    ]


def clone_tool_groups() -> list[dict[str, Any]]:
    return json.loads(json.dumps(CORE_TOOL_GROUPS, ensure_ascii=False))


def handle_tools_catalog(params: dict[str, Any]) -> dict[str, Any]:
    cfg = load_config()
    agent_id = normalize_agent_id(params.get("agentId") or resolve_default_agent_id(cfg))
    groups = clone_tool_groups()
    include_plugins = params.get("includePlugins") is not False
    if include_plugins:
        mcp_servers = as_record(as_record(cfg.get("mcp")).get("servers"))
        if mcp_servers:
            groups.append(
                {
                    "id": "mcp",
                    "label": "MCP",
                    "source": "mcp",
                    "tools": [
                        {
                            "id": f"mcp_{normalize_token(name, 'server')}",
                            "label": str(name),
                            "description": "Configured MCP server tool surface",
                            "source": "mcp",
                        }
                        for name in sorted(mcp_servers.keys())
                    ],
                }
            )
    return {
        "agentId": agent_id,
        "profiles": catalog_profiles(),
        "groups": groups,
        "governance": governance_summary(),
    }


def handle_tools_effective(params: dict[str, Any]) -> dict[str, Any]:
    cfg = load_config()
    session_key = as_string(params.get("sessionKey")) or f"agent:{resolve_default_agent_id(cfg)}:{session_main_key(cfg)}"
    agent_id = normalize_agent_id(params.get("agentId") or (parse_agent_session_key(session_key) or (resolve_default_agent_id(cfg), ""))[0])
    catalog = handle_tools_catalog({"agentId": agent_id, "includePlugins": True})
    return {
        "agentId": agent_id,
        "sessionKey": session_key,
        "profile": "full",
        "groups": catalog["groups"],
        "governance": catalog["governance"],
    }


def handle_governance_overview(params: dict[str, Any]) -> dict[str, Any]:
    cfg = load_config()
    agents = list_agents(cfg)
    charter_dir = state_dir() / "charter"
    proposals = load_experience_state().get("strategicMemories", [])
    overview = {
        "charterDeclared": charter_dir.exists(),
        "charterDir": str(charter_dir),
        "agents": agents,
        "agentCount": len(agents),
        "defaultAgentId": resolve_default_agent_id(cfg),
        "freezeActive": False,
        "proposalCount": len(proposals) if isinstance(proposals, list) else 0,
        "layers": ["governance", "evolution", "capability", "execution", "api", "interaction"],
    }
    return {"sessionKey": as_string(params.get("sessionKey")) or f"agent:{overview['defaultAgentId']}:{session_main_key(cfg)}", "overview": overview}


def autonomy_profile(agent_id: str) -> dict[str, Any]:
    return {
        "agentId": agent_id,
        "controllerId": f"runtime.autonomy/{agent_id}",
        "description": f"Autonomous loop for {agent_id}",
        "enabled": True,
    }


def autonomy_status_entry(agent_id: str) -> dict[str, Any]:
    workspace = str(agent_workspace_dir(agent_id))
    return {
        "agentId": agent_id,
        "profile": autonomy_profile(agent_id),
        "workspaceDirs": [workspace],
        "primaryWorkspaceDir": workspace,
        "duplicateLoopCount": 0,
        "expectedLoopEveryMs": 86_400_000,
        "loopCadenceAligned": True,
        "hasActiveFlow": False,
        "driftReasons": [],
        "suggestedAction": "observe",
        "health": "idle",
    }


def handle_autonomy_overview(params: dict[str, Any]) -> dict[str, Any]:
    cfg = load_config()
    requested = params.get("agentIds")
    agent_ids = [normalize_agent_id(item) for item in requested] if isinstance(requested, list) and requested else [agent["id"] for agent in list_agents(cfg)]
    entries = [autonomy_status_entry(agent_id) for agent_id in agent_ids]
    overview = {
        "entries": entries,
        "totals": {
            "totalProfiles": len(entries),
            "healthy": 0,
            "idle": len(entries),
            "drift": 0,
            "missingLoop": 0,
            "activeFlows": 0,
        },
    }
    return {"sessionKey": as_string(params.get("sessionKey")) or f"agent:{resolve_default_agent_id(cfg)}:{session_main_key(cfg)}", "overview": overview}


def business_context(value: Any) -> dict[str, Any]:
    rec = as_record(value)
    payload = rec.get("payload") if isinstance(rec.get("payload"), dict) else None
    return {
        "domain": as_string(rec.get("domain")) or "general",
        "accessMode": as_string(rec.get("accessMode")) or "manual",
        **({"domainLabel": as_string(rec.get("domainLabel"))} if as_string(rec.get("domainLabel")) else {}),
        **({"accessModeLabel": as_string(rec.get("accessModeLabel"))} if as_string(rec.get("accessModeLabel")) else {}),
        **({"object": as_string(rec.get("object"))} if as_string(rec.get("object")) else {}),
        **({"acceptanceCriteria": as_string(rec.get("acceptanceCriteria"))} if as_string(rec.get("acceptanceCriteria")) else {}),
        **({"payload": payload} if payload else {}),
    }


def handle_business_tasks_list(params: dict[str, Any]) -> dict[str, Any]:
    allowed = {"pending", "running", "completed", "failed", "cancelled"}
    status = as_string(params.get("status")).lower()
    tasks = [as_record(task) for task in load_business_tasks_store()["tasks"] if isinstance(task, dict)]
    if status in allowed:
        tasks = [task for task in tasks if task.get("status") == status]
    tasks.sort(key=lambda item: int(item.get("createdAt") or 0), reverse=True)
    limit = normalize_int(params.get("limit"), 0, minimum=0)
    if limit > 0:
        tasks = tasks[:limit]
    return {"tasks": tasks}


def handle_business_tasks_create(params: dict[str, Any]) -> dict[str, Any]:
    timestamp = now_ms()
    task = {
        "id": create_id("bt"),
        "agentId": as_string(params.get("agentId")) or DEFAULT_AGENT_ID,
        "name": require_string(params.get("name"), "name"),
        "goal": require_string(params.get("goal"), "goal"),
        "status": "running",
        "progress": 15,
        "duration": normalize_status(params.get("duration"), {"short", "medium", "long"}, "short"),
        "priority": normalize_status(params.get("priority"), {"high", "medium", "low"}, "medium"),
        "group": as_string(params.get("group")) or "ai",
        "business": business_context(params.get("business")),
        "autonomy": {"sessionKey": f"agent:{normalize_agent_id(params.get('agentId'))}:main", "started": {"status": "queued"}},
        "createdAt": timestamp,
        "updatedAt": timestamp,
    }
    store = load_business_tasks_store()
    store["tasks"] = [task, *store["tasks"]]
    save_business_tasks_store(store)
    append_log(f"business.tasks.create id={task['id']} name={task['name']}")
    return {"task": task, "autonomyStarted": True}


def handle_business_tasks_update(params: dict[str, Any]) -> dict[str, Any]:
    task_id = require_string(params.get("id"), "id")
    store = load_business_tasks_store()
    for index, raw in enumerate(store["tasks"]):
        task = as_record(raw)
        if task.get("id") != task_id:
            continue
        status = normalize_status(params.get("status"), {"pending", "running", "completed", "failed", "cancelled"}, as_string(task.get("status")) or "running")
        task["status"] = status
        if "progress" in params:
            task["progress"] = normalize_int(params.get("progress"), int(task.get("progress") or 0), minimum=0, maximum=100)
        if "error" in params and as_string(params.get("error")):
            task["error"] = as_string(params.get("error"))
        task["updatedAt"] = now_ms()
        if status in {"completed", "failed", "cancelled"}:
            task["completedAt"] = task["updatedAt"]
        store["tasks"][index] = task
        save_business_tasks_store(store)
        return {"task": task}
    raise ValueError(f"unknown business task: {task_id}")


def handle_business_tasks_delete(params: dict[str, Any]) -> dict[str, Any]:
    task_id = require_string(params.get("id"), "id")
    store = load_business_tasks_store()
    for index, raw in enumerate(store["tasks"]):
        task = as_record(raw)
        if task.get("id") == task_id:
            deleted = store["tasks"].pop(index)
            save_business_tasks_store(store)
            return {"task": deleted}
    raise ValueError(f"unknown business task: {task_id}")


def parallel_counts(tasks: list[dict[str, Any]]) -> dict[str, int]:
    counts = {"total": len(tasks), "queued": 0, "starting": 0, "running": 0, "failed": 0, "cancelled": 0}
    for task in tasks:
        status = as_string(task.get("status")) or "queued"
        if status in counts:
            counts[status] += 1
    return counts


def refresh_parallel_batch(batch: dict[str, Any]) -> dict[str, Any]:
    tasks = [as_record(task) for task in batch.get("tasks", []) if isinstance(task, dict)]
    counts = parallel_counts(tasks)
    if counts["cancelled"] == counts["total"] and counts["total"]:
        status = "cancelled"
    elif counts["failed"]:
        status = "failed"
    else:
        status = "running"
    batch["tasks"] = tasks
    batch["counts"] = counts
    batch["status"] = status
    batch["updatedAt"] = now_ms()
    return batch


def handle_agents_parallel_start(params: dict[str, Any]) -> dict[str, Any]:
    raw_tasks = params.get("tasks")
    if not isinstance(raw_tasks, list) or len(raw_tasks) < 1:
        raise ValueError("tasks is required")
    timestamp = now_ms()
    tasks: list[dict[str, Any]] = []
    seen: set[str] = set()
    for index, raw_task in enumerate(raw_tasks):
        rec = as_record(raw_task)
        goal = require_string(rec.get("goal"), "goal")
        task_id = as_string(rec.get("id")) or f"task_{index + 1}"
        if task_id in seen:
            task_id = f"{task_id}_{index + 1}"
        seen.add(task_id)
        agent_id = normalize_agent_id(rec.get("agentId") or DEFAULT_AGENT_ID)
        tasks.append(
            {
                "id": task_id,
                "agentId": agent_id,
                "goal": goal,
                "status": "running",
                "sessionKey": f"agent:{agent_id}:{task_id}",
                "runId": create_id("run"),
                "startedAt": timestamp,
                "updatedAt": timestamp,
            }
        )
    batch = refresh_parallel_batch(
        {
            "batchId": create_id("parallel"),
            **({"title": as_string(params.get("title"))} if as_string(params.get("title")) else {}),
            "status": "running",
            "concurrency": normalize_int(params.get("concurrency"), min(4, len(tasks)), minimum=1, maximum=len(tasks)),
            **({"parentSessionKey": as_string(params.get("parentSessionKey"))} if as_string(params.get("parentSessionKey")) else {}),
            "createdAt": timestamp,
            "updatedAt": timestamp,
            "tasks": tasks,
        }
    )
    store = load_parallel_batches_store()
    store["batches"] = [batch, *store["batches"]]
    save_parallel_batches_store(store)
    append_log(f"agents.parallel.start batchId={batch['batchId']} tasks={len(tasks)}")
    return batch


def find_parallel_batch(batch_id: str) -> tuple[dict[str, Any], int, dict[str, Any]]:
    store = load_parallel_batches_store()
    for index, raw in enumerate(store["batches"]):
        batch = as_record(raw)
        if batch.get("batchId") == batch_id:
            return store, index, refresh_parallel_batch(batch)
    raise ValueError(f"parallel batch not found: {batch_id}")


def handle_agents_parallel_status(params: dict[str, Any]) -> dict[str, Any]:
    _store, _index, batch = find_parallel_batch(require_string(params.get("batchId"), "batchId"))
    return batch


def handle_agents_parallel_list(params: dict[str, Any]) -> dict[str, Any]:
    batches = [refresh_parallel_batch(as_record(batch)) for batch in load_parallel_batches_store()["batches"] if isinstance(batch, dict)]
    batches.sort(key=lambda item: int(item.get("updatedAt") or 0), reverse=True)
    limit = normalize_int(params.get("limit"), 20, minimum=1)
    return {"batches": batches[:limit]}


def handle_agents_parallel_cancel(params: dict[str, Any]) -> dict[str, Any]:
    batch_id = require_string(params.get("batchId"), "batchId")
    store, index, batch = find_parallel_batch(batch_id)
    for task in batch["tasks"]:
        if task.get("status") not in {"failed", "cancelled"}:
            task["status"] = "cancelled"
            task["updatedAt"] = now_ms()
    batch = refresh_parallel_batch(batch)
    store["batches"][index] = batch
    save_parallel_batches_store(store)
    return batch


def configured_mcp_servers() -> dict[str, dict[str, Any]]:
    servers = as_record(as_record(load_config().get("mcp")).get("servers"))
    return {str(name): as_record(server) for name, server in servers.items() if isinstance(server, dict)}


def mcp_server_launch_config(server_name: str) -> dict[str, Any]:
    servers = configured_mcp_servers()
    server = servers.get(server_name)
    if not server:
        raise ValueError(f"MCP server not configured: {server_name}")
    if as_string(server.get("url")):
        raise ValueError(f"MCP server {server_name} uses URL transport; Python TUI stdio backend currently supports command-based stdio MCP servers")
    command = require_string(server.get("command"), f"mcp.servers.{server_name}.command")
    args = server.get("args") if isinstance(server.get("args"), list) else []
    env = server.get("env") if isinstance(server.get("env"), dict) else {}
    cwd = as_string(server.get("cwd")) or as_string(server.get("workingDirectory")) or os.getcwd()
    timeout_ms = normalize_int(server.get("connectionTimeoutMs"), 10_000, minimum=1_000, maximum=120_000)
    return {
        "command": command,
        "args": [as_string(arg) for arg in args if as_string(arg)],
        "env": {str(key): as_string(value) for key, value in env.items() if as_string(value)},
        "cwd": cwd,
        "timeout": timeout_ms / 1000,
    }


def read_mcp_frames(proc: subprocess.Popen[str], out_queue: "queue.Queue[dict[str, Any]]", err_queue: "queue.Queue[str]") -> None:
    assert proc.stdout is not None
    for line in proc.stdout:
        text = line.strip()
        if not text:
            continue
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError:
            err_queue.put(f"invalid MCP JSON frame: {text[:200]}")
            continue
        if isinstance(parsed, dict):
            out_queue.put(parsed)


def read_mcp_stderr(proc: subprocess.Popen[str], err_queue: "queue.Queue[str]") -> None:
    assert proc.stderr is not None
    for line in proc.stderr:
        text = line.strip()
        if text:
            err_queue.put(text)


def mcp_write(proc: subprocess.Popen[str], frame: dict[str, Any]) -> None:
    if not proc.stdin:
        raise RuntimeError("MCP process stdin is closed")
    proc.stdin.write(json.dumps(frame, ensure_ascii=False, separators=(",", ":")) + "\n")
    proc.stdin.flush()


def mcp_wait_response(
    proc: subprocess.Popen[str],
    out_queue: "queue.Queue[dict[str, Any]]",
    err_queue: "queue.Queue[str]",
    request_id: int,
    timeout: float,
) -> dict[str, Any]:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if proc.poll() is not None:
            errors: list[str] = []
            while not err_queue.empty():
                errors.append(err_queue.get_nowait())
            detail = f": {'; '.join(errors[-3:])}" if errors else ""
            raise RuntimeError(f"MCP process exited with code {proc.returncode}{detail}")
        try:
            frame = out_queue.get(timeout=0.05)
        except queue.Empty:
            continue
        if frame.get("id") != request_id:
            continue
        error = frame.get("error")
        if isinstance(error, dict):
            raise RuntimeError(as_string(error.get("message")) or f"MCP request {request_id} failed")
        result = frame.get("result")
        return result if isinstance(result, dict) else {"value": result}
    raise TimeoutError(f"MCP request {request_id} timed out")


def with_mcp_client(server_name: str, operation: Callable[[Callable[[str, dict[str, Any] | None], dict[str, Any]]], dict[str, Any]]) -> dict[str, Any]:
    launch = mcp_server_launch_config(server_name)
    env = {**os.environ, **launch["env"], "PYTHONIOENCODING": "utf-8", "PYTHONUTF8": "1"}
    proc = subprocess.Popen(
        [launch["command"], *launch["args"]],
        cwd=launch["cwd"],
        env=env,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    out_queue: "queue.Queue[dict[str, Any]]" = queue.Queue()
    err_queue: "queue.Queue[str]" = queue.Queue()
    threading.Thread(target=read_mcp_frames, args=(proc, out_queue, err_queue), daemon=True).start()
    threading.Thread(target=read_mcp_stderr, args=(proc, err_queue), daemon=True).start()
    next_id = 1

    def request(method: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        nonlocal next_id
        request_id = next_id
        next_id += 1
        frame: dict[str, Any] = {"jsonrpc": "2.0", "id": request_id, "method": method}
        if params is not None:
            frame["params"] = params
        mcp_write(proc, frame)
        return mcp_wait_response(proc, out_queue, err_queue, request_id, launch["timeout"])

    try:
        request(
            "initialize",
            {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "assistant-tui-gateway", "version": "1.0.0"},
            },
        )
        mcp_write(proc, {"jsonrpc": "2.0", "method": "notifications/initialized"})
        return operation(request)
    finally:
        try:
            proc.terminate()
            proc.wait(timeout=2)
        except Exception:
            try:
                proc.kill()
            except Exception:
                pass


def split_mcp_tool_name(value: str) -> tuple[str, str]:
    raw = require_string(value, "name")
    if "__" in raw:
        server, tool = raw.split("__", 1)
        return require_string(server, "server"), require_string(tool, "tool")
    if "." in raw:
        server, tool = raw.split(".", 1)
        return require_string(server, "server"), require_string(tool, "tool")
    server = require_string(load_config().get("mcpDefaultServer") or next(iter(configured_mcp_servers().keys()), ""), "server")
    return server, raw


def list_mcp_tools_for_server(server_name: str) -> list[dict[str, Any]]:
    def operation(request: Callable[[str, dict[str, Any] | None], dict[str, Any]]) -> dict[str, Any]:
        return request("tools/list", {})

    result = with_mcp_client(server_name, operation)
    raw_tools = result.get("tools") if isinstance(result.get("tools"), list) else []
    tools: list[dict[str, Any]] = []
    for raw_tool in raw_tools:
        tool = as_record(raw_tool)
        name = as_string(tool.get("name"))
        if not name:
            continue
        tools.append(
            {
                "name": f"{server_name}__{name}",
                "server": server_name,
                "tool": name,
                "description": as_string(tool.get("description")),
                "inputSchema": tool.get("inputSchema") if isinstance(tool.get("inputSchema"), dict) else {},
            }
        )
    return tools


def handle_mcp_tools_list(params: dict[str, Any]) -> dict[str, Any]:
    servers = configured_mcp_servers()
    requested_server = as_string(params.get("server") or params.get("serverName"))
    server_names = [requested_server] if requested_server else sorted(servers.keys())
    tools: list[dict[str, Any]] = []
    errors: list[dict[str, str]] = []
    for server_name in server_names:
        try:
            tools.extend(list_mcp_tools_for_server(server_name))
        except Exception as exc:
            errors.append({"server": server_name, "message": str(exc)})
    if requested_server and errors and not tools:
        raise RuntimeError(errors[0]["message"])
    return {"count": len(tools), "tools": tools, **({"errors": errors} if errors else {})}


def handle_mcp_tools_call(params: dict[str, Any]) -> dict[str, Any]:
    server_name = as_string(params.get("server") or params.get("serverName"))
    raw_tool_name = require_string(params.get("tool") or params.get("toolName") or params.get("name"), "name")
    if not server_name:
        server_name, tool_name = split_mcp_tool_name(raw_tool_name)
    else:
        tool_name = raw_tool_name.split("__", 1)[1] if "__" in raw_tool_name else raw_tool_name
    arguments = params.get("arguments")
    if arguments is None:
        arguments = params.get("args")
    if arguments is None:
        arguments = {}
    if not isinstance(arguments, dict):
        raise ValueError("arguments must be an object")

    def operation(request: Callable[[str, dict[str, Any] | None], dict[str, Any]]) -> dict[str, Any]:
        return request("tools/call", {"name": tool_name, "arguments": arguments})

    result = with_mcp_client(server_name, operation)
    append_log(f"mcp.tools.call server={server_name} tool={tool_name}")
    return {"server": server_name, "tool": tool_name, "name": f"{server_name}__{tool_name}", "result": result}


def method_catalog() -> dict[str, dict[str, Any]]:
    return {
        name: {
            "name": name,
            "category": name.split(".", 1)[0] if "." in name else "system",
            "scope": "operator.read" if any(token in name for token in [".list", ".status", ".summary", ".get", ".search", ".describe", "status"]) else "operator.admin",
            "description": METHOD_DESCRIPTIONS.get(name, f"Call {name}"),
        }
        for name in sorted(HANDLERS.keys())
    }


def handle_gateway_methods(params: dict[str, Any]) -> dict[str, Any]:
    query = as_string(params.get("query")).lower()
    methods = list(method_catalog().values())
    if query:
        methods = [
            method
            for method in methods
            if query in method["name"].lower()
            or query in as_string(method.get("category")).lower()
            or query in as_string(method.get("description")).lower()
        ]
    return {"query": query or None, "count": len(methods), "methods": methods}


def handle_gateway_method_describe(params: dict[str, Any]) -> dict[str, Any]:
    method = require_string(params.get("method"), "method")
    catalog = method_catalog()
    entry = catalog.get(method)
    if not entry:
        raise ValueError(f"unknown gateway method: {method}")
    return {
        "method": {
            **entry,
            "paramsSchema": {"type": "object"},
            "resultSchema": {"type": "object"},
        },
        "callTemplate": f"/gateway-call {method} {{}}",
    }


def handle_skills_status(_params: dict[str, Any]) -> dict[str, Any]:
    skills_root = state_dir() / "skills"
    generated = generated_skills_dir()
    entries: list[dict[str, Any]] = []
    for root in [skills_root, generated]:
        if not root.exists():
            continue
        for skill_file in root.rglob("SKILL.md"):
            entries.append(
                {
                    "name": skill_file.parent.name,
                    "path": str(skill_file),
                    "source": "generated" if generated in skill_file.parents else "workspace",
                    "ok": True,
                }
            )
    return {
        "ok": True,
        "workspaceDir": os.getcwd(),
        "skillsDir": str(skills_root),
        "count": len(entries),
        "entries": entries,
        "eligibility": {"remote": True},
    }


def handle_skills_search(params: dict[str, Any]) -> dict[str, Any]:
    query = as_string(params.get("query")).lower()
    status = handle_skills_status({})
    results = []
    for entry in status["entries"]:
        haystack = f"{entry.get('name')} {entry.get('path')}".lower()
        if not query or query in haystack:
            results.append(entry)
    limit = params.get("limit")
    if isinstance(limit, int) and limit > 0:
        results = results[:limit]
    return {"results": results}


def handle_skills_bins(_params: dict[str, Any]) -> dict[str, Any]:
    return {"bins": []}


def handle_agents_files_list(params: dict[str, Any]) -> dict[str, Any]:
    agent_id = normalize_agent_id(params.get("agentId") or DEFAULT_AGENT_ID)
    workspace = agent_workspace_dir(agent_id)
    files = []
    for name in sorted(ALLOWED_AGENT_FILE_NAMES):
        file_path = workspace / name
        if file_path.exists() and file_path.is_file():
            stat = file_path.stat()
            files.append({"name": name, "path": str(file_path), "missing": False, "size": stat.st_size, "updatedAtMs": int(stat.st_mtime * 1000)})
        else:
            files.append({"name": name, "path": str(file_path), "missing": True})
    return {"agentId": agent_id, "workspace": str(workspace), "files": files}


def resolve_agent_file(params: dict[str, Any]) -> tuple[str, Path, str, Path]:
    agent_id = normalize_agent_id(params.get("agentId") or DEFAULT_AGENT_ID)
    name = require_string(params.get("name"), "name")
    if name not in ALLOWED_AGENT_FILE_NAMES:
        raise ValueError(f'unsupported file "{name}"')
    workspace = agent_workspace_dir(agent_id)
    file_path = (workspace / name).resolve()
    workspace_resolved = workspace.resolve()
    if workspace_resolved != file_path and workspace_resolved not in file_path.parents:
        raise ValueError(f'unsafe file "{name}"')
    return agent_id, workspace_resolved, name, file_path


def handle_agents_files_get(params: dict[str, Any]) -> dict[str, Any]:
    agent_id, workspace, name, file_path = resolve_agent_file(params)
    if not file_path.exists():
        return {"agentId": agent_id, "workspace": str(workspace), "file": {"name": name, "path": str(file_path), "missing": True}}
    stat = file_path.stat()
    return {
        "agentId": agent_id,
        "workspace": str(workspace),
        "file": {
            "name": name,
            "path": str(file_path),
            "missing": False,
            "size": stat.st_size,
            "updatedAtMs": int(stat.st_mtime * 1000),
            "content": file_path.read_text(encoding="utf-8"),
        },
    }


def handle_agents_files_set(params: dict[str, Any]) -> dict[str, Any]:
    content = params.get("content")
    if not isinstance(content, str):
        raise ValueError("content is required")
    agent_id, workspace, name, file_path = resolve_agent_file(params)
    workspace.mkdir(parents=True, exist_ok=True)
    file_path.write_text(content, encoding="utf-8")
    stat = file_path.stat()
    return {
        "ok": True,
        "agentId": agent_id,
        "workspace": str(workspace),
        "file": {
            "name": name,
            "path": str(file_path),
            "missing": False,
            "size": stat.st_size,
            "updatedAtMs": int(stat.st_mtime * 1000),
            "content": content,
        },
    }


def handle_cron_status(_params: dict[str, Any]) -> dict[str, Any]:
    store = load_cron_store()
    jobs = [job for job in store["jobs"] if isinstance(job, dict)]
    enabled = [job for job in jobs if job.get("enabled") is not False]
    running = [job for job in jobs if as_record(job.get("state")).get("runningAtMs")]
    return {
        "ok": True,
        "path": str(cron_store_path()),
        "enabled": True,
        "jobs": len(jobs),
        "enabledJobs": len(enabled),
        "runningJobs": len(running),
        "nextRunAtMs": min(
            [as_record(job.get("state")).get("nextRunAtMs") for job in enabled if isinstance(as_record(job.get("state")).get("nextRunAtMs"), (int, float))],
            default=None,
        ),
    }


def handle_cron_list(params: dict[str, Any]) -> dict[str, Any]:
    jobs = [job for job in load_cron_store()["jobs"] if isinstance(job, dict)]
    if params.get("includeDisabled") is not True:
        jobs = [job for job in jobs if job.get("enabled") is not False]
    limit = params.get("limit")
    if isinstance(limit, int) and limit > 0:
        jobs = jobs[:limit]
    return {"jobs": jobs, "count": len(jobs), "path": str(cron_store_path())}


def handle_cron_add(params: dict[str, Any]) -> dict[str, Any]:
    store = load_cron_store()
    timestamp = now_ms()
    job = {
        "id": as_string(params.get("id")) or str(uuid.uuid4()),
        "name": as_string(params.get("name")) or "Terminal scheduled task",
        "enabled": params.get("enabled") is not False,
        "schedule": as_record(params.get("schedule")) or {"kind": "at", "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())},
        "sessionTarget": as_string(params.get("sessionTarget")) or "main",
        "wakeMode": as_string(params.get("wakeMode")) or "now",
        "payload": as_record(params.get("payload")) or {"kind": "systemEvent", "text": ""},
        "delivery": as_record(params.get("delivery")) or {"mode": "none"},
        "failureAlert": params.get("failureAlert", False),
        "createdAtMs": timestamp,
        "updatedAtMs": timestamp,
        "state": {"lastRunStatus": "skipped"},
    }
    store["jobs"] = [job, *[entry for entry in store["jobs"] if as_record(entry).get("id") != job["id"]]]
    save_cron_store(store)
    return job


def handle_cron_update(params: dict[str, Any]) -> dict[str, Any]:
    job_id = require_string(params.get("id"), "id")
    patch = as_record(params.get("patch")) or {key: value for key, value in params.items() if key != "id"}
    store = load_cron_store()
    for index, raw in enumerate(store["jobs"]):
        job = as_record(raw)
        if job.get("id") == job_id:
            updated = {**job, **patch, "updatedAtMs": now_ms()}
            store["jobs"][index] = updated
            save_cron_store(store)
            return updated
    raise ValueError(f"cron job not found: {job_id}")


def handle_cron_remove(params: dict[str, Any]) -> dict[str, Any]:
    job_id = require_string(params.get("id"), "id")
    store = load_cron_store()
    before = len(store["jobs"])
    store["jobs"] = [job for job in store["jobs"] if as_record(job).get("id") != job_id]
    save_cron_store(store)
    return {"ok": True, "removed": len(store["jobs"]) != before, "id": job_id}


def handle_cron_run(params: dict[str, Any]) -> dict[str, Any]:
    job_id = require_string(params.get("id"), "id")
    store = load_cron_store()
    for index, raw in enumerate(store["jobs"]):
        job = as_record(raw)
        if job.get("id") == job_id:
            state = as_record(job.get("state"))
            state.update({"lastRunAtMs": now_ms(), "lastRunStatus": "ok", "lastDeliveryStatus": "not-requested"})
            job["state"] = state
            store["jobs"][index] = job
            save_cron_store(store)
            return {"status": "ok", "job": job}
    raise ValueError(f"cron job not found: {job_id}")


def handle_cron_runs(params: dict[str, Any]) -> dict[str, Any]:
    job_id = as_string(params.get("id"))
    jobs = [as_record(job) for job in load_cron_store()["jobs"] if isinstance(job, dict)]
    if job_id:
        jobs = [job for job in jobs if job.get("id") == job_id]
    entries = [
        {
            "id": job.get("id"),
            "status": as_record(job.get("state")).get("lastRunStatus"),
            "runAtMs": as_record(job.get("state")).get("lastRunAtMs"),
            "deliveryStatus": as_record(job.get("state")).get("lastDeliveryStatus"),
        }
        for job in jobs
        if as_record(job.get("state")).get("lastRunAtMs")
    ]
    return {"entries": entries}


def event_search_text(event: dict[str, Any]) -> str:
    return "\n".join(
        [
            as_string(event.get("kind")),
            as_string(event.get("summary")),
            as_string(event.get("source")),
            as_string(event.get("sessionKey")),
            *[as_string(tag) for tag in event.get("tags", [])],
            *[as_string(item) for item in event.get("evidence", [])],
            as_string(event.get("outcome")),
        ]
    )


def handle_experience_capture(params: dict[str, Any]) -> dict[str, Any]:
    summary = require_string(params.get("summary"), "summary")
    state = load_experience_state()
    timestamp = now_ms()
    event = {
        "id": create_id("exp"),
        "kind": as_string(params.get("kind")) or "lesson",
        "summary": summary,
        "source": as_string(params.get("source")) or None,
        "sessionKey": as_string(params.get("sessionKey")) or None,
        "tags": normalize_string_array(params.get("tags")),
        "evidence": normalize_string_array(params.get("evidence")),
        "outcome": as_string(params.get("outcome")) or None,
        "createdAt": timestamp,
        "updatedAt": timestamp,
    }
    state["events"] = [event, *state["events"]]
    if is_complex_task_event(event):
        candidate = {
            "id": create_id("skill_candidate"),
            "title": summary[:72],
            "trigger": f"Use when a similar task appears: {summary}",
            "steps": [normalize_skill_step(item) for item in event["evidence"] if normalize_skill_step(item)] or ["Capture the observed failure", "Apply the proven fix", "Verify the outcome"],
            "status": "proposed",
            "evidenceEventIds": [event["id"]],
            "tags": normalize_string_array([*event["tags"], "autonomous", "agentskills.io"]),
            "createdAt": timestamp,
            "updatedAt": timestamp,
        }
        state["skillCandidates"] = [candidate, *state["skillCandidates"]]
    save_experience_state(state)
    return {"event": event}


def handle_experience_search(params: dict[str, Any]) -> dict[str, Any]:
    query = require_string(params.get("query"), "query")
    terms = tokenize_query(query)
    limit = params.get("limit") if isinstance(params.get("limit"), int) and params.get("limit") > 0 else 20
    state = load_experience_state()
    results: list[dict[str, Any]] = []
    for event in state["events"]:
        score = score_text(terms, event_search_text(as_record(event)))
        if score > 0:
            results.append({"type": "event", "id": event.get("id"), "summary": event.get("summary"), "score": score, "source": event.get("source"), "tags": event.get("tags"), "createdAt": event.get("createdAt")})
    for candidate in state["skillCandidates"]:
        text = " ".join([as_string(candidate.get("title")), as_string(candidate.get("trigger")), *[as_string(step) for step in candidate.get("steps", [])], *[as_string(tag) for tag in candidate.get("tags", [])]])
        score = score_text(terms, text)
        if score > 0:
            results.append({"type": "skill_candidate", "id": candidate.get("id"), "summary": candidate.get("title"), "score": score, "tags": candidate.get("tags"), "createdAt": candidate.get("createdAt")})
    for file_path in list_transcript_files():
        snippets: list[str] = []
        score = 0
        for row in transcript_text_rows(file_path):
            row_score = score_text(terms, row["text"])
            if row_score > 0:
                score += row_score
                if len(snippets) < 3:
                    snippets.append(row["text"][:240])
        if score > 0:
            results.append({"type": "conversation", "id": str(file_path), "summary": "\n".join(snippets), "score": score, "source": "transcript", "metadata": {"path": str(file_path)}})
    results.sort(key=lambda item: item.get("score", 0), reverse=True)
    return {"query": query, "results": results[:limit]}


def handle_experience_session_recall(params: dict[str, Any]) -> dict[str, Any]:
    query = require_string(params.get("query"), "query")
    terms = tokenize_query(query)
    limit = params.get("limit") if isinstance(params.get("limit"), int) and params.get("limit") > 0 else 10
    hits: list[dict[str, Any]] = []
    for file_path in list_transcript_files():
        for row in transcript_text_rows(file_path):
            score = score_text(terms, row["text"])
            if score > 0:
                hits.append({"id": row["id"], "path": row["path"], "role": row["role"], "snippet": row["text"][:320], "score": score})
    hits.sort(key=lambda item: item["score"], reverse=True)
    hits = hits[:limit]
    summary = f'Session recall for "{query}" found {len(hits)} hit(s).' if hits else f'No session memory matched "{query}".'
    return {"query": query, "backend": "text-scan", "summary": summary, "hits": hits}


def handle_experience_summary(params: dict[str, Any]) -> dict[str, Any]:
    limit = params.get("limit") if isinstance(params.get("limit"), int) and params.get("limit") > 0 else 10
    state = load_experience_state()
    self_model = as_record(state.get("selfModel"))
    self_model_facts = sum(len(self_model.get(key, [])) for key in ["strengths", "weaknesses", "preferences", "learnedPatterns", "nextGrowthAreas"] if isinstance(self_model.get(key), list))
    return {
        "counts": {
            "events": len(state["events"]),
            "skillCandidates": len(state["skillCandidates"]),
            "selfModelFacts": self_model_facts,
        },
        "recentEvents": state["events"][:limit],
        "recentSkillCandidates": state["skillCandidates"][:limit],
        "selfModel": state["selfModel"],
    }


def handle_skill_candidates_list(params: dict[str, Any]) -> dict[str, Any]:
    state = load_experience_state()
    status = as_string(params.get("status"))
    candidates = [candidate for candidate in state["skillCandidates"] if not status or as_record(candidate).get("status") == status]
    candidates.sort(key=lambda item: as_record(item).get("createdAt", 0), reverse=True)
    limit = params.get("limit")
    if isinstance(limit, int) and limit > 0:
        candidates = candidates[:limit]
    return {"candidates": candidates}


def handle_skill_candidates_create(params: dict[str, Any]) -> dict[str, Any]:
    timestamp = now_ms()
    candidate = {
        "id": create_id("skill_candidate"),
        "title": require_string(params.get("title"), "title"),
        "trigger": require_string(params.get("trigger"), "trigger"),
        "steps": normalize_string_array(params.get("steps")),
        "status": "proposed",
        "evidenceEventIds": normalize_string_array(params.get("evidenceEventIds")),
        "tags": normalize_string_array(params.get("tags")),
        "createdAt": timestamp,
        "updatedAt": timestamp,
    }
    state = load_experience_state()
    state["skillCandidates"] = [candidate, *state["skillCandidates"]]
    save_experience_state(state)
    return {"candidate": candidate}


def handle_skill_usage_record(params: dict[str, Any]) -> dict[str, Any]:
    candidate_id = require_string(params.get("candidateId"), "candidateId")
    state = load_experience_state()
    candidates = [as_record(candidate) for candidate in state["skillCandidates"]]
    index = next((i for i, candidate in enumerate(candidates) if candidate.get("id") == candidate_id), -1)
    if index < 0:
        raise ValueError(f"skill candidate not found: {candidate_id}")
    usage = {
        "id": create_id("skill_usage"),
        "candidateId": candidate_id,
        "successful": params.get("successful") is not False,
        "outcome": require_string(params.get("outcome"), "outcome"),
        "observations": normalize_string_array(params.get("observations")),
        "createdAt": now_ms(),
    }
    candidate = candidates[index]
    candidate["steps"] = normalize_string_array([*candidate.get("steps", []), *[normalize_skill_step(item) for item in usage["observations"]]])
    candidate["tags"] = normalize_string_array([*candidate.get("tags", []), "self-improved"])
    candidate["updatedAt"] = now_ms()
    state["skillCandidates"][index] = candidate
    state["skillUsage"] = [usage, *state["skillUsage"]]
    save_experience_state(state)
    return {"usage": usage, "candidate": candidate}


def handle_skill_candidates_export(params: dict[str, Any]) -> dict[str, Any]:
    candidate_id = require_string(params.get("candidateId"), "candidateId")
    state = load_experience_state()
    candidate = next((as_record(item) for item in state["skillCandidates"] if as_record(item).get("id") == candidate_id), None)
    if not candidate:
        raise ValueError(f"skill candidate not found: {candidate_id}")
    name = slugify(as_string(candidate.get("title")))
    directory = Path(as_string(params.get("targetDir"))).expanduser().resolve() if as_string(params.get("targetDir")) else generated_skills_dir() / name
    skill_path = directory / "SKILL.md"
    content = "\n".join(
        [
            "---",
            f"name: {name}",
            f"description: {json.dumps(as_string(candidate.get('trigger')) or 'Generated assistant skill', ensure_ascii=False)}",
            "---",
            "",
            f"# {as_string(candidate.get('title'))}",
            "",
            f"Trigger: {as_string(candidate.get('trigger'))}",
            "",
            "## Steps",
            *[f"{index + 1}. {step}" for index, step in enumerate(candidate.get("steps", []))],
            "",
        ]
    )
    directory.mkdir(parents=True, exist_ok=True)
    skill_path.write_text(content + "\n", encoding="utf-8")
    return {"name": name, "directory": str(directory), "skillPath": str(skill_path), "content": content}


def handle_strategy_memory_capture(params: dict[str, Any]) -> dict[str, Any]:
    timestamp = now_ms()
    memory = {
        "id": create_id("strategy"),
        "title": require_string(params.get("title"), "title"),
        "objective": require_string(params.get("objective"), "objective"),
        "cadence": as_string(params.get("cadence")) or "weekly",
        "nextPushAt": params.get("nextPushAt") if isinstance(params.get("nextPushAt"), (int, float)) else timestamp,
        "evidenceEventIds": normalize_string_array(params.get("evidenceEventIds")),
        "tags": normalize_string_array(params.get("tags")),
        "createdAt": timestamp,
        "updatedAt": timestamp,
    }
    state = load_experience_state()
    state["strategicMemories"] = [memory, *state["strategicMemories"]]
    save_experience_state(state)
    return {"memory": memory}


def cadence_ms(cadence: str) -> int:
    return {"hourly": 3_600_000, "daily": 86_400_000, "monthly": 2_592_000_000}.get(cadence, 604_800_000)


def handle_strategy_memory_due(params: dict[str, Any]) -> dict[str, Any]:
    current = params.get("now") if isinstance(params.get("now"), (int, float)) else now_ms()
    limit = params.get("limit") if isinstance(params.get("limit"), int) and params.get("limit") > 0 else 20
    state = load_experience_state()
    pushes = [
        {
            "id": memory.get("id"),
            "title": memory.get("title"),
            "prompt": f"Strategic push: {memory.get('objective')}",
            "cadence": memory.get("cadence"),
            "nextPushAt": memory.get("nextPushAt"),
            "evidenceEventIds": memory.get("evidenceEventIds", []),
            "tags": memory.get("tags", []),
        }
        for memory in [as_record(item) for item in state["strategicMemories"]]
        if isinstance(memory.get("nextPushAt"), (int, float)) and memory.get("nextPushAt") <= current
    ]
    pushes.sort(key=lambda item: item.get("nextPushAt", 0))
    return {"pushes": pushes[:limit]}


def handle_strategy_memory_advance(params: dict[str, Any]) -> dict[str, Any]:
    memory_id = require_string(params.get("id"), "id")
    pushed_at = params.get("pushedAt") if isinstance(params.get("pushedAt"), (int, float)) else now_ms()
    state = load_experience_state()
    for index, raw in enumerate(state["strategicMemories"]):
        memory = as_record(raw)
        if memory.get("id") == memory_id:
            memory["lastPushedAt"] = pushed_at
            memory["nextPushAt"] = int(pushed_at) + cadence_ms(as_string(memory.get("cadence")))
            memory["updatedAt"] = now_ms()
            state["strategicMemories"][index] = memory
            save_experience_state(state)
            return {"memory": memory}
    raise ValueError(f"strategic memory not found: {memory_id}")


def handle_self_model_get(_params: dict[str, Any]) -> dict[str, Any]:
    return {"selfModel": load_experience_state()["selfModel"]}


def handle_self_model_update(params: dict[str, Any]) -> dict[str, Any]:
    state = load_experience_state()
    model = as_record(state["selfModel"])
    for key in ["strengths", "weaknesses", "preferences", "learnedPatterns", "nextGrowthAreas", "evidenceEventIds"]:
        model[key] = merge_string_arrays(model.get(key), params.get(key))
    model["updatedAt"] = now_ms()
    state["selfModel"] = model
    save_experience_state(state)
    return {"selfModel": model}


def handle_user_model_update(params: dict[str, Any]) -> dict[str, Any]:
    state = load_experience_state()
    model = as_record(state["userModel"])
    for key in ["preferences", "goals", "communicationStyle", "constraints", "contradictions", "evidenceEventIds"]:
        model[key] = merge_string_arrays(model.get(key), params.get(key))
    model["updatedAt"] = now_ms()
    state["userModel"] = model
    save_experience_state(state)
    return {"userModel": model}


def handle_user_model_dialectic(params: dict[str, Any]) -> dict[str, Any]:
    query = require_string(params.get("query"), "query")
    model = load_experience_state()["userModel"]
    hypotheses = []
    for key in ["preferences", "goals", "communicationStyle", "constraints", "contradictions"]:
        for claim in model.get(key, [])[:3]:
            hypotheses.append({"claim": claim, "confidence": 0.6, "supportingEvidence": model.get("evidenceEventIds", []), "contradictingEvidence": []})
    return {"query": query, "answer": "; ".join(item["claim"] for item in hypotheses[:5]) or "No user model facts recorded yet.", "hypotheses": hypotheses, "model": model}


def deep_merge(base: Any, patch: Any) -> Any:
    if isinstance(base, dict) and isinstance(patch, dict):
        merged = dict(base)
        for key, value in patch.items():
            merged[key] = deep_merge(merged.get(key), value)
        return merged
    return patch


def handle_config_get(_params: dict[str, Any]) -> dict[str, Any]:
    cfg = load_config()
    return {"raw": json.dumps(cfg, ensure_ascii=False, indent=2), "config": cfg, "path": str(config_path())}


def handle_config_patch(params: dict[str, Any]) -> dict[str, Any]:
    raw = require_string(params.get("raw"), "raw")
    try:
        patch = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError(f"config.patch raw must be valid JSON: {exc}")
    if not isinstance(patch, dict):
        raise ValueError("config.patch raw must be an object")
    cfg = load_config()
    next_cfg = deep_merge(cfg, patch)
    save_config(next_cfg)
    changed_paths = sorted(patch.keys())
    append_log(f"config.patch changedPaths={','.join(changed_paths)}")
    return {"ok": True, "path": str(config_path()), "changedPaths": changed_paths, "config": next_cfg}


def handle_config_set(params: dict[str, Any]) -> dict[str, Any]:
    raw = require_string(params.get("raw"), "raw")
    try:
        cfg = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError(f"config.set raw must be valid JSON: {exc}")
    if not isinstance(cfg, dict):
        raise ValueError("config.set raw must be an object")
    save_config(cfg)
    append_log("config.set")
    return {"ok": True, "path": str(config_path()), "config": cfg}


def handle_config_schema(_params: dict[str, Any]) -> dict[str, Any]:
    return {
        "schema": {"type": "object", "additionalProperties": True},
        "uiHints": {},
        "version": "python-stdio",
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }


def handle_config_schema_lookup(params: dict[str, Any]) -> dict[str, Any]:
    path_value = as_string(params.get("path")) or "."
    return {"path": path_value, "schema": {"type": "object"}, "children": []}


def handle_logs_tail(params: dict[str, Any]) -> dict[str, Any]:
    path = log_path()
    cursor = normalize_int(params.get("cursor"), 0, minimum=0)
    limit = normalize_int(params.get("limit"), 200, minimum=1, maximum=5000)
    max_bytes = normalize_int(params.get("maxBytes"), 1_000_000, minimum=1, maximum=1_000_000)
    if not path.exists():
        return {"file": str(path), "cursor": 0, "size": 0, "lines": []}
    data = path.read_bytes()
    size = len(data)
    reset = cursor > size
    start = 0 if reset else cursor
    chunk = data[start:]
    truncated = False
    if len(chunk) > max_bytes:
        chunk = chunk[-max_bytes:]
        truncated = True
    text = chunk.decode("utf-8", errors="replace")
    lines = text.splitlines()[-limit:]
    return {"file": str(path), "cursor": size, "size": size, "lines": lines, **({"truncated": True} if truncated else {}), **({"reset": True} if reset else {})}


Handler = Callable[[dict[str, Any]], dict[str, Any]]

METHOD_DESCRIPTIONS: dict[str, str] = {
    "status": "Show embedded stdio gateway status",
    "config.get": "Read assistant configuration",
    "config.set": "Replace assistant configuration",
    "config.patch": "Merge a partial configuration object",
    "config.schema": "Describe configuration schema",
    "config.schema.lookup": "Describe a configuration subtree",
    "logs.tail": "Read recent gateway log lines",
    "gateway.methods": "List discoverable JSON-RPC methods",
    "gateway.method.describe": "Describe a JSON-RPC method",
    "tools.catalog": "List available tool groups",
    "tools.effective": "List tools effective for a session",
    "mcp.tools.list": "Discover tools exposed by configured MCP servers",
    "mcp.tools.call": "Call a tool exposed by a configured MCP server",
    "governance.overview": "Show governance overview",
    "autonomy.overview": "Show autonomy overview",
    "business.tasks.list": "List business tasks",
    "business.tasks.create": "Create a business task",
    "business.tasks.update": "Update a business task",
    "business.tasks.delete": "Delete a business task",
    "agents.parallel.start": "Start parallel agent tasks",
    "agents.parallel.status": "Show parallel agent task status",
    "agents.parallel.list": "List parallel agent batches",
    "agents.parallel.cancel": "Cancel a parallel agent batch",
    "agents.files.list": "List agent context files",
    "agents.files.get": "Read an agent context file",
    "agents.files.set": "Write an agent context file",
    "sessions.steer": "Redirect an active terminal run",
    "models.remoteList": "Probe a remote model endpoint",
    "skills.status": "Show skill system status",
    "skills.search": "Search installed/generated skills",
    "cron.status": "Show scheduler status",
    "cron.list": "List scheduled jobs",
    "cron.add": "Create a scheduled job",
    "cron.update": "Update a scheduled job",
    "cron.remove": "Remove a scheduled job",
    "cron.run": "Run a scheduled job",
    "cron.runs": "List scheduled job runs",
    "experience.capture": "Capture persistent experience",
    "experience.search": "Search experience and transcripts",
    "experience.sessionRecall": "Recall prior session messages",
    "experience.summary": "Summarize persistent experience",
    "skill.candidates.list": "List skill candidates",
    "skill.candidates.create": "Create a skill candidate",
    "skill.usage.record": "Record skill usage and improve candidate",
    "skill.candidates.exportAgentSkill": "Export candidate as SKILL.md",
    "strategy.memory.capture": "Capture strategic memory",
    "strategy.memory.due": "List due strategic pushes",
    "strategy.memory.advance": "Advance strategic memory cadence",
    "self.model.get": "Read persistent self model",
    "self.model.update": "Update persistent self model",
    "user.model.update": "Update persistent user model",
    "user.model.dialectic": "Query user model dialectically",
}

HANDLERS: dict[str, Handler] = {
    "status": handle_status,
    "config.get": handle_config_get,
    "config.set": handle_config_set,
    "config.apply": handle_config_set,
    "config.patch": handle_config_patch,
    "config.schema": handle_config_schema,
    "config.schema.lookup": handle_config_schema_lookup,
    "logs.tail": handle_logs_tail,
    "gateway.methods": handle_gateway_methods,
    "gateway.method.describe": handle_gateway_method_describe,
    "tools.catalog": handle_tools_catalog,
    "tools.effective": handle_tools_effective,
    "mcp.tools.list": handle_mcp_tools_list,
    "mcp.tools.call": handle_mcp_tools_call,
    "governance.overview": handle_governance_overview,
    "autonomy.overview": handle_autonomy_overview,
    "business.tasks.list": handle_business_tasks_list,
    "business.tasks.create": handle_business_tasks_create,
    "business.tasks.update": handle_business_tasks_update,
    "business.tasks.delete": handle_business_tasks_delete,
    "agents.parallel.start": handle_agents_parallel_start,
    "agents.parallel.status": handle_agents_parallel_status,
    "agents.parallel.list": handle_agents_parallel_list,
    "agents.parallel.cancel": handle_agents_parallel_cancel,
    "agents.files.list": handle_agents_files_list,
    "agents.files.get": handle_agents_files_get,
    "agents.files.set": handle_agents_files_set,
    "agents.list": handle_agents_list,
    "sessions.list": handle_sessions_list,
    "chat.history": handle_chat_history,
    "sessions.steer": handle_sessions_steer,
    "sessions.patch": handle_sessions_patch,
    "sessions.reset": handle_sessions_reset,
    "models.list": handle_models_list,
    "models.remoteList": handle_models_remote_list,
    "chat.send": handle_chat_send,
    "chat.abort": handle_chat_abort,
    "skills.status": handle_skills_status,
    "skills.search": handle_skills_search,
    "skills.bins": handle_skills_bins,
    "cron.status": handle_cron_status,
    "cron.list": handle_cron_list,
    "cron.add": handle_cron_add,
    "cron.update": handle_cron_update,
    "cron.remove": handle_cron_remove,
    "cron.run": handle_cron_run,
    "cron.runs": handle_cron_runs,
    "experience.capture": handle_experience_capture,
    "experience.search": handle_experience_search,
    "experience.sessionRecall": handle_experience_session_recall,
    "experience.summary": handle_experience_summary,
    "skill.candidates.list": handle_skill_candidates_list,
    "skill.candidates.create": handle_skill_candidates_create,
    "skill.usage.record": handle_skill_usage_record,
    "skill.candidates.exportAgentSkill": handle_skill_candidates_export,
    "strategy.memory.capture": handle_strategy_memory_capture,
    "strategy.memory.due": handle_strategy_memory_due,
    "strategy.memory.advance": handle_strategy_memory_advance,
    "self.model.get": handle_self_model_get,
    "self.model.update": handle_self_model_update,
    "user.model.update": handle_user_model_update,
    "user.model.dialectic": handle_user_model_dialectic,
}


def json_rpc_error(message: str, code: int = -32000) -> dict[str, Any]:
    return {"code": code, "message": message}


def handle_request(request: dict[str, Any]) -> None:
    request_id = request.get("id")
    if not isinstance(request_id, str) or not request_id:
        write_frame({"jsonrpc": "2.0", "error": json_rpc_error("request id must be a string", -32600)})
        return
    if request.get("jsonrpc") != "2.0":
        write_frame({"id": request_id, "jsonrpc": "2.0", "error": json_rpc_error("jsonrpc must be 2.0", -32600)})
        return
    method = as_string(request.get("method"))
    handler = HANDLERS.get(method)
    if not handler:
        write_frame(
            {
                "id": request_id,
                "jsonrpc": "2.0",
                "error": json_rpc_error(f"unknown stdio gateway method: {method or '<empty>'}", -32601),
            }
        )
        return
    try:
        result = handler(as_record(request.get("params")))
        write_frame({"id": request_id, "jsonrpc": "2.0", "result": result})
    except Exception as exc:
        write_frame({"id": request_id, "jsonrpc": "2.0", "error": json_rpc_error(str(exc))})


def main() -> None:
    emit_event(
        "gateway.ready",
        {
            "url": "stdio://python-tui-gateway",
            "methods": sorted(HANDLERS.keys()),
        },
    )
    for line in sys.stdin:
        if not line.strip():
            continue
        try:
            parsed = json.loads(line)
        except json.JSONDecodeError as exc:
            write_frame({"jsonrpc": "2.0", "error": json_rpc_error(str(exc), -32700)})
            continue
        if not isinstance(parsed, dict):
            write_frame({"jsonrpc": "2.0", "error": json_rpc_error("request must be an object", -32600)})
            continue
        handle_request(parsed)


if __name__ == "__main__":
    main()
