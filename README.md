# Flowly – frontend

Angular 22 client for Flowly: plan your day across projects as a kanban board with **swimlanes**.

The Django API lives in the separate `flowly-backend` repository.

## Features

- **My day** board: To do / In progress / Done columns, one swimlane per project, assignee, or tag in
  any tag group you define (e.g. Context: @office / @home). You can also turn grouping off.
- Drag cards between columns and lanes. Moving to another lane changes the task's project, assignee or tag.
- **Backlog** side panel with unscheduled tasks. Drag them onto the board to plan them for the day,
  or drag board cards back to unschedule them.
- **Carry over**: unfinished tasks from earlier days show up with a ↻ badge.
- **Mine / Everyone** scope, previous/next day navigation, collapsible lanes, hide empty lanes,
  quick-add per lane, full task editor.
- Workspaces with members, roles and email invitations, plus pages to manage projects and tags.
- View settings are kept in the URL (`?date=&group=&scope=`) and in localStorage per workspace.

## Run it

With Docker (production build served by nginx):

```bash
API_URL=http://localhost:8000/api docker compose up -d --build   # http://localhost:8080
```

`API_URL` is written to `/config.json` when the container starts, so one image works with any backend.
`WEB_PORT` changes the host port. Add the frontend's origin to the backend's `CORS_ALLOWED_ORIGINS`.

Local development (Node 20.19+ / 22+):

```bash
npm ci
npm start            # http://localhost:4200, reads public/config.json (default API http://localhost:8000/api)
```

or without a local Node:

```bash
docker run --rm -it -p 4200:4200 -v "$PWD":/app -w /app node:22-alpine sh -c "npm ci && npx ng serve --host 0.0.0.0"
```

## Layout

```
src/app/core/        config, auth (JWT + refresh interceptor), API client, workspace store, models
src/app/pages/       auth, shell (top bar, workspace switcher), day-board, projects, tags, members
src/app/components/  task-card, task-dialog, toast
```

How swimlanes work is in `pages/day-board/lanes.ts`. Each lane knows which task fields put a card in it,
so dropping a card sends a single PATCH with those fields plus `status`, `position` and `planned_date`.
