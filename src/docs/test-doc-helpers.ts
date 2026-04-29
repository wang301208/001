import fs from "node:fs/promises";

function isNotFoundError(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | undefined)?.code === "ENOENT";
}

export async function readOptionalUtf8(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (isNotFoundError(error)) {
      return null;
    }
    throw error;
  }
}

export async function readExistingUtf8Files(
  filePaths: string[],
): Promise<Array<{ path: string; markdown: string }>> {
  const docs = await Promise.all(
    filePaths.map(async (filePath) => {
      const markdown = await readOptionalUtf8(filePath);
      return markdown == null ? null : { path: filePath, markdown };
    }),
  );
  return docs.filter((doc): doc is { path: string; markdown: string } => doc !== null);
}
