# Satış Eğitim Platformu - Sales Training Platform

## Overview
This is a comprehensive sales training platform using Azure OpenAI's Realtime API. The system enables sales personnel (IKÇO) to practice conversations with an AI customer, with full session tracking, evaluation, and team lead oversight.

### Key Features
- **Real-time voice conversations** with AI acting as a customer (based on CSV customer profile)
- **User authentication** with role-based access (IKÇO and Team Lead)
- **Session management** - All conversations are tracked and stored
- **Performance evaluation** - AI-powered analysis of sales conversations
- **Dashboards** - Separate dashboards for IKÇO and Team Leads
- **Customer Profile** - AI configured from CSV file to act as "Sağlam İnşaat" company representative

## Project Architecture

### Backend (Node.js + Express)
- **Framework**: Express.js with TypeScript
- **Database**: SQLite with Prisma ORM
- **Authentication**: JWT + bcrypt
- **API Port**: 3000

### Frontend (Vite + TypeScript)
- **Framework**: Vite + TypeScript + Tailwind CSS
- **Main Entry Point**: `src/main.ts`
- **Audio Processing**: Custom audio worklet processors
- **Frontend Port**: 5000

### Database Schema (Prisma)
- **Users**: Authentication and role management (IKÇO/TEAM_LEAD)
- **Sessions**: Conversation sessions with start/end times
- **Transcripts**: Speaker-based conversation transcripts
- **Evaluations**: AI-generated performance evaluations with scores

## Recent Changes (October 2, 2025)
- **Transformed into sales training platform** with full authentication system
- **Created backend API** with Express + Prisma for session/transcript management
- **Implemented customer profile** from CSV (Sağlam İnşaat Taahhüt LTD)
- **Built professional UI** with Tailwind CSS for login, dashboards
- **Integrated session tracking** - conversations auto-saved to database
- **Added role-based access** - IKÇO and Team Lead roles
- **Created Team Lead dashboard** with performance metrics and charts
- **Integrated evaluation system** - results saved to database with scores

## Key Files

### Backend
- `server/index.ts` - Express API server with auth and session routes
- `server/customer-profile.ts` - CSV-based customer profile configuration
- `prisma/schema.prisma` - Database schema definition

### Frontend
- `src/main.ts` - Main conversation logic with backend integration
- `src/api.ts` - API helper for backend communication
- `login.html` - Authentication page (login/register)
- `dashboard.html` - IKÇO dashboard with personal stats
- `team-dashboard.html` - Team Lead dashboard with team overview
- `session.html` - Session detail view with transcript and evaluation
- `index.html` - Real-time conversation interface

### Customer Profile
- `attached_assets/Book(Sayfa1)_1759420297416.csv` - Customer profile data source

## Development

### On Replit
The application is fully configured and ready to run on Replit:
1. Dependencies are already installed
2. Prisma client is generated automatically
3. Database is initialized (SQLite with Prisma)
4. JWT_SECRET is configured in the workflow
5. Workflow runs both backend and frontend with: `npm run dev`
   - Backend runs on http://localhost:3000
   - Frontend runs on http://0.0.0.0:5000 (accessible via Replit's webview)

### Local Development
1. Install dependencies: `npm install`
2. Generate Prisma client: `npx prisma generate`
3. Push database schema: `npx prisma db push`
4. **Set JWT_SECRET environment variable**: 
   ```bash
   export JWT_SECRET="your-secret-key-here"
   ```
5. Run dev servers (both frontend and backend): `npm run dev`
   - Backend runs on http://localhost:3000
   - Frontend runs on http://localhost:5000

**Note**: JWT_SECRET is REQUIRED. The backend will fail to start without it. Use a strong, random secret in production.

### Azure OpenAI Configuration
To use the real-time voice features, you need to configure Azure OpenAI credentials:
1. You'll need an Azure OpenAI endpoint with Realtime API access
2. Set the following when starting a conversation:
   - AZURE_OPENAI_ENDPOINT
   - AZURE_OPENAI_API_KEY
   - AZURE_OPENAI_DEPLOYMENT_NAME (e.g., "gpt-4o-realtime-preview")

## User Roles

### IKÇO (Sales Personnel)
- Create accounts and login
- Practice sales conversations with AI customer
- View personal conversation history
- Access evaluation results
- Track performance metrics

### Team Lead
- View all IKÇO performance metrics
- Access all conversation sessions
- Review evaluations and transcripts
- Monitor team performance with charts
- Track individual IKÇO progress

## Customer Profile (AI Configuration)
The AI acts as **Tansu Tan**, İK Müdürü at **Sağlam İnşaat Taahhüt LTD**:
- Company: 150 employees, 20 annual turnover
- Current tools: LinkedIn, Eleman.net, Secret CV
- Pain points: Cost, quality applicants, speed
- Needs: 5 sales reps + 2 admin staff in January
- Decision maker: Yes
- Budget conscious, needs ROI proof

## Deployment
- Build: `npm run build`
- Backend must run alongside frontend in production
- Deployment target: VM (stateful - maintains sessions)
- Environment variables needed:
  - JWT_SECRET (for authentication)
  - Azure OpenAI credentials for realtime and evaluation

## API Endpoints
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `POST /api/sessions/start` - Start new conversation session
- `POST /api/sessions/:id/end` - End conversation session  
- `POST /api/sessions/:id/transcript` - Save transcript
- `POST /api/sessions/:id/evaluation` - Save evaluation
- `GET /api/sessions` - Get user's sessions
- `GET /api/team-lead/overview` - Team performance overview (Team Lead only)
- `GET /api/team-lead/sessions` - All sessions (Team Lead only)
