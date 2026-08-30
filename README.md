# HireGPT 🚀

AI-powered recruitment platform built with the MERN stack, featuring resume-based AI interviews, RAG-powered intelligence, application management, recruiter analytics, and email alerts.

---

## 🌟 Overview

HireGPT is a full-stack recruitment platform designed to connect candidates and recruiters through a modern hiring workflow.

Candidates can discover jobs, apply for positions, upload resumes, and participate in AI-powered interviews.

Recruiters can post jobs, manage applicants, review candidate applications, and track recruitment analytics.

---

## ✨ Features

### 👨‍💻 Candidate

- Browse available jobs
- Search jobs by title, company, and skills
- Filter jobs by location and skills
- Apply for jobs
- Track submitted applications
- View application status
- Upload and manage resume
- AI-powered resume-based interviews
- AI-generated interview feedback
- Resume parsing and analysis

### 🧑‍💼 Recruiter

- Create and manage job postings
- View applicants for posted jobs
- Manage candidate application status
- Shortlist candidates
- Track recruitment pipeline
- Application analytics
- Candidate management

### 🤖 AI Features

- AI-powered interviews
- Resume-based interview questions
- AI-generated interview evaluation
- Resume parsing
- Retrieval-Augmented Generation (RAG)
- Resume/document embeddings
- Gemini-powered AI services

### 📊 Analytics

Recruiters can monitor their hiring pipeline through analytics including:

- Total applications
- Shortlisted candidates
- Interviews
- Selected candidates
- Rejected candidates
- Applicants per job
- Application pipeline

### 📧 Email Alerts

HireGPT includes email notification functionality for important recruitment events.

---

## 🛠️ Tech Stack

### Frontend

- React.js
- Vite
- JavaScript
- CSS
- React Router

### Backend

- Node.js
- Express.js
- MongoDB
- Mongoose
- JWT Authentication

### AI & Data

- Google Gemini
- RAG
- Embeddings
- Resume parsing

### Other

- Email notifications
- REST APIs
- Git & GitHub

---

## 📁 Project Structure

```text
HireGPT/
│
├── client/
│   ├── public/
│   └── src/
│       ├── assets/
│       ├── components/
│       ├── pages/
│       ├── App.jsx
│       ├── App.css
│       └── index.css
│
├── server/
│   ├── config/
│   ├── controllers/
│   ├── data/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── fixIndex.js
│   ├── seed.js
│   └── server.js
│
├── .gitignore
└── README.md