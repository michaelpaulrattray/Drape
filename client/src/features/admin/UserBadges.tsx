import { CheckCircle, ShieldOff, Lock, Snowflake, Crown, Shield, User } from "lucide-react";

export const StatusBadge = ({ status }: { status: "active" | "suspended" | "locked" | "frozen" }) => {
  const styles = {
    active: "bg-emerald-50 text-emerald-700 border-emerald-200",
    suspended: "bg-red-50 text-red-700 border-red-200",
    frozen: "bg-cyan-50 text-cyan-700 border-cyan-200",
    locked: "bg-amber-50 text-amber-700 border-amber-200",
  };
  const icons = {
    active: <CheckCircle className="w-3 h-3" />,
    suspended: <ShieldOff className="w-3 h-3" />,
    frozen: <Snowflake className="w-3 h-3" />,
    locked: <Lock className="w-3 h-3" />,
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border ${styles[status]}`}>
      {icons[status]}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

export const RoleBadge = ({ role }: { role: "user" | "admin" | "moderator" }) => {
  if (role === "admin") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border bg-purple-50 text-purple-700 border-purple-200">
        <Crown className="w-3 h-3" />
        Admin
      </span>
    );
  }
  if (role === "moderator") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border bg-blue-50 text-blue-700 border-blue-200">
        <Shield className="w-3 h-3" />
        Moderator
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border bg-gray-100 text-[#666] border-gray-200">
      <User className="w-3 h-3" />
      User
    </span>
  );
};

export const getUserStatus = (user: {
  suspendedAt: string | Date | null;
  frozenAt?: string | Date | null;
  lockedUntil: string | Date | null;
}): "active" | "suspended" | "frozen" | "locked" => {
  if (user.suspendedAt) return "suspended";
  if (user.frozenAt) return "frozen";
  if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) return "locked";
  return "active";
};

export const formatDate = (dateStr: string | Date) => {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};
