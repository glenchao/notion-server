/**
 * Executor for Vancouver House 2 database - logs when a new page is created
 * @param payload - The webhook payload containing the page information
 * @returns True if successful, false otherwise
 */
export async function vancouverHouse2Executor(
  payload: Record<string, unknown>,
): Promise<boolean> {
  try {
    const entity = payload.entity as { id: string; type: string } | undefined;
    const pageId = entity?.id;

    if (!pageId) {
      console.error(
        "[vancouverHouse2Executor] No page ID found in payload",
      );
      return false;
    }

    console.log(
      "[vancouverHouse2Executor] New page created in Vancouver House 2 database:",
      pageId,
    );
    console.log("[vancouverHouse2Executor] Full payload:", JSON.stringify(payload, null, 2));

    return true;
  } catch (error) {
    console.error("[vancouverHouse2Executor] Error processing:", error);
    return false;
  }
}
