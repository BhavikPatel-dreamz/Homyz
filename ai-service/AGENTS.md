# Universal Python Agent Instructions & Guidelines

> **Instructions for AI Agent:** Read this document before making any changes. Adhere strictly to the workspace structure, coding standards, environment mandates, and documentation rules outlined below.

---

## 1. Project Overview & Quick Reference
- **Project Name:** `homyz-ai-backend`
- **Language & Runtime:** Python 3.10+
- **Primary Framework:** FastAPI (ASGI)
- **Application Directory:** `app/`
- **Main Entry Point:** `app/main.py`
- **Dependencies:** `app/requirements.txt`
- **Docs Directory:** `00_Docs/`
- **Vector Database:** Development: Qdrant Cloud Free Tier (`cloud.qdrant.io`) | Deployment: Local / Self-Hosted Qdrant (`localhost:6333`)
- **LLM / Vision Provider:** 1 OpenAI API Key (`gpt-4o-mini`, `text-embedding-3-small`, `omni-moderation-latest`)

---

## 2. Directory Layout & Workspace Structure
All application code, configuration, tests, and dependencies must live strictly inside the `app/` directory. Never place loose application source files in the project root.

```text
.
├── 00_Docs/                   # Central Project Documentation (Source of Truth)
│   ├── PENDING_TASKS.md       # Task list & progress tracker
│   ├── PROJECT_OVERVIEW.md    # High-level architecture & requirements
│   ├── API_DOCUMENTATION.md   # Endpoint contracts & payload schemas
│   ├── CODING_STANDARDS.md    # Coding guidelines & architecture patterns
│   ├── LOCAL_SETUP_GUIDE.md   # Local Docker & Python setup instructions
│   └── PROVIDER_MIGRATION_GUIDE.md # LLM Provider Switching (Gemini <-> OpenAI)
├── app/                       # Self-Contained Application Root
│   ├── .venv/                 # Local Python virtual environment (strictly inside app/)
│   ├── main.py                # Main application entry point & middleware
│   ├── requirements.txt       # Python dependencies
│   ├── .env                   # Local secrets (never committed)
│   ├── .example.env           # Template for environment variables
│   ├── api/                   # Route handlers (Controllers)
│   │   └── v1/                # Versioned endpoints
│   ├── core/                  # Configuration, security, and constants
│   │   ├── config.py          # Pydantic BaseSettings & env parsing
│   │   ├── security.py        # API key verification
│   │   ├── constants.py       # Global static constants
│   │   └── exceptions.py      # Domain custom exceptions
│   ├── services/              # Business Logic Layer (The "Brain")
│   ├── models/                # Pydantic schemas (Request/Response models)
│   ├── utils/                 # Shared helper utilities (logging, formatting, etc.)
│   └── tests/                 # Unit and integration test suite
├── docker-compose.yml         # Local Qdrant container runner
├── AGENTS.md                  # Agent instruction file
└── .gitignore                 # Ignores .env, __pycache__, .pytest_cache
```

---

## 3. Documentation Management (`00_Docs/`)
- **Source of Truth:** The `00_Docs/` folder contains the authoritative documentation for the project.
- **Task Tracking:** Always update `00_Docs/PENDING_TASKS.md` immediately upon completing a task (`[x]`) or identifying a new requirement.
- **Syncing Architecture & APIs:** Whenever endpoints, schemas, or architectural flows change, update the corresponding markdown files in `00_Docs/` (`API_DOCUMENTATION.md`, `PROJECT_OVERVIEW.md`).
- **No Orphaned Features:** Never leave code changes undocumented.
- **Backend API Documentation Scope:** Backend documentation (`API_DOCUMENTATION.md`) must strictly document **what was built on the backend** (HTTP methods, endpoints, request/response JSON schemas, status codes, error payloads, and TypeScript DTO types). **Never include frontend framework implementation code** (e.g. React/Vue components, JSX/TSX snippets, state hooks, `fetch`/`axios` client calls, or UI styling tips). Keep documentation focused purely on the backend API contracts.

---

## 4. Environment & Secrets Management (`app/`)
- **Centralized Config:** Manage all environment variables inside `app/core/config.py` using Pydantic `BaseSettings`.
- **Zero Secret Commits:** Never commit `app/.env` or any file containing real API keys, credentials, or tokens.
- **Mandatory `.example.env` Sync:** Whenever an environment variable is introduced or modified in `app/core/config.py`, immediately add/update its placeholder in `app/.example.env`.
- **Pre-Modification Check:** Always inspect `app/core/config.py` and `app/.example.env` before implementing configuration-dependent features.

---

## 5. Architecture & Code Structure (Modular Pattern)
- **App Entry Point:** `app/main.py` is the single root of execution, startup/shutdown lifecycles, and middleware configuration.
- **Single Responsibility Principle (SRP):** Each class, function, and module must have one clearly defined responsibility.
- **Thin Route Handlers (`app/api/`):**
  - Routes only handle HTTP request validation, status codes, and delegating calls to services.
  - Do not write complex business logic, third-party API calls, or database queries directly inside route functions.
- **Service Layer (`app/services/`):**
  - All core business logic, external API integrations, and Qdrant operations must reside in `app/services/`.
  - Use class-based services with dependency injection for clean testing and mocking.
- **Data Schemas (`app/models/`):**
  - Define all request payloads, query parameters, and response bodies as Pydantic models.

---

## 6. Python Coding Standards
- **Strict Typing:** All function arguments and return types **MUST** include explicit Python type hints (`typing` module or native 3.10+ types).
- **Naming Conventions:**
  - Modules & Files: `snake_case.py`
  - Classes: `PascalCase`
  - Functions & Variables: `snake_case`
  - Constants: `UPPER_SNAKE_CASE`
- **Asynchronous First:** Use `async` / `await` for all I/O-bound operations (network requests, DB queries, streaming, file I/O).
- **Error Handling:** 
  - Never use bare `except:`.
  - Catch specific exceptions and raise unified domain exceptions from `core.exceptions` (e.g., `NotFoundError`, `BadRequestError`, `AuthenticationError`, `AIProviderError`) rather than direct FastAPI `HTTPException` in domain services.
  - Use global exception handlers in `main.py` (`@app.exception_handler(AppException)`) to map domain exceptions to standard HTTP status codes and structured JSON `{detail, code}` responses without leaking sensitive stack traces to clients.

---

## 7. Agent Behavior & Execution Workflow
1. **Pre-Check:** Read existing files, `00_Docs/`, and `app/core/config.py` before modifying code.
2. **Explicit Scope:** Work strictly on the requested task. Do not refactor unrelated modules or jump to future tasks without explicit user approval.
3. **Preserve Integrity:** Keep existing comments, docstrings, and logic intact unless instructed otherwise.
4. **No Placeholders:** Never commit dummy mock logic or unfinished `TODO` placeholders in production paths.
5. **Verification:** Run tests and check syntax after making changes to ensure zero regressions.
