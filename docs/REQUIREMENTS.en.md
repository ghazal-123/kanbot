# Kanbot: Requirements (EN)

> **Kanbot** (kanban + bot): *Your sprint board with an AI teammate.*
> A personal todo app organised around agile sprints, with a simple AI assistant that helps you write todos, plan sprints and summarise them.

| | |
|---|---|
| **Document** | Product requirements, v1.0 |
| **Duration** | 1 week (7 days) |
| **Your job** | Build the **frontend** only |
| **Backend** | Already built in `kanbot/server`. Do not change it; treat it as the contract |
| **Language** | English only (no translations, no RTL) |
| **Companion docs** | [Implementation plan](IMPLEMENTATION-PLAN.en.md) (API design, architecture, day-by-day plan) · Wireframes in [`../design/wireframes`](../design/wireframes) · Logo in [`../design/logo`](../design/logo) |

---

## 1. Product overview

### 1.1 Problem
Todo apps are good at lists but bad at answering "what should I work on this week, and how did last week go?". Real agile tools such as Jira are too heavy for one person. Writing good todos and planning a realistic sprint also takes time.

### 1.2 Solution
Kanbot gives one user:
1. A **backlog**: everything they might work on, in priority order.
2. **Sprints**: a short time box (usually 2 weeks) with a goal and a set of todos taken from the backlog.
3. A **board** for the active sprint, with the columns **To Do → In Progress → In Review → Done**.
4. An **AI assistant** that can:
   - turn a short feature description into a list of todos,
   - suggest which backlog todos fit in the next sprint,
   - write a summary of a sprint,
   - answer questions about the project in a chat.

### 1.3 Target user
One person managing their own work: a student, a freelancer, or a developer on a side project. There are **no teams, sharing or assignees** in v1. Every project belongs to the user who created it.

### 1.4 Important: there is no UI design
**This project has no UI design and no visual design.** The wireframes in `design/wireframes` are **low-fidelity** and **greyscale**. They only show *what* is on each screen and roughly *where*. They do not show how it should look.

**You choose the UI and the design**: colours, typography, spacing, component library, icons, light/dark theme, animations. Treat this as part of the assignment: pick a direction early (Day 1) and apply it consistently. The Kanbot logo in `design/logo` is provided and may be used, recoloured or replaced.

---

## 2. Glossary

| Term | Meaning |
|---|---|
| **Project** | A container for a backlog and its sprints, e.g. "Mobile App Redesign". Has a short **key** (2–6 letters, e.g. `KAN`). |
| **Todo** | One piece of work. Identified by a key like `KAN-12`. Has a type, a priority, story points and a status. |
| **Backlog** | All todos of a project that are **not in any sprint**, in priority order (top = most important). |
| **Sprint** | A time box with a name, goal, start and end date. Status is **planned**, **active** or **completed**. |
| **Active sprint** | The one sprint currently in progress. A project has **at most one** active sprint. |
| **Board** | The active sprint's todos shown in 4 columns by status. |
| **Status** | `todo` (To Do), `in_progress` (In Progress), `in_review` (In Review), `done` (Done). |
| **Story points** | Effort estimate: 1, 2, 3, 5, 8 or 13. Can be empty (not estimated). |
| **Capacity** | How many story points the user thinks they can finish in one sprint. |
| **Carried over** | Todos not finished when a sprint is completed, moved to the backlog or to the next sprint. |
| **Mock mode** | When the backend has no AI key, a built-in rule-based "fake AI" answers instead. All features still work. |

---

## 3. Data at a glance

| Entity | Fields the UI uses |
|---|---|
| **User** | name, email |
| **Project** | name, key, description, stats (backlog count, total todos, active sprint) |
| **Todo** | key, title, description, type (`task`/`story`/`bug`), status, priority (`low`/`medium`/`high`/`urgent`), story points, labels, due date, sprint (or backlog), order |
| **Sprint** | name, goal, start date, end date, status, live stats (todos/points done), final stats when completed (incl. carried over), AI summary |

Exact shapes are in `server/src/types/api.ts` and the [implementation plan §4](IMPLEMENTATION-PLAN.en.md#4-backend-api-design).

---

## 4. Functional requirements

Every requirement has an ID and **acceptance criteria (AC)**. The AC are what the reviewer will test.

### 4.1 Authentication (AUTH)

| ID | Requirement | Acceptance criteria |
|---|---|---|
| AUTH-1 | **Register.** A visitor can create an account. | Form: name, email, password, confirm password. Client-side validation: all required, valid email, password ≥ 8 characters, confirm matches. Server validation errors (`details[]`) show under the matching field. A 409 shows "An account with this email already exists" under email. The submit button shows a loading state and can't be double-submitted. On success the user is signed in and goes to the projects page. |
| AUTH-2 | **Log in.** | Form: email, password. A 401 shows the server message ("Incorrect email or password.") above the form. On success go to the page the user originally asked for (`?redirect=`), or the projects page. |
| AUTH-3 | **Stay logged in.** The session survives a page reload. | The token is persisted (e.g. `localStorage`). On app start, if a token exists, call `GET /auth/me` while showing a full-page loader. Success → signed in. 401 → clear the token and show login. |
| AUTH-4 | **Log out.** | Available from the user menu or sidebar. Clears the token and any cached data, then goes to `/login`. |
| AUTH-5 | **Auth guard.** | Signed-out users who open any private page are redirected to `/login?redirect=<that page>`. Signed-in users who open `/login` or `/register` are redirected to the app. |
| AUTH-6 | **Expired session.** | **Any** 401 from any API call except login clears the session and redirects to `/login?redirect=<current page>` with a message "Your session has expired. Please log in again." |

### 4.2 Projects (PRJ)

| ID | Requirement | Acceptance criteria |
|---|---|---|
| PRJ-1 | **List projects.** | Projects page shows a card or row per project: name, key, description, backlog count, active sprint name (if any). Empty state with a "Create your first project" call to action. |
| PRJ-2 | **Create a project.** | Dialog/form: name (required), key (optional, 2–6 letters, uppercased automatically; if empty the server generates one), description (optional). A 409 on key shows "This key is already used" under the key field. After creating, open the new project's backlog. |
| PRJ-3 | **Edit a project.** | Name, key and description can be edited. Changing the key does not change existing todo keys (show a short hint). |
| PRJ-4 | **Delete a project.** | Needs a confirmation that names the project and warns that all its todos and sprints will be deleted. Then go back to the projects list. |
| PRJ-5 | **Switch project.** | A project switcher (e.g. in the sidebar) lists all projects and opens the selected one. The current project is remembered across reloads (the URL contains the project id). |

### 4.3 Backlog and todos (BL)

| ID | Requirement | Acceptance criteria |
|---|---|---|
| BL-1 | **See the backlog.** | `/projects/:id/backlog` lists backlog todos in `order`. Each row shows: key, title, type, priority, story points, labels. A header shows the count and total points. Empty state: "Your backlog is empty", with buttons to create a todo or generate todos with AI. |
| BL-2 | **Quick create.** | An inline "+ Create todo" input at the bottom of the backlog: typing a title and pressing Enter creates the todo (defaults: task, medium, no points) and keeps focus in the input for the next one. Escape cancels. |
| BL-3 | **Todo details.** | Clicking a todo opens a details view (modal or side panel) where every field can be edited: title, description (multi-line), type, status, priority, story points (1, 2, 3, 5, 8, 13 or none), labels, due date, sprint (Backlog or any planned/active sprint). Save → `PATCH /todos/:id`. Unsaved changes trigger "Discard changes?" when closing. Server validation errors appear under fields. |
| BL-4 | **Delete a todo.** | From the details view or the row menu, with a confirmation. The todo disappears from the list right away. |
| BL-5 | **Reorder the backlog.** | Drag and drop rows to change priority (`POST /todos/:id/move` with the new `position`). The new order shows immediately (optimistic update) and is rolled back with an error message if the request fails. A keyboard alternative or "Move to top / bottom" menu items are required for accessibility. |
| BL-6 | **Search and filter.** | A search box (key, title, description, labels) and filters for priority and type. Filters apply to the backlog list. While a filter is active, drag-and-drop reorder may be disabled (show why). |
| BL-7 | **Move between backlog and sprints.** | From the row menu or details view, a todo can be moved to any planned sprint or to the active sprint, and back to the backlog. Dragging a todo from the backlog into a planned sprint section is a nice-to-have. |

### 4.4 Sprints and board (SPR)

| ID | Requirement | Acceptance criteria |
|---|---|---|
| SPR-1 | **Create a sprint.** | "+ Create sprint" creates a planned sprint (name defaults to "Sprint N"; goal, start and end dates optional; end ≥ start). Planned sprints appear above the backlog on the backlog page as collapsible sections, each with its todos, todo count and total points. |
| SPR-2 | **Edit / delete a planned sprint.** | Name, goal and dates can be edited. Deleting a planned sprint (with confirmation) moves its todos back to the backlog. Active and completed sprints cannot be deleted (hide or disable the action). |
| SPR-3 | **Start a sprint.** | "Start sprint" on a planned sprint opens a small dialog with start date (default today) and end date (default +14 days). If another sprint is active, the button is disabled with an explanation (the server also returns 409). After starting, go to the board. |
| SPR-4 | **Active sprint board.** | `/projects/:id/board` shows the active sprint: name, goal, dates, days remaining, and a progress bar (`donePoints / totalPoints` and `doneTodos / totalTodos`). Four columns: To Do, In Progress, In Review, Done, each with a count. Cards show key, title, type, priority, points. Clicking a card opens the todo details (BL-3). No active sprint → empty state with a link to the backlog to plan and start one. |
| SPR-5 | **Move cards.** | Drag cards between columns and within a column (`POST /todos/:id/move` with `status` and `position`). Optimistic update with rollback on error. Progress updates right away. Non-drag alternative: change the status from the details view or the card menu. |
| SPR-6 | **Complete a sprint.** | "Complete sprint" opens a dialog that shows done and not-done counts and asks where unfinished todos go: **Backlog** (default) or any planned sprint. Optional checkbox "Generate AI summary" (calls AI-4 after completing). After completing, show the sprint's summary page. |
| SPR-7 | **Sprints history.** | `/projects/:id/sprints` lists all sprints (active, planned, completed) with name, dates, status badge and points done/total. Opening a sprint shows its details: stats (completed todos, points done, carried over, completion %), the list of todos, and its AI summary if there is one. |

### 4.5 AI assistant (AI)

Keep the AI part **simple**. The backend does all the AI work and returns finished JSON. The frontend sends a request, shows a loading state, and renders the result. There is **no streaming**, and the AI **never changes data on its own**: the user always reviews and confirms.

| ID | Requirement | Acceptance criteria |
|---|---|---|
| AI-1 | **Assistant panel + chat.** | An "Ask AI" button in the top bar opens a side panel (drawer) on every project page. It contains quick-action buttons (**Create todos**, **Plan sprint**, **Summarize sprint**), a message list and a text input. Sending a message calls `POST /projects/:id/ai/chat` with the **whole conversation** (the server stores nothing). Assistant replies render as **Markdown**. A "thinking…" indicator shows while waiting. Enter sends, Shift+Enter adds a new line. The conversation is kept while the panel is closed and reset when switching project (or with a "New chat" button). |
| AI-2 | **Generate todos.** | A dialog with a textarea ("Describe a feature…") and an optional count (1–10, default 5). "Generate" calls `POST /projects/:id/ai/generate-todos`. The result is a list of **draft** todos, each with a checkbox (all checked by default) and editable title, type, priority and points. "Add N to backlog" saves the checked ones with `POST /projects/:id/todos/bulk`, closes the dialog and shows them in the backlog. Nothing is saved before that click. |
| AI-3 | **Plan sprint.** | A dialog with **capacity** (story points, required, 1–200) and optional **focus**. "Suggest plan" calls `POST /projects/:id/ai/plan-sprint` and shows: the suggested goal (editable), the suggested backlog todos with checkboxes, the running total vs capacity, and the reasoning. "Create sprint with N todos" calls `POST /projects/:id/sprints` with `goal` and the checked `todoIds`. The new sprint appears as a planned sprint on the backlog page. |
| AI-4 | **Summarize sprint.** | On the board (active sprint) and on a completed sprint's page, "Summarize" calls `POST /sprints/:id/ai/summary` and shows the Markdown summary. The summary is saved by the server: show the saved one next time, with a "Regenerate" button and the time it was generated. |
| AI-5 | **AI states.** | All AI actions have: a loading state (buttons disabled, spinner/skeleton), an error state using the server message with a "Try again" button (502 `AI_ERROR`, 429 `RATE_LIMITED`), and a short disclaimer "AI can make mistakes. Review before saving." Call `GET /ai/status` once: when `mode` is `"mock"`, show a small "Mock AI" badge in the panel header so users know the answers are fake. |

---

## 5. Screens

The wireframes in `design/wireframes` show each screen. They define content and layout only, not visual design.

| # | Screen | Route | Requirements |
|---|---|---|---|
| 00 | Navigation flow | n/a | AUTH-5 |
| 01 | Login | `/login` | AUTH-2 |
| 02 | Register | `/register` | AUTH-1 |
| 03 | Projects | `/projects` | PRJ-1…5 |
| 04 | Backlog (with planned sprints) | `/projects/:projectId/backlog` | BL-1…7, SPR-1…3 |
| 05 | Active sprint board | `/projects/:projectId/board` | SPR-4, SPR-5 |
| 06 | Todo details | modal on top of any page | BL-3, BL-4 |
| 07 | AI assistant panel | drawer on any project page | AI-1, AI-5 |
| 08 | AI: generate todos | modal | AI-2 |
| 09 | AI: plan sprint | modal | AI-3 |
| 10 | Sprints history + summary | `/projects/:projectId/sprints(/:sprintId)` | SPR-7, AI-4 |
| 11 | Complete sprint | modal | SPR-6 |
| n/a | Not found | `*` | Friendly 404 with a link home |

---

## 6. Non-functional requirements

| ID | Area | Requirement |
|---|---|---|
| NFR-1 | Stack | React + TypeScript (strict) + Vite. No `any` without a comment explaining why. `npm run build` and `npm run lint` pass with no errors. |
| NFR-2 | States | Every data view has **loading**, **empty** and **error** states. No blank screens, no unhandled promise errors in the console. |
| NFR-3 | Feedback | Every mutation gives feedback (toast/snackbar or inline). Destructive actions need confirmation. |
| NFR-4 | Responsive | Fully usable from 1024px to wide desktop. Usable on tablet (768px): the sidebar collapses, the board scrolls horizontally. Phone support is a bonus. |
| NFR-5 | Accessibility | Semantic HTML, labelled form fields, visible focus, keyboard-usable dialogs (focus trap, Esc closes), colour is never the only signal (priority also has text or an icon), contrast AA. Drag and drop has a non-drag alternative. |
| NFR-6 | Performance | No request waterfalls on page load that can be avoided. Lists are not re-fetched on every keystroke (debounce search ≥ 300ms). Optimistic updates for drag and drop. |
| NFR-7 | Security | Only the JWT is stored client-side. Never log the token. Markdown from the AI is rendered without raw HTML. |
| NFR-8 | Code quality | Clear folder structure (see plan §3), an API layer separate from components, typed with the provided `api.ts`, no copy-pasted fetch calls in components. Small meaningful commits. |
| NFR-9 | Language | English only. All UI text in English. Dates shown in a readable format (e.g. "Oct 20 – Nov 2"). |

---

## 7. Out of scope (v1)

Teams, sharing, assignees, comments · custom columns or workflows · sub-tasks and epics · file attachments · notifications and email · password reset and social login · real-time sync between tabs · AI that edits data without confirmation · AI streaming · charts beyond the progress bar and stat tiles · multi-language / RTL · any backend change.

---

## 8. Deliverables

1. A `client/` folder inside `kanbot/` with the React app.
2. `client/README.md`: how to run it, the UI library and design choices you made **and why**, the requirements you completed, known issues.
3. A short demo (video or live) covering: register → create project → generate todos with AI → plan sprint with AI → start sprint → move cards → complete sprint → AI summary.

### 8.1 How it will be evaluated

| Area | Weight |
|---|---|
| Functional requirements work as described (AC) | 40% |
| AI features (AI-1…AI-5) including loading/error states | 15% |
| UI/UX quality and consistency of **your** design choices | 15% |
| Code quality, structure, typing | 15% |
| States, accessibility, responsiveness (NFR) | 10% |
| README + demo | 5% |

---

## 9. These are the base requirements: go further

**This document is the base.** Everything above is the minimum for a complete project. You are free to **add any enhancements you want**, as long as the base requirements keep working. Document each enhancement in your README. Enhancements that need backend changes are fine to fake on the frontend (e.g. `localStorage`) as long as you explain it.

Some ideas, from small to large:

**UX and polish**
- Dark mode with a theme toggle (remember the choice).
- Keyboard shortcuts: `c` create todo, `/` focus search, `?` shortcut help, `g b` go to board.
- A command palette (Ctrl/Cmd + K) to jump to projects, todos and actions.
- Undo toast after delete or move ("Todo deleted · Undo").
- Animations for drag and drop, dialogs and the progress bar.
- Inline editing of title and points directly on cards and rows.
- Mobile layout: bottom navigation, board as swipeable columns.

**Productivity**
- Due-date indicators (overdue in red, due today) and a "My week" view.
- Label management with colours, and filter by label.
- Bulk actions: select several todos → move to sprint / change priority / delete.
- Burndown chart for the active sprint (computed from `completedAt`).
- Velocity chart across completed sprints (from `completedStats`).
- Export the backlog or a sprint summary to Markdown or CSV.
- Sprint templates (default length, default capacity).

**AI**
- "Improve this todo" button in the details view: send the todo to the chat and ask for a better title, description and acceptance criteria.
- "Estimate" button: ask the chat to suggest story points for unestimated todos.
- Suggested prompts in the chat panel depending on the page (backlog vs board).
- Save chat history per project in `localStorage`.
- A daily stand-up helper: "What did I do yesterday, what's next, any blockers?" generated from recent `completedAt` dates.
- Typewriter effect when showing AI answers (simulated streaming).

**Engineering**
- Unit tests (Vitest + Testing Library) for the API client, auth guard and key components.
- End-to-end tests (Playwright) for the main flow.
- Error boundary with a friendly crash screen.
- Storybook for your component library.
- PWA: installable, with an offline banner.
- Deploy the frontend (Vercel / Netlify) and the backend (Render / Railway).
