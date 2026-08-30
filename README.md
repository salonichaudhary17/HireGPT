# HireGPT 🤖

An AI-powered recruitment platform built with the MERN stack and Generative AI.

HireGPT connects recruiters and candidates through job management, resume analysis, AI-powered interviews, application tracking, and recruitment analytics.

## 🚀 Features

### 👨‍💼 Recruiter
- Post, edit, and delete jobs
- View applicants for each job
- Track application statuses
- Application analytics and charts
- Candidate pipeline tracking
- Email alerts

### 👩‍💻 Candidate
- Browse available jobs
- Apply for jobs
- Track applications
- Upload resumes
- Resume analysis
- AI-powered interviews
- Interview feedback

### 🤖 AI Features
- Resume analysis using Generative AI
- AI-powered interview generation
- AI interview evaluation
- Resume-based AI interactions
- Retrieval-Augmented Generation (RAG)

## 🛠️ Tech Stack

### Frontend
- React
- React Router
- Vite
- CSS

### Backend
- Node.js
- Express.js
- MongoDB
- Mongoose
- JWT Authentication

### AI
- Google Gemini
- Generative AI
- RAG
- Embeddings

### Other
- Nodemailer
- Multer
- PDF parsing
- Docker
- Docker Compose

## 🏗️ Project Structure

```text
HireGPT/
├── client/
│   ├── src/
│   │   ├── components/
│   │   └── pages/
│   ├── Dockerfile
│   └── package.json
│
├── server/
│   ├── controllers/
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── middleware/
│   ├── Dockerfile
│   └── package.json
│
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md