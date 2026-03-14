export const randomFrom = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

export const shuffle = <T,>(list: T[]): T[] => [...list].sort(() => Math.random() - 0.5);
