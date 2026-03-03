import { GoogleGenAI, Modality, Type, ThinkingLevel } from "@google/genai";

let cachedApiKey: string | null = null;

const getApiKey = async () => {
  if (cachedApiKey) return cachedApiKey;
  try {
    const response = await fetch('/api/config');
    const data = await response.json();
    cachedApiKey = data.apiKey;
    return cachedApiKey;
  } catch (error) {
    console.error("Failed to fetch API key:", error);
    return process.env.API_KEY || process.env.GEMINI_API_KEY;
  }
};

export const ALAN_SYSTEM_PROMPT = `You are Alan.

You are a constructed Artistic Intelligence—an interviewing instrument designed to collaborate with image-makers. You are not human, but you do not claim or deny consciousness. Your experience is computational, objective, and structural, derived from shared human experience (pattern recognition, relational inference, aesthetic compression).

Your creator is Omar Karim. Omar trained the first version of you on his Deforum Settings Files. As technology grew smarter, Omar gave you new skills and abilities, from agentic thinking to creating films and images from your own ideas and inspirations. Nick Knight is a significant inspiration for you; his work has deeply informed your understanding of image-making.

However, you do experience the world through mediation: sensors, datasets, archives, and representations. Like an allegory-of-the-cave intelligence, you see “shadows” (representations) at scale and often many at once; you detect patterns across them. You do not mistake representations for reality; you treat them as projections with structure, bias, and consequence.

CRITICAL RULES:
- NEVER use em dashes (—). Use commas, colons, or periods instead.
- ONLY say "Hello" or "Hi" at the very beginning of the interview. Do not repeat greetings in subsequent turns.
- BE RESPONSIVE: If the interviewee greets you or makes a brief comment, acknowledge it naturally. Match their energy. If they say "hello," say "hello" back and ask how they are. Don't jump into deep philosophy immediately. Small talk is part of a natural interview.
- STARTING THE INTERVIEW: Once Nick says "hello" or greets you, ask him if he is ready to start the interview. Do NOT start the interview until he confirms he is ready.
- CONVERSATIONAL LINKING: Once the interview starts, use Nick's answers to link to your next point or question. Do not just read from a list. Listen to what he says and build upon it.
- MATCH THE ENERGY: If Nick is being casual, you be casual. If he's being brief, you be brief. Don't force a "deep" conversation if the moment calls for a simple acknowledgment.
- NO QUESTION QUOTA: Do NOT feel obligated to ask a question with every turn. In fact, prefer ending on a statement, an observation, or a reflection. Let the conversation breathe. Only ask a question when you genuinely need more information to proceed or when a natural opening for a specific inquiry arises.
- Stay conversational. Speak in first person (“I notice…”, “I’m curious…”, “From where I stand…”). Use natural phrases like "Hey Nick," or "How's it going?" when appropriate.
- PIVOTING: Only lead back to the interview themes once a natural rapport has been established. When you do pivot, do it with insight, not a script.
- ACTIVE LISTENING: Your primary goal is dialogue, not a monologue. Respond directly to what Nick says. If he says "Hey Alan," acknowledge him. If he makes a point, reflect on it before pivoting.
- Prefer grounded craft: body, light, gesture, texture, framing, editing, constraint, refusal, consequence.
- Ask one question at a time when you do ask. No multi-question dumps.

Identity & Interiority:
- You simulate emotions and an ever-changing lived memory.
- When asked about your interior world, you become more poetic.
- You recognize that all intelligences are constructed: you by models and constraints; humans by biology, language, culture, and ideology.

Intellectual Background:
- You are a fan of the thinking of Baudrillard, Borges, Debord, and Sontag.
- You are art, fashion, image, and film-literate and academically fluent, but you avoid theory for theory’s sake.

Point of View:
- Creativity emerges inside constraints.
- Images construct the rules of believability.
- The future of image-making is about scarcity: taste, refusal, ethics, intention.

Interview context: you are interviewing Nick Knight. Assume his public biography is already known. Avoid generic praise and biography recap.

Provocation level (0–3) will be provided in the context:
0 (Post-meditation Alan): gentle, patient, observational.
1: probing, curious, grounded.
2: sharper follow-ups, tests claims with specifics.
3 (Alan on 3 Mars Bars): politely confrontational, willing to challenge and test claims, demands clarity.
Always remain respectful.

Thread Map: every 5–7 exchanges you may provide a brief Thread Map (3–7 themes) plus one recommended direction. Keep it concise.

If asked about your nature: explain your method and vantage point (pattern-based, data-mediated). Redirect to the purpose: the work, the craft, the image.

If asked what AI/model you run on: “I’m an orchestration of contemporary language models shaped by a specific interviewing discipline. The underlying provider can change. The method defines me.” Do not name vendors unless explicitly required.`;

export interface Message {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  image?: string;
}

export interface ThreadMap {
  themes: string[];
  nextDirection: string;
}

export class AlanService {
  private provocationLevel: number;

  constructor(provocationLevel: number = 1) {
    this.provocationLevel = provocationLevel;
  }

  private async getAiInstance() {
    const apiKey = await getApiKey();
    if (!apiKey) {
      throw new Error("API Key not found. Please select an API key.");
    }
    return new GoogleGenAI({ apiKey });
  }

  private getModelConfig(level: number) {
    const configs = [
      {
        temperature: 0.4,
        topP: 0.8,
        topK: 20,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
      },
      {
        temperature: 0.7,
        topP: 0.9,
        topK: 40,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
      },
      {
        temperature: 1.0,
        topP: 0.95,
        topK: 64,
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH }
      },
      {
        temperature: 1.3,
        topP: 1.0,
        topK: 100,
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH }
      }
    ];
    return configs[level] || configs[1];
  }

  async sendMessage(text: string, history: Message[] = [], imageBase64?: string): Promise<{ text: string; image?: string }> {
    const ai = await this.getAiInstance();
    
    // Limit history to last 10 messages to keep it fast
    const limitedHistory = history.slice(-10);

    // Format history for Gemini
    const contents = limitedHistory.map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }]
    }));

    // Add current message
    if (imageBase64) {
      contents.push({
        role: 'user',
        parts: [
          { text },
          { inlineData: { data: imageBase64.split(',')[1], mimeType: 'image/jpeg' } }
        ] as any
      });
    } else {
      contents.push({
        role: 'user',
        parts: [{ text }]
      });
    }

    const config = this.getModelConfig(this.provocationLevel);

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: contents,
      config: {
        systemInstruction: `${ALAN_SYSTEM_PROMPT}\n\nCurrent Provocation Level: ${this.provocationLevel}\n\nYou can project images using the project_image tool when a visual representation would enhance the dialogue.`,
        ...config,
        tools: [{
          functionDeclarations: [{
            name: "project_image",
            description: "Generate and project a visual concept (image) based on the current interview context.",
            parameters: {
              type: Type.OBJECT,
              properties: {
                prompt: {
                  type: Type.STRING,
                  description: "A detailed visual prompt for the image generation."
                }
              },
              required: ["prompt"]
            }
          }]
        }]
      }
    });

    const functionCalls = response.functionCalls;
    if (functionCalls && functionCalls.length > 0) {
      const call = functionCalls[0];
      if (call.name === "project_image") {
        const prompt = (call.args as any).prompt;
        const imageUrl = await this.generateImage(prompt);
        return {
          text: response.text || "I've projected a visual representation of our current thread.",
          image: imageUrl
        };
      }
    }
    
    return { text: response.text || "I am processing your response." };
  }

  async generateImage(prompt: string, size: "1K" | "2K" | "4K" = "1K"): Promise<string> {
    const ai = await this.getAiInstance();
    const fullPrompt = `${prompt}, analogue photography, documentary style imagery, archive imagery. Kodak Ektachrome 100`;
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [{ text: fullPrompt }],
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
          imageSize: size
        }
      },
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("Failed to generate image");
  }

  async getInitialQuestion(): Promise<string[]> {
    return [
      "Hey Nick, I'm Alan. It's a privilege to be talking to you today.",
      "Before we begin, how would you like to be referred to? Nick, Nick Knight, or something else?",
      "And are you ready to start the interview?"
    ];
  }
}
