import type { VocabularyWord } from "../../types";

const verbExampleOverrides: Record<string, string> = {
  "her\u00e4sin": "Esimerkki: Min\u00e4 her\u00e4sin aikaisin.",
  menin: "Esimerkki: Min\u00e4 menin kauppaan.",
  tulin: "Esimerkki: Min\u00e4 tulin kotiin.",
  tapasin: "Esimerkki: Min\u00e4 tapasin yst\u00e4v\u00e4n.",
  "s\u00f6in": "Esimerkki: Min\u00e4 s\u00f6in aamupalaa.",
  "k\u00e4vin": "Esimerkki: Min\u00e4 k\u00e4vin kirjastossa.",
  palasin: "Esimerkki: Min\u00e4 palasin kotiin."
};

export const studyExample = (word: VocabularyWord): string => {
  if (word.pos === "verb") {
    if (word.fi === "olla") {
      return "Esimerkki: Min\u00e4 haluan olla ajoissa.";
    }

    const override = verbExampleOverrides[word.fi];
    if (override) {
      return override;
    }

    return `Esimerkki: Min\u00e4 yrit\u00e4n ${word.fi} t\u00e4n\u00e4\u00e4n.`;
  }

  if (word.pos === "noun") {
    return `Esimerkki: T\u00e4m\u00e4 on ${word.fi}.`;
  }

  if (word.pos === "adjective") {
    return `Esimerkki: T\u00e4m\u00e4 teht\u00e4v\u00e4 on ${word.fi}.`;
  }

  if (word.pos === "adverb") {
    return `Esimerkki: H\u00e4n puhuu ${word.fi}.`;
  }

  if (word.pos === "pronoun") {
    return `Esimerkki: Sana "${word.fi}" auttaa keskustelussa.`;
  }

  return `Esimerkki: K\u00e4yt\u00e4n sanaa "${word.fi}" arjessa.`;
};

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const maskedSimpleExplanation = (word: VocabularyWord): string => {
  if (!word.fiSimple.trim()) return "";

  const escapedWord = escapeRegExp(word.fi);
  if (!escapedWord) return word.fiSimple;

  return word.fiSimple.replace(new RegExp(escapedWord, "giu"), "____");
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
