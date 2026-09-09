import prisma from "./prismaClient";

export const resolveGenderName = async (
  value: unknown
): Promise<string | null> => {
  if (typeof value === "string" && value.trim() !== "") {
    const trimmed = value.trim();
    const gender = await prisma.gender.findFirst({
      where: { OR: [{ id: Number(trimmed) || -1 }, { name: trimmed }] },
    });
    return gender?.name ?? null;
  }

  if (value && typeof value === "object") {
    const g = value as { id?: unknown; name?: unknown };
    const id = typeof g.id === "number" ? g.id : Number(g.id);
    const name = typeof g.name === "string" ? g.name : "";
    const gender = await prisma.gender.findFirst({
      where: { OR: [{ id: id || -1 }, { name }] },
    });
    return gender?.name ?? null;
  }

  return null;
};
