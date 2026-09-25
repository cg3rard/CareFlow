import { useFlow } from "../context/FlowContext";
import logo from "../assets/Logo_careflow.png";

const navItems = [
  { id: 1, label: "Daily Mood Triage" },
  { id: 2, label: "Flow Studio" },
  { id: 3, label: "Mood Garden" },
  { id: "community", label: "Community" },
];
const moodStyles = {
  Happy: {
    icon: "sentiment_very_satisfied",
    className: "bg-primary-container text-on-primary-container",
  },
  Angry: {
    icon: "sentiment_very_dissatisfied",
    className: "bg-error-container text-on-error-container",
  },
  Sleepy: {
    icon: "bedtime",
    className: "bg-inverse-surface text-inverse-on-surface",
  },
  Bored: {
    icon: "sentiment_neutral",
    className: "bg-tertiary-container text-on-tertiary-container",
  },
};

export default function Navbar() {
  const {
    step,
    navigateTo,
    activeSound,
    toggleSoundscape,
    selectedMood,
    resetFlow,
    authUser,
    startLogin,
    logout,
    openPsychologistFlow,
  } = useFlow();
  const displayName = authUser?.name || "Guest";
  const initials = displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const moodStyle = moodStyles[selectedMood] || moodStyles.Happy;
  const role = authUser?.role;
  const isStaff = role === "admin" || role === "psychologist";
  const workspaceLabel =
    role === "admin"
      ? "Admin Panel"
      : role === "psychologist"
        ? "Psychologist Panel"
        : "";
  const goHome = () =>
    isStaff
      ? navigateTo(role === "admin" ? "admin" : "psychologist")
      : resetFlow();

  return (
    <header className="apple-header fixed inset-x-0 top-0 z-50 bg-background/95 shadow-[0_1px_8px_rgba(0,0,0,0.06)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-12">
        <div className="flex min-w-0 items-center gap-3 xl:gap-6">
          <button
            type="button"
            onClick={goHome}
            className="flex shrink-0 items-center gap-2.5"
            title={isStaff ? workspaceLabel : "Back to triage"}
          >
            <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-transparent p-0 shadow-none">
              <img
                src={logo}
                alt="Careflow"
                className="h-full w-full object-contain"
              />
            </span>
            <span className="hidden text-lg font-bold tracking-tight text-on-surface sm:inline">
              Careflow
            </span>
          </button>
          {isStaff ? (
            <>
              <button
                type="button"
                onClick={() => navigateTo(role === "admin" ? "admin" : "psychologist")}
                className="hidden rounded-full bg-tertiary-container px-4 py-1.5 text-xs font-bold text-on-tertiary-container transition-colors hover:bg-tertiary-container/80 sm:inline"
              >
                {workspaceLabel}
              </button>
              {role === "admin" && (
                <button
                  type="button"
                  onClick={() => navigateTo("community")}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${step === "community" ? "bg-error-container text-on-error-container" : "bg-surface-container text-on-surface hover:bg-surface-container-high"}`}
                >
                  <span className="material-symbols-outlined text-[16px]">forum</span>
                  Community tools
                </button>
              )}
            </>
          ) : (
            <nav
              className="hidden items-center rounded-full border border-surface-container bg-surface-container-low p-1 xl:flex"
              aria-label="Main navigation"
            >
              {navItems.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => navigateTo(item.id)}
                  className={`rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${step === item.id ? "bg-primary-container text-on-primary-container shadow-xs" : "text-on-surface-variant hover:text-on-surface"}`}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!isStaff &&
            (authUser?.psychologistId ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-container px-3 py-2 text-[11px] font-bold text-on-primary-container shadow-[0_2px_0_#121214]">
                <span className="material-symbols-outlined text-[17px]">
                  lock
                </span>
                {authUser.shareDataWithPsychologist
                  ? "Shared your data with consultant"
                  : "Consultant locked · Chat only"}
              </span>
            ) : (
              <button
                type="button"
                onClick={openPsychologistFlow}
                className="inline-flex items-center gap-1.5 rounded-full bg-tertiary px-3 py-2 text-[11px] font-bold text-on-tertiary shadow-[0_3px_0_#121214] transition-transform hover:-translate-y-0.5 active:translate-y-0"
                title="Need help from a psychologist?"
              >
                <span className="material-symbols-outlined text-[17px]">
                  psychology
                </span>
                <span>Need Psychologist Help?</span>
              </button>
            ))}

          {!isStaff && (
            <div
              className={`hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold shadow-[0_2px_0_#121214] lg:flex ${moodStyle.className}`}
            >
              <span className="material-symbols-outlined text-[17px]">
                {moodStyle.icon}
              </span>
              <span>{selectedMood}</span>
            </div>
          )}
          {authUser ? (
            <button
              type="button"
              onClick={logout}
              title="Log out of account"
              className="flex items-center gap-2 rounded-full border border-surface-container bg-surface-container-lowest p-1 pr-2.5 shadow-[0_2px_0_#121214]"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-on-primary">
                {initials}
              </span>
              <span className="hidden max-w-24 truncate text-xs font-bold text-on-surface lg:inline">
                {displayName}
              </span>
              <span className="material-symbols-outlined text-[16px] text-on-surface-variant">
                logout
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={startLogin}
              className="rounded-full bg-primary px-3 py-2 text-xs font-bold text-on-primary shadow-[0_2px_0_#121214]"
            >
              Sign in
            </button>
          )}
        </div>
      </div>
      {!isStaff && (
        <nav
          className="flex h-11 items-center gap-1 overflow-x-auto border-t border-surface-container/70 px-3 pb-2 xl:hidden"
          aria-label="Page navigation"
        >
          {navItems.map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => navigateTo(item.id)}
              className={`whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-bold ${step === item.id ? "bg-primary-container text-on-primary-container" : "text-on-surface-variant"}`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      )}
    </header>
  );
}
