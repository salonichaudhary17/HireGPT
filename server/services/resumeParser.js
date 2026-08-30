import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const model = genAI.getGenerativeModel({
  model: "gemini-2.0-flash",
});

export const parseResume = async (resumeText) => {
  const prompt = `
You are an AI resume parser.

Extract structured information from the resume below.

Return ONLY valid JSON in this format:

{
  "name": "",
  "email": "",
  "phone": "",
  "skills": [],
  "education": [],
  "experience": [],
  "projects": [],
  "certifications": []
}

Do not add markdown.
Do not add explanations.
If information is missing, use an empty string or empty array.

Resume:
${resumeText}
`;

  const result = await model.generateContent(prompt);

  const response = result.response.text();

  const cleaned = response
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  return JSON.parse(cleaned);
};