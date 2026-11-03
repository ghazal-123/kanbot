# 🤖 Kanbot Full Frontend UI/UX Specification (MUI + Tailwind)

This document contains the absolute core visual guidelines, component mappings, animations, and front-end state/logic requirements for Kanbot. The AI Agent must follow these specifications strictly to build all application views flawlessly.

---

## 🎨 1. Theme, Color Palette & Brand Assets
All application views must fully support Dark & Light modes seamlessly by combining Tailwind CSS classes with MUI context/components:
- Application Logo Source: All official branding logos, icons, and asset graphics are securely stored and located inside the src/assets/ folder. Use these assets across placeholder headers, welcome text card view boxes, and the main navigation shell sidebar.
- Primary Theme Color: Robot Neon Violet/Indigo (bg-indigo-600 / hover:bg-indigo-700 / MUI: Primary). Used for main call-to-actions, active navigation markers, and primary buttons.
- AI & Success Accent Color: Smart Neon Green (bg-green-500 / hover:bg-green-600 / MUI: Success). Used for AI assistants, bulk task generation tools, and fully completed sprint tracking item indicators.
- Light Mode UI System: Main App Wrapper Background: bg-slate-50, Content Cards & Dropdowns: bg-white, Core Text Elements: text-slate-900.
- Dark Mode UI System: Main App Wrapper Background: Space Dark Navy (dark:bg-[#0B1329]), Content Cards & Dropdowns: dark:bg-slate-900, Core Text Elements: dark:text-white.

---

## 🎬 2. Micro-Animations & Fluid UX Transitions
- Page Transitions: Implement smooth opacity fade-ins (transition-all duration-300 ease-in-out) when switching layout views via React Router links.
- Button Interactivity: Add tactile scaling compression effects (active:scale-95) on user click triggers, with soft elegant shadow glows on element hover.
- Loading Architecture: Replace standard blank canvas elements with elegant shimmer skeletons blocks or native custom MUI loaders/spinners during API endpoint request delays.

---

## 🔄 3. Advanced Interactions (Drag & Drop Canvas)
- Fluid Task Dragging: Task cards must glide smoothly and beautifully when dragged inside or between Planned Sprints containers and the global Backlog list, or across the primary Kanban Board workout columns (To Do, In Progress, Done).
- Optimistic UI Updates Strategy: When a card item is dropped, instantly update its position or category status state visually on the view screen layout before waiting for the network API response to complete.
- Error Rollback Animation: If the server API fails during a drop payload action, the front-end client must automatically play a snap-back animation returning the task card to its original exact coordinates, while triggering a clean toast error notification.

---

## 🧠 4. Artificial Intelligence Logic & Memory Management
- Mock AI Awareness: The assistant operates on a local server endpoint in Mock Mode. Maintain clean loading overlay status screens during prompts. All rich text or chat logs returned from the backend must render correctly utilizing Markdown text styling elements.
- Front-End Memory Management: The server database does not retain conversation history context. The front-end React client must store the full chat message array object state locally and transmit the entire multi-turn conversation list to POST /api/projects/:projectId/ai/chat on every single new user interaction request loop.

---

## 🚨 5. Form Validations & Error Handling (Zod Schemas)
- All user inputs in Login and Register forms must be strictly processed and validated client-side utilizing Zod tracking schema validation prior to dispatching Axios requests.
- Catch 409 database conflicts (like existing duplicate email registrations) or validation faults, and render clean localized warning indicators directly underneath the corresponding field text inputs.