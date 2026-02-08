import { CheckCircle, ShieldOff, Lock, Snowflake, Crown, Shield, User } from "lucide-react";

export const StatusBadge = ({ status }: { status: "active" | "suspended" | "locked" | "frozen" }) => {
  const styles = {
    active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    suspended: "bg-red-500/10 text-red-400 border-red-500/20",
    frozen: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    locked: "bg-amber-500/10 text-amber-400 border-amber-500/20",
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
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border bg-purple-500/10 text-purple-400 border-purple-500/20">
        <Crown className="w-3 h-3" />
        Admin
      </span>
    );
  }
  if (role === "moderator") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border bg-blue-500/10 text-blue-400 border-blue-500/20">
        <Shield className="w-3 h-3" />
        Moderator
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border bg-gray-500/10 text-gray-400 border-gray-500/20">
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
