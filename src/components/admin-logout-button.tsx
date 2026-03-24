import { adminLogout } from "@/app/actions/admin-logout";
import { buttonClasses } from "@/lib/ui/button-variants";

type AdminLogoutButtonProps = {
  className?: string;
};

export default function AdminLogoutButton({ className }: AdminLogoutButtonProps) {
  return (
    <form action={adminLogout}>
      <button
        type="submit"
        className={
          className ??
          buttonClasses({
            variant: "outline",
            size: "md",
            className: "px-3",
          })
        }
      >
        Çıkış Yap
      </button>
    </form>
  );
}
