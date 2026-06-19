// Paste your Gemini API key below.
// Keep in mind this is a frontend-only hackathon project, so the key will be visible in the browser.
const GEMINI_API_KEY="AQ.Ab8RN6KF1XfheBo6stRPimrzjfj_cn08tceI40xxsVlBQzzE8g";
const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-3.5-flash", "gemini-2.5-flash-lite"];

const resumeInput = document.getElementById("resumeInput");
const analyzeBtn = document.getElementById("analyzeBtn");
const statusText = document.getElementById("statusText");
const resultsSection = document.getElementById("resultsSection");
const atsScore = document.getElementById("atsScore");
const strengthsList = document.getElementById("strengthsList");
const weaknessesList = document.getElementById("weaknessesList");
const missingSkillsList = document.getElementById("missingSkillsList");
const suggestionsText = document.getElementById("suggestionsText");

function showStatus(message) {
  statusText.textContent = message;
}

function setLoadingState(isLoading) {
  analyzeBtn.disabled = isLoading;
  analyzeBtn.textContent = isLoading ? "Analyzing..." : "Analyze Resume";
}

function clearLists() {
  strengthsList.innerHTML = "";
  weaknessesList.innerHTML = "";
  missingSkillsList.innerHTML = "";
}

function fillList(listElement, items, emptyText) {
  listElement.innerHTML = "";

  if (!items || items.length === 0) {
    const li = document.createElement("li");
    li.textContent = emptyText;
    listElement.appendChild(li);
    return;
  }

  items.forEach(function (item) {
    const li = document.createElement("li");
    li.textContent = item;
    listElement.appendChild(li);
  });
}

function cleanJsonText(text) {
  let cleanText = text.trim();

  if (cleanText.startsWith("```")) {
    cleanText = cleanText.replace(/^```[a-zA-Z]*\s*/, "");
    cleanText = cleanText.replace(/```$/, "");
  }

  return cleanText.trim();
}

function validateData(data) {
  if (!data || typeof data !== "object") {
    return false;
  }

  if (typeof data.atsScore !== "number") {
    return false;
  }

  if (!Array.isArray(data.strengths)) {
    return false;
  }

  if (!Array.isArray(data.weaknesses)) {
    return false;
  }

  if (!Array.isArray(data.missingSkills)) {
    return false;
  }

  if (typeof data.suggestions !== "string") {
    return false;
  }

  return true;
}

async function analyzeResume() {
  const resumeText = resumeInput.value.trim();

  if (!resumeText) {
    showStatus("Please paste your resume before analyzing.");
    return;
  }

  if (GEMINI_API_KEY === "PASTE_YOUR_GEMINI_API_KEY_HERE") {
    showStatus("Please add your Gemini API key in script.js first.");
    return;
  }

  setLoadingState(true);
  showStatus("Analyzing resume with Gemini...");
  clearLists();
  suggestionsText.textContent = "Loading AI feedback...";

  const prompt = `You are a resume reviewer for college students.
Review the resume text and return ONLY valid JSON in this exact format:
{
  "atsScore": 85,
  "strengths": ["item1", "item2"],
  "weaknesses": ["item1", "item2"],
  "missingSkills": ["item1", "item2"],
  "suggestions": "text"
}
Rules:
- atsScore must be a number from 0 to 100
- strengths, weaknesses and missingSkills must be short arrays of strings
- suggestions must be a clear paragraph or two
- Do not add markdown, code fences or extra text

Resume text:
${resumeText}`;

  async function callGemini(modelName) {
    let response = null;

    for (let attempt = 0; attempt < 2; attempt++) {
      response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/" +
          modelName +
          ":generateContent?key=" +
          GEMINI_API_KEY,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: prompt,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.4,
              responseMimeType: "application/json",
            },
          }),
        }
      );

      if (response.ok) {
        return response;
      }

      if (response.status !== 503 && response.status !== 429) {
        return response;
      }

      if (attempt === 0) {
        await new Promise(function (resolve) {
          setTimeout(resolve, 700);
        });
      }
    }

    return response;
  }

  try {
    let response = null;

    for (let i = 0; i < GEMINI_MODELS.length; i++) {
      response = await callGemini(GEMINI_MODELS[i]);

      if (response.ok) {
        break;
      }

      if (response.status === 503 && i < GEMINI_MODELS.length - 1) {
        continue;
      }

      if (response.status !== 404 || i === GEMINI_MODELS.length - 1) {
        throw new Error("Gemini API request failed with status " + response.status + ".");
      }
    }

    if (!response.ok) {
      throw new Error("Gemini API request failed.");
    }

    const data = await response.json();

    if (!data.candidates || !data.candidates.length) {
      throw new Error("No response received from Gemini.");
    }

    const parts = data.candidates[0].content && data.candidates[0].content.parts;

    if (!parts || !parts.length || !parts[0].text) {
      throw new Error("Invalid Gemini response format.");
    }

    const rawText = cleanJsonText(parts[0].text);
    const result = JSON.parse(rawText);

    if (!validateData(result)) {
      throw new Error("Gemini returned invalid JSON.");
    }

    atsScore.textContent = Math.max(0, Math.min(100, result.atsScore));
    fillList(strengthsList, result.strengths, "No strengths found.");
    fillList(weaknessesList, result.weaknesses, "No weaknesses found.");
    fillList(missingSkillsList, result.missingSkills, "No missing skills found.");
    suggestionsText.textContent = result.suggestions;
    showStatus("Analysis complete.");
    resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    console.error(error);
    atsScore.textContent = "--";
    clearLists();
    suggestionsText.textContent = "Your detailed AI feedback will show here after analysis.";
    showStatus("Something went wrong while analyzing the resume. Please try again.");
  } finally {
    setLoadingState(false);
  }
}

analyzeBtn.addEventListener("click", analyzeResume);