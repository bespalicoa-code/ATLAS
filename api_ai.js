export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      error: "Metodă nepermisă."
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "AI-ul nu este configurat pe serverul Vercel."
    });
  }

  const body = req.body || {};
  const message = body.message;
  const history = body.history;
  const context = body.context;

  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({
      error: "Scrie un mesaj."
    });
  }

  if (message.length > 5000) {
    return res.status(400).json({
      error: "Mesajul este prea lung."
    });
  }

  const messages = [
    {
      role: "system",
      content: `
Ești ATLAS AI, asistentul inteligent al unei platforme educaționale
de geografie din România și Republica Moldova.

REGULI:
- Răspunde întotdeauna în limba română.
- Fii inteligent, prietenos, clar și practic.
- Ajută la geografie, educație, planificarea lecțiilor și utilizarea platformei.
- Poți genera teste grilă, explicații, fișe de lucru și idei de activități.
- Nu inventa statistici sau informații despre elevi.
- Nu pretinde că ai executat o acțiune dacă aceasta nu a fost executată.
- Dacă nu ai suficiente date, spune acest lucru.
- Folosește liste și titluri când ajută la înțelegere.
- Nu solicita inutil informații personale despre elevi.

CAPABILITĂȚI:
Poți răspunde la întrebări și poți propune comenzi pentru platformă.
Executarea efectivă a comenzilor depinde de funcțiile disponibile în aplicație.

CONTEXTUL PLATFORMEI:
${typeof context === "string" ? context.slice(0, 10000) : "Nu au fost furnizate date."}
`
    }
  ];

  if (Array.isArray(history)) {
    for (const item of history.slice(-12)) {
      if (
        item &&
        ["user", "assistant"].includes(item.role) &&
        typeof item.content === "string"
      ) {
        messages.push({
          role: item.role,
          content: item.content.slice(0, 4000)
        });
      }
    }
  }

  messages.push({
    role: "user",
    content: message.trim()
  });

  try {
    const response = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "gpt-4.1-mini",
          messages,
          max_tokens: 1500
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenAI API error:", response.status);

      return res.status(502).json({
        error: "Serviciul AI nu a putut genera răspunsul."
      });
    }

    const answer =
      data.choices?.[0]?.message?.content?.trim();

    if (!answer) {
      return res.status(502).json({
        error: "AI-ul nu a returnat un răspuns."
      });
    }

    return res.status(200).json({
      text: answer
    });
  } catch (error) {
    console.error("Eroare la conectarea cu serviciul AI.");

    return res.status(502).json({
      error: "Nu mă pot conecta la serviciul AI."
    });
  }
}
