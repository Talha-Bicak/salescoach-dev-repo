import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { getCustomerSystemPrompt } from './customer-profile';

const app = express();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set. This is required for secure authentication.');
  process.exit(1);
}

app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(cookieParser());

interface AuthRequest extends express.Request {
  userId?: string;
  userRole?: string;
}

const authMiddleware = (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
  const token = req.cookies.token || req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; role: string };
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const teamLeadMiddleware = (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
  if (req.userRole !== 'TEAM_LEAD') {
    return res.status(403).json({ error: 'Forbidden: Team Lead access required' });
  }
  next();
};

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name, role } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: role || 'IKCO'
      }
    });

    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET);
    res.cookie('token', token, { httpOnly: true });
    
    res.json({ 
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      token 
    });
  } catch (error) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET);
    res.cookie('token', token, { httpOnly: true });
    
    res.json({ 
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      token 
    });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
});

app.get('/api/auth/me', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, email: true, name: true, role: true }
    });
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

app.post('/api/sessions/start', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const session = await prisma.session.create({
      data: {
        userId: req.userId!,
        customerProfile: 'default'
      }
    });

    const systemPrompt = getCustomerSystemPrompt();
    
    res.json({ session, systemPrompt });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create session' });
  }
});

app.post('/api/sessions/:sessionId/end', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { sessionId } = req.params;
    
    const session = await prisma.session.findUnique({
      where: { id: sessionId }
    });

    if (!session || session.userId !== req.userId) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const updatedSession = await prisma.session.update({
      where: { id: sessionId },
      data: { endedAt: new Date() }
    });

    res.json({ session: updatedSession });
  } catch (error) {
    res.status(500).json({ error: 'Failed to end session' });
  }
});

app.post('/api/sessions/:sessionId/transcript', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { sessionId } = req.params;
    const { speaker, text } = req.body;

    const session = await prisma.session.findUnique({
      where: { id: sessionId }
    });

    if (!session || session.userId !== req.userId) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const transcript = await prisma.transcript.create({
      data: {
        sessionId,
        speaker,
        text
      }
    });

    res.json({ transcript });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save transcript' });
  }
});

app.post('/api/sessions/:sessionId/evaluation', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { sessionId } = req.params;
    const { result, score } = req.body;

    const session = await prisma.session.findUnique({
      where: { id: sessionId }
    });

    if (!session || session.userId !== req.userId) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const evaluation = await prisma.evaluation.create({
      data: {
        sessionId,
        userId: req.userId!,
        result,
        score: score ? parseFloat(score) : null
      }
    });

    res.json({ evaluation });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save evaluation' });
  }
});

app.get('/api/sessions', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const sessions = await prisma.session.findMany({
      where: { userId: req.userId },
      include: {
        transcripts: true,
        evaluations: true
      },
      orderBy: { startedAt: 'desc' }
    });

    res.json({ sessions });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get sessions' });
  }
});

app.get('/api/sessions/:sessionId', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { sessionId } = req.params;
    
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        transcripts: { orderBy: { timestamp: 'asc' } },
        evaluations: true,
        user: { select: { id: true, name: true, email: true } }
      }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.userId !== req.userId && req.userRole !== 'TEAM_LEAD') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    res.json({ session });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get session' });
  }
});

app.get('/api/team-lead/overview', authMiddleware, teamLeadMiddleware, async (req: AuthRequest, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { role: 'IKCO' },
      include: {
        sessions: {
          include: {
            evaluations: true
          }
        },
        _count: {
          select: {
            sessions: true,
            evaluations: true
          }
        }
      }
    });

    const overview = users.map(user => {
      const totalSessions = user._count.sessions;
      const totalEvaluations = user._count.evaluations;
      const avgScore = user.sessions
        .flatMap(s => s.evaluations)
        .reduce((acc, e) => {
          if (e.score) {
            acc.sum += e.score;
            acc.count += 1;
          }
          return acc;
        }, { sum: 0, count: 0 });

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        totalSessions,
        totalEvaluations,
        averageScore: avgScore.count > 0 ? avgScore.sum / avgScore.count : null
      };
    });

    res.json({ overview });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get overview' });
  }
});

app.get('/api/team-lead/sessions', authMiddleware, teamLeadMiddleware, async (req: AuthRequest, res) => {
  try {
    const sessions = await prisma.session.findMany({
      include: {
        user: { select: { id: true, name: true, email: true } },
        transcripts: true,
        evaluations: true
      },
      orderBy: { startedAt: 'desc' }
    });

    res.json({ sessions });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get all sessions' });
  }
});

app.get('/api/customer-prompt', authMiddleware, (req, res) => {
  const systemPrompt = getCustomerSystemPrompt();
  res.json({ systemPrompt });
});

const PORT = process.env.BACKEND_PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
