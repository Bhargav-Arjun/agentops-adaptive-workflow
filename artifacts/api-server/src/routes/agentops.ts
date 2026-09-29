import { randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";
import {
  ApproveHitlBody,
  GetMemoryLogsResponse,
  RunTaskBody,
} from "@workspace/api-zod";
import {
  hindsightBankId,
  hindsightHealth,
  listExperiences,
  recallExperience,
  retainExperience,
  type HindsightMemory,
} from "../lib/hindsight";

type TaskParameters = {
  records: number;
  batch_size: number | string;
};

type Experience = {
  task: string;
  parameters: TaskParameters;
  outcome: "SUCCESS" | "FAILURE";
  error: string | null;
  human_action: string | null;
  winning_recovery_fix: string | null;
  timestamp: string;
};

type PendingReview = {
  task: string;
  parameters: TaskParameters;
  previous_failure: Experience;
  recall: ReturnType<typeof buildRecallResult>;
};

const router: IRouter = Router();
const pendingReviews = new Map<string, PendingReview>();

function isSuccessfulBatch(batchSize: number | string) {
  return Number(batchSize) === 100;
}

function executeDataIngestion(parameters: TaskParameters) {
  if (isSuccessfulBatch(parameters.batch_size)) {
    return {
      status: "SUCCESS" as const,
      http_status: 200,
      message: "Task Completed Successfully",
      parameters,
      error: null,
    };
  }

  const error =
    parameters.batch_size === "full"
      ? "Database Timeout"
      : `Unsupported batch size: ${String(parameters.batch_size)}`;
  return {
    status: "FAILURE" as const,
    http_status: 504,
    message: "Data Ingestion Tool failed",
    parameters,
    error,
  };
}

function experienceText(
  task: string,
  parameters: TaskParameters,
  execution: ReturnType<typeof executeDataIngestion>,
  humanAction: string | null,
  recovery: TaskParameters | null,
) {
  return [
    "AgentOps workflow experience",
    `Task: ${task}`,
    "Tool: Data Ingestion Tool",
    `Attempted parameters: records=${parameters.records}, batch_size=${String(parameters.batch_size)}`,
    `Outcome: ${execution.status}`,
    `Error observed: ${execution.error ?? "none"}`,
    `Human action: ${humanAction ?? "none"}`,
    `Winning recovery fix: ${recovery ? `records=${recovery.records}, batch_size=${String(recovery.batch_size)}` : "none"}`,
    `Final outcome: ${execution.status}`,
    `Timestamp: ${new Date().toISOString()}`,
  ].join("\n");
}

function parseExperience(memory: HindsightMemory): Experience | null {
  const text = memory.text ?? "";
  const metadata = memory.metadata;
  if (
    metadata &&
    metadata.source === "agentops" &&
    typeof metadata.task === "string" &&
    typeof metadata.outcome === "string" &&
    typeof metadata.parameters === "string"
  ) {
    try {
      const parameters = JSON.parse(metadata.parameters) as TaskParameters;
      const outcome = metadata.outcome === "SUCCESS" ? "SUCCESS" : "FAILURE";
      return {
        task: metadata.task,
        parameters,
        outcome,
        error:
          outcome === "FAILURE"
            ? text.match(/database timeout|unsupported batch size[^.|]*/i)?.[0] ??
              "Data Ingestion Tool failed"
            : null,
        human_action:
          typeof metadata.human_action === "string" &&
          metadata.human_action.length > 0
            ? metadata.human_action
            : null,
        winning_recovery_fix:
          outcome === "SUCCESS"
            ? `records=${parameters.records}, batch_size=${String(parameters.batch_size)}`
            : null,
        timestamp:
          memory.mentioned_at ??
          memory.date ??
          new Date().toISOString(),
      };
    } catch {
      // Continue with the natural-language fact parser below.
    }
  }

  if (!text.includes("AgentOps") && !text.includes("Data Ingestion Tool")) {
    return null;
  }

  const naturalLanguageTask = text.match(
    /(?:successfully processed|failed to process|attempting to process)\s+([\d,]+)(?:\s+to\s+[\d,]+)?\s+customer records/i,
  );
  const naturalLanguageBatch = text.match(
    /batch size (?:of|was set to)\s+([a-z0-9]+)/i,
  );
  const naturalLanguageOutcome = /successfully processed/i.test(text)
    ? "SUCCESS"
    : /failed to process|database timeout|encountered a database timeout/i.test(
          text,
        )
      ? "FAILURE"
      : null;
  if (naturalLanguageTask && naturalLanguageOutcome) {
    const rawBatch = naturalLanguageBatch?.[1] ?? "full";
    const batchSize = Number.isFinite(Number(rawBatch))
      ? Number(rawBatch)
      : rawBatch;
    const records = Number(naturalLanguageTask[1].replaceAll(",", ""));
    return {
      task: "Process customer records",
      parameters: { records, batch_size: batchSize },
      outcome: naturalLanguageOutcome,
      error: naturalLanguageOutcome === "FAILURE" ? "Database Timeout" : null,
      human_action: null,
      winning_recovery_fix:
        naturalLanguageOutcome === "SUCCESS"
          ? `records=${records}, batch_size=${String(batchSize)}`
          : null,
      timestamp:
        memory.mentioned_at ?? memory.date ?? new Date().toISOString(),
    };
  }

  const task = text.match(/^Task:\s*(.+)$/m)?.[1]?.trim();
  const params = text.match(
    /^Attempted parameters:\s*records=(\d+),\s*batch_size=(.+)$/m,
  );
  const outcome = text.match(/^Outcome:\s*(SUCCESS|FAILURE)$/m)?.[1] as
    | "SUCCESS"
    | "FAILURE"
    | undefined;
  if (!task || !params || !outcome) return null;

  const recovery = text.match(
    /^Winning recovery fix:\s*records=(\d+),\s*batch_size=(.+)$/m,
  );
  return {
    task,
    parameters: {
      records: Number(params[1]),
      batch_size: params[2].trim(),
    },
    outcome,
    error: text.match(/^Error observed:\s*(.+)$/m)?.[1]?.trim() ?? null,
    human_action:
      text.match(/^Human action:\s*(.+)$/m)?.[1]?.trim() === "none"
        ? null
        : (text.match(/^Human action:\s*(.+)$/m)?.[1]?.trim() ?? null),
    winning_recovery_fix:
      recovery && recovery[2]
        ? `records=${recovery[1]}, batch_size=${recovery[2].trim()}`
        : null,
    timestamp:
      text.match(/^Timestamp:\s*(.+)$/m)?.[1]?.trim() ??
      memory.mentioned_at ??
      memory.date ??
      new Date().toISOString(),
  };
}

function buildRecallResult(query: string, memories: HindsightMemory[]) {
  return {
    found: memories.length > 0,
    query,
    memories: memories.slice(0, 8).map((memory) => ({
      id: memory.id ?? null,
      text: memory.text ?? "",
      type: memory.type ?? memory.fact_type ?? null,
      context: memory.context ?? null,
      occurred_at:
        memory.occurred_at ??
        memory.mentioned_at ??
        memory.date ??
        null,
    })),
  };
}

async function retainRun(
  task: string,
  parameters: TaskParameters,
  execution: ReturnType<typeof executeDataIngestion>,
  humanAction: string | null,
  recovery: TaskParameters | null,
) {
  await retainExperience(
    experienceText(task, parameters, execution, humanAction, recovery),
    {
      source: "agentops",
      task,
      outcome: execution.status,
      parameters: JSON.stringify(parameters),
      human_action: humanAction ?? "",
    },
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected server error";
}

router.post("/run-task", async (req, res) => {
  const parsed = RunTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { task, parameters } = parsed.data;
  const query = `${task}. Data ingestion recovery history for records=${parameters.records}, batch_size=${String(parameters.batch_size)}`;

  try {
    const memories = await recallExperience(query);
    const recall = buildRecallResult(query, memories);
    const experiences = memories
      .map(parseExperience)
      .filter((value): value is Experience => value !== null);
    const previousFailure = experiences.find(
      (experience) => experience.outcome === "FAILURE",
    );
    const previousSuccess = experiences.find(
      (experience) => experience.outcome === "SUCCESS",
    );

    if (previousFailure) {
      const reviewId = randomUUID();
      pendingReviews.set(reviewId, {
        task,
        parameters,
        previous_failure: previousFailure,
        recall,
      });
      res.json({
        status: "HITL_REQUIRED",
        review_id: reviewId,
        task,
        parameters,
        recall,
        previous_failure: {
          task: previousFailure.task,
          failed_parameters: previousFailure.parameters,
          error: previousFailure.error ?? "Unknown failure",
          winning_recovery_fix: previousFailure.winning_recovery_fix,
          recovery_parameters: previousSuccess?.parameters ?? null,
        },
        execution: null,
        retained: false,
      });
      return;
    }

    const executionParameters = previousSuccess?.parameters ?? parameters;
    const execution = executeDataIngestion(executionParameters);
    await retainRun(
      task,
      executionParameters,
      execution,
      previousSuccess ? "Reused previous successful configuration" : null,
      previousSuccess ? executionParameters : null,
    );

    const reviewId =
      execution.status === "FAILURE" ? randomUUID() : null;
    if (reviewId) {
      pendingReviews.set(reviewId, {
        task,
        parameters,
        previous_failure: {
          task,
          parameters: executionParameters,
          outcome: "FAILURE",
          error: execution.error,
          human_action: null,
          winning_recovery_fix: null,
          timestamp: new Date().toISOString(),
        },
        recall,
      });
    }

    res.json({
      status: execution.status === "SUCCESS" ? "SUCCESS" : "FAILURE",
      review_id: reviewId,
      task,
      parameters: executionParameters,
      recall,
      previous_failure:
        execution.status === "FAILURE"
          ? {
              task,
              failed_parameters: executionParameters,
              error: execution.error ?? "Unknown failure",
              winning_recovery_fix: null,
              recovery_parameters: null,
            }
          : null,
      execution,
      retained: true,
    });
  } catch (error) {
    req.log.error({ err: error }, "AgentOps run failed");
    res.status(502).json({ error: errorMessage(error) });
  }
});

router.post("/hitl-approve", async (req, res) => {
  const parsed = ApproveHitlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const pending = pendingReviews.get(parsed.data.review_id);
  if (!pending) {
    res.status(404).json({ error: "That human review is no longer pending." });
    return;
  }

  try {
    const execution = executeDataIngestion(parsed.data.parameters);
    await retainRun(
      pending.task,
      parsed.data.parameters,
      execution,
      parsed.data.human_action,
      execution.status === "SUCCESS" ? parsed.data.parameters : null,
    );
    pendingReviews.delete(parsed.data.review_id);

    res.json({
      status: execution.status,
      review_id: null,
      task: pending.task,
      parameters: parsed.data.parameters,
      recall: pending.recall,
      previous_failure: {
        task: pending.previous_failure.task,
        failed_parameters: pending.previous_failure.parameters,
        error: pending.previous_failure.error ?? "Unknown failure",
        winning_recovery_fix: null,
        recovery_parameters:
          execution.status === "SUCCESS" ? parsed.data.parameters : null,
      },
      execution,
      retained: true,
    });
  } catch (error) {
    req.log.error({ err: error }, "AgentOps HITL approval failed");
    res.status(502).json({ error: errorMessage(error) });
  }
});

router.get("/memory-logs", async (req, res) => {
  try {
    const memories = await listExperiences();
    const logs = memories
      .map((memory) => {
        const experience = parseExperience(memory);
        if (!experience) return null;
        return {
          id: memory.id ?? null,
          task: experience.task,
          outcome: experience.outcome,
          parameters: experience.parameters,
          error: experience.error,
          human_action: experience.human_action,
          timestamp: experience.timestamp,
          text: memory.text ?? "",
        };
      })
      .filter((value): value is NonNullable<typeof value> => value !== null);
    res.json(GetMemoryLogsResponse.parse({ bank_id: hindsightBankId, logs }));
  } catch (error) {
    req.log.error({ err: error }, "AgentOps memory log read failed");
    res.status(502).json({ error: errorMessage(error) });
  }
});

router.get("/health", async (_req, res) => {
  res.json(await hindsightHealth());
});

export default router;