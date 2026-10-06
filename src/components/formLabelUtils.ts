export function toTitleCase(label: string): string {
  return label.replace(/\b[a-z][a-z'-]*/gi, (word) =>
    word[0].toUpperCase() + word.slice(1).toLowerCase(),
  );
}