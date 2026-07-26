export const safeConnect = (id: string | number | null | undefined) => {
  return id ? { connect: { id } } : undefined;
};
