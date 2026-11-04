type TransferRecordIdentifier = {
  id?: number | string | null;
  transfer_id?: number | string | null;
};

export function getTransferRecordKey(record: TransferRecordIdentifier): string {
  if (
    record.transfer_id !== null &&
    record.transfer_id !== undefined &&
    String(record.transfer_id).trim()
  ) {
    return `transfer:${record.transfer_id}`;
  }
  return `record:${record.id ?? ""}`;
}

export function dedupeTransferRecords<T extends TransferRecordIdentifier>(
  records: T[],
): T[] {
  const seenIds = new Set<string>();
  return records.filter((transfer) => {
    const ids = [
      transfer.transfer_id !== null &&
      transfer.transfer_id !== undefined &&
      String(transfer.transfer_id).trim()
        ? `transfer:${transfer.transfer_id}`
        : null,
      transfer.id !== null &&
      transfer.id !== undefined &&
      String(transfer.id).trim()
        ? `record:${transfer.id}`
        : null,
    ].filter((id): id is string => Boolean(id));
    if (ids.some((id) => seenIds.has(id))) return false;
    ids.forEach((id) => seenIds.add(id));
    return true;
  });
}
