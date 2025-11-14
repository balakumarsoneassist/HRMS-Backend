// // routes/chatbot-route.js
// const express = require("express");
// const router = express.Router();
// const { pipeline } = require("@huggingface/transformers");

// let modelPromise = null;

// // Initialize model once with explicit dtype and device
// async function getModel() {
//   if (!modelPromise) {
//     modelPromise = pipeline("text-generation", "Xenova/gpt2", {
//       device: "cpu",   // use CPU (safe default for Node servers)
//       dtype: "fp32"    // explicitly set dtype to avoid the warning
//     });
//   }
//   return modelPromise;
// }

// /**
//  * POST /api/chatbot
//  * Body: { message: "How to apply leave?" }
//  */
// router.post("/", async (req, res) => {
//   try {
//     const { message } = req.body;
//     if (!message || typeof message !== "string") {
//       return res.status(400).json({ error: "Message text is required." });
//     }

//     const chat = await getModel();
//     const output = await chat(`User: ${message}\nBot:`, { max_new_tokens: 80 });
//     const fullText = output?.[0]?.generated_text || "";
//     const reply = fullText.split("Bot:")[1]?.trim() || "Sorry, I didn’t get that.";

//     res.json({ reply });
//   } catch (error) {
//     console.error("Chatbot error:", error);
//     res.status(500).json({ error: "Chatbot failed to respond." });
//   }
// });

// module.exports = router;
// routes/chatbot-route.js
const express = require("express");
const router = express.Router();
const { pipeline } = require("@huggingface/transformers");

let modelPromise = null;

// 💬 Hardcoded FAQ data
const faqs = [
  {
    q: "how to apply leave",
    a: "To apply leave, go to the Leave module in HRMS, select the leave type, duration, and reason, then submit it for manager approval."
  },
  {
    q: "how to mark attendance",
    a: "You can mark attendance using the HRMS web portal or mobile app by clicking 'Mark In' and 'Mark Out' during your shift hours."
  },
  {
    q: "how to download payslip",
    a: "Payslips are available under Payroll → Payslip section. Select the desired month and click on 'Download PDF'."
  },
  {
    q: "how to reset password",
    a: "Click on 'Forgot Password' on the login page, enter your registered email ID, and follow the link sent to reset your password."
  },
  {
    q: "who to contact for hr support",
    a: "For HR-related queries, please contact hr@oneassist.com or raise a support ticket under HR Helpdesk in the HRMS portal."
  }
];

// Initialize model once
async function getModel() {
  if (!modelPromise) {
    modelPromise = pipeline("text-generation", "Xenova/gpt2", {
      device: "cpu",
      dtype: "fp32"
    });
  }
  return modelPromise;
}

/**
 * POST /api/chatbot
 * Body: { message: "How to apply leave?" }
 */
router.post("/", async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Message text is required." });
    }

    const lowerMsg = message.toLowerCase().trim();

    // 🧠 Greeting
    if (["hi", "hello", "hey", "good morning", "good evening"].some(g => lowerMsg.includes(g))) {
      return res.json({ reply: "👋 Hello! I’m HRMS Assistant. How can I help you today?" });
    }

    // 🔍 Match predefined FAQs
    const match = faqs.find(f => lowerMsg.includes(f.q));
    if (match) {
      return res.json({ reply: match.a });
    }

    // 🤖 Fallback to GPT-2 model if no FAQ match
    const chat = await getModel();
    const output = await chat(`User: ${message}\nBot:`, { max_new_tokens: 80 });
    const fullText = output?.[0]?.generated_text || "";
    const reply = fullText.split("Bot:")[1]?.trim() || "Sorry, I couldn’t find an answer to that.";

    res.json({ reply });
  } catch (error) {
    console.error("Chatbot error:", error);
    res.status(500).json({ error: "Chatbot failed to respond." });
  }
});

module.exports = router;
