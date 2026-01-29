# Project Manager – Reference Document

This document is the **single source of truth** for building the Project Manager app.

---

## 1. Tech Stack

### Frontend

* **Next.js (App Router)**
* **shadcn/ui** for all UI components
* Tailwind CSS
* Dark-first design

### Backend

* **Neon Auth** – authentication & user management
* **Neon Database (PostgreSQL)** – core data storage
* Server Actions / API Routes

---

## 2. Design System

### Color Scheme

* Background: **Pure Black (#000000)**
* Surface / Cards: **Near Black (#0a0a0a – #111111)**
* Text: **White (#ffffff)**
* Muted Text: **Gray (#a1a1aa)**
* Border: **Neutral dark gray (#1f2937)**

### Primary Brand Color

* **Primary:** `#72f1b8`
* Hover: slightly darker tint
* Focus rings & active states use primary

### UI Principles

* Minimal
* High contrast
* No unnecessary gradients
* Clean spacing
* Fast & responsive

---

## 3. Auth & User Model

### Authentication (Neon Auth)

* Email + password
* OAuth-ready (future)
* Session-based auth

### User Roles

* `OWNER`
* `ADMIN`
* `MEMBER`
* `VIEWER`

Role-based access enforced at:

* API layer
* UI (disabled / hidden actions)

---

## 4. Core Entities (Database Level)

### User

* id
* name
* email
* role
* createdAt

### Organization

* id
* name
* ownerId
* createdAt

### Project

* id
* organizationId
* name
* description
* status (planning | active | on_hold | completed)
* startDate
* endDate
* createdAt

### Task

* id
* projectId
* title
* description
* status (todo | in_progress | done)
* priority (low | medium | high)
* assigneeId
* dueDate
* createdAt

### Subtask

* id
* taskId
* title
* completed

### Comment

* id
* taskId
* userId
* content
* createdAt

---

## 5. Core Features (MVP)

### Projects

* Create / edit / archive projects
* Assign members
* Project status tracking

### Tasks

* CRUD tasks
* Drag & drop Kanban
* Subtasks
* Due dates & priorities

### Views

* List View
* Kanban View

### Collaboration

* Comments on tasks
* @mentions (future-ready)

---

## 6. shadcn/ui Components to Use

### Layout

* `Sidebar`
* `Sheet`
* `Separator`

### Navigation

* `Tabs`
* `Breadcrumb`

### Data Display

* `Card`
* `Table`
* `Badge`
* `Progress`

### Forms

* `Button`
* `Input`
* `Textarea`
* `Select`
* `Checkbox`
* `Calendar`

### Feedback

* `Toast`
* `AlertDialog`
* `DropdownMenu`

---

## 7. Pages & Routes

### Auth

* /login
* /register

### App

* /dashboard
* /projects
* /projects/[projectId]
* /projects/[projectId]/tasks

---

## 8. Permissions Matrix (High Level)

| Action         | Owner | Admin | Member | Viewer |
| -------------- | ----- | ----- | ------ | ------ |
| Create Project | ✅     | ✅     | ❌      | ❌      |
| Edit Project   | ✅     | ✅     | ❌      | ❌      |
| Create Task    | ✅     | ✅     | ✅      | ❌      |
| Edit Task      | ✅     | ✅     | ✅      | ❌      |
| Comment        | ✅     | ✅     | ✅      | ❌      |

---

## 9. Dark UI Rules

* No pure white surfaces
* Borders always subtle
* Primary color only for actions & highlights
* Avoid visual noise

---

## 10. Future Enhancements (Not MVP)

* Time tracking
* Gantt view
* Reports & analytics
* Automations
* AI task breakdown

---

## 11. Development Notes

* Read `docs/features.md` before implementing any feature
* Every feature must map to this document
* Keep components reusable
* No inline styling

---

**This document is the reference.**
If something is unclear, update this doc first before writing code.
