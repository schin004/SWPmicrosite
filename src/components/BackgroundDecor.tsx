export default function BackgroundDecor() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
      {/* Radial gradient bg */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50/60 via-white to-purple-50/40" />

      {/* Floating blurred circles */}
      <div
        className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-30 animate-float-slow"
        style={{ background: 'radial-gradient(circle, #93C5FD 0%, transparent 70%)' }}
      />
      <div
        className="absolute top-1/4 -right-24 w-80 h-80 rounded-full opacity-20 animate-float"
        style={{ background: 'radial-gradient(circle, #C4B5FD 0%, transparent 70%)', animationDelay: '2s' }}
      />
      <div
        className="absolute bottom-1/3 left-1/4 w-64 h-64 rounded-full opacity-20 animate-float-slow"
        style={{ background: 'radial-gradient(circle, #99F6E4 0%, transparent 70%)', animationDelay: '4s' }}
      />
      <div
        className="absolute -bottom-20 -right-20 w-72 h-72 rounded-full opacity-20 animate-float"
        style={{ background: 'radial-gradient(circle, #FDE68A 0%, transparent 70%)', animationDelay: '1s' }}
      />
    </div>
  );
}
