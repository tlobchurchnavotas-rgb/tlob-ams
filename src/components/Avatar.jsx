// ─── AVATAR ───────────────────────────────────────────────────────────────────
function Avatar({ member, size = 32, style: extraStyle = {} }) {
  if (member?.photo) return <img src={member.photo} alt={member.name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0, ...extraStyle }} />;
  const colors = ["linear-gradient(135deg,#6366f1,#06b6d4)", "linear-gradient(135deg,#10b981,#06b6d4)", "linear-gradient(135deg,#f59e0b,#ef4444)", "linear-gradient(135deg,#8b5cf6,#ec4899)"];
  const ci = (member?.name || "?").charCodeAt(0) % colors.length;
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: colors[ci], display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.38, fontWeight: 700, color: "white", flexShrink: 0, ...extraStyle }}>
      {(member?.name || "?")[0]}
    </div>
  );
}

export default Avatar;
