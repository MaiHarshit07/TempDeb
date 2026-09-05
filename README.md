# Debate Platform

A production-style debate and discussion platform built with React, Vite, Express, Prisma, and PostgreSQL.

## Stack

- Frontend: React, Vite, React Router, Axios, Tailwind CSS
- Backend: Node.js, Express, JWT auth, bcryptjs, Helmet, rate limiting
- Database: PostgreSQL + Prisma ORM

## Features

- User authentication with JWT
- Topic creation, listing, search, and filtering
- Comment threads with nested replies
- Voting with upvote/downvote and vote switching
- Notification feed and read state
- For You recommendation feed based on categories and impact
- Profiles and moderator-ready role system
- Basic reporting and moderation endpoints

## Project structure

- `/client` – Vite React frontend
- `/server` – Express API and Prisma schema

## Quick start

1. Create `.env` from the example file.
2. Start PostgreSQL and update `DATABASE_URL`.
3. Run Prisma migration and seed:
   - `cd server`
   - `npx prisma migrate dev --name init`
   - `npm run prisma:seed`
4. Start backend:
   - `npm run dev`
5. Start frontend:
   - `cd client`
   - `npm run dev`

## Environment variables

Create `/server/.env` with:

```env
PORT=5000
CLIENT_URL=http://localhost:5173
JWT_SECRET=replace-with-a-strong-secret
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/debate_platform?schema=public"
MODERATOR_TOKEN_THRESHOLD=1000
```

For the client, optionally create `/client/.env` to point at a different API:

```env
VITE_API_URL=http://localhost:5000/api
```

## Prisma

```bash
cd server
npx prisma generate
npx prisma migrate dev
npm run prisma:seed
```

## Scripts

Backend:

```bash
cd server
npm run dev
npm test
```

Frontend:

```bash
cd client
npm run dev
npm run build
```

## Future features

- Real-time websocket notifications
- AI moderation and summarization
- ML recommendation pipeline
- Reputation and badge systems
- Follow and direct messaging
- Debate tournaments and polls
- Analytics dashboard
