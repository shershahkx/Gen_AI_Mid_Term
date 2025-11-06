require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.use(cors());
app.use(bodyParser.json());

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("Error: GEMINI_API_KEY not found. Please create a .env file.");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

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
    const userCode = req.body.code || "";

    const result = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `${prompt}\n\nHere is the code:\n${userCode}`,
            },
          ],
        },
      ],
    });

    console.log("Raw API result for debugging:");
    console.dir(result, { depth: null });

    let feedback;
    if (result?.response) {
      feedback =
        typeof result.response.text === "function"
          ? await result.response.text()
          : result.response.text;
    } else if (result?.candidates?.[0]?.content?.parts?.[0]?.text) {
      feedback = result.candidates[0].content.parts[0].text;
    } else if (result?.output?.[0]?.content?.[0]?.text) {
      feedback = result.output[0].content[0].text;
    } else {
      feedback = JSON.stringify(result, null, 2);
    }

    res.json({ review: feedback });
  } catch (error) {
    console.error("Error while reviewing code:", error);
    res.status(500).json({ error: "Failed to analyze code.", details: String(error) });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
