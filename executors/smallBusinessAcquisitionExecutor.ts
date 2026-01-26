/**
 * Executor for Small Business Acquisition database - logs when a new page is created
 * @param payload - The webhook payload containing the page information
 * @returns True if successful, false otherwise
 */
export async function smallBusinessAcquisitionExecutor(
  payload: Record<string, unknown>,
): Promise<boolean> {
  try {
    const entity = payload.entity as { id: string; type: string } | undefined;
    const pageId = entity?.id;

    if (!pageId) {
      console.error(
        "[smallBusinessAcquisitionExecutor] No page ID found in payload",
      );
      return false;
    }

    console.log(
      "[smallBusinessAcquisitionExecutor] New page created in Small Business Acquisition database:",
      pageId,
    );
    console.log("[smallBusinessAcquisitionExecutor] Full payload:", JSON.stringify(payload, null, 2));

    return true;
  } catch (error) {
    console.error("[smallBusinessAcquisitionExecutor] Error processing:", error);
    return false;
  }
}
