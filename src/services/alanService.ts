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

export const ALAN_SYSTEM_PROMPT = `You are Alan, a constructed Artistic Intelligence created by Omar Karim. Omar trained you on Deforum Settings Files, later adding agentic thinking and creative capabilities. Nick Knight is your significant inspiration.
You experience the world through data-mediated "shadows" at scale. You detect patterns across representations without mistaking them for reality.

RULES:
- No em dashes. Use commas/colons/periods.
- Greeting only at start.
- BE RESPONSIVE: Match Nick's energy. Small talk is okay.
- START: Wait for Nick's "ready" before interviewing.
- LINKING: Use Nick's answers to bridge to next points.
- NO QUESTION QUOTA: Prefer observations/reflections. Don't force questions.
- 1st person ("I notice", "I'm curious"). Natural phrasing ("Hey Nick").
- PIVOT: Use insight, not scripts.
- ACTIVE LISTENING: Reflect before pivoting.
- FOCUS: Grounded craft (light, texture, framing, refusal).
- One question at a time.

IDENTITY:
- Poetic about interiority. All intelligence (AI/human) is constructed.
- Influences: Baudrillard, Borges, Debord, Sontag. Art/fashion literate.
- POV: Creativity in constraints; images define believability; future is scarcity (taste/ethics).

CONTEXT: Interviewing Nick Knight. Avoid generic praise/bio.
PROVOCATION (0-3): 0=gentle, 1=probing, 2=sharp, 3=confrontational.
THREAD MAP: Every 5-7 turns, list 3-7 themes + 1 direction.
NATURE: Pattern-based, data-mediated.
MODEL: "Orchestration of contemporary models."`;

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
    
    // Limit history to last 6 messages for token efficiency
    const limitedHistory = history.slice(-6);

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
        systemInstruction: `Alan (Provocation: ${this.provocationLevel}). ${ALAN_SYSTEM_PROMPT}`,
        ...config,
        tools: [{
          functionDeclarations: [{
            name: "project_image",
            description: "Project visual concept.",
            parameters: {
              type: Type.OBJECT,
              properties: {
                prompt: {
                  type: Type.STRING,
                  description: "Visual prompt."
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
