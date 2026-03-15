export const randomFrom = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

export const shuffle = <T,>(list: T[]): T[] => {
  const shuffled = [...list];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
};
