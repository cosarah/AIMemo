# AIMemo

## Project Architecture

This is an AI-powered learning application with a React 19 frontend and Django backend that allows users to learn through interactive cards and chat with AI.

### Frontend Structure (aied-frontend/)
- **React 19 + TypeScript + Vite 6** - Modern React setup with latest features
- **Package Manager**: pnpm (required)
- **State Management**: Zustand for global state
- **Routing**: React Router v7 with lazy loading
- **Styling**: SCSS with BEM naming convention
- **UI Components**: Custom components in `/src/components/`
- **AI Chat Integration**: React-markdown with KaTeX for math rendering

### Backend Structure (aied-backend/)
- **Django 4.1.3** with SQLite database
- **CORS enabled** for frontend communication
- **Main Apps**: 
  - `cards/` - Core learning card functionality
  - `utils/` - AI chat utilities and JWT auth
- **AI Integration**: OpenAI-compatible API via SiliconFlow

## Key Features Architecture

### Learning System
- **Cards**: Learning content stored as markdown with math support
- **Questions**: Multiple types (choice, short_answer, code) with AI analysis
- **Chat**: Context-aware AI assistant using card content
- **Progress Tracking**: User progress through CardRecord and AnswerRecord models

### Data Models (aied-backend/cards/models.py)
- `Card` - Learning content with UUID primary keys
- `Question` - Associated questions with different types
- `ChatRecord` - AI conversation history
- `AnswerRecord` - User answers with AI analysis
- `User` - Custom user model with learning state

## Development Commands

### Frontend (aied-frontend/)
```bash
# Development
pnpm dev              # Start dev server
pnpm dev:test         # Start with test environment
pnpm dev:pro          # Start with production environment

# Building
pnpm build:dev        # Build for development
pnpm build:test       # Build for test
pnpm build:pro        # Build for production

# Code Quality
pnpm typecheck        # TypeScript type checking
pnpm lint:eslint      # ESLint with auto-fix
pnpm lint:style       # Stylelint with auto-fix
pnpm lint:format      # Prettier formatting
pnpm lint:all         # Run all linting tools

# Dependencies
pnpm deps:check       # Check outdated packages
pnpm deps:update      # Update to latest versions
```

### Backend (aied-backend/)
```bash
# Development
python manage.py runserver

# Database
python manage.py makemigrations
python manage.py migrate

# Testing
python manage.py test
```

## Key Patterns and Conventions

### Frontend Patterns
- **File Naming**: kebab-case for files and folders
- **Component Structure**: Each component in own folder with index.tsx and index.scss
- **State Management**: Zustand stores in `/src/store/modules/`
- **API Integration**: Centralized in `/src/services/` with axios
- **Routing**: Lazy-loaded routes with guards in `/src/router/`

### Backend Patterns
- **Views**: Function-based views with `@csrf_exempt` decorators
- **Authentication**: JWT tokens via `utils/utils_jwt.py`
- **AI Integration**: Centralized in `utils/chat.py` with DeepSeek-V3 model
- **Error Handling**: JSON responses with proper HTTP status codes

### API Integration
- Frontend communicates with backend via `BACKEND_URL` constant
- Key endpoints:
  - `/chat` - AI conversation with cards
  - `/card` - Card navigation (first, next, prev)
  - `/question` - Question navigation and submission

## Important Notes

### Security Considerations
- API key is currently hardcoded in `utils/chat.py` (should be moved to environment variables)
- CORS is set to allow all origins (should be restricted in production)
- JWT implementation exists but needs proper integration

### Code Quality
- Frontend uses comprehensive linting setup (ESLint, Prettier, Stylelint)
- Pre-commit hooks with Husky and lint-staged
- TypeScript strict mode enabled

### Development Environment
- Node.js ^18.0.0 || ^20.0.0 || >=22.0.0
- pnpm >=9 (enforced via preinstall hook)
- Python 3.x for Django backend

### Frontend Dependencies
- Math rendering: KaTeX with react-markdown
- State management: Zustand + Immer
- Utilities: es-toolkit, dayjs, ahooks
- HTTP client: axios

This codebase follows modern React and Django patterns with a focus on AI-powered learning experiences. The frontend uses React 19 features while maintaining compatibility, and the backend provides a robust API for learning content management and AI integration.