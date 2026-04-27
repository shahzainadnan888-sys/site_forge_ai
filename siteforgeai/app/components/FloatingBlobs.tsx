export function FloatingBlobs() {
  return (
    <div
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      aria-hidden
    >
      <div
        className="sf-blob-1 absolute -left-[20%] top-[-10%] h-[min(50vw,480px)] w-[min(50vw,480px)] rounded-full blur-3xl"
        style={{ background: "var(--sf-blob-1)" }}
      />
      <div
        className="sf-blob-2 absolute right-[-15%] top-[20%] h-[min(45vw,420px)] w-[min(45vw,420px)] rounded-full blur-3xl"
        style={{ background: "var(--sf-blob-2)" }}
      />
      <div
        className="sf-blob-3 absolute bottom-[-5%] left-[30%] h-[min(40vw,380px)] w-[min(40vw,380px)] rounded-full blur-3xl"
        style={{ background: "var(--sf-blob-3)" }}
      />
      <div
        className="absolute inset-0 opacity-[0.35] dark:opacity-25"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, var(--sf-border) 1px, transparent 0)",
          backgroundSize: "32px 32px",
        }}
      />
    </div>
  );
}
