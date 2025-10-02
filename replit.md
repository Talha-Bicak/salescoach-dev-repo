# Azure OpenAI Realtime Chat Application

## Overview
This is a real-time voice chat application using Azure OpenAI's Realtime API. The application enables voice conversations with AI, with features including:
- Real-time voice input and output
- Visual voice activity indicators
- Camera integration support
- Performance evaluation capabilities
- Customizable AI voice and personality settings

## Project Architecture
- **Frontend Framework**: Vite + TypeScript
- **Main Entry Point**: `src/main.ts`
- **Audio Processing**: Custom audio worklet processors for recording and playback
- **Azure OpenAI Integration**: Uses `@azure/openai` SDK and custom rt-client for real-time streaming

## Recent Changes (October 2, 2025)
- Configured for Replit environment
- Set up Vite config to bind to 0.0.0.0:5000 with proper HMR settings
- Created .gitignore for Node.js project
- Configured deployment with autoscale target
- Added workflow to run dev server on port 5000

## Key Files
- `src/main.ts` - Main application logic and UI handling
- `src/recorder.ts` - Audio recording using Web Audio API
- `src/player.ts` - Audio playback handling
- `public/audio-worklet-processor.js` - Audio processing worklet
- `index.html` - Main application UI

## Development
- Run `npm install` to install dependencies
- Run `npm run dev` to start development server on port 5000
- The app requires Azure OpenAI credentials (endpoint, API key, deployment name)

## Deployment
- Build: `npm run build`
- Preview: `vite preview --host 0.0.0.0 --port 5000`
- Deployment target: autoscale (stateless web app)

## User Requirements
Users will need to provide:
1. Azure OpenAI endpoint URL
2. Azure OpenAI API key
3. Deployment/Model name for realtime service
4. (Optional) Azure OpenAI credentials for evaluation feature
