// Shared, client-safe types for AI generation and chat.

export type StartupBlueprintInput = {
  idea: string;
  problem: string;
  customers: string[];
  country: string;
  budget: number;
  experience: string;
  timeline: string;
  advantage: string;
};

export type StartupBlueprint = {
  startupName: string;
  tagline: string;
  elevatorPitch: string;
  problemStatement: string;
  solution: string;
  targetAudience: string;
  customerPersona: string;
  marketOpportunity: string;
  competitorAnalysis: string;
  uniqueSellingProposition?: string;
  swotAnalysis: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
  };
  businessModel: string;
  revenueModel: string;
  pricingSuggestions: string;
  estimatedStartupCost?: string;
  brandingStrategy: string;
  brandIdentity?: string;
  logoConcept?: string;
  colorPalette?: string[];
  marketingStrategy: string;
  launchRoadmap: string;
  financialEstimate: string;
  risks: string[];
  growthOpportunities?: string[];
  investorPitchSummary?: string;
  recommendations: string[];
  nextSteps: string[];
};

export type ChatTurn = { role: "user" | "ai"; text: string };
