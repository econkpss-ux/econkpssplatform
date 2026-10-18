type ProfileColumnError = {
  code?: string;
  message?: string;
};

export function isMissingDeletionPendingColumn(error: ProfileColumnError) {
  return (
    (error.code === "42703" || error.code === "PGRST204") &&
    error.message.toLowerCase().includes("deletion_pending")
  );
}

export function warnDeletionMigrationMissing() {
  console.warn(
    "The account-deletion database migration is not applied yet; using the existing membership profile fields.",
  );
}
