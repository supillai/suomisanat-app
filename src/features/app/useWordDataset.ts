import { useEffect, useReducer } from "react";
import { loadWordDataset } from "../../data/word-data";
import type { VocabularyWord } from "../../types";

type WordDatasetState =
  | {
      status: "loading";
      words: null;
      error: null;
      requestId: number;
    }
  | {
      status: "ready";
      words: VocabularyWord[];
      error: null;
      requestId: number;
    }
  | {
      status: "error";
      words: null;
      error: string;
      requestId: number;
    };

type WordDatasetAction =
  | { type: "reload" }
  | { type: "loaded"; words: VocabularyWord[] }
  | { type: "failed"; error: string };

type WordDatasetResult = WordDatasetState & {
  reload: () => void;
};

const initialState: WordDatasetState = {
  status: "loading",
  words: null,
  error: null,
  requestId: 0
};

const wordDatasetReducer = (state: WordDatasetState, action: WordDatasetAction): WordDatasetState => {
  switch (action.type) {
    case "reload":
      return {
        status: "loading",
        words: null,
        error: null,
        requestId: state.requestId + 1
      };
    case "loaded":
      return {
        status: "ready",
        words: action.words,
        error: null,
        requestId: state.requestId
      };
    case "failed":
      return {
        status: "error",
        words: null,
        error: action.error,
        requestId: state.requestId
      };
    default:
      return state;
  }
};

export const useWordDataset = (): WordDatasetResult => {
  const [state, dispatch] = useReducer(wordDatasetReducer, initialState);

  useEffect(() => {
    const controller = new AbortController();

    void loadWordDataset(controller.signal)
      .then((words) => {
        dispatch({ type: "loaded", words });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;

        dispatch({
          type: "failed",
          error: error instanceof Error ? error.message : "Failed to load the vocabulary dataset."
        });
      });

    return () => controller.abort();
  }, [state.requestId]);

  return {
    ...state,
    reload: () => dispatch({ type: "reload" })
  };
};
