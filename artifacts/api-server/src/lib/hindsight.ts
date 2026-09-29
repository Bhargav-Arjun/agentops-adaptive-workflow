const DEFAULT_BASE_URL = "https://api.hindsight.vectorize.io";
const DEFAULT_BANK_ID = "agentops-demo";

export type HindsightMemory = {
  id?: string | null;
  text?: string;
  type?: string | null;
  context?: string | null;
  occurred_at?: string | null;
  metadata?: Record<string, unknown>;
  date?: string | null;
  mentioned_at?: string | null;
  fact_type?: string | null;
};

type HindsightRecallResponse = {
  results?: HindsightMemory[];
};

type HindsightListResponse = {
  items?: HindsightMemory[];
  total?: number;
};

const baseUrl = (process.env.HINDSIGHT_BASE_URL ?? DEFAULT_BASE_URL).replace(
  /\/$/,
  "",
);
export const hindsightBankId =
  process.env.HINDSIGHT_BANK_ID ?? DEFAULT_BANK_ID;

let bankReady: Promise<void> | undefined;

function requireApiKey() {
  const apiKey = process.env.HINDSIGHT_API_KEY;
  if (!apiKey) {
    throw new Error(
      "HINDSIGHT_API_KEY is not configured. Add it to the project secrets.",
    );
  }
  return apiKey;
}

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<{ data: T; response: Response }> {
  const apiKey = requireApiKey();
  const response = await fetch(
    `${baseUrl}/v1/default/banks/${encodeURIComponent(hindsightBankId)}${path}`,
    {
      ...init,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    },
  );

  const raw = await response.text();
  let data: unknown = {};
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = { detail: raw };
    }
  }

  if (!response.ok) {
    const detail =
      typeof data === "object" &&
      data !== null &&
      "detail" in data &&
      typeof data.detail === "string"
        ? data.detail
        : `Hindsight returned HTTP ${response.status}: ${JSON.stringify(data)}`;
    throw new Error(detail);
  }

  return { data: data as T, response };
}

async function ensureBank() {
  if (!bankReady) {
    bankReady = request("", {
      method: "PUT",
      body: JSON.stringify({
        name: "AgentOps",
        mission:
          "Remember operational workflow outcomes so failed automation can recover safely.",
      }),
    })
      .then(() => undefined)
      .catch((error: unknown) => {
        bankReady = undefined;
        throw error;
      });
  }
  return bankReady;
}

export async function recallExperience(query: string) {
  await ensureBank();
  const { data } = await request<HindsightRecallResponse>("/memories/recall", {
    method: "POST",
    body: JSON.stringify({
      query,
      budget: "mid",
      max_tokens: 4096,
    }),
  });
  return data.results ?? [];
}

export async function retainExperience(content: string, metadata: object) {
  await ensureBank();
  await request("/memories", {
    method: "POST",
    body: JSON.stringify({
      async: false,
      items: [
        {
          content,
          context: "AgentOps adaptive workflow recovery",
          metadata,
        },
      ],
    }),
  });
}

export async function listExperiences() {
  await ensureBank();
  const { data } = await request<HindsightListResponse>(
    "/memories/list?limit=100",
    { method: "GET" },
  );
  return data.items ?? [];
}

export async function hindsightHealth() {
  if (!process.env.HINDSIGHT_API_KEY) {
    return {
      configured: false,
      status: "missing_credentials",
      bank_id: hindsightBankId,
    };
  }

  try {
    await ensureBank();
    return { configured: true, status: "connected", bank_id: hindsightBankId };
  } catch (error) {
    return {
      configured: true,
      status: "unavailable",
      bank_id: hindsightBankId,
      error: error instanceof Error ? error.message : "Unknown Hindsight error",
    };
  }
}