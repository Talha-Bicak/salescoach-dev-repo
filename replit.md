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

## Recent Changes (October 6, 2025)
### Database Migration to MSSQL
- **Migrated from SQLite to Microsoft SQL Server**
  - Updated Prisma schema for SQL Server with proper data types
  - Created Docker Compose configuration for local MSSQL testing
  - Added comprehensive MSSQL_MIGRATION_GUIDE.md with step-by-step instructions
  - Connection string configured for MSSQL (port 1433, SA user)
  - Long text fields now use @db.NVarChar(Max) for Turkish character support

### UI/UX Improvements
- **Login/Registration Page (login.html)**
  - Increased input field sizes for better usability (py-4 instead of py-3)
  - Improved form symmetry with consistent spacing (mb-3, space-y-6)
  - Larger buttons with better visual hierarchy (py-4, text-lg)
  - Widened form container (max-w-xl) for better desktop experience
  
- **Dashboard Pages (dashboard.html, team-dashboard.html)**
  - Added custom gradient scrollbars matching the design theme
  - Implemented scrolling with max-height constraints (600px, 500px)
  - Smooth scrolling behavior for better UX
  - Team dashboard now uses modern gradient navigation (matching other pages)
  - Enhanced navigation bar with backdrop blur and improved iconography
  
- **Templates Page (templates.html)**
  - Added animated arrow icons on card hover (rotating arrow in circle)
  - Enhanced card hover effects with increased elevation and border glow
  - Improved typography with bullet points and star icons on badges
  - Added hover effects to category titles with transform animations
  - Enhanced back button with directional animation
  - Larger title with decorative underline
  
- **Conversation Page (index.html)**
  - Updated navigation to match modern gradient design across all pages
  - Added user avatar icon and improved header spacing
  - Consistent backdrop blur effects and white/purple color scheme

### Scoring System Analysis
- **Comprehensive evaluation of current scoring mechanism**
  - Identified regex-based score extraction issues
  - Documented problems with simple averaging approach
  - Provided detailed improvement recommendations:
    1. Structured JSON output from Azure OpenAI
    2. Weighted average calculations
    3. Template-specific evaluation criteria
    4. Confidence level tracking
    5. Performance trend analysis
    6. Database schema enhancements for detailed scoring

## Previous Changes (October 2, 2025)
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

### Database Options

#### Option 1: SQLite (Current - Simple, No Setup Required)
The application currently uses SQLite and is fully configured:
1. Dependencies are already installed
2. Prisma client is generated automatically
3. Database file: `prisma/dev.db`
4. No additional setup required

#### Option 2: MSSQL (Recommended for Production)
For production or enterprise deployments, migrate to MSSQL:
1. **Local Testing**: Use Docker Compose (see `MSSQL_MIGRATION_GUIDE.md`)
2. **Cloud Deployment**: Azure SQL Database or AWS RDS
3. **Migration Steps**: Detailed in `MSSQL_MIGRATION_GUIDE.md`
4. **Benefits**: Better performance, scalability, enterprise features

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

### MSSQL Migration
To migrate to MSSQL, follow the comprehensive guide: `MSSQL_MIGRATION_GUIDE.md`

Quick start:
```bash
# Start MSSQL with Docker
docker-compose up -d

# Update .env with MSSQL connection string
# Run Prisma migrations
npx prisma migrate dev --name init_mssql

# Start the app
npm run dev
```

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
