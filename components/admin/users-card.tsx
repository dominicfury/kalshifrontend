import { listUsers } from "@/lib/users";

import { UsersTable } from "./users-table";

export async function UsersCard() {
  const users = await listUsers();
  return <UsersTable initial={users} />;
}
