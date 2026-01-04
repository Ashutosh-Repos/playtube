# PlayTube - Web Application

This is the frontend application for PlayTube, a modern video sharing platform.

## Tech Stack
- **Framework**: Next.js 15 (App Router)
- **UI**: Tailwind CSS, ShadCN UI, Aceternity UI
- **Auth**: Custom JWT (Access + Refresh Tokens) with Server Actions
- **State**: Server Components + React Context (Client)
- **Database**: Prisma ORM (Postgres)
- **Event Bus**: RabbitMQ

## Getting Started

1.  **Install dependencies**:
    ```bash
    pnpm install
    ```

2.  **Environment Setup**:
    Ensure your `.env` file is configured with:
    - `DATABASE_URL`
    - `REDIS_URL`
    - `RABBITMQ_URL`
    - `AUTH_PRIVATE_KEY` / `AUTH_PUBLIC_KEY`

3.  **Run Development Server**:
    ```bash
    pnpm dev
    ```

## Project Structure
- `app/(auth)`: Authentication pages (Login, Register).
- `app/(home)`: Main dashboard and video feeds.
- `lib/auth`: Core authentication logic (Session, Tokens, Cookies).
- `components/ui`: Reusable UI components (ShadCN).
- `actions`: Server Actions for form mutations.
