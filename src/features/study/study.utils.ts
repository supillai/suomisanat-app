import type { VocabularyWord } from "../../types";
import { isPhraseLikeWord } from "../app/learningScope";

const verbExampleOverrides: Record<string, string> = {
  "heräsin": "Esimerkki: Minä heräsin aikaisin.",
  menin: "Esimerkki: Minä menin kauppaan.",
  tulin: "Esimerkki: Minä tulin kotiin.",
  tapasin: "Esimerkki: Minä tapasin ystävän.",
  "söin": "Esimerkki: Minä söin aamupalaa.",
  "kävin": "Esimerkki: Minä kävin kirjastossa.",
  palasin: "Esimerkki: Minä palasin kotiin."
};

export const studyExample = (word: VocabularyWord): string => {
  if (isPhraseLikeWord(word)) {
    return `Esimerkki: Voit sanoa: "${word.fi}"`;
  }

  if (word.pos === "verb") {
    if (word.fi === "olla") {
      return "Esimerkki: Minä haluan olla ajoissa.";
    }

    const override = verbExampleOverrides[word.fi];
    if (override) {
      return override;
    }

    return `Esimerkki: Minä yritän ${word.fi} tänään.`;
  }

  if (word.pos === "noun") {
    return `Esimerkki: Tämä on ${word.fi}.`;
  }

  if (word.pos === "adjective") {
    return `Esimerkki: Tämä tehtävä on ${word.fi}.`;
  }

  if (word.pos === "adverb") {
    return `Esimerkki: Hän puhuu ${word.fi}.`;
  }

  if (word.pos === "pronoun") {
    return `Esimerkki: Sana "${word.fi}" auttaa keskustelussa.`;
  }

  return `Esimerkki: Käytän sanaa "${word.fi}" arjessa.`;
};

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeStudyText = (value: string): string => value.trim().toLocaleLowerCase("fi-FI");

const maskedSimpleExplanation = (word: VocabularyWord): string => {
  if (!word.fiSimple.trim()) return "";
  if (normalizeStudyText(word.fiSimple) === normalizeStudyText(word.fi)) return "";

  const escapedWord = escapeRegExp(word.fi);
  if (!escapedWord) return word.fiSimple;

  const masked = word.fiSimple.replace(new RegExp(escapedWord, "giu"), "____");
  return masked.trim() === "____" ? "" : masked;
};

export const buildStudyHints = (word: VocabularyWord): string[] => {
  const hints: string[] = [];
  const maskedExplanation = maskedSimpleExplanation(word);

  if (maskedExplanation.trim()) {
    hints.push(`Easy Finnish clue: ${maskedExplanation}`);
  }

  if (word.enSimple.trim()) {
    hints.push(`English clue: ${word.enSimple}`);
  }

  return hints;
};