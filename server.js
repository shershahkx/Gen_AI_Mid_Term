require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { GoogleGenAI } = require("@google/genai"); 

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.use(express.static(path.resolve(__dirname)));

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("error: GEMINI_API_KEY not found. Please create a .env file.");
  process.exit(1);
}
const genAI = new GoogleGenAI(apiKey);

const prompt = `
You are an AI Code Reviewer. Review the given code snippet and provide concise feedback under these three categories:

1. **Readability** – Comment briefly on naming, formatting, and comment clarity.
2. **Best Practices** – Point out key issues such as unsafe access, hard-coded values, or missing encapsulation.
3. **Optimization** – Suggest small improvements for performance or simplicity.

Each section should include only the most relevant 1–3 points. Keep it short and clear — no long explanations or repetition.
Return your answer in this format:

### Readability
- Issue: ...
- Suggestion: ...

### Best Practices
- Issue: ...
- Suggestion: ...

### Optimization
- Issue: ...
- Suggestion: ...
`;

app.post("/review", async (req, res) => {
  try {
    const userCode = String(req.body.code || "").trim();
    if (!userCode) return res.status(400).json({ error: "No code provided" });

    const payloadText = `${prompt}\n${userCode}`;

    const result = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [{ text: payloadText }],
        },
      ],
    });
    async function extractText(resp) {
      if (!resp) return null;
      if (resp.response) {
        const t = resp.response.text;
        if (typeof t === "function") return await resp.response.text();
        if (typeof t === "string") return t;
      }
      if (resp.candidates?.length) {
        const p = resp.candidates[0]?.content?.parts?.[0]?.text;
        if (typeof p === "string") return p;
      }
      if (resp.output?.[0]?.content?.[0]?.text) {
        return resp.output[0].content[0].text;
      }
      if (typeof resp.text === "string") return resp.text;
      if (typeof resp === "string") return resp;
      return null;
    }

    const feedback = (await extractText(result)) ?? JSON.stringify(result, null, 2);

    return res.json({ review: feedback });
  } catch (err) {
    console.error("Error in /review endpoint:", err);
    return res.status(500).json({ error: "AI review failed", details: String(err) });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`AI Code Reviewer backend listening on http://localhost:${PORT}`));
