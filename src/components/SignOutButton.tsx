import { signOut } from "@/app/login/actions";
import { Button } from "./ui";

export function SignOutButton() {
  return (
    <form action={signOut}>
      <Button variant="secondary" type="submit">
        ออกจากระบบ
      </Button>
    </form>
  );
}
