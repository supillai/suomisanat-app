import { WORD_POS_OPTIONS, WORD_TOPICS } from "../types";
import type { VocabularyWord, WordPos, WordTopic } from "../types";

export const WORD_DATASET_VERSION = "v2";
export const WORD_DATASET_URL = `/data/words.${WORD_DATASET_VERSION}.json`;

const topicSet = new Set<WordTopic>(WORD_TOPICS);
const posSet = new Set<WordPos>(WORD_POS_OPTIONS);

const isNonEmptyString = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const parseWordDataset = (value: unknown): VocabularyWord[] => {
  if (!Array.isArray(value)) {
    throw new Error("Word dataset must be an array.");
  }

  if (value.length === 0) {
    throw new Error("Word dataset is empty.");
  }

  const words: VocabularyWord[] = [];
  const seenIds = new Set<number>();
  const seenFinnish = new Set<string>();

  value.forEach((entry, index) => {
    if (!isRecord(entry)) {
      throw new Error(`Word ${index + 1} is not an object.`);
    }

    const idValue = entry.id;
    if (typeof idValue !== "number" || !Number.isInteger(idValue) || idValue <= 0) {
      throw new Error(`Word ${index + 1} has an invalid id.`);
    }

    const id = idValue;

    if (seenIds.has(id)) {
      throw new Error(`Word dataset contains a duplicate id: ${id}.`);
    }

    const fi = entry.fi;
    const en = entry.en;
    const fiSimple = entry.fiSimple;
    const enSimple = entry.enSimple;
    const topic = entry.topic;
    const pos = entry.pos;

    if (!isNonEmptyString(fi) || !isNonEmptyString(en) || !isNonEmptyString(fiSimple) || !isNonEmptyString(enSimple)) {
      throw new Error(`Word ${id} is missing required text fields.`);
    }

    if (seenFinnish.has(fi)) {
      throw new Error(`Word dataset contains a duplicate Finnish entry: ${fi}.`);
    }

    if (typeof topic !== "string" || !topicSet.has(topic as WordTopic)) {
      throw new Error(`Word ${id} has an invalid topic.`);
    }

    if (typeof pos !== "string" || !posSet.has(pos as WordPos)) {
      throw new Error(`Word ${id} has an invalid part of speech.`);
    }

    seenIds.add(id);
    seenFinnish.add(fi);
    words.push({
      id,
      fi,
      en,
      fiSimple,
      enSimple,
      topic: topic as WordTopic,
      pos: pos as WordPos
    });
  });

  return words;
};

export const loadWordDataset = async (signal?: AbortSignal): Promise<VocabularyWord[]> => {
  const response = await fetch(WORD_DATASET_URL, {
    signal,
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to load word dataset (${response.status}).`);
  }

  return parseWordDataset(await response.json());
};
