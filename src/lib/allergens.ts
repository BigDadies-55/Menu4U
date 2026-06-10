export const ALLERGEN_LIST = [
  { key: "GLUTEN",      label: "גלוטן" },
  { key: "MILK",        label: "חלב" },
  { key: "EGGS",        label: "ביצים" },
  { key: "FISH",        label: "דגים" },
  { key: "PEANUTS",     label: "בוטנים" },
  { key: "SOYBEANS",    label: "סויה" },
  { key: "NUTS",        label: "אגוזים" },
  { key: "SESAME",      label: "שומשום" },
  { key: "CRUSTACEANS", label: "סרטנים" },
  { key: "MOLLUSCS",    label: "רכיכות" },
  { key: "CELERY",      label: "סלרי" },
  { key: "MUSTARD",     label: "חרדל" },
  { key: "SULPHITES",   label: "גופרית" },
  { key: "LUPIN",       label: "לופין" },
] as const;

export type AllergenKey = (typeof ALLERGEN_LIST)[number]["key"];
